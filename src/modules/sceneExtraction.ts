import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AWSConfig, VideoSegment, APIResponse } from '../types';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

export interface ExtractedScene {
  segmentId: string;
  localPath: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export class SceneExtractionModule {
  private s3Client: S3Client;
  private config: AWSConfig;
  private concurrencyLimit: number;

  constructor(config: AWSConfig, concurrencyLimit: number = 3) {
    this.config = config;
    this.concurrencyLimit = concurrencyLimit;
    this.s3Client = new S3Client({
      region: config.region,
      credentials: config.credentials,
    });
  }

  async extractScenes(
    s3Uri: string,
    segments: VideoSegment[],
    jobId: string
  ): Promise<APIResponse<{
    extractedScenes: ExtractedScene[];
    errors: string[];
  }>> {
    const startTime = Date.now();
    let tempFiles: string[] = [];
    let tempDir: string = '';

    try {
      logger.info('Starting scene extraction', { 
        jobId, 
        s3Uri, 
        segmentCount: segments.length 
      });

      // Generate temporary paths
      const tempPaths = this.generateTempPaths(jobId, s3Uri);
      tempDir = tempPaths.outputDir;
      tempFiles.push(tempPaths.inputVideo);

      // Create temporary directory
      await fs.promises.mkdir(tempPaths.outputDir, { recursive: true });

      // Download video from S3
      const downloadResult = await this.downloadVideoFromS3(s3Uri, tempPaths.inputVideo);
      if (!downloadResult.success) {
        return downloadResult;
      }

      // Extract scenes with concurrency control
      const extractedScenes: ExtractedScene[] = [];
      const errors: string[] = [];

      // Process segments in batches to control concurrency
      for (let i = 0; i < segments.length; i += this.concurrencyLimit) {
        const batch = segments.slice(i, i + this.concurrencyLimit);
        const batchPromises = batch.map(async (segment, batchIndex) => {
          const segmentIndex = i + batchIndex;
          const segmentId = `segment-${segmentIndex}`;
          const outputPath = path.join(tempPaths.outputDir, `${segmentId}.mp4`);
          tempFiles.push(outputPath);

          try {
            const extractResult = await this.extractSingleScene(
              segment,
              tempPaths.inputVideo,
              outputPath,
              segmentId
            );

            if (extractResult.success && extractResult.data) {
              return extractResult.data;
            } else {
              errors.push(`${segmentId}: ${extractResult.error?.message}`);
              return null;
            }
          } catch (error) {
            const errorMsg = `${segmentId}: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(errorMsg);
            logger.warn('Scene extraction failed', { segmentId, error: errorMsg });
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        extractedScenes.push(...batchResults.filter((result): result is ExtractedScene => result !== null));

        logger.debug('Batch extraction completed', { 
          batchStart: i, 
          batchSize: batch.length,
          successCount: batchResults.filter(r => r !== null).length,
          errorCount: batchResults.filter(r => r === null).length
        });
      }

      const processingTime = Date.now() - startTime;
      
      logger.info('Scene extraction completed', {
        jobId,
        totalSegments: segments.length,
        successfulExtractions: extractedScenes.length,
        errors: errors.length,
        processingTime,
      });

      return {
        success: true,
        data: {
          extractedScenes,
          errors,
        },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Scene extraction failed', { error, jobId, s3Uri });

      return {
        success: false,
        error: {
          code: 'SCENE_EXTRACTION_FAILED',
          message: 'Failed to extract scenes from video',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };

    } finally {
      // Clean up temporary files
      await this.cleanup(tempFiles, tempDir);
    }
  }

  async downloadVideoFromS3(
    s3Uri: string,
    localPath: string
  ): Promise<APIResponse<{ localPath: string }>> {
    try {
      const { bucket, key } = this.parseS3Uri(s3Uri);
      
      logger.debug('Downloading video from S3', { s3Uri, localPath, bucket, key });

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await retryWithBackoff(
        async () => await this.s3Client.send(command),
        { maxRetries: 3 },
        'S3 video download'
      );

      if (!response.Body) {
        throw new Error('No body in S3 response');
      }

      // Stream the response body to local file
      const writeStream = fs.createWriteStream(localPath);
      const webStream = response.Body.transformToWebStream();
      
      await webStream.pipeTo(new WritableStream({
        write(chunk) {
          writeStream.write(chunk);
        },
        close() {
          writeStream.end();
        },
      }));

      // Verify file was downloaded
      await fs.promises.access(localPath, fs.constants.F_OK);
      const stats = await fs.promises.stat(localPath);

      logger.info('Video downloaded successfully', { 
        s3Uri, 
        localPath, 
        size: stats.size 
      });

      return {
        success: true,
        data: { localPath },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to download video from S3', { error, s3Uri, localPath });

      return {
        success: false,
        error: {
          code: 'DOWNLOAD_FAILED',
          message: 'Failed to download video from S3',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  async extractSingleScene(
    segment: VideoSegment,
    inputPath: string,
    outputPath: string,
    segmentId: string
  ): Promise<APIResponse<ExtractedScene>> {
    return new Promise((resolve) => {
      const duration = segment.endTime - segment.startTime;

      logger.debug('Extracting single scene', {
        segmentId,
        startTime: segment.startTime,
        endTime: segment.endTime,
        duration,
        inputPath,
        outputPath,
      });

      ffmpeg(inputPath)
        .seekInput(segment.startTime)
        .duration(duration)
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-movflags', 'faststart',
          '-preset', 'fast',
          '-crf', '23',
        ])
        .on('start', (commandLine) => {
          logger.debug('FFmpeg started', { segmentId, commandLine });
        })
        .on('progress', (progress) => {
          logger.debug('FFmpeg progress', { 
            segmentId, 
            percent: progress.percent,
            currentTime: progress.timemark 
          });
        })
        .on('end', () => {
          logger.debug('FFmpeg completed', { segmentId, outputPath });
          
          resolve({
            success: true,
            data: {
              segmentId,
              localPath: outputPath,
              startTime: segment.startTime,
              endTime: segment.endTime,
              duration,
            },
            timestamp: new Date(),
          });
        })
        .on('error', (error) => {
          logger.error('FFmpeg extraction failed', { 
            error, 
            segmentId, 
            inputPath, 
            outputPath 
          });

          resolve({
            success: false,
            error: {
              code: 'EXTRACTION_FAILED',
              message: `Failed to extract scene ${segmentId}`,
              details: error instanceof Error ? error.message : String(error),
            },
            timestamp: new Date(),
          });
        })
        .run();
    });
  }

  generateTempPaths(jobId: string, s3Uri: string): {
    inputVideo: string;
    outputDir: string;
  } {
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(7);
    
    // Extract filename from S3 URI
    const filename = s3Uri.split('/').pop() || 'video.mp4';
    const baseName = path.parse(filename).name;

    return {
      inputVideo: path.join(tempDir, `${jobId}-${timestamp}-${randomSuffix}-${filename}`),
      outputDir: path.join(tempDir, `scenes-${jobId}-${timestamp}-${randomSuffix}`),
    };
  }

  async cleanup(tempFiles: string[], tempDir?: string): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    // Clean up individual files
    for (const file of tempFiles) {
      cleanupPromises.push(
        fs.promises.unlink(file).catch((error) => {
          logger.warn('Failed to cleanup temp file', { file, error: error.message });
        })
      );
    }

    // Clean up temp directory
    if (tempDir) {
      cleanupPromises.push(
        fs.promises.rmdir(tempDir, { recursive: true }).catch((error) => {
          logger.warn('Failed to cleanup temp directory', { tempDir, error: error.message });
        })
      );
    }

    await Promise.all(cleanupPromises);
    logger.debug('Cleanup completed', { fileCount: tempFiles.length, tempDir });
  }

  private parseS3Uri(s3Uri: string): { bucket: string; key: string } {
    const s3UriRegex = /^s3:\/\/([^\/]+)\/(.+)$/;
    const match = s3Uri.match(s3UriRegex);
    
    if (!match) {
      throw new Error('Invalid S3 URI format. Expected: s3://bucket/key');
    }

    return {
      bucket: match[1],
      key: match[2],
    };
  }
}