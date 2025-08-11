import { logger } from '../utils/logger';
import { 
  UploadRequest, 
  ImageProcessRequest,
  PipelineType,
  PipelineSelectionCriteria,
  PipelineConfig
} from '../types';

export interface PipelineSelectionResult {
  pipeline: PipelineType;
  reason: string;
  autoSelected: boolean;
  config: PipelineConfig;
}

export class PipelineSelector {
  private readonly openAIMaxVideoSizeMB: number;
  private readonly openAIMaxVideoDurationSeconds: number;
  private readonly defaultPipeline: PipelineType;
  
  constructor() {
    // Load configuration from environment variables
    this.openAIMaxVideoSizeMB = parseInt(process.env.OPENAI_MAX_VIDEO_SIZE_MB || '25');
    this.openAIMaxVideoDurationSeconds = parseInt(process.env.OPENAI_MAX_DURATION_SECONDS || '180');
    this.defaultPipeline = (process.env.DEFAULT_PIPELINE as PipelineType) || 'aws';
  }

  /**
   * Select the optimal pipeline for video processing
   */
  async selectVideoProcessingPipeline(
    request: UploadRequest & { pipeline?: PipelineType },
    fileSize?: number,
    duration?: number
  ): Promise<PipelineSelectionResult> {
    logger.info('Selecting video processing pipeline', {
      requestedPipeline: request.pipeline,
      fileSize,
      duration,
      metadata: request.metadata
    });

    // If user explicitly requested a pipeline, use it
    if (request.pipeline) {
      logger.info('Using user-requested pipeline', { pipeline: request.pipeline });
      return {
        pipeline: request.pipeline,
        reason: 'User explicitly requested this pipeline',
        autoSelected: false,
        config: this.getPipelineConfig(request.pipeline)
      };
    }

    // Auto-select based on criteria
    const criteria: PipelineSelectionCriteria = {
      fileSize,
      duration,
      language: request.metadata?.language,
      priority: request.metadata?.priority
    };

    const selectedPipeline = this.autoSelectPipeline(criteria);
    
    logger.info('Auto-selected pipeline', { 
      pipeline: selectedPipeline.pipeline,
      reason: selectedPipeline.reason 
    });

    return selectedPipeline;
  }

  /**
   * Select the optimal pipeline for image processing
   */
  async selectImageProcessingPipeline(
    request: ImageProcessRequest & { pipeline?: PipelineType },
    fileSize?: number
  ): Promise<PipelineSelectionResult> {
    logger.info('Selecting image processing pipeline', {
      requestedPipeline: request.pipeline,
      fileSize,
      options: request.options
    });

    // If user explicitly requested a pipeline, use it
    if (request.pipeline) {
      logger.info('Using user-requested pipeline', { pipeline: request.pipeline });
      return {
        pipeline: request.pipeline,
        reason: 'User explicitly requested this pipeline',
        autoSelected: false,
        config: this.getPipelineConfig(request.pipeline)
      };
    }

    // For images, prefer OpenAI for better quality and faster processing
    const useOpenAI = this.shouldUseOpenAIForImage(fileSize, request.options?.detailLevel);
    
    const selectedPipeline: PipelineType = useOpenAI ? 'openai' : 'aws';
    const reason = useOpenAI 
      ? 'OpenAI provides superior image analysis with Vision API'
      : 'AWS pipeline selected for compatibility';

    logger.info('Auto-selected pipeline for image', { 
      pipeline: selectedPipeline,
      reason 
    });

    return {
      pipeline: selectedPipeline,
      reason,
      autoSelected: true,
      config: this.getPipelineConfig(selectedPipeline)
    };
  }

  /**
   * Auto-select pipeline based on criteria
   */
  private autoSelectPipeline(criteria: PipelineSelectionCriteria): PipelineSelectionResult {
    // Check if OpenAI is suitable for this request
    const openAIReasons = this.checkOpenAISuitability(criteria);
    
    if (openAIReasons.suitable) {
      return {
        pipeline: 'openai',
        reason: openAIReasons.reason,
        autoSelected: true,
        config: this.getPipelineConfig('openai')
      };
    }

    // Check if hybrid approach would be beneficial
    const hybridReasons = this.checkHybridSuitability(criteria);
    
    if (hybridReasons.suitable) {
      return {
        pipeline: 'hybrid',
        reason: hybridReasons.reason,
        autoSelected: true,
        config: this.getPipelineConfig('hybrid')
      };
    }

    // Default to AWS pipeline
    return {
      pipeline: 'aws',
      reason: openAIReasons.reason || 'AWS pipeline selected as default',
      autoSelected: true,
      config: this.getPipelineConfig('aws')
    };
  }

  /**
   * Check if OpenAI pipeline is suitable
   */
  private checkOpenAISuitability(criteria: PipelineSelectionCriteria): {
    suitable: boolean;
    reason: string;
  } {
    // Check file size constraint
    if (criteria.fileSize && criteria.fileSize > this.openAIMaxVideoSizeMB * 1024 * 1024) {
      return {
        suitable: false,
        reason: `File size (${Math.round(criteria.fileSize / 1024 / 1024)}MB) exceeds OpenAI limit (${this.openAIMaxVideoSizeMB}MB)`
      };
    }

    // Check duration constraint
    if (criteria.duration && criteria.duration > this.openAIMaxVideoDurationSeconds) {
      return {
        suitable: false,
        reason: `Duration (${criteria.duration}s) exceeds OpenAI limit (${this.openAIMaxVideoDurationSeconds}s)`
      };
    }

    // Check for high priority requests (prefer faster OpenAI)
    if (criteria.priority === 'high') {
      return {
        suitable: true,
        reason: 'High priority request - using faster OpenAI pipeline'
      };
    }

    // If file is small enough, prefer OpenAI for quality
    if (criteria.fileSize && criteria.fileSize < 10 * 1024 * 1024) { // < 10MB
      return {
        suitable: true,
        reason: 'Small file size - OpenAI provides better quality for small videos'
      };
    }

    // If duration is short, prefer OpenAI
    if (criteria.duration && criteria.duration < 60) { // < 1 minute
      return {
        suitable: true,
        reason: 'Short duration - OpenAI provides faster processing'
      };
    }

    return {
      suitable: false,
      reason: 'File characteristics better suited for AWS pipeline'
    };
  }

  /**
   * Check if hybrid pipeline would be beneficial
   */
  private checkHybridSuitability(criteria: PipelineSelectionCriteria): {
    suitable: boolean;
    reason: string;
  } {
    // Use hybrid for medium-sized videos that need both speed and scalability
    if (criteria.fileSize && 
        criteria.fileSize > 20 * 1024 * 1024 && 
        criteria.fileSize < 100 * 1024 * 1024) {
      return {
        suitable: true,
        reason: 'Medium-sized file - using hybrid approach for optimal performance'
      };
    }

    // Use hybrid for videos with mixed content complexity
    if (criteria.duration && 
        criteria.duration > 60 && 
        criteria.duration < 300) {
      return {
        suitable: true,
        reason: 'Medium duration - hybrid approach balances speed and cost'
      };
    }

    return {
      suitable: false,
      reason: 'File characteristics do not benefit from hybrid approach'
    };
  }

  /**
   * Check if OpenAI should be used for image processing
   */
  private shouldUseOpenAIForImage(
    fileSize?: number,
    detailLevel?: string
  ): boolean {
    // Always use OpenAI for technical detail level
    if (detailLevel === 'technical') {
      return true;
    }

    // Use OpenAI for smaller images (better quality)
    if (fileSize && fileSize < 20 * 1024 * 1024) { // < 20MB
      return true;
    }

    // Check if OpenAI is configured and available
    if (process.env.OPENAI_API_KEY) {
      return true;
    }

    return false;
  }

  /**
   * Get configuration for selected pipeline
   */
  private getPipelineConfig(pipeline: PipelineType): PipelineConfig {
    switch (pipeline) {
      case 'openai':
        return {
          provider: 'openai',
          maxFileSize: this.openAIMaxVideoSizeMB * 1024 * 1024,
          maxDuration: this.openAIMaxVideoDurationSeconds,
          supportedFormats: ['mp4', 'webm', 'mov', 'avi', 'jpg', 'png', 'gif', 'webp'],
          features: {
            videoChunking: true,
            batchProcessing: true,
            multiModal: true,
            customPrompts: true
          },
          rateLimits: {
            requestsPerMinute: parseInt(process.env.OPENAI_RPM || '50'),
            tokensPerMinute: parseInt(process.env.OPENAI_TPM || '40000')
          }
        };

      case 'aws':
        return {
          provider: 'aws',
          maxFileSize: parseInt(process.env.MAX_VIDEO_SIZE_MB || '500') * 1024 * 1024,
          maxDuration: parseInt(process.env.MAX_VIDEO_DURATION_SECONDS || '3600'),
          supportedFormats: ['mp4', 'mov', 'avi', 'mkv', 'jpg', 'png', 'bmp'],
          features: {
            videoSegmentation: true,
            sceneDetection: true,
            parallelProcessing: true,
            rekognitionLabels: true
          },
          rateLimits: {
            requestsPerMinute: 100,
            concurrentJobs: parseInt(process.env.AWS_CONCURRENT_JOBS || '10')
          }
        };

      case 'hybrid':
        return {
          provider: 'hybrid',
          maxFileSize: parseInt(process.env.MAX_VIDEO_SIZE_MB || '500') * 1024 * 1024,
          maxDuration: parseInt(process.env.MAX_VIDEO_DURATION_SECONDS || '3600'),
          supportedFormats: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'jpg', 'png', 'gif', 'webp'],
          features: {
            videoChunking: true,
            videoSegmentation: true,
            sceneDetection: true,
            multiModal: true,
            bestOfBothWorlds: true
          },
          rateLimits: {
            requestsPerMinute: 75,
            tokensPerMinute: 40000,
            concurrentJobs: 10
          }
        };

      default:
        return this.getPipelineConfig('aws');
    }
  }

  /**
   * Validate pipeline selection for given request
   */
  validatePipelineSelection(
    pipeline: PipelineType,
    fileSize?: number,
    duration?: number
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const config = this.getPipelineConfig(pipeline);

    // Validate file size
    if (fileSize && fileSize > config.maxFileSize) {
      errors.push(
        `File size (${Math.round(fileSize / 1024 / 1024)}MB) exceeds ${pipeline} pipeline limit (${Math.round(config.maxFileSize / 1024 / 1024)}MB)`
      );
    }

    // Validate duration
    if (duration && duration > config.maxDuration) {
      errors.push(
        `Duration (${duration}s) exceeds ${pipeline} pipeline limit (${config.maxDuration}s)`
      );
    }

    // Add warnings for suboptimal choices
    if (pipeline === 'aws' && fileSize && fileSize < 5 * 1024 * 1024) {
      warnings.push('Small files process faster with OpenAI pipeline');
    }

    if (pipeline === 'openai' && fileSize && fileSize > 20 * 1024 * 1024) {
      warnings.push('Large files may require chunking, consider AWS pipeline');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get pipeline statistics and recommendations
   */
  getPipelineStatistics(): {
    pipelines: {
      name: PipelineType;
      config: PipelineConfig;
      recommended: string[];
    }[];
    defaultPipeline: PipelineType;
  } {
    return {
      pipelines: [
        {
          name: 'openai',
          config: this.getPipelineConfig('openai'),
          recommended: [
            'Small videos (< 25MB)',
            'Short duration (< 3 min)',
            'High priority requests',
            'Technical image analysis',
            'Detailed scene descriptions'
          ]
        },
        {
          name: 'aws',
          config: this.getPipelineConfig('aws'),
          recommended: [
            'Large videos (> 25MB)',
            'Long duration (> 3 min)',
            'Batch processing',
            'Professional video content',
            'Cost-sensitive workloads'
          ]
        },
        {
          name: 'hybrid',
          config: this.getPipelineConfig('hybrid'),
          recommended: [
            'Medium-sized videos (20-100MB)',
            'Mixed content complexity',
            'Balance of speed and cost',
            'Enterprise workloads',
            'High availability requirements'
          ]
        }
      ],
      defaultPipeline: this.defaultPipeline
    };
  }
}