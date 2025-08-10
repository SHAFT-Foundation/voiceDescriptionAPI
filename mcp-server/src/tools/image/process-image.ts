import { z } from 'zod';
import { Tool, ToolContext, MCPToolError, ErrorCode } from '../../types/index.js';
import { APIClient } from '../../adapters/api-client.js';
import { FileHandler } from '../../adapters/file-handler.js';
import { logger, createLogger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

const toolLogger = createLogger('process-image-tool');

const processImageSchema = z.object({
  image_path: z.string()
    .min(1)
    .describe('Path to the image file to process'),
  
  detail_level: z.enum(['basic', 'comprehensive', 'technical'])
    .optional()
    .default('comprehensive')
    .describe('Level of detail in description - basic (brief), comprehensive (detailed), technical (includes technical details)'),
  
  generate_audio: z.boolean()
    .optional()
    .default(true)
    .describe('Generate audio narration of the description'),
  
  include_alt_text: z.boolean()
    .optional()
    .default(true)
    .describe('Include HTML alt text suitable for web accessibility'),
  
  context: z.string()
    .optional()
    .describe('Additional context about the image usage (e.g., "product photo for e-commerce", "diagram in technical documentation")'),
  
  voice_id: z.string()
    .optional()
    .default('Joanna')
    .describe('AWS Polly voice ID for audio generation (Joanna, Matthew, Salli, Joey, etc.)'),
  
  language: z.enum(['en', 'es', 'fr', 'de', 'ja', 'zh'])
    .optional()
    .default('en')
    .describe('Language for description and audio generation')
});

export class ProcessImageTool implements Tool {
  name = 'voice_description_process_image';
  description = 'Process a single image for accessibility description with optional audio narration';
  inputSchema = processImageSchema;
  
  private apiClient: APIClient;
  private fileHandler: FileHandler;
  
  constructor() {
    this.apiClient = new APIClient();
    this.fileHandler = new FileHandler();
  }
  
  async execute(
    params: z.infer<typeof processImageSchema>,
    context: ToolContext
  ) {
    const startTime = Date.now();
    
    toolLogger.info('Starting image processing', {
      imagePath: params.image_path,
      detailLevel: params.detail_level,
      generateAudio: params.generate_audio,
      includeAltText: params.include_alt_text,
      context: params.context,
      voiceId: params.voice_id,
      language: params.language,
      requestId: context.requestId
    });
    
    try {
      // Validate file path
      const pathValidation = this.fileHandler.validateFilePath(params.image_path);
      if (!pathValidation.valid) {
        throw new MCPToolError(
          pathValidation.error?.includes('not exist') ? ErrorCode.FILE_NOT_FOUND :
          pathValidation.error?.includes('size') ? ErrorCode.FILE_TOO_LARGE :
          ErrorCode.INVALID_PARAMETERS,
          pathValidation.error!,
          pathValidation.details
        );
      }
      
      // Validate image file type
      const typeValidation = this.fileHandler.validateFileType(
        params.image_path,
        config.files.allowedImageTypes
      );
      if (!typeValidation.valid) {
        throw new MCPToolError(
          ErrorCode.UNSUPPORTED_FORMAT,
          typeValidation.error!,
          {
            ...typeValidation.details,
            supportedFormats: config.files.allowedImageTypes
          }
        );
      }
      
      // Get file info and read the image
      const fileInfo = await this.fileHandler.getFileInfo(params.image_path);
      const fileData = await this.fileHandler.readFile(params.image_path);
      
      toolLogger.info('File loaded successfully', {
        fileName: fileInfo.name,
        size: fileInfo.size,
        mimeType: fileInfo.mimeType,
        bufferSize: fileData.buffer!.length,
        requestId: context.requestId
      });
      
      // Process through API
      const result = await this.apiClient.processImage({
        file: fileData.buffer!,
        fileName: fileData.name,
        mimeType: fileData.mimeType,
        options: {
          detailLevel: params.detail_level,
          generateAudio: params.generate_audio,
          includeAltText: params.include_alt_text,
          voiceId: params.voice_id,
          language: params.language,
        },
        metadata: {
          context: params.context,
        },
      });
      
      const processingTime = Date.now() - startTime;
      
      toolLogger.info('Image processing completed', {
        jobId: result.jobId,
        status: result.status,
        processingTime: `${processingTime}ms`,
        confidence: result.results?.confidence,
        requestId: context.requestId
      });
      
      // Format the response with comprehensive information
      const response = {
        success: true,
        job_id: result.jobId,
        status: result.status,
        processing_time_ms: processingTime,
        processing_time_human: this.formatDuration(processingTime),
        
        // Core results
        results: {
          // Main description
          description: result.results.detailedDescription,
          
          // Accessibility text
          alt_text: result.results.altText,
          
          // Visual analysis
          visual_elements: result.results.visualElements || [],
          colors: result.results.colors || [],
          composition: result.results.composition,
          
          // Confidence and quality metrics
          confidence: result.results.confidence,
          confidence_level: this.getConfidenceLevel(result.results.confidence),
          
          // Audio narration (if generated)
          audio: result.results.audioFile ? {
            url: result.results.audioFile.url,
            duration_seconds: result.results.audioFile.duration,
            duration_human: this.formatDuration(result.results.audioFile.duration * 1000),
            format: result.results.audioFile.format,
            voice_id: params.voice_id,
            language: params.language
          } : undefined,
          
          // HTML/Web metadata
          html_metadata: result.results.htmlMetadata || {
            alt_attribute: result.results.altText,
            aria_label: `Image: ${result.results.altText}`,
            title: result.results.detailedDescription.substring(0, 100) + '...'
          }
        },
        
        // Processing metadata
        processing_info: {
          detail_level: params.detail_level,
          audio_generated: params.generate_audio && !!result.results.audioFile,
          alt_text_included: params.include_alt_text,
          language: params.language,
          context_provided: !!params.context
        },
        
        // Source file information
        source_info: {
          file_name: fileInfo.name,
          file_size_bytes: fileInfo.size,
          file_size_human: this.formatFileSize(fileInfo.size!),
          mime_type: fileInfo.mimeType,
          file_extension: fileInfo.extension
        },
        
        // Usage recommendations
        usage_recommendations: this.generateUsageRecommendations(
          result.results,
          params.detail_level,
          params.context
        )
      };
      
      toolLogger.debug('Generated response', {
        jobId: result.jobId,
        hasAudio: !!response.results.audio,
        descriptionLength: response.results.description.length,
        altTextLength: response.results.alt_text.length,
        visualElementsCount: response.results.visual_elements.length,
        requestId: context.requestId
      });
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      toolLogger.error('Image processing failed', {
        imagePath: params.image_path,
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
        'Failed to process image',
        {
          originalError: error instanceof Error ? error.message : String(error),
          imagePath: params.image_path,
          duration: `${duration}ms`
        }
      );
    }
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
   * Generate usage recommendations based on processing results
   */
  private generateUsageRecommendations(
    results: any,
    detailLevel: string,
    context?: string
  ): {
    web_accessibility: string[];
    content_management: string[];
    social_media: string[];
    documentation: string[];
  } {
    const recommendations = {
      web_accessibility: [
        `Use the alt_text "${results.altText}" for the HTML alt attribute`,
        'Consider the detailed description for aria-describedby if more context is needed',
      ],
      content_management: [
        'Tag the image with the identified visual elements for better searchability',
        'Use the detailed description for image metadata and cataloging',
      ],
      social_media: [
        'Use the detailed description as a caption for accessibility',
        'Include color and composition information for visually impaired followers',
      ],
      documentation: [
        'Include both the description and technical details in documentation',
        'Reference specific visual elements when explaining concepts',
      ]
    };
    
    // Add context-specific recommendations
    if (context) {
      if (context.toLowerCase().includes('ecommerce') || context.toLowerCase().includes('product')) {
        recommendations.content_management.push(
          'Use color information for product filtering and search',
          'Include visual elements in product tags and categories'
        );
      }
      
      if (context.toLowerCase().includes('technical') || context.toLowerCase().includes('diagram')) {
        recommendations.documentation.push(
          'Focus on the technical detail level for accurate documentation',
          'Use visual elements to create cross-references'
        );
      }
    }
    
    // Add detail level specific recommendations
    if (detailLevel === 'basic') {
      recommendations.web_accessibility.push('Basic level is suitable for simple alt text requirements');
    } else if (detailLevel === 'comprehensive') {
      recommendations.web_accessibility.push('Comprehensive level provides rich accessibility descriptions');
    } else if (detailLevel === 'technical') {
      recommendations.documentation.push('Technical level includes detailed visual analysis perfect for documentation');
    }
    
    return recommendations;
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