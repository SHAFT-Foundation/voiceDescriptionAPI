import { NextApiRequest, NextApiResponse } from 'next';
import { PipelineSelector } from '../../../src/orchestrator/pipelineSelector';
import { UnifiedPipelineOrchestrator } from '../../../src/orchestrator/unifiedPipelineOrchestrator';
import { logger } from '../../../src/utils/logger';

// AWS Configuration
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  inputBucket: process.env.INPUT_S3_BUCKET || 'voice-description-api-input',
  outputBucket: process.env.OUTPUT_S3_BUCKET || 'voice-description-api-output',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
};

const pipelineSelector = new PipelineSelector();
const orchestrator = new UnifiedPipelineOrchestrator(awsConfig);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET and POST methods allowed',
      },
      timestamp: new Date(),
    });
  }

  try {
    logger.info('Pipeline comparison requested', { method: req.method });

    if (req.method === 'GET') {
      // Return general pipeline statistics and information
      const statistics = pipelineSelector.getPipelineStatistics();
      const openaiAvailable = await orchestrator.validateOpenAIAvailability();

      return res.status(200).json({
        success: true,
        data: {
          pipelines: statistics.pipelines.map(p => ({
            ...p,
            available: p.name === 'openai' ? openaiAvailable : true,
            status: p.name === 'openai' && !openaiAvailable ? 
              'OpenAI API not configured or unavailable' : 'Available',
          })),
          defaultPipeline: statistics.defaultPipeline,
          recommendation: {
            forSmallVideos: 'openai',
            forLargeVideos: 'aws',
            forBalanced: 'hybrid',
            forImages: 'openai',
          },
          features: {
            openai: {
              pros: [
                'Superior quality for small files',
                'Faster processing for short videos',
                'Advanced Vision API capabilities',
                'Multiple description formats',
                'Custom prompt support',
              ],
              cons: [
                '25MB file size limit',
                '3-minute duration limit',
                'Higher token costs',
                'Rate limiting concerns',
              ],
              bestFor: [
                'Short promotional videos',
                'Social media content',
                'Product demonstrations',
                'Educational clips',
                'High-priority content',
              ],
            },
            aws: {
              pros: [
                'Handles large files (500MB+)',
                'Long video support',
                'Professional scene detection',
                'Cost-effective at scale',
                'Parallel processing',
              ],
              cons: [
                'Slower for small files',
                'Less detailed descriptions',
                'Fixed processing pipeline',
              ],
              bestFor: [
                'Feature films',
                'TV episodes',
                'Long-form content',
                'Batch processing',
                'Cost-sensitive projects',
              ],
            },
            hybrid: {
              pros: [
                'Best of both worlds',
                'Intelligent scene detection',
                'OpenAI quality analysis',
                'Flexible processing',
                'Good for medium files',
              ],
              cons: [
                'More complex pipeline',
                'Potentially higher latency',
                'Mixed cost structure',
              ],
              bestFor: [
                'Medium-length videos',
                'Content with varied complexity',
                'Enterprise workloads',
                'Quality-critical projects',
              ],
            },
          },
          pricing: {
            openai: {
              model: 'Token-based',
              estimate: '$0.01 per 1K tokens',
              averagePerMinute: '$0.50-$1.00',
            },
            aws: {
              model: 'Service-based',
              rekognition: '$0.10 per minute',
              bedrock: '$0.05 per scene',
              polly: '$4.00 per 1M characters',
            },
            hybrid: {
              model: 'Combined',
              estimate: 'AWS Rekognition + OpenAI tokens',
            },
          },
        },
        timestamp: new Date(),
      });

    } else {
      // POST method - analyze specific file and recommend pipeline
      const { fileSize, duration, fileType, priority, requirements } = req.body;

      if (!fileSize && !duration && !fileType) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'Provide at least one of: fileSize, duration, or fileType',
          },
          timestamp: new Date(),
        });
      }

      // Determine if it's video or image
      const isImage = fileType?.startsWith('image/') || 
                     ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileType);

      let recommendation;
      
      if (isImage) {
        // Image recommendation
        recommendation = await pipelineSelector.selectImageProcessingPipeline(
          { options: { detailLevel: requirements?.detailLevel } },
          fileSize
        );
      } else {
        // Video recommendation
        recommendation = await pipelineSelector.selectVideoProcessingPipeline(
          { 
            metadata: { 
              priority,
              language: requirements?.language 
            } 
          },
          fileSize,
          duration
        );
      }

      // Validate the recommendation
      const validation = pipelineSelector.validatePipelineSelection(
        recommendation.pipeline,
        fileSize,
        duration
      );

      // Calculate estimated processing time
      const estimatedTime = calculateEstimatedTime(
        recommendation.pipeline,
        fileSize,
        duration,
        isImage
      );

      // Calculate estimated cost
      const estimatedCost = calculateEstimatedCost(
        recommendation.pipeline,
        fileSize,
        duration,
        isImage
      );

      return res.status(200).json({
        success: true,
        data: {
          recommendation: {
            pipeline: recommendation.pipeline,
            reason: recommendation.reason,
            autoSelected: recommendation.autoSelected,
            confidence: validation.valid ? 'high' : 'low',
          },
          validation: {
            valid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings,
          },
          estimates: {
            processingTime: estimatedTime,
            cost: estimatedCost,
          },
          alternatives: getAlternativePipelines(
            recommendation.pipeline,
            isImage
          ),
          inputAnalysis: {
            fileSize: fileSize ? `${(fileSize / 1024 / 1024).toFixed(2)} MB` : null,
            duration: duration ? `${duration} seconds` : null,
            fileType,
            isImage,
            priority,
          },
        },
        timestamp: new Date(),
      });
    }

  } catch (error) {
    logger.error('Pipeline comparison failed', { error });

    return res.status(500).json({
      success: false,
      error: {
        code: 'COMPARISON_FAILED',
        message: 'Failed to compare pipelines',
        details: error instanceof Error ? error.message : String(error),
      },
      timestamp: new Date(),
    });
  }
}

function calculateEstimatedTime(
  pipeline: string,
  fileSize?: number,
  duration?: number,
  isImage?: boolean
): string {
  if (isImage) {
    return pipeline === 'openai' ? '5-10 seconds' : '10-15 seconds';
  }

  const durationMinutes = (duration || 60) / 60;
  
  switch (pipeline) {
    case 'openai':
      return `${Math.ceil(durationMinutes * 2)}-${Math.ceil(durationMinutes * 3)} minutes`;
    case 'aws':
      return `${Math.ceil(durationMinutes * 3)}-${Math.ceil(durationMinutes * 5)} minutes`;
    case 'hybrid':
      return `${Math.ceil(durationMinutes * 2.5)}-${Math.ceil(durationMinutes * 4)} minutes`;
    default:
      return 'Unknown';
  }
}

function calculateEstimatedCost(
  pipeline: string,
  fileSize?: number,
  duration?: number,
  isImage?: boolean
): {
  min: string;
  max: string;
  breakdown?: Record<string, string>;
} {
  if (isImage) {
    return pipeline === 'openai' 
      ? { min: '$0.01', max: '$0.05', breakdown: { 'OpenAI Tokens': '$0.01-$0.05' } }
      : { min: '$0.05', max: '$0.10', breakdown: { 'Bedrock': '$0.05', 'Polly': '$0.01-$0.05' } };
  }

  const durationMinutes = (duration || 60) / 60;
  
  switch (pipeline) {
    case 'openai':
      return {
        min: `$${(durationMinutes * 0.5).toFixed(2)}`,
        max: `$${(durationMinutes * 1.0).toFixed(2)}`,
        breakdown: {
          'OpenAI Tokens': `$${(durationMinutes * 0.5).toFixed(2)}-$${(durationMinutes * 1.0).toFixed(2)}`,
        },
      };
    case 'aws':
      return {
        min: `$${(durationMinutes * 0.15).toFixed(2)}`,
        max: `$${(durationMinutes * 0.30).toFixed(2)}`,
        breakdown: {
          'Rekognition': `$${(durationMinutes * 0.10).toFixed(2)}`,
          'Bedrock': `$${(durationMinutes * 0.05).toFixed(2)}`,
          'Polly': '$0.01-$0.05',
        },
      };
    case 'hybrid':
      return {
        min: `$${(durationMinutes * 0.30).toFixed(2)}`,
        max: `$${(durationMinutes * 0.60).toFixed(2)}`,
        breakdown: {
          'Rekognition': `$${(durationMinutes * 0.10).toFixed(2)}`,
          'OpenAI': `$${(durationMinutes * 0.20).toFixed(2)}-$${(durationMinutes * 0.45).toFixed(2)}`,
          'Polly': '$0.01-$0.05',
        },
      };
    default:
      return { min: 'Unknown', max: 'Unknown' };
  }
}

function getAlternativePipelines(
  recommended: string,
  isImage: boolean
): Array<{
  pipeline: string;
  tradeoff: string;
}> {
  if (isImage) {
    return recommended === 'openai'
      ? [{ pipeline: 'aws', tradeoff: 'Lower cost, slightly less detail' }]
      : [{ pipeline: 'openai', tradeoff: 'Higher quality, higher cost' }];
  }

  const alternatives = [];
  
  if (recommended !== 'openai') {
    alternatives.push({
      pipeline: 'openai',
      tradeoff: 'Higher quality, file size limitations',
    });
  }
  
  if (recommended !== 'aws') {
    alternatives.push({
      pipeline: 'aws',
      tradeoff: 'Lower cost, handles large files',
    });
  }
  
  if (recommended !== 'hybrid') {
    alternatives.push({
      pipeline: 'hybrid',
      tradeoff: 'Balanced approach, more complex',
    });
  }

  return alternatives;
}