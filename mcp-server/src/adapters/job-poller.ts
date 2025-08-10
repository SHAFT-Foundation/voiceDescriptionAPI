import { EventEmitter } from 'events';
import { 
  JobStatus, 
  PollOptions, 
  MCPToolError, 
  ErrorCode 
} from '../types/index.js';
import { logger, createLogger, logJobProgress, logJobCompleted } from '../utils/logger.js';
import { sleep, withTimeout } from '../utils/retry.js';
import { pollingConfig } from '../config/index.js';

const pollerLogger = createLogger('job-poller');

export interface JobPollResult {
  jobId: string;
  finalStatus: JobStatus;
  duration: number;
  pollingAttempts: number;
}

export interface JobPoller {
  pollJob(
    jobId: string,
    checkFunction: () => Promise<JobStatus>,
    options?: PollOptions
  ): Promise<JobPollResult>;
  
  cancelJob(jobId: string): void;
  cancelAllJobs(): void;
  getActivePolls(): string[];
}

export class DefaultJobPoller extends EventEmitter implements JobPoller {
  private activePolls: Map<string, AbortController> = new Map();
  private pollStats: Map<string, {
    startTime: number;
    attempts: number;
    lastUpdate: number;
  }> = new Map();
  
  constructor() {
    super();
    this.setupCleanup();
  }
  
  /**
   * Poll a job until completion or timeout
   */
  async pollJob(
    jobId: string,
    checkFunction: () => Promise<JobStatus>,
    options: PollOptions = {}
  ): Promise<JobPollResult> {
    const {
      interval = pollingConfig.defaultInterval,
      timeout = pollingConfig.maxDuration,
      onProgress
    } = options;
    
    // Check if job is already being polled
    if (this.activePolls.has(jobId)) {
      throw new MCPToolError(
        ErrorCode.INVALID_PARAMETERS,
        'Job is already being polled',
        { jobId }
      );
    }
    
    const startTime = Date.now();
    const abortController = new AbortController();
    let attempts = 0;
    
    // Register the polling operation
    this.activePolls.set(jobId, abortController);
    this.pollStats.set(jobId, {
      startTime,
      attempts: 0,
      lastUpdate: startTime
    });
    
    pollerLogger.info('Started job polling', {
      jobId,
      interval: `${interval}ms`,
      timeout: `${timeout}ms`
    });
    
    try {
      const finalStatus = await this.pollWithTimeout(
        jobId,
        checkFunction,
        interval,
        timeout,
        abortController.signal,
        onProgress
      );
      
      const duration = Date.now() - startTime;
      const stats = this.pollStats.get(jobId)!;
      
      logJobCompleted(jobId, duration, finalStatus.status === 'completed');
      
      pollerLogger.info('Job polling completed', {
        jobId,
        finalStatus: finalStatus.status,
        duration: `${duration}ms`,
        attempts: stats.attempts
      });
      
      this.emit('jobCompleted', {
        jobId,
        status: finalStatus.status,
        duration,
        attempts: stats.attempts
      });
      
      return {
        jobId,
        finalStatus,
        duration,
        pollingAttempts: stats.attempts
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const stats = this.pollStats.get(jobId);
      
      logJobCompleted(jobId, duration, false, error);
      
      pollerLogger.error('Job polling failed', {
        jobId,
        duration: `${duration}ms`,
        attempts: stats?.attempts || 0,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.emit('jobFailed', {
        jobId,
        error,
        duration,
        attempts: stats?.attempts || 0
      });
      
      throw error;
    } finally {
      // Clean up
      this.activePolls.delete(jobId);
      this.pollStats.delete(jobId);
    }
  }
  
  /**
   * Core polling logic with timeout
   */
  private async pollWithTimeout(
    jobId: string,
    checkFunction: () => Promise<JobStatus>,
    interval: number,
    timeout: number,
    signal: AbortSignal,
    onProgress?: (status: JobStatus) => void
  ): Promise<JobStatus> {
    return withTimeout(
      this.poll(jobId, checkFunction, interval, signal, onProgress),
      timeout,
      `Job polling timeout after ${timeout}ms`
    );
  }
  
  /**
   * Core polling loop
   */
  private async poll(
    jobId: string,
    checkFunction: () => Promise<JobStatus>,
    interval: number,
    signal: AbortSignal,
    onProgress?: (status: JobStatus) => void
  ): Promise<JobStatus> {
    let lastStatus: JobStatus | undefined;
    
    while (!signal.aborted) {
      const stats = this.pollStats.get(jobId);
      if (stats) {
        stats.attempts++;
        stats.lastUpdate = Date.now();
      }
      
      try {
        // Check job status
        const status = await this.checkJobWithRetry(checkFunction, jobId);
        lastStatus = status;
        
        // Log progress if status changed
        if (pollingConfig.progressReporting && 
            (!lastStatus || 
             status.progress !== lastStatus.progress || 
             status.step !== lastStatus.step)) {
          
          logJobProgress(jobId, status.step || 'unknown', status.progress, status.message);
        }
        
        // Call progress callback
        if (onProgress) {
          try {
            onProgress(status);
          } catch (error) {
            pollerLogger.warn('Progress callback error', {
              jobId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        
        // Emit progress event
        this.emit('progress', { jobId, status });
        
        // Check if job is complete
        if (status.status === 'completed') {
          pollerLogger.debug('Job completed successfully', { jobId });
          return status;
        }
        
        // Check if job failed
        if (status.status === 'failed') {
          const error = new MCPToolError(
            ErrorCode.JOB_FAILED,
            status.error?.message || 'Job processing failed',
            {
              jobId,
              error: status.error,
              step: status.step,
              progress: status.progress
            }
          );
          
          pollerLogger.error('Job failed during processing', {
            jobId,
            step: status.step,
            error: status.error
          });
          
          throw error;
        }
        
        // Log periodic status updates
        if (stats && stats.attempts % 10 === 0) {
          pollerLogger.debug('Job polling update', {
            jobId,
            status: status.status,
            step: status.step,
            progress: status.progress,
            attempts: stats.attempts,
            duration: `${Date.now() - stats.startTime}ms`
          });
        }
        
      } catch (error) {
        // Don't retry if it's already a polling error
        if (error instanceof MCPToolError) {
          throw error;
        }
        
        pollerLogger.warn('Job status check failed, will retry', {
          jobId,
          attempt: stats?.attempts || 0,
          error: error instanceof Error ? error.message : String(error)
        });
        
        // Continue polling unless it's a critical error
        if (this.isCriticalError(error)) {
          throw new MCPToolError(
            ErrorCode.JOB_FAILED,
            'Critical error during job status check',
            {
              jobId,
              originalError: error instanceof Error ? error.message : String(error)
            }
          );
        }
      }
      
      // Wait before next poll (unless aborted)
      if (!signal.aborted) {
        await this.interruptibleSleep(interval, signal);
      }
    }
    
    // If we get here, polling was aborted
    throw new MCPToolError(
      ErrorCode.JOB_FAILED,
      'Job polling was cancelled',
      { jobId, lastStatus }
    );
  }
  
  /**
   * Check job status with retry logic
   */
  private async checkJobWithRetry(
    checkFunction: () => Promise<JobStatus>,
    jobId: string,
    maxRetries: number = 3
  ): Promise<JobStatus> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await withTimeout(checkFunction(), 10000); // 10 second timeout per check
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Only retry on network/timeout errors
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        pollerLogger.debug('Job status check retry', {
          jobId,
          attempt,
          error: error instanceof Error ? error.message : String(error)
        });
        
        await sleep(1000 * attempt); // Progressive backoff
      }
    }
    
    throw new MCPToolError(
      ErrorCode.API_REQUEST_FAILED,
      'Failed to check job status after retries',
      {
        jobId,
        attempts: maxRetries,
        lastError: lastError.message
      }
    );
  }
  
  /**
   * Sleep that can be interrupted by abort signal
   */
  private async interruptibleSleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new Error('Aborted'));
        return;
      }
      
      const timeout = setTimeout(resolve, ms);
      
      const abortHandler = () => {
        clearTimeout(timeout);
        reject(new Error('Aborted'));
      };
      
      signal.addEventListener('abort', abortHandler, { once: true });
      
      // Clean up listener when promise resolves
      timeout.unref?.(); // Don't keep process alive
      setTimeout(() => {
        signal.removeEventListener('abort', abortHandler);
      }, ms);
    });
  }
  
  /**
   * Cancel a specific job's polling
   */
  cancelJob(jobId: string): void {
    const controller = this.activePolls.get(jobId);
    if (controller) {
      controller.abort();
      this.activePolls.delete(jobId);
      
      pollerLogger.info('Cancelled job polling', { jobId });
      this.emit('jobCancelled', { jobId });
    } else {
      pollerLogger.warn('Attempted to cancel non-existent job', { jobId });
    }
  }
  
  /**
   * Cancel all active polling operations
   */
  cancelAllJobs(): void {
    const jobIds = Array.from(this.activePolls.keys());
    
    for (const [jobId, controller] of this.activePolls) {
      controller.abort();
    }
    
    this.activePolls.clear();
    this.pollStats.clear();
    
    pollerLogger.info('Cancelled all job polling', { 
      cancelledJobs: jobIds.length,
      jobIds 
    });
    
    this.emit('allJobsCancelled', { jobIds });
  }
  
  /**
   * Get list of currently active polling jobs
   */
  getActivePolls(): string[] {
    return Array.from(this.activePolls.keys());
  }
  
  /**
   * Get polling statistics
   */
  getPollingStats(): Array<{
    jobId: string;
    startTime: number;
    duration: number;
    attempts: number;
    lastUpdate: number;
  }> {
    const now = Date.now();
    
    return Array.from(this.pollStats.entries()).map(([jobId, stats]) => ({
      jobId,
      startTime: stats.startTime,
      duration: now - stats.startTime,
      attempts: stats.attempts,
      lastUpdate: stats.lastUpdate
    }));
  }
  
  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof MCPToolError) {
      return error.retryable;
    }
    
    // Network and timeout errors are retryable
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /econnrefused/i,
      /econnreset/i,
      /etimedout/i
    ];
    
    const errorMessage = error?.message?.toLowerCase() || '';
    return retryablePatterns.some(pattern => pattern.test(errorMessage));
  }
  
  /**
   * Check if error is critical (should stop polling immediately)
   */
  private isCriticalError(error: any): boolean {
    if (error instanceof MCPToolError) {
      return [
        ErrorCode.API_AUTHENTICATION_FAILED,
        ErrorCode.JOB_NOT_FOUND,
        ErrorCode.INVALID_PARAMETERS
      ].includes(error.code);
    }
    
    // Authentication and authorization errors are critical
    const criticalPatterns = [
      /unauthorized/i,
      /forbidden/i,
      /authentication/i,
      /not found/i
    ];
    
    const errorMessage = error?.message?.toLowerCase() || '';
    return criticalPatterns.some(pattern => pattern.test(errorMessage));
  }
  
  /**
   * Set up cleanup intervals and handlers
   */
  private setupCleanup(): void {
    // Clean up stale polling stats every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const staleThreshold = 30 * 60 * 1000; // 30 minutes
      
      for (const [jobId, stats] of this.pollStats) {
        if (now - stats.lastUpdate > staleThreshold && !this.activePolls.has(jobId)) {
          this.pollStats.delete(jobId);
          pollerLogger.debug('Cleaned up stale polling stats', { jobId });
        }
      }
    }, 5 * 60 * 1000);
    
    // Handle process termination
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }
  
  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    pollerLogger.info('Shutting down job poller', {
      activePolls: this.activePolls.size
    });
    
    this.cancelAllJobs();
    this.removeAllListeners();
    
    pollerLogger.info('Job poller shutdown complete');
  }
}

// Export a singleton instance
export const jobPoller = new DefaultJobPoller();