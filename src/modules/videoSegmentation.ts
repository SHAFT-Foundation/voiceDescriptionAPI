import { 
  RekognitionClient, 
  StartSegmentDetectionCommand, 
  GetSegmentDetectionCommand,
  SegmentDetection,
  VideoJobStatus
} from '@aws-sdk/client-rekognition';
import { AWSConfig, VideoSegment, APIResponse } from '../types';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

export class VideoSegmentationModule {
  private rekognitionClient: RekognitionClient;
  private config: AWSConfig;

  constructor(config: AWSConfig) {
    this.config = config;
    this.rekognitionClient = new RekognitionClient({
      region: config.region,
      credentials: config.credentials,
    });
  }

  async startSegmentDetection(s3Uri: string): Promise<APIResponse<{
    rekognitionJobId: string;
  }>> {
    try {
      const { bucket, key } = this.parseS3Uri(s3Uri);

      logger.info('Starting Rekognition segment detection', { s3Uri, bucket, key });

      const command = new StartSegmentDetectionCommand({
        Video: {
          S3Object: {
            Bucket: bucket,
            Name: key,
          },
        },
        SegmentTypes: ['TECHNICAL_CUE', 'SHOT'],
        NotificationChannel: undefined, // We'll use polling instead
      });

      const result = await retryWithBackoff(
        async () => await this.rekognitionClient.send(command),
        { maxRetries: 3 },
        'Rekognition StartSegmentDetection'
      );

      if (!result.JobId) {
        throw new Error('No JobId returned from Rekognition');
      }

      logger.info('Segment detection job started', { 
        rekognitionJobId: result.JobId, 
        s3Uri 
      });

      return {
        success: true,
        data: {
          rekognitionJobId: result.JobId,
        },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to start segment detection', { error, s3Uri });

      if (error instanceof Error && error.message.includes('Invalid S3 URI')) {
        return {
          success: false,
          error: {
            code: 'INVALID_S3_URI',
            message: 'Invalid S3 URI format',
            details: error.message,
          },
          timestamp: new Date(),
        };
      }

      return {
        success: false,
        error: {
          code: 'REKOGNITION_START_FAILED',
          message: 'Failed to start Rekognition segment detection job',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  async pollSegmentDetectionJob(rekognitionJobId: string): Promise<APIResponse<{
    status: string;
    segments?: VideoSegment[];
    statusMessage?: string;
  }>> {
    try {
      logger.debug('Polling segment detection job', { rekognitionJobId });

      let nextToken: string | undefined;
      const allSegments: SegmentDetection[] = [];

      do {
        const command = new GetSegmentDetectionCommand({
          JobId: rekognitionJobId,
          NextToken: nextToken,
        });

        const result = await this.rekognitionClient.send(command);

        if (result.JobStatus === 'FAILED') {
          return {
            success: false,
            error: {
              code: 'REKOGNITION_JOB_FAILED',
              message: 'Rekognition segment detection job failed',
              details: result.StatusMessage || 'Unknown error',
            },
            timestamp: new Date(),
          };
        }

        if (result.JobStatus === 'IN_PROGRESS') {
          return {
            success: true,
            data: {
              status: 'IN_PROGRESS',
            },
            timestamp: new Date(),
          };
        }

        if (result.JobStatus === 'SUCCEEDED') {
          if (result.Segments) {
            allSegments.push(...result.Segments);
          }
          nextToken = result.NextToken;
        }

      } while (nextToken);

      // Process and filter segments
      const videoSegments = this.processRekognitionSegments(allSegments);

      logger.info('Segment detection job completed', { 
        rekognitionJobId, 
        segmentCount: videoSegments.length 
      });

      return {
        success: true,
        data: {
          status: 'SUCCEEDED',
          segments: videoSegments,
        },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to poll segment detection job', { error, rekognitionJobId });

      return {
        success: false,
        error: {
          code: 'REKOGNITION_POLL_FAILED',
          message: 'Failed to poll Rekognition job status',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  async processSegmentationResults(
    s3Uri: string, 
    jobId: string, 
    timeoutMs: number = 30 * 60 * 1000 // 30 minutes
  ): Promise<APIResponse<{
    segments: VideoSegment[];
    processingTime: number;
  }>> {
    const startTime = Date.now();

    try {
      // Start segment detection
      const startResult = await this.startSegmentDetection(s3Uri);
      if (!startResult.success) {
        return startResult;
      }

      const rekognitionJobId = startResult.data!.rekognitionJobId;

      // Poll for completion with exponential backoff
      let pollAttempt = 0;
      const maxPollAttempts = Math.floor(timeoutMs / 5000); // Poll every 5 seconds minimum

      while (Date.now() - startTime < timeoutMs) {
        const pollResult = await this.pollSegmentDetectionJob(rekognitionJobId);
        
        if (!pollResult.success) {
          return pollResult;
        }

        if (pollResult.data!.status === 'SUCCEEDED') {
          const processingTime = Date.now() - startTime;
          
          logger.info('Segmentation completed successfully', {
            jobId,
            rekognitionJobId,
            processingTime,
            segmentCount: pollResult.data!.segments?.length || 0,
          });

          return {
            success: true,
            data: {
              segments: pollResult.data!.segments || [],
              processingTime,
            },
            timestamp: new Date(),
          };
        }

        // Exponential backoff for polling
        pollAttempts++;
        const delay = Math.min(5000 * Math.pow(1.5, pollAttempt), 30000); // Max 30 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Timeout reached
      logger.warn('Segmentation job timed out', { jobId, rekognitionJobId, timeoutMs });

      return {
        success: false,
        error: {
          code: 'SEGMENTATION_TIMEOUT',
          message: `Segmentation job timed out after ${timeoutMs}ms`,
        },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Segmentation processing failed', { error, jobId, s3Uri });

      return {
        success: false,
        error: {
          code: 'SEGMENTATION_PROCESS_FAILED',
          message: 'Failed to process video segmentation',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private processRekognitionSegments(segments: SegmentDetection[]): VideoSegment[] {
    const confidenceThreshold = 80.0; // Filter out low-confidence segments

    const processedSegments: VideoSegment[] = segments
      .filter(segment => {
        // Filter by confidence
        const confidence = segment.ShotSegment?.Confidence || 
                          segment.TechnicalCueSegment?.Confidence || 0;
        return confidence >= confidenceThreshold;
      })
      .map(segment => {
        const startTime = (segment.StartTimestampMillis || 0) / 1000;
        const endTime = (segment.EndTimestampMillis || 0) / 1000;
        const confidence = segment.ShotSegment?.Confidence || 
                          segment.TechnicalCueSegment?.Confidence || 0;

        return {
          startTime,
          endTime,
          confidence,
          type: segment.Type as 'TECHNICAL_CUE' | 'SHOT',
        };
      })
      .filter(segment => segment.endTime > segment.startTime) // Valid time range
      .sort((a, b) => a.startTime - b.startTime); // Sort by start time

    // Merge overlapping or adjacent segments
    return this.mergeAdjacentSegments(processedSegments);
  }

  private mergeAdjacentSegments(segments: VideoSegment[]): VideoSegment[] {
    if (segments.length <= 1) return segments;

    const merged: VideoSegment[] = [segments[0]];
    const mergeThreshold = 1.0; // Merge segments within 1 second of each other

    for (let i = 1; i < segments.length; i++) {
      const current = segments[i];
      const previous = merged[merged.length - 1];

      // Check if segments should be merged
      if (current.startTime - previous.endTime <= mergeThreshold && 
          current.type === previous.type) {
        // Merge segments
        previous.endTime = current.endTime;
        previous.confidence = Math.max(previous.confidence, current.confidence);
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  parseS3Uri(s3Uri: string): { bucket: string; key: string } {
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