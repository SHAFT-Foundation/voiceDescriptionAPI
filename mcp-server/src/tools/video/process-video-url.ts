import { z } from 'zod';
import { Tool, ToolContext, MCPToolError, ErrorCode } from '../../types/index.js';
import { APIClient } from '../../adapters/api-client.js';
import { jobPoller } from '../../adapters/job-poller.js';
import { logger, createLogger } from '../../utils/logger.js';

const toolLogger = createLogger('process-video-url-tool');

const processVideoUrlSchema = z.object({
  s3_uri: z.string()
    .regex(/^s3:\/\/[a-z0-9][a-z0-9.-]*[a-z0-9]\/[\w\-._~:/?#[\]@!$&'()*+,;=.]+$/, 
           'Invalid S3 URI format')
    .describe('S3 URI of the video file (e.g., s3://bucket-name/path/to/video.mp4)'),
  
  options: z.object({
    title: z.string()
      .optional()
      .describe('Title of the video content'),
    
    description: z.string()
      .optional()
      .describe('Additional context about the video'),
    
    language: z.enum(['en', 'es', 'fr', 'de', 'ja', 'zh'])
      .optional()
      .default('en')
      .describe('Target language for descriptions'),
    
    voice_id: z.string()
      .optional()
      .default('Joanna')
      .describe('AWS Polly voice ID for audio generation'),
    
    detail_level: z.enum(['basic', 'detailed', 'comprehensive'])
      .optional()
      .default('detailed')
      .describe('Level of detail in descriptions')
  }).optional().default({}),
  
  wait_for_completion: z.boolean()
    .optional()
    .default(false)
    .describe('Wait for processing to complete before returning'),
  
  polling_timeout: z.number()
    .min(30)
    .max(1800) // 30 minutes max
    .optional()
    .default(600)
    .describe('Maximum time to wait for completion (in seconds)')
});

export class ProcessVideoUrlTool implements Tool {
  name = 'voice_description_process_video_url';
  description = 'Process a video from an S3 URL for audio description generation';
  inputSchema = processVideoUrlSchema;
  
  private apiClient: APIClient;
  
  constructor() {
    this.apiClient = new APIClient();
  }
  
  async execute(
    params: z.infer<typeof processVideoUrlSchema>,
    context: ToolContext
  ) {
    const startTime = Date.now();
    
    toolLogger.info('Starting S3 video processing', {
      s3Uri: params.s3_uri,
      options: params.options,
      waitForCompletion: params.wait_for_completion,
      requestId: context.requestId
    });
    
    try {
      // Extract bucket and key from S3 URI for validation
      const s3UriParts = this.parseS3Uri(params.s3_uri);
      
      toolLogger.debug('Parsed S3 URI', {
        bucket: s3UriParts.bucket,
        key: s3UriParts.key,
        requestId: context.requestId
      });
      
      // Process video from S3
      const processResult = await this.apiClient.processVideoFromS3(
        params.s3_uri,
        {
          title: params.options?.title,
          language: params.options?.language,
          voiceId: params.options?.voice_id,
          detailLevel: params.options?.detail_level
        }
      );
      
      const processingDuration = Date.now() - startTime;
      
      toolLogger.info('Video processing started', {
        jobId: processResult.jobId,
        status: processResult.status,
        estimatedTime: processResult.estimatedTime,
        processingDuration: `${processingDuration}ms`,
        requestId: context.requestId
      });
      
      const response = {
        success: true,
        job_id: processResult.jobId,
        status: processResult.status,
        estimated_time_seconds: processResult.estimatedTime,
        estimated_time_human: this.formatDuration(processResult.estimatedTime || 0),
        status_url: `/api/status/${processResult.jobId}`,
        message: 'S3 video processing started successfully',
        source_info: {
          s3_uri: params.s3_uri,
          bucket: s3UriParts.bucket,
          key: s3UriParts.key,
          processing_start_duration_ms: processingDuration
        },
        processing_options: {
          language: params.options?.language || 'en',
          voice_id: params.options?.voice_id || 'Joanna',
          detail_level: params.options?.detail_level || 'detailed',
          title: params.options?.title,
          description: params.options?.description
        }
      };
      
      // Optionally wait for completion
      if (params.wait_for_completion) {
        toolLogger.info('Waiting for video processing to complete', {
          jobId: processResult.jobId,
          timeout: `${params.polling_timeout}s`,
          requestId: context.requestId
        });
        
        try {
          const pollResult = await jobPoller.pollJob(
            processResult.jobId,
            () => this.apiClient.checkJobStatus(processResult.jobId, 'video'),
            {
              timeout: params.polling_timeout * 1000,
              onProgress: (status) => {
                toolLogger.debug('Processing progress', {
                  jobId: processResult.jobId,
                  status: status.status,
                  step: status.step,
                  progress: status.progress,
                  message: status.message,
                  requestId: context.requestId
                });
              }
            }
          );
          
          const totalDuration = Date.now() - startTime;
          
          toolLogger.info('Video processing completed', {
            jobId: processResult.jobId,
            finalStatus: pollResult.finalStatus.status,
            totalDuration: `${totalDuration}ms`,
            pollingAttempts: pollResult.pollingAttempts,
            requestId: context.requestId
          });
          
          return {
            ...response,
            status: pollResult.finalStatus.status,
            final_results: pollResult.finalStatus.results,
            processing_info: {
              total_duration_ms: totalDuration,
              total_duration_human: this.formatDuration(totalDuration),
              polling_attempts: pollResult.pollingAttempts,
              processing_steps_completed: pollResult.finalStatus.step || 'all'
            },
            message: pollResult.finalStatus.status === 'completed' 
              ? 'S3 video processing completed successfully'
              : `S3 video processing ${pollResult.finalStatus.status}`,
            download_instructions: pollResult.finalStatus.status === 'completed' ? {
              text_description: `Use voice_description_download_results with job_id="${processResult.jobId}" and format="text"`,
              audio_narration: `Use voice_description_download_results with job_id="${processResult.jobId}" and format="audio"`,
              complete_package: `Use voice_description_download_results with job_id="${processResult.jobId}" and format="all"`
            } : undefined
          };
        } catch (pollingError) {
          toolLogger.error('Polling failed but processing request succeeded', {
            jobId: processResult.jobId,
            error: pollingError instanceof Error ? pollingError.message : String(pollingError),
            requestId: context.requestId
          });
          
          // Return partial success - processing started but polling failed
          return {
            ...response,
            polling_error: {
              message: 'Processing started but polling for completion failed',
              details: pollingError instanceof Error ? pollingError.message : String(pollingError),
              instructions: `You can manually check status using voice_description_check_status with job_id="${processResult.jobId}"`
            }
          };
        }
      }
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      toolLogger.error('S3 video processing failed', {
        s3Uri: params.s3_uri,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
        requestId: context.requestId
      });
      
      // Re-throw MCP errors as-is
      if (error instanceof MCPToolError) {
        throw error;
      }
      
      // Wrap unexpected errors
      throw new MCPToolError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to process video from S3 URL',
        {
          originalError: error instanceof Error ? error.message : String(error),
          s3Uri: params.s3_uri,
          duration: `${duration}ms`
        }
      );
    }
  }
  
  /**
   * Parse S3 URI into bucket and key components
   */
  private parseS3Uri(s3Uri: string): { bucket: string; key: string } {
    try {
      const url = new URL(s3Uri);
      
      if (url.protocol !== 's3:') {
        throw new MCPToolError(
          ErrorCode.INVALID_PARAMETERS,
          'Invalid S3 URI protocol - must start with s3://',
          { s3Uri }
        );
      }
      
      const bucket = url.hostname;
      const key = url.pathname.substring(1); // Remove leading slash
      
      if (!bucket) {
        throw new MCPToolError(
          ErrorCode.INVALID_PARAMETERS,
          'Invalid S3 URI - bucket name is required',
          { s3Uri }
        );
      }
      
      if (!key) {
        throw new MCPToolError(
          ErrorCode.INVALID_PARAMETERS,
          'Invalid S3 URI - object key is required',
          { s3Uri }
        );
      }
      
      // Validate bucket name format (basic check)
      if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(bucket) && bucket.length < 63) {
        throw new MCPToolError(
          ErrorCode.INVALID_PARAMETERS,
          'Invalid S3 bucket name format',
          { bucket, s3Uri }
        );
      }
      
      return { bucket, key };
    } catch (error) {
      if (error instanceof MCPToolError) {
        throw error;
      }
      
      throw new MCPToolError(
        ErrorCode.INVALID_PARAMETERS,
        'Failed to parse S3 URI',
        {
          s3Uri,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }
  
  /**
   * Format duration in milliseconds to human readable string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}