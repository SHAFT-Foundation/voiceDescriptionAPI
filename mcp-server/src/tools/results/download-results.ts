import { z } from 'zod';
import { Tool, ToolContext, MCPToolError, ErrorCode } from '../../types/index.js';
import { APIClient } from '../../adapters/api-client.js';
import { FileHandler } from '../../adapters/file-handler.js';
import { logger, createLogger } from '../../utils/logger.js';

const toolLogger = createLogger('download-results-tool');

const downloadResultsSchema = z.object({
  job_id: z.string()
    .min(1)
    .describe('Job ID to download results for'),
  
  format: z.enum(['text', 'audio', 'json', 'all'])
    .optional()
    .default('all')
    .describe('Format to download - text description, audio file, metadata JSON, or all formats'),
  
  save_to: z.string()
    .optional()
    .describe('Directory path to save downloaded files (if not provided, files are saved to temp directory)'),
  
  job_type: z.enum(['video', 'image'])
    .optional()
    .default('video')
    .describe('Type of job - affects download endpoints'),
  
  include_metadata: z.boolean()
    .optional()
    .default(true)
    .describe('Include additional metadata in JSON format'),
  
  overwrite_existing: z.boolean()
    .optional()
    .default(false)
    .describe('Overwrite existing files if they already exist')
});

export class DownloadResultsTool implements Tool {
  name = 'voice_description_download_results';
  description = 'Download processing results including text descriptions, audio files, and metadata';
  inputSchema = downloadResultsSchema;
  
  private apiClient: APIClient;
  private fileHandler: FileHandler;
  
  constructor() {
    this.apiClient = new APIClient();
    this.fileHandler = new FileHandler();
  }
  
  async execute(
    params: z.infer<typeof downloadResultsSchema>,
    context: ToolContext
  ) {
    const startTime = Date.now();
    
    toolLogger.info('Starting results download', {
      jobId: params.job_id,
      format: params.format,
      saveTo: params.save_to,
      jobType: params.job_type,
      includeMetadata: params.include_metadata,
      requestId: context.requestId
    });
    
    try {
      // First, check if job exists and is completed
      const status = await this.apiClient.checkJobStatus(params.job_id, params.job_type);
      
      if (status.status !== 'completed') {
        throw new MCPToolError(
          status.status === 'failed' ? ErrorCode.JOB_FAILED : ErrorCode.PROCESSING_ERROR,
          `Cannot download results - job status is "${status.status}"`,
          {
            jobId: params.job_id,
            currentStatus: status.status,
            step: status.step,
            progress: status.progress
          }
        );
      }
      
      // Determine save directory
      const saveDirectory = params.save_to || this.fileHandler.getTempDirectory();
      
      // Download requested formats
      const downloadResults = await this.downloadFiles(
        params.job_id,
        params.format,
        params.job_type,
        saveDirectory,
        params.overwrite_existing,
        params.include_metadata,
        status
      );
      
      const totalDuration = Date.now() - startTime;
      
      toolLogger.info('Results download completed', {
        jobId: params.job_id,
        filesDownloaded: downloadResults.files.length,
        totalSize: downloadResults.totalSize,
        duration: `${totalDuration}ms`,
        requestId: context.requestId
      });
      
      // Build comprehensive response
      return {
        success: true,
        job_id: params.job_id,
        job_type: params.job_type,
        job_status: status.status,
        
        // Download summary
        download_info: {
          formats_requested: params.format,
          formats_downloaded: downloadResults.downloadedFormats,
          total_files: downloadResults.files.length,
          total_size_bytes: downloadResults.totalSize,
          total_size_human: this.formatFileSize(downloadResults.totalSize),
          save_directory: saveDirectory,
          download_duration_ms: totalDuration,
          download_duration_human: this.formatDuration(totalDuration)
        },
        
        // File details
        files: downloadResults.files.map(file => ({
          format: file.format,
          file_path: file.path,
          file_name: file.name,
          size_bytes: file.size,
          size_human: this.formatFileSize(file.size),
          mime_type: file.mimeType,
          created_at: new Date().toISOString()
        })),
        
        // Content previews (for text content)
        content_previews: downloadResults.contentPreviews,
        
        // Usage instructions
        usage_instructions: this.generateUsageInstructions(
          downloadResults.files,
          params.job_type
        ),
        
        // Metadata (if included)
        ...(params.include_metadata && downloadResults.metadata && {
          job_metadata: downloadResults.metadata
        })
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      toolLogger.error('Results download failed', {
        jobId: params.job_id,
        format: params.format,
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
        'Failed to download results',
        {
          originalError: error instanceof Error ? error.message : String(error),
          jobId: params.job_id,
          format: params.format,
          duration: `${duration}ms`
        }
      );
    }
  }
  
  /**
   * Download files based on requested format
   */
  private async downloadFiles(
    jobId: string,
    format: string,
    jobType: string,
    saveDirectory: string,
    overwriteExisting: boolean,
    includeMetadata: boolean,
    jobStatus: any
  ) {
    const files: Array<{
      format: string;
      path: string;
      name: string;
      size: number;
      mimeType: string;
    }> = [];
    
    const contentPreviews: Record<string, any> = {};
    let totalSize = 0;
    const downloadedFormats: string[] = [];
    let metadata: any = null;
    
    // Download text description
    if (format === 'text' || format === 'all') {
      try {
        const textData = await this.apiClient.downloadTextResults(jobId, jobType);
        const textPath = await this.fileHandler.saveResults(
          textData,
          jobId,
          'txt',
          saveDirectory
        );
        
        const textSize = Buffer.byteLength(textData, 'utf8');
        files.push({
          format: 'text',
          path: textPath,
          name: `${jobId}.txt`,
          size: textSize,
          mimeType: 'text/plain'
        });
        
        totalSize += textSize;
        downloadedFormats.push('text');
        
        // Add content preview (first 500 characters)
        contentPreviews.text = {
          preview: textData.substring(0, 500) + (textData.length > 500 ? '...' : ''),
          full_length: textData.length,
          word_count: textData.split(/\s+/).length,
          line_count: textData.split('\n').length
        };
        
        toolLogger.debug('Downloaded text results', {
          jobId,
          textSize,
          textLength: textData.length
        });
        
      } catch (error) {
        toolLogger.warn('Failed to download text results', {
          jobId,
          error: error instanceof Error ? error.message : String(error)
        });
        
        if (format === 'text') {
          throw error; // If only text was requested, fail completely
        }
      }
    }
    
    // Download audio file
    if (format === 'audio' || format === 'all') {
      try {
        const audioData = await this.apiClient.downloadAudioResults(jobId, jobType);
        const audioPath = await this.fileHandler.saveResults(
          audioData,
          jobId,
          'mp3',
          saveDirectory
        );
        
        files.push({
          format: 'audio',
          path: audioPath,
          name: `${jobId}.mp3`,
          size: audioData.length,
          mimeType: 'audio/mpeg'
        });
        
        totalSize += audioData.length;
        downloadedFormats.push('audio');
        
        // Add audio metadata preview
        contentPreviews.audio = {
          file_size_human: this.formatFileSize(audioData.length),
          estimated_duration: this.estimateAudioDuration(audioData.length),
          format: 'MP3'
        };
        
        toolLogger.debug('Downloaded audio results', {
          jobId,
          audioSize: audioData.length
        });
        
      } catch (error) {
        toolLogger.warn('Failed to download audio results', {
          jobId,
          error: error instanceof Error ? error.message : String(error)
        });
        
        if (format === 'audio') {
          throw error; // If only audio was requested, fail completely
        }
      }
    }
    
    // Create JSON metadata file
    if (format === 'json' || format === 'all' || includeMetadata) {
      try {
        metadata = {
          job_id: jobId,
          job_type: jobType,
          status: jobStatus.status,
          created_at: jobStatus.createdAt,
          updated_at: jobStatus.updatedAt,
          processing_info: {
            step: jobStatus.step,
            progress: jobStatus.progress,
            message: jobStatus.message
          },
          results: jobStatus.results,
          download_info: {
            downloaded_at: new Date().toISOString(),
            formats: downloadedFormats,
            total_files: files.length
          }
        };
        
        const jsonData = JSON.stringify(metadata, null, 2);
        const jsonPath = await this.fileHandler.saveResults(
          jsonData,
          jobId,
          'json',
          saveDirectory
        );
        
        const jsonSize = Buffer.byteLength(jsonData, 'utf8');
        files.push({
          format: 'json',
          path: jsonPath,
          name: `${jobId}.json`,
          size: jsonSize,
          mimeType: 'application/json'
        });
        
        totalSize += jsonSize;
        if (!downloadedFormats.includes('json')) {
          downloadedFormats.push('json');
        }
        
        // Add JSON preview
        contentPreviews.json = {
          keys: Object.keys(metadata),
          size_formatted: this.formatFileSize(jsonSize)
        };
        
        toolLogger.debug('Created JSON metadata', {
          jobId,
          jsonSize,
          keys: Object.keys(metadata).length
        });
        
      } catch (error) {
        toolLogger.warn('Failed to create JSON metadata', {
          jobId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return {
      files,
      contentPreviews,
      totalSize,
      downloadedFormats,
      metadata
    };
  }
  
  /**
   * Generate usage instructions for downloaded files
   */
  private generateUsageInstructions(
    files: Array<{ format: string; path: string; name: string }>,
    jobType: string
  ): {
    general: string[];
    by_format: Record<string, string[]>;
    integration: string[];
  } {
    const instructions = {
      general: [
        'All files have been saved to the specified directory',
        'File paths are absolute and can be used directly',
        'Files are organized by job ID for easy identification'
      ],
      by_format: {} as Record<string, string[]>,
      integration: [] as string[]
    };
    
    // Format-specific instructions
    for (const file of files) {
      switch (file.format) {
        case 'text':
          instructions.by_format.text = [
            'Use the text file for descriptions and captions',
            'Content can be copied directly into documentation or CMS',
            jobType === 'video' 
              ? 'Text includes timestamped segments for video synchronization'
              : 'Text includes detailed accessibility descriptions'
          ];
          break;
          
        case 'audio':
          instructions.by_format.audio = [
            'Audio file is in MP3 format compatible with most players',
            'Use for audio narration or accessibility applications',
            'Can be embedded in web pages or mobile applications'
          ];
          break;
          
        case 'json':
          instructions.by_format.json = [
            'JSON contains structured metadata and processing details',
            'Use for programmatic access to results and configuration',
            'Includes confidence scores and technical details'
          ];
          break;
      }
    }
    
    // Integration instructions based on job type
    if (jobType === 'image') {
      instructions.integration = [
        'Use alt text from JSON for HTML img alt attributes',
        'Detailed description can be used for aria-describedby',
        'Audio file can provide additional accessibility support'
      ];
    } else if (jobType === 'video') {
      instructions.integration = [
        'Text file contains timestamped segments for video players',
        'Audio can be synchronized with video playback',
        'JSON includes segment timing for programmatic integration'
      ];
    }
    
    return instructions;
  }
  
  /**
   * Estimate audio duration from file size (rough approximation)
   */
  private estimateAudioDuration(sizeBytes: number): string {
    // Rough estimate: ~1KB per second for low-quality MP3
    const estimatedSeconds = Math.round(sizeBytes / 1024);
    return this.formatDuration(estimatedSeconds * 1000);
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
  
  /**
   * Format duration in milliseconds to human readable string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}