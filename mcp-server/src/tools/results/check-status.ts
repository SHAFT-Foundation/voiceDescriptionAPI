import { z } from 'zod';
import { Tool, ToolContext, MCPToolError, ErrorCode } from '../../types/index.js';
import { APIClient } from '../../adapters/api-client.js';
import { jobPoller } from '../../adapters/job-poller.js';
import { logger, createLogger } from '../../utils/logger.js';

const toolLogger = createLogger('check-status-tool');

const checkStatusSchema = z.object({
  job_id: z.string()
    .min(1)
    .describe('Job ID to check status for'),
  
  job_type: z.enum(['video', 'image', 'batch'])
    .describe('Type of job - video processing, single image, or batch processing'),
  
  wait_for_completion: z.boolean()
    .optional()
    .default(false)
    .describe('Poll continuously until job completes or fails'),
  
  polling_timeout: z.number()
    .min(10)
    .max(1800) // 30 minutes max
    .optional()
    .default(300)
    .describe('Maximum time to wait for completion when polling (in seconds)'),
  
  include_history: z.boolean()
    .optional()
    .default(false)
    .describe('Include job execution history and timeline'),
  
  include_details: z.boolean()
    .optional()
    .default(true)
    .describe('Include detailed status information and progress')
});

export class CheckStatusTool implements Tool {
  name = 'voice_description_check_status';
  description = 'Check the processing status of a video, image, or batch job with optional polling';
  inputSchema = checkStatusSchema;
  
  private apiClient: APIClient;
  
  constructor() {
    this.apiClient = new APIClient();
  }
  
  async execute(
    params: z.infer<typeof checkStatusSchema>,
    context: ToolContext
  ) {
    const startTime = Date.now();
    
    toolLogger.info('Checking job status', {
      jobId: params.job_id,
      jobType: params.job_type,
      waitForCompletion: params.wait_for_completion,
      includeHistory: params.include_history,
      includeDetails: params.include_details,
      requestId: context.requestId
    });
    
    try {
      // Get initial status
      const initialStatus = await this.getJobStatus(params.job_id, params.job_type);
      
      // If not waiting for completion, return immediate status
      if (!params.wait_for_completion) {
        return this.formatStatusResponse(
          initialStatus,
          params,
          Date.now() - startTime,
          1,
          false
        );
      }
      
      // Check if job is already complete
      if (initialStatus.status === 'completed' || initialStatus.status === 'failed') {
        toolLogger.info('Job already in final state', {
          jobId: params.job_id,
          status: initialStatus.status,
          requestId: context.requestId
        });
        
        return this.formatStatusResponse(
          initialStatus,
          params,
          Date.now() - startTime,
          1,
          false
        );
      }
      
      // Poll for completion
      toolLogger.info('Starting job polling', {
        jobId: params.job_id,
        timeout: `${params.polling_timeout}s`,
        requestId: context.requestId
      });
      
      const pollResult = await jobPoller.pollJob(
        params.job_id,
        () => this.getJobStatus(params.job_id, params.job_type),
        {
          timeout: params.polling_timeout * 1000,
          onProgress: (status) => {
            toolLogger.debug('Polling progress', {
              jobId: params.job_id,
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
      
      toolLogger.info('Job polling completed', {
        jobId: params.job_id,
        finalStatus: pollResult.finalStatus.status,
        totalDuration: `${totalDuration}ms`,
        pollingAttempts: pollResult.pollingAttempts,
        requestId: context.requestId
      });
      
      return this.formatStatusResponse(
        pollResult.finalStatus,
        params,
        totalDuration,
        pollResult.pollingAttempts,
        true
      );
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      toolLogger.error('Status check failed', {
        jobId: params.job_id,
        jobType: params.job_type,
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
        'Failed to check job status',
        {
          originalError: error instanceof Error ? error.message : String(error),
          jobId: params.job_id,
          jobType: params.job_type,
          duration: `${duration}ms`
        }
      );
    }
  }
  
  /**
   * Get job status from API
   */
  private async getJobStatus(jobId: string, jobType: string) {
    try {
      return await this.apiClient.checkJobStatus(jobId, jobType as 'video' | 'image');
    } catch (error) {
      // Handle common errors
      if (error instanceof MCPToolError) {
        if (error.code === ErrorCode.JOB_NOT_FOUND || 
            error.message.toLowerCase().includes('not found')) {
          throw new MCPToolError(
            ErrorCode.JOB_NOT_FOUND,
            `Job ${jobId} not found`,
            { jobId, jobType }
          );
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Format the status response with comprehensive information
   */
  private formatStatusResponse(
    status: any,
    params: any,
    duration: number,
    attempts: number,
    wasPolled: boolean
  ) {
    const response = {
      success: true,
      job_id: params.job_id,
      job_type: params.job_type,
      
      // Current status
      status: status.status,
      step: status.step,
      progress: status.progress,
      message: status.message,
      
      // Timestamps
      created_at: status.createdAt,
      updated_at: status.updatedAt,
      
      // Duration and timing
      check_duration_ms: duration,
      check_duration_human: this.formatDuration(duration),
      
      // Status categorization
      is_complete: status.status === 'completed',
      is_failed: status.status === 'failed',
      is_processing: ['pending', 'processing'].includes(status.status),
      
      // Progress information
      progress_info: {
        percentage: status.progress || 0,
        percentage_formatted: `${status.progress || 0}%`,
        current_step: status.step || 'unknown',
        estimated_remaining_time: this.estimateRemainingTime(status),
        status_description: this.getStatusDescription(status.status, status.step)
      }
    };
    
    // Add polling information if polling was used
    if (wasPolled) {
      response.polling_info = {
        was_polled: true,
        polling_attempts: attempts,
        polling_duration_ms: duration,
        polling_duration_human: this.formatDuration(duration),
        timeout_seconds: params.polling_timeout
      };
    } else {
      response.polling_info = {
        was_polled: false,
        single_check: true
      };
    }
    
    // Add results if job is completed
    if (status.status === 'completed' && status.results) {
      response.results_available = {
        has_results: true,
        results_preview: this.createResultsPreview(status.results, params.job_type),
        download_instructions: {
          text: `Use voice_description_download_results with job_id="${params.job_id}" and format="text"`,
          audio: `Use voice_description_download_results with job_id="${params.job_id}" and format="audio"`,
          complete: `Use voice_description_download_results with job_id="${params.job_id}" and format="all"`
        }
      };
      
      // Include full results if details requested
      if (params.include_details) {
        response.full_results = status.results;
      }
    } else {
      response.results_available = {
        has_results: false,
        reason: status.status === 'failed' ? 'Job failed' : 'Job not yet completed'
      };
    }
    
    // Add error information if job failed
    if (status.status === 'failed' && status.error) {
      response.error_info = {
        error_code: status.error.code,
        error_message: status.error.message,
        error_details: status.error.details,
        step_when_failed: status.step,
        progress_when_failed: status.progress
      };
    }
    
    // Add job history if requested
    if (params.include_history) {
      response.execution_history = this.createExecutionHistory(status);
    }
    
    // Add next actions based on status
    response.next_actions = this.suggestNextActions(status, params.job_type, params.job_id);
    
    return response;
  }
  
  /**
   * Get human-readable status description
   */
  private getStatusDescription(status: string, step?: string): string {
    const descriptions = {
      'pending': 'Job is queued and waiting to start processing',
      'processing': step ? `Currently ${step}` : 'Job is being processed',
      'completed': 'Job completed successfully',
      'failed': 'Job failed during processing'
    };
    
    return descriptions[status] || `Job is in ${status} state`;
  }
  
  /**
   * Estimate remaining time based on current progress
   */
  private estimateRemainingTime(status: any): string | null {
    if (!status.progress || status.progress === 0) {
      return null;
    }
    
    // This is a basic estimation - in a real system you'd use historical data
    const estimatedTotalTime = status.estimatedTime || 300000; // 5 minutes default
    const progressDecimal = status.progress / 100;
    const remainingTime = estimatedTotalTime * (1 - progressDecimal);
    
    return remainingTime > 0 ? this.formatDuration(remainingTime) : null;
  }
  
  /**
   * Create a preview of results without including all data
   */
  private createResultsPreview(results: any, jobType: string) {
    if (jobType === 'video') {
      return {
        type: 'video',
        has_text_description: !!results.textDescription,
        has_audio_file: !!results.audioFile,
        segment_count: results.segments?.length || 0,
        total_duration: results.totalDuration
      };
    } else if (jobType === 'image') {
      return {
        type: 'image',
        has_description: !!results.detailedDescription,
        has_alt_text: !!results.altText,
        has_audio: !!results.audioFile,
        confidence: results.confidence,
        visual_elements_count: results.visualElements?.length || 0
      };
    } else if (jobType === 'batch') {
      return {
        type: 'batch',
        total_images: results.totalImages || 0,
        successful_images: results.processed || 0,
        failed_images: results.failed || 0,
        completion_rate: results.processed ? 
          Math.round((results.processed / results.totalImages) * 100) : 0
      };
    }
    
    return { type: 'unknown', has_data: !!results };
  }
  
  /**
   * Create execution history timeline
   */
  private createExecutionHistory(status: any) {
    const history = [];
    
    if (status.createdAt) {
      history.push({
        timestamp: status.createdAt,
        event: 'job_created',
        description: 'Job was created and queued for processing'
      });
    }
    
    // Add processing milestones based on step
    if (status.step) {
      history.push({
        timestamp: status.updatedAt || new Date().toISOString(),
        event: 'step_progress',
        description: `Processing step: ${status.step}`,
        progress: status.progress
      });
    }
    
    if (status.status === 'completed') {
      history.push({
        timestamp: status.updatedAt || new Date().toISOString(),
        event: 'job_completed',
        description: 'Job completed successfully'
      });
    } else if (status.status === 'failed') {
      history.push({
        timestamp: status.updatedAt || new Date().toISOString(),
        event: 'job_failed',
        description: 'Job failed during processing',
        error: status.error
      });
    }
    
    return history;
  }
  
  /**
   * Suggest next actions based on job status
   */
  private suggestNextActions(status: any, jobType: string, jobId: string): string[] {
    const actions = [];
    
    if (status.status === 'completed') {
      actions.push(`Download results using voice_description_download_results with job_id="${jobId}"`);
      actions.push('Check the results quality and confidence scores');
      
      if (jobType === 'image') {
        actions.push('Consider the alt_text for web accessibility implementation');
      } else if (jobType === 'video') {
        actions.push('Review the generated segments and timing');
      }
    } else if (status.status === 'failed') {
      actions.push('Check the error details to understand what went wrong');
      actions.push('Consider retrying with different parameters if appropriate');
      actions.push('Contact support if the error persists');
    } else if (status.status === 'processing') {
      actions.push('Wait for processing to complete - this may take several minutes');
      actions.push(`Check status again in ${this.estimateRemainingTime(status) || '2-3 minutes'}`);
      actions.push('Consider using wait_for_completion=true for automatic polling');
    } else if (status.status === 'pending') {
      actions.push('Job is queued - processing will start shortly');
      actions.push('Check status again in 1-2 minutes');
    }
    
    return actions;
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