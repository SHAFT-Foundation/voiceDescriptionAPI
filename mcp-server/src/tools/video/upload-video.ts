import { z } from 'zod';
import { Tool, ToolContext, MCPToolError, ErrorCode } from '../../types/index.js';
import { APIClient } from '../../adapters/api-client.js';
import { FileHandler } from '../../adapters/file-handler.js';
import { jobPoller } from '../../adapters/job-poller.js';
import { logger, createLogger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

const toolLogger = createLogger('upload-video-tool');

const uploadVideoSchema = z.object({
  file_path: z.string()
    .min(1)
    .describe('Path to the video file to upload'),
  
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
    .describe('Level of detail in descriptions'),
  
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

export class UploadVideoTool implements Tool {
  name = 'voice_description_upload_video';
  description = 'Upload and process a video file for audio description generation';
  inputSchema = uploadVideoSchema;
  
  private apiClient: APIClient;
  private fileHandler: FileHandler;
  
  constructor() {
    this.apiClient = new APIClient();
    this.fileHandler = new FileHandler();
  }
  
  async execute(
    params: z.infer<typeof uploadVideoSchema>,
    context: ToolContext
  ) {
    const startTime = Date.now();
    
    toolLogger.info('Starting video upload', {
      filePath: params.file_path,
      title: params.title,
      language: params.language,
      detailLevel: params.detail_level,
      waitForCompletion: params.wait_for_completion,
      requestId: context.requestId
    });
    
    try {
      // Validate and prepare file
      const fileValidation = this.fileHandler.validateFilePath(params.file_path);
      if (!fileValidation.valid) {
        throw new MCPToolError(
          fileValidation.error?.includes('not exist') ? ErrorCode.FILE_NOT_FOUND :
          fileValidation.error?.includes('size') ? ErrorCode.FILE_TOO_LARGE :
          ErrorCode.INVALID_PARAMETERS,
          fileValidation.error!,
          fileValidation.details
        );
      }
      
      // Validate video file type
      const typeValidation = this.fileHandler.validateFileType(
        params.file_path,
        config.files.allowedVideoTypes
      );
      if (!typeValidation.valid) {
        throw new MCPToolError(
          ErrorCode.UNSUPPORTED_FORMAT,
          typeValidation.error!,
          {
            ...typeValidation.details,
            supportedFormats: config.files.allowedVideoTypes
          }
        );
      }
      
      // Get file info for logging
      const fileInfo = await this.fileHandler.getFileInfo(params.file_path);
      toolLogger.info('File validation passed', {
        fileName: fileInfo.name,
        size: fileInfo.size,
        mimeType: fileInfo.mimeType,
        requestId: context.requestId
      });
      
      // Prepare file upload
      const uploadData = await this.fileHandler.prepareVideoUpload(params.file_path);
      
      // Upload to API
      const uploadResult = await this.apiClient.uploadVideo({
        file: uploadData.stream || uploadData.buffer!,
        fileName: uploadData.name,
        mimeType: uploadData.mimeType,
        metadata: {
          title: params.title,
          description: params.description,
          language: params.language,
        },
        options: {
          voiceId: params.voice_id,
          detailLevel: params.detail_level,
        },
      });
      
      const uploadDuration = Date.now() - startTime;
      
      toolLogger.info('Video uploaded successfully', {
        jobId: uploadResult.jobId,
        status: uploadResult.status,
        estimatedTime: uploadResult.estimatedTime,
        uploadDuration: `${uploadDuration}ms`,
        requestId: context.requestId
      });
      
      const response = {
        success: true,
        job_id: uploadResult.jobId,
        status: uploadResult.status,
        estimated_time_seconds: uploadResult.estimatedTime,
        estimated_time_human: this.formatDuration(uploadResult.estimatedTime || 0),
        status_url: `/api/status/${uploadResult.jobId}`,
        message: 'Video uploaded successfully and processing has started',
        upload_info: {
          file_name: uploadData.name,
          file_size_bytes: uploadData.size,
          file_size_human: this.formatFileSize(uploadData.size),
          mime_type: uploadData.mimeType,
          upload_duration_ms: uploadDuration
        },
        processing_options: {
          language: params.language,
          voice_id: params.voice_id,
          detail_level: params.detail_level
        }
      };
      
      // Optionally wait for completion
      if (params.wait_for_completion) {
        toolLogger.info('Waiting for video processing to complete', {
          jobId: uploadResult.jobId,
          timeout: `${params.polling_timeout}s`,
          requestId: context.requestId
        });
        
        try {
          const pollResult = await jobPoller.pollJob(
            uploadResult.jobId,
            () => this.apiClient.checkJobStatus(uploadResult.jobId, 'video'),
            {
              timeout: params.polling_timeout * 1000,
              onProgress: (status) => {
                toolLogger.debug('Processing progress', {
                  jobId: uploadResult.jobId,
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
            jobId: uploadResult.jobId,
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
              ? 'Video processing completed successfully'
              : `Video processing ${pollResult.finalStatus.status}`,
            download_instructions: pollResult.finalStatus.status === 'completed' ? {
              text_description: `Use voice_description_download_results with job_id="${uploadResult.jobId}" and format="text"`,
              audio_narration: `Use voice_description_download_results with job_id="${uploadResult.jobId}" and format="audio"`,
              complete_package: `Use voice_description_download_results with job_id="${uploadResult.jobId}" and format="all"`
            } : undefined
          };
        } catch (pollingError) {
          toolLogger.error('Polling failed but upload succeeded', {
            jobId: uploadResult.jobId,
            error: pollingError instanceof Error ? pollingError.message : String(pollingError),
            requestId: context.requestId
          });
          
          // Return partial success - upload worked but polling failed
          return {
            ...response,
            polling_error: {
              message: 'Upload succeeded but polling for completion failed',
              details: pollingError instanceof Error ? pollingError.message : String(pollingError),
              instructions: `You can manually check status using voice_description_check_status with job_id="${uploadResult.jobId}"`
            }
          };
        }
      }
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      toolLogger.error('Video upload failed', {
        filePath: params.file_path,
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
        'Failed to upload and process video',
        {
          originalError: error instanceof Error ? error.message : String(error),
          filePath: params.file_path,
          duration: `${duration}ms`
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
  
  /**
   * Format file size to human readable string
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}