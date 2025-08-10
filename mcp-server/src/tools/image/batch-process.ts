import { z } from 'zod';
import { Tool, ToolContext, MCPToolError, ErrorCode } from '../../types/index.js';
import { APIClient } from '../../adapters/api-client.js';
import { FileHandler } from '../../adapters/file-handler.js';
import { logger, createLogger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import PQueue from 'p-queue';

const toolLogger = createLogger('batch-process-images-tool');

const batchProcessSchema = z.object({
  images: z.array(z.object({
    path: z.string().min(1).describe('Path to the image file'),
    id: z.string().optional().describe('Custom identifier for tracking this image'),
    context: z.string().optional().describe('Specific context for this image')
  })).min(1).max(50).describe('Array of image configurations (1-50 images max)'),
  
  options: z.object({
    detail_level: z.enum(['basic', 'comprehensive', 'technical'])
      .optional()
      .default('comprehensive')
      .describe('Level of detail for all images'),
    
    generate_audio: z.boolean()
      .optional()
      .default(true)
      .describe('Generate audio narration for all images'),
    
    voice_id: z.string()
      .optional()
      .default('Joanna')
      .describe('AWS Polly voice ID for audio generation'),
    
    language: z.enum(['en', 'es', 'fr', 'de', 'ja', 'zh'])
      .optional()
      .default('en')
      .describe('Language for descriptions and audio')
  }).optional().default({}),
  
  processing: z.object({
    parallel: z.boolean()
      .optional()
      .default(true)
      .describe('Process images in parallel for faster completion'),
    
    max_concurrent: z.number()
      .min(1)
      .max(10)
      .optional()
      .default(3)
      .describe('Maximum number of images to process simultaneously'),
    
    stop_on_first_error: z.boolean()
      .optional()
      .default(false)
      .describe('Stop processing remaining images if any image fails'),
    
    include_timing: z.boolean()
      .optional()
      .default(true)
      .describe('Include detailed timing information in results')
  }).optional().default({}),
  
  output: z.object({
    save_results: z.boolean()
      .optional()
      .default(false)
      .describe('Save individual results to files'),
    
    save_directory: z.string()
      .optional()
      .describe('Directory to save results (if save_results is true)'),
    
    include_summary: z.boolean()
      .optional()
      .default(true)
      .describe('Include batch processing summary'),
    
    include_recommendations: z.boolean()
      .optional()
      .default(true)
      .describe('Include usage recommendations for the batch')
  }).optional().default({})
});

export class BatchProcessImagesTool implements Tool {
  name = 'voice_description_batch_images';
  description = 'Process multiple images in batch for accessibility descriptions with parallel processing capabilities';
  inputSchema = batchProcessSchema;
  
  private apiClient: APIClient;
  private fileHandler: FileHandler;
  
  constructor() {
    this.apiClient = new APIClient();
    this.fileHandler = new FileHandler();
  }
  
  async execute(
    params: z.infer<typeof batchProcessSchema>,
    context: ToolContext
  ) {
    const startTime = Date.now();
    
    toolLogger.info('Starting batch image processing', {
      imageCount: params.images.length,
      parallel: params.processing?.parallel,
      maxConcurrent: params.processing?.max_concurrent,
      options: params.options,
      requestId: context.requestId
    });
    
    try {
      // Validate all images first
      const validationResults = await this.validateAllImages(params.images);
      const validImages = validationResults.valid;
      const invalidImages = validationResults.invalid;
      
      if (validImages.length === 0) {
        throw new MCPToolError(
          ErrorCode.INVALID_PARAMETERS,
          'No valid images found in batch',
          { invalidImages }
        );
      }
      
      if (invalidImages.length > 0) {
        toolLogger.warn('Some images failed validation', {
          validCount: validImages.length,
          invalidCount: invalidImages.length,
          invalidImages: invalidImages.map(img => ({
            path: img.path,
            error: img.error
          })),
          requestId: context.requestId
        });
      }
      
      // Generate batch ID for tracking
      const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      
      // Process images
      const processingResults = await this.processImages(
        validImages,
        params.options || {},
        params.processing || {},
        batchId,
        context.requestId
      );
      
      const totalDuration = Date.now() - startTime;
      
      // Save results if requested
      if (params.output?.save_results && params.output.save_directory) {
        await this.saveResults(
          processingResults.successful,
          params.output.save_directory,
          batchId
        );
      }
      
      toolLogger.info('Batch processing completed', {
        batchId,
        totalImages: params.images.length,
        validImages: validImages.length,
        successfulImages: processingResults.successful.length,
        failedImages: processingResults.failed.length,
        totalDuration: `${totalDuration}ms`,
        requestId: context.requestId
      });
      
      // Build comprehensive response
      const response = {
        success: processingResults.failed.length === 0 || !params.processing?.stop_on_first_error,
        batch_id: batchId,
        
        // Summary statistics
        summary: {
          total_images: params.images.length,
          validation_passed: validImages.length,
          validation_failed: invalidImages.length,
          processing_successful: processingResults.successful.length,
          processing_failed: processingResults.failed.length,
          completion_rate: Math.round((processingResults.successful.length / validImages.length) * 100),
          total_duration_ms: totalDuration,
          total_duration_human: this.formatDuration(totalDuration),
          average_time_per_image_ms: Math.round(totalDuration / validImages.length),
          average_time_per_image_human: this.formatDuration(totalDuration / validImages.length)
        },
        
        // Successful results
        results: processingResults.successful.map(result => ({
          image_id: result.imageId,
          source_path: result.sourcePath,
          success: true,
          processing_time_ms: result.processingTime,
          processing_time_human: this.formatDuration(result.processingTime),
          
          // Core results
          description: result.result.description,
          alt_text: result.result.alt_text,
          visual_elements: result.result.visual_elements,
          colors: result.result.colors,
          composition: result.result.composition,
          confidence: result.result.confidence,
          confidence_level: this.getConfidenceLevel(result.result.confidence),
          
          // Audio information (if generated)
          audio: result.result.audio,
          
          // HTML metadata
          html_metadata: result.result.html_metadata,
          
          // File information
          file_info: result.fileInfo
        })),
        
        // Failed validations
        validation_errors: invalidImages.map(img => ({
          image_path: img.path,
          image_id: img.id || 'unknown',
          error_type: 'validation_failed',
          error_message: img.error,
          error_details: img.details
        })),
        
        // Failed processing
        processing_errors: processingResults.failed.map(failure => ({
          image_id: failure.imageId,
          source_path: failure.sourcePath,
          error_type: 'processing_failed',
          error_message: failure.error,
          processing_time_ms: failure.processingTime,
          processing_time_human: this.formatDuration(failure.processingTime)
        })),
        
        // Processing configuration used
        processing_config: {
          detail_level: params.options?.detail_level || 'comprehensive',
          audio_generated: params.options?.generate_audio !== false,
          voice_id: params.options?.voice_id || 'Joanna',
          language: params.options?.language || 'en',
          parallel_processing: params.processing?.parallel !== false,
          max_concurrent: params.processing?.max_concurrent || 3,
          stopped_on_error: params.processing?.stop_on_first_error === true
        }
      };
      
      // Add optional sections
      if (params.output?.include_summary !== false) {
        response.summary = {
          ...response.summary,
          overall_confidence: this.calculateOverallConfidence(processingResults.successful),
          most_common_elements: this.findCommonElements(processingResults.successful),
          dominant_colors: this.findDominantColors(processingResults.successful)
        };
      }
      
      if (params.output?.include_recommendations !== false) {
        response.usage_recommendations = this.generateBatchRecommendations(
          processingResults.successful,
          params.options?.detail_level || 'comprehensive'
        );
      }
      
      if (params.processing?.include_timing !== false) {
        response.timing_analysis = this.generateTimingAnalysis(processingResults);
      }
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      toolLogger.error('Batch processing failed', {
        imageCount: params.images.length,
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
        'Batch image processing failed',
        {
          originalError: error instanceof Error ? error.message : String(error),
          imageCount: params.images.length,
          duration: `${duration}ms`
        }
      );
    }
  }
  
  /**
   * Validate all images before processing
   */
  private async validateAllImages(images: Array<{ path: string; id?: string; context?: string }>) {
    const valid: Array<{ path: string; id: string; context?: string; fileInfo: any }> = [];
    const invalid: Array<{ path: string; id?: string; error: string; details?: any }> = [];
    
    for (const [index, image] of images.entries()) {
      const imageId = image.id || `img-${index + 1}`;
      
      try {
        // Validate path
        const pathValidation = this.fileHandler.validateFilePath(image.path);
        if (!pathValidation.valid) {
          invalid.push({
            path: image.path,
            id: imageId,
            error: pathValidation.error!,
            details: pathValidation.details
          });
          continue;
        }
        
        // Validate type
        const typeValidation = this.fileHandler.validateFileType(
          image.path,
          config.files.allowedImageTypes
        );
        if (!typeValidation.valid) {
          invalid.push({
            path: image.path,
            id: imageId,
            error: typeValidation.error!,
            details: typeValidation.details
          });
          continue;
        }
        
        // Get file info
        const fileInfo = await this.fileHandler.getFileInfo(image.path);
        
        valid.push({
          path: image.path,
          id: imageId,
          context: image.context,
          fileInfo
        });
        
      } catch (error) {
        invalid.push({
          path: image.path,
          id: imageId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return { valid, invalid };
  }
  
  /**
   * Process images with parallel or sequential execution
   */
  private async processImages(
    images: Array<{ path: string; id: string; context?: string; fileInfo: any }>,
    options: any,
    processing: any,
    batchId: string,
    requestId?: string
  ) {
    const successful: Array<{
      imageId: string;
      sourcePath: string;
      processingTime: number;
      result: any;
      fileInfo: any;
    }> = [];
    
    const failed: Array<{
      imageId: string;
      sourcePath: string;
      processingTime: number;
      error: string;
    }> = [];
    
    if (processing.parallel !== false) {
      // Parallel processing with concurrency control
      const queue = new PQueue({ concurrency: processing.max_concurrent || 3 });
      
      const promises = images.map((image) =>
        queue.add(async () => {
          const startTime = Date.now();
          
          try {
            const result = await this.processSingleImage(image, options);
            const processingTime = Date.now() - startTime;
            
            successful.push({
              imageId: image.id,
              sourcePath: image.path,
              processingTime,
              result,
              fileInfo: image.fileInfo
            });
            
            toolLogger.debug('Image processed successfully', {
              batchId,
              imageId: image.id,
              processingTime: `${processingTime}ms`,
              requestId
            });
            
          } catch (error) {
            const processingTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            failed.push({
              imageId: image.id,
              sourcePath: image.path,
              processingTime,
              error: errorMessage
            });
            
            toolLogger.warn('Image processing failed', {
              batchId,
              imageId: image.id,
              error: errorMessage,
              processingTime: `${processingTime}ms`,
              requestId
            });
            
            // Stop on first error if requested
            if (processing.stop_on_first_error) {
              throw new MCPToolError(
                ErrorCode.PROCESSING_ERROR,
                `Batch processing stopped due to error in image ${image.id}`,
                { imageId: image.id, originalError: errorMessage }
              );
            }
          }
        })
      );
      
      await Promise.all(promises);
      
    } else {
      // Sequential processing
      for (const image of images) {
        const startTime = Date.now();
        
        try {
          const result = await this.processSingleImage(image, options);
          const processingTime = Date.now() - startTime;
          
          successful.push({
            imageId: image.id,
            sourcePath: image.path,
            processingTime,
            result,
            fileInfo: image.fileInfo
          });
          
          toolLogger.debug('Image processed successfully (sequential)', {
            batchId,
            imageId: image.id,
            processingTime: `${processingTime}ms`,
            requestId
          });
          
        } catch (error) {
          const processingTime = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          failed.push({
            imageId: image.id,
            sourcePath: image.path,
            processingTime,
            error: errorMessage
          });
          
          toolLogger.warn('Image processing failed (sequential)', {
            batchId,
            imageId: image.id,
            error: errorMessage,
            processingTime: `${processingTime}ms`,
            requestId
          });
          
          // Stop on first error if requested
          if (processing.stop_on_first_error) {
            throw new MCPToolError(
              ErrorCode.PROCESSING_ERROR,
              `Batch processing stopped due to error in image ${image.id}`,
              { imageId: image.id, originalError: errorMessage }
            );
          }
        }
      }
    }
    
    return { successful, failed };
  }
  
  /**
   * Process a single image
   */
  private async processSingleImage(
    image: { path: string; id: string; context?: string },
    options: any
  ) {
    // Read the image file
    const fileData = await this.fileHandler.readFile(image.path);
    
    // Process through API  
    const result = await this.apiClient.processImage({
      file: fileData.buffer!,
      fileName: fileData.name,
      mimeType: fileData.mimeType,
      options: {
        detailLevel: options.detail_level,
        generateAudio: options.generate_audio,
        includeAltText: true,
        voiceId: options.voice_id,
        language: options.language,
      },
      metadata: {
        context: image.context,
      },
    });
    
    // Return formatted result
    return {
      description: result.results.detailedDescription,
      alt_text: result.results.altText,
      visual_elements: result.results.visualElements || [],
      colors: result.results.colors || [],
      composition: result.results.composition,
      confidence: result.results.confidence,
      audio: result.results.audioFile ? {
        url: result.results.audioFile.url,
        duration_seconds: result.results.audioFile.duration,
        format: result.results.audioFile.format,
        voice_id: options.voice_id,
        language: options.language
      } : undefined,
      html_metadata: result.results.htmlMetadata || {
        alt_attribute: result.results.altText,
        aria_label: `Image: ${result.results.altText}`
      }
    };
  }
  
  /**
   * Save batch results to files
   */
  private async saveResults(
    results: Array<any>,
    directory: string,
    batchId: string
  ): Promise<void> {
    try {
      for (const result of results) {
        // Save text description
        await this.fileHandler.saveResults(
          result.result.description,
          `${batchId}-${result.imageId}`,
          'txt',
          directory
        );
        
        // Save structured data
        await this.fileHandler.saveResults(
          JSON.stringify({
            imageId: result.imageId,
            sourcePath: result.sourcePath,
            ...result.result
          }, null, 2),
          `${batchId}-${result.imageId}`,
          'json',
          directory
        );
      }
      
      toolLogger.info('Batch results saved', {
        batchId,
        directory,
        resultCount: results.length
      });
    } catch (error) {
      toolLogger.warn('Failed to save batch results', {
        batchId,
        directory,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Calculate overall confidence for the batch
   */
  private calculateOverallConfidence(results: Array<any>): number {
    if (results.length === 0) return 0;
    
    const sum = results.reduce((acc, result) => acc + (result.result.confidence || 0), 0);
    return Math.round((sum / results.length) * 100) / 100;
  }
  
  /**
   * Find most common visual elements across all images
   */
  private findCommonElements(results: Array<any>): Array<{ element: string; count: number; percentage: number }> {
    const elementCounts: Record<string, number> = {};
    
    for (const result of results) {
      const elements = result.result.visual_elements || [];
      for (const element of elements) {
        elementCounts[element] = (elementCounts[element] || 0) + 1;
      }
    }
    
    return Object.entries(elementCounts)
      .map(([element, count]) => ({
        element,
        count,
        percentage: Math.round((count / results.length) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 most common
  }
  
  /**
   * Find dominant colors across all images
   */
  private findDominantColors(results: Array<any>): Array<{ color: string; count: number; percentage: number }> {
    const colorCounts: Record<string, number> = {};
    
    for (const result of results) {
      const colors = result.result.colors || [];
      for (const color of colors) {
        colorCounts[color] = (colorCounts[color] || 0) + 1;
      }
    }
    
    return Object.entries(colorCounts)
      .map(([color, count]) => ({
        color,
        count,
        percentage: Math.round((count / results.length) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 most common colors
  }
  
  /**
   * Generate batch-specific usage recommendations
   */
  private generateBatchRecommendations(results: Array<any>, detailLevel: string) {
    return {
      content_strategy: [
        `Processed ${results.length} images with ${detailLevel} detail level`,
        'Use consistent alt text patterns across similar images',
        'Consider grouping images with similar visual elements for better organization'
      ],
      accessibility: [
        'Ensure all images have descriptive alt text for screen readers',
        'Use detailed descriptions for complex images that convey important information',
        'Consider audio descriptions for visually rich content'
      ],
      optimization: [
        'Batch processing is efficient for large image sets',
        'Consider caching descriptions for frequently used images',
        'Use the confidence scores to identify images that may need manual review'
      ],
      workflow: [
        'Save results to organized directories for easy retrieval',
        'Use image IDs for tracking and reference management',
        'Consider automated tagging based on visual elements'
      ]
    };
  }
  
  /**
   * Generate timing analysis for the batch
   */
  private generateTimingAnalysis(processingResults: any) {
    const all = [...processingResults.successful, ...processingResults.failed];
    const times = all.map(r => r.processingTime);
    
    if (times.length === 0) {
      return { message: 'No timing data available' };
    }
    
    times.sort((a, b) => a - b);
    
    return {
      total_images: all.length,
      fastest_ms: Math.min(...times),
      fastest_human: this.formatDuration(Math.min(...times)),
      slowest_ms: Math.max(...times),
      slowest_human: this.formatDuration(Math.max(...times)),
      median_ms: times[Math.floor(times.length / 2)],
      median_human: this.formatDuration(times[Math.floor(times.length / 2)]),
      average_ms: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      average_human: this.formatDuration(times.reduce((a, b) => a + b, 0) / times.length)
    };
  }
  
  /**
   * Get human-readable confidence level
   */
  private getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.9) return 'very high';
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.7) return 'good';
    if (confidence >= 0.6) return 'moderate';
    if (confidence >= 0.5) return 'low';
    return 'very low';
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