import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { AWSConfig, UploadRequest, APIResponse, ProcessingConfig } from '../types';
import { logger } from '../utils/logger';
import { retryWithBackoff, isRetryableError } from '../utils/retry';

export class VideoInputModule {
  private s3Client: S3Client;
  private config: AWSConfig;
  private processingConfig: ProcessingConfig;

  constructor(config: AWSConfig) {
    this.config = config;
    this.s3Client = new S3Client({
      region: config.region,
      credentials: config.credentials,
    });

    this.processingConfig = {
      maxVideoSizeMB: parseInt(process.env.MAX_VIDEO_SIZE_MB || '500'),
      processingTimeoutMinutes: parseInt(process.env.PROCESSING_TIMEOUT_MINUTES || '30'),
      novaModelId: process.env.NOVA_MODEL_ID || 'amazon.nova-pro-v1:0',
      pollyVoiceId: process.env.POLLY_VOICE_ID || 'Joanna',
      ffmpegConcurrency: parseInt(process.env.FFMPEG_CONCURRENCY || '3'),
    };
  }

  async uploadFile(request: UploadRequest): Promise<APIResponse<{
    jobId: string;
    s3Uri: string;
    uploadUrl?: string;
  }>> {
    try {
      const jobId = this.generateJobId();
      
      logger.info('Starting file upload', { jobId, hasFile: !!request.file, s3Uri: request.s3Uri });

      // Handle direct S3 URI input
      if (request.s3Uri) {
        const validation = await this.validateS3Uri(request.s3Uri);
        if (!validation.success) {
          return validation;
        }

        return {
          success: true,
          data: {
            jobId,
            s3Uri: request.s3Uri,
          },
          timestamp: new Date(),
        };
      }

      // Handle file upload
      if (!request.file) {
        return {
          success: false,
          error: {
            code: 'MISSING_FILE',
            message: 'Either file or s3Uri must be provided',
          },
          timestamp: new Date(),
        };
      }

      // Validate file
      const validation = this.validateFile(request.file);
      if (!validation.success) {
        return validation;
      }

      // Generate S3 key
      const s3Key = `videos/${jobId}/${Date.now()}-video.mp4`;
      const s3Uri = `s3://${this.config.inputBucket}/${s3Key}`;

      // Upload to S3 with retry logic
      const uploadResult = await retryWithBackoff(
        async () => {
          const command = new PutObjectCommand({
            Bucket: this.config.inputBucket,
            Key: s3Key,
            Body: request.file as Buffer,
            ContentType: this.detectContentType(request.file as Buffer),
            Metadata: {
              jobId,
              title: request.metadata?.title || '',
              description: request.metadata?.description || '',
              language: request.metadata?.language || 'en',
              uploadedAt: new Date().toISOString(),
            },
          });

          return await this.s3Client.send(command);
        },
        { maxRetries: 3 },
        'S3 upload'
      );

      logger.info('File uploaded successfully', { jobId, s3Uri, etag: uploadResult.ETag });

      return {
        success: true,
        data: {
          jobId,
          s3Uri,
        },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('File upload failed', { error, request: { hasFile: !!request.file, s3Uri: request.s3Uri } });

      return {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload file to S3',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  async validateS3Uri(s3Uri: string): Promise<APIResponse<{
    exists: boolean;
    size?: number;
    contentType?: string;
  }>> {
    try {
      // Parse S3 URI
      const s3UriRegex = /^s3:\/\/([^\/]+)\/(.+)$/;
      const match = s3Uri.match(s3UriRegex);
      
      if (!match) {
        return {
          success: false,
          error: {
            code: 'INVALID_S3_URI',
            message: 'Invalid S3 URI format. Expected: s3://bucket/key',
          },
          timestamp: new Date(),
        };
      }

      const [, bucket, key] = match;

      // Check if object exists
      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const result = await this.s3Client.send(command);

      // Validate file size
      if (result.ContentLength && result.ContentLength > this.processingConfig.maxVideoSizeMB * 1024 * 1024) {
        return {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File size exceeds maximum allowed size of ${this.processingConfig.maxVideoSizeMB}MB`,
          },
          timestamp: new Date(),
        };
      }

      return {
        success: true,
        data: {
          exists: true,
          size: result.ContentLength,
          contentType: result.ContentType,
        },
        timestamp: new Date(),
      };

    } catch (error: any) {
      if (error.name === 'NotFound') {
        return {
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: 'File not found in S3',
          },
          timestamp: new Date(),
        };
      }

      logger.error('S3 URI validation failed', { error, s3Uri });

      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Failed to validate S3 URI',
          details: error.message,
        },
        timestamp: new Date(),
      };
    }
  }

  private validateFile(file: File | Buffer): APIResponse<void> {
    const buffer = file instanceof Buffer ? file : Buffer.from(file.arrayBuffer() as ArrayBuffer);
    
    // Check file size
    if (buffer.length > this.processingConfig.maxVideoSizeMB * 1024 * 1024) {
      return {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds maximum allowed size of ${this.processingConfig.maxVideoSizeMB}MB`,
        },
        timestamp: new Date(),
      };
    }

    // Basic file format validation
    const contentType = this.detectContentType(buffer);
    if (!contentType.startsWith('video/')) {
      return {
        success: false,
        error: {
          code: 'INVALID_FILE_FORMAT',
          message: 'Only video files are supported',
        },
        timestamp: new Date(),
      };
    }

    return {
      success: true,
      timestamp: new Date(),
    };
  }

  private detectContentType(buffer: Buffer): string {
    // Simple magic number detection for common video formats
    const header = buffer.slice(0, 12);
    
    if (header.slice(4, 12).toString() === 'ftypmp42') {
      return 'video/mp4';
    }
    if (header.slice(0, 3).toString() === 'FLV') {
      return 'video/x-flv';
    }
    if (header.slice(0, 4).toString('hex') === '1a45dfa3') {
      return 'video/webm';
    }
    
    // Default to mp4 if unable to detect
    return 'video/mp4';
  }

  generateJobId(): string {
    return uuidv4();
  }

  async getSignedUploadUrl(fileName: string, contentType: string): Promise<APIResponse<{
    uploadUrl: string;
    s3Key: string;
    jobId: string;
  }>> {
    try {
      const jobId = this.generateJobId();
      const s3Key = `videos/${jobId}/${Date.now()}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: this.config.inputBucket,
        Key: s3Key,
        ContentType: contentType,
        Metadata: {
          jobId,
          uploadedAt: new Date().toISOString(),
        },
      });

      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 }); // 1 hour

      return {
        success: true,
        data: {
          uploadUrl,
          s3Key,
          jobId,
        },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to generate signed upload URL', { error, fileName, contentType });

      return {
        success: false,
        error: {
          code: 'SIGNED_URL_FAILED',
          message: 'Failed to generate signed upload URL',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }
}