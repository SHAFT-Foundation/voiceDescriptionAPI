import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
  AWSConfig, 
  APIResponse, 
  ImageUploadRequest, 
  UploadResult, 
  ValidationResult,
  ImageMetadata
} from '../types';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

export class ImageInputModule {
  private s3Client: S3Client;
  private config: AWSConfig;
  private maxImageSizeMB: number;
  private supportedFormats: Set<string>;

  constructor(config: AWSConfig) {
    this.config = config;
    this.maxImageSizeMB = parseInt(process.env.MAX_IMAGE_SIZE_MB || '50');
    this.supportedFormats = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
    
    this.s3Client = new S3Client({
      region: config.region,
      credentials: config.credentials,
    });
  }

  async uploadImage(request: ImageUploadRequest): Promise<APIResponse<UploadResult>> {
    try {
      logger.info('Starting image upload', { 
        hasFile: !!request.file, 
        s3Uri: request.s3Uri,
        jobId: request.jobId 
      });

      // If S3 URI is provided, validate it
      if (request.s3Uri) {
        const validationResult = await this.validateS3ImageUri(request.s3Uri);
        if (!validationResult.success) {
          return {
            success: false,
            error: validationResult.error,
            timestamp: new Date(),
          };
        }

        const { format, size } = validationResult.data!;
        
        return {
          success: true,
          data: {
            jobId: request.jobId,
            s3Uri: request.s3Uri,
            size: size || 0,
            format: format || '.jpg',
          },
          timestamp: new Date(),
        };
      }

      // Validate and upload file
      if (!request.file) {
        return {
          success: false,
          error: {
            code: 'NO_INPUT',
            message: 'No image file or S3 URI provided',
          },
          timestamp: new Date(),
        };
      }

      // Convert File to Buffer if necessary
      let buffer: Buffer;
      if (request.file instanceof Buffer) {
        buffer = request.file;
      } else if ('arrayBuffer' in request.file) {
        const arrayBuffer = await request.file.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else {
        return {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'Invalid file type provided',
          },
          timestamp: new Date(),
        };
      }

      // Validate image file
      const validationResult = this.validateImageFile(buffer);
      if (!validationResult.success) {
        return {
          success: false,
          error: validationResult.error,
          timestamp: new Date(),
        };
      }

      const { format } = validationResult.data!;

      // Generate S3 key
      const s3Key = `images/${request.jobId}/${uuidv4()}${format}`;
      const s3Uri = `s3://${this.config.inputBucket}/${s3Key}`;

      // Upload to S3
      const uploadResult = await this.uploadToS3(buffer, s3Key, format);
      if (!uploadResult.success) {
        return {
          success: false,
          error: uploadResult.error,
          timestamp: new Date(),
        };
      }

      logger.info('Image upload successful', { 
        jobId: request.jobId,
        s3Uri,
        size: buffer.length,
        format
      });

      return {
        success: true,
        data: {
          jobId: request.jobId,
          s3Uri,
          size: buffer.length,
          format,
        },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Image upload failed', { error, request });

      return {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: 'Failed to upload image',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  async validateS3ImageUri(s3Uri: string): Promise<APIResponse<ValidationResult>> {
    try {
      // Parse S3 URI
      const match = s3Uri.match(/^s3:\/\/([^\/]+)\/(.+)$/);
      if (!match) {
        return {
          success: false,
          error: {
            code: 'INVALID_S3_URI',
            message: 'Invalid S3 URI format',
          },
          timestamp: new Date(),
        };
      }

      const [, bucket, key] = match;

      // Head object to verify existence and get metadata
      const headCommand = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await retryWithBackoff(
        async () => await this.s3Client.send(headCommand),
        { maxRetries: 3, baseDelay: 1000 },
        'S3 HEAD Object'
      );

      const size = response.ContentLength || 0;
      const format = this.detectFormatFromKey(key);

      // Validate format
      if (!this.supportedFormats.has(format)) {
        return {
          success: false,
          error: {
            code: 'UNSUPPORTED_FORMAT',
            message: `Unsupported image format: ${format}`,
            details: `Supported formats: ${Array.from(this.supportedFormats).join(', ')}`,
          },
          timestamp: new Date(),
        };
      }

      // Validate size
      if (size > this.maxImageSizeMB * 1024 * 1024) {
        return {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `Image file exceeds maximum size of ${this.maxImageSizeMB}MB`,
            details: `File size: ${Math.round(size / 1024 / 1024)}MB`,
          },
          timestamp: new Date(),
        };
      }

      logger.info('S3 image URI validated', { s3Uri, size, format });

      return {
        success: true,
        data: {
          valid: true,
          format,
          size,
        },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('S3 image URI validation failed', { error, s3Uri });

      // Check if it's a not found error
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return {
          success: false,
          error: {
            code: 'IMAGE_NOT_FOUND',
            message: 'Image not found in S3',
            details: s3Uri,
          },
          timestamp: new Date(),
        };
      }

      return {
        success: false,
        error: {
          code: 'S3_VALIDATION_FAILED',
          message: 'Failed to validate S3 image URI',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private validateImageFile(buffer: Buffer): APIResponse<{ format: string }> {
    try {
      // Check file size
      const sizeMB = buffer.length / (1024 * 1024);
      if (sizeMB > this.maxImageSizeMB) {
        return {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `Image file exceeds maximum size of ${this.maxImageSizeMB}MB`,
            details: `File size: ${sizeMB.toFixed(2)}MB`,
          },
          timestamp: new Date(),
        };
      }

      // Detect format from buffer (check magic numbers)
      const format = this.detectImageFormat(buffer);
      if (!format) {
        return {
          success: false,
          error: {
            code: 'UNKNOWN_FORMAT',
            message: 'Unable to detect image format',
          },
          timestamp: new Date(),
        };
      }

      // Check if format is supported
      if (!this.supportedFormats.has(format)) {
        return {
          success: false,
          error: {
            code: 'UNSUPPORTED_FORMAT',
            message: `Unsupported image format: ${format}`,
            details: `Supported formats: ${Array.from(this.supportedFormats).join(', ')}`,
          },
          timestamp: new Date(),
        };
      }

      logger.debug('Image file validated', { size: buffer.length, format });

      return {
        success: true,
        data: { format },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Image file validation failed', { error });

      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Failed to validate image file',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private detectImageFormat(buffer: Buffer): string {
    // Check magic numbers for image formats
    const magicNumbers: { [key: string]: number[][] } = {
      '.jpg': [[0xFF, 0xD8, 0xFF]],
      '.png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
      '.gif': [[0x47, 0x49, 0x46, 0x38]], // GIF87a or GIF89a
      '.webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header
      '.bmp': [[0x42, 0x4D]], // BM
    };

    for (const [format, signatures] of Object.entries(magicNumbers)) {
      for (const signature of signatures) {
        if (this.bufferStartsWith(buffer, signature)) {
          // Special handling for WebP (need to check WEBP signature at offset 8)
          if (format === '.webp') {
            const webpSignature = [0x57, 0x45, 0x42, 0x50];
            if (buffer.length > 11 && this.bufferStartsWith(buffer.subarray(8, 12), webpSignature)) {
              return format;
            }
            continue;
          }
          return format === '.jpg' ? '.jpeg' : format; // Normalize JPEG extension
        }
      }
    }

    return '';
  }

  private bufferStartsWith(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) {
      return false;
    }

    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }

    return true;
  }

  private detectFormatFromKey(key: string): string {
    const ext = path.extname(key).toLowerCase();
    return ext || '.jpg'; // Default to JPEG if no extension
  }

  private async uploadToS3(buffer: Buffer, key: string, format: string): Promise<APIResponse<void>> {
    try {
      const contentType = this.getContentTypeFromFormat(format);

      const command = new PutObjectCommand({
        Bucket: this.config.inputBucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          'upload-time': new Date().toISOString(),
          'file-format': format,
        },
      });

      await retryWithBackoff(
        async () => await this.s3Client.send(command),
        { maxRetries: 3, baseDelay: 1000 },
        'S3 PUT Object'
      );

      logger.info('Image uploaded to S3', { bucket: this.config.inputBucket, key });

      return {
        success: true,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('S3 upload failed', { error, key });

      return {
        success: false,
        error: {
          code: 'S3_UPLOAD_FAILED',
          message: 'Failed to upload image to S3',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private getContentTypeFromFormat(format: string): string {
    const contentTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };

    return contentTypes[format] || 'application/octet-stream';
  }

  // Helper method to get image from S3 (for processing)
  async getImageFromS3(s3Uri: string): Promise<APIResponse<Buffer>> {
    try {
      const match = s3Uri.match(/^s3:\/\/([^\/]+)\/(.+)$/);
      if (!match) {
        return {
          success: false,
          error: {
            code: 'INVALID_S3_URI',
            message: 'Invalid S3 URI format',
          },
          timestamp: new Date(),
        };
      }

      const [, bucket, key] = match;

      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await retryWithBackoff(
        async () => await this.s3Client.send(command),
        { maxRetries: 3, baseDelay: 1000 },
        'S3 GET Object'
      );

      if (!response.Body) {
        throw new Error('No body in S3 response');
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      logger.debug('Image retrieved from S3', { s3Uri, size: buffer.length });

      return {
        success: true,
        data: buffer,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to get image from S3', { error, s3Uri });

      return {
        success: false,
        error: {
          code: 'S3_GET_FAILED',
          message: 'Failed to retrieve image from S3',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }
}