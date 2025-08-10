import { ToolRegistry } from './registry.js';
import { logger } from '../utils/logger.js';

// Import video processing tools
import { UploadVideoTool } from './video/upload-video.js';
import { ProcessVideoUrlTool } from './video/process-video-url.js';

// Import image processing tools
import { ProcessImageTool } from './image/process-image.js';
import { BatchProcessImagesTool } from './image/batch-process.js';

// Import job management tools
import { CheckStatusTool } from './results/check-status.js';
import { DownloadResultsTool } from './results/download-results.js';

// Import system tools
import { HealthCheckTool } from './system/health-check.js';
import { AWSStatusTool } from './system/aws-status.js';

/**
 * Register all MCP tools with the registry
 */
export async function registerAllTools(registry: ToolRegistry): Promise<number> {
  const tools = [
    // Video processing tools
    new UploadVideoTool(),
    new ProcessVideoUrlTool(),
    
    // Image processing tools
    new ProcessImageTool(),
    new BatchProcessImagesTool(),
    
    // Job management tools
    new CheckStatusTool(),
    new DownloadResultsTool(),
    
    // System tools
    new HealthCheckTool(),
    new AWSStatusTool(),
  ];
  
  let registeredCount = 0;
  const errors: Array<{ tool: string; error: string }> = [];
  
  for (const tool of tools) {
    try {
      registry.register(tool);
      registeredCount++;
      
      logger.debug('Tool registered successfully', {
        name: tool.name,
        description: tool.description
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ tool: tool.name, error: errorMsg });
      
      logger.error('Failed to register tool', {
        name: tool.name,
        error: errorMsg
      });
    }
  }
  
  if (errors.length > 0) {
    logger.warn('Some tools failed to register', {
      totalTools: tools.length,
      registered: registeredCount,
      failed: errors.length,
      errors
    });
  }
  
  logger.info('Tool registration completed', {
    totalTools: tools.length,
    registered: registeredCount,
    failed: errors.length
  });
  
  return registeredCount;
}

/**
 * Get list of all available tools with their metadata
 */
export function getToolMetadata() {
  return [
    // Video processing tools
    {
      name: 'voice_description_upload_video',
      category: 'video',
      description: 'Upload and process a video file for audio description generation',
      complexity: 'high',
      estimatedTime: '5-10 minutes',
      requiresPolling: true
    },
    {
      name: 'voice_description_process_video_url',
      category: 'video', 
      description: 'Process a video from an S3 URL',
      complexity: 'high',
      estimatedTime: '5-10 minutes',
      requiresPolling: true
    },
    
    // Image processing tools
    {
      name: 'voice_description_process_image',
      category: 'image',
      description: 'Process a single image for accessibility description',
      complexity: 'medium',
      estimatedTime: '10-30 seconds',
      requiresPolling: false
    },
    {
      name: 'voice_description_batch_images',
      category: 'image',
      description: 'Process multiple images in batch',
      complexity: 'medium',
      estimatedTime: '30 seconds - 5 minutes',
      requiresPolling: false
    },
    
    // Job management tools
    {
      name: 'voice_description_check_status',
      category: 'management',
      description: 'Check processing status of a job',
      complexity: 'low',
      estimatedTime: '1-2 seconds',
      requiresPolling: false
    },
    {
      name: 'voice_description_download_results',
      category: 'management',
      description: 'Download processing results',
      complexity: 'low',
      estimatedTime: '5-30 seconds',
      requiresPolling: false
    },
    
    // System tools
    {
      name: 'voice_description_health_check',
      category: 'system',
      description: 'Check API health and system status',
      complexity: 'low',
      estimatedTime: '1-3 seconds',
      requiresPolling: false
    },
    {
      name: 'voice_description_aws_status',
      category: 'system',
      description: 'Check AWS service status and quotas',
      complexity: 'low',
      estimatedTime: '2-5 seconds',
      requiresPolling: false
    }
  ];
}

/**
 * Get tools by category
 */
export function getToolsByCategory() {
  const metadata = getToolMetadata();
  const categories: Record<string, typeof metadata> = {};
  
  for (const tool of metadata) {
    if (!categories[tool.category]) {
      categories[tool.category] = [];
    }
    categories[tool.category].push(tool);
  }
  
  return categories;
}

/**
 * Get usage recommendations based on use case
 */
export function getUsageRecommendations(useCase: string): string[] {
  const recommendations: Record<string, string[]> = {
    'single-video': [
      'voice_description_upload_video',
      'voice_description_check_status',
      'voice_description_download_results'
    ],
    'single-image': [
      'voice_description_process_image'
    ],
    'batch-images': [
      'voice_description_batch_images'
    ],
    'monitoring': [
      'voice_description_health_check',
      'voice_description_aws_status'
    ],
    'development': [
      'voice_description_health_check',
      'voice_description_process_image',
      'voice_description_check_status'
    ]
  };
  
  return recommendations[useCase] || [];
}

export {
  UploadVideoTool,
  ProcessVideoUrlTool,
  ProcessImageTool,
  BatchProcessImagesTool,
  CheckStatusTool,
  DownloadResultsTool,
  HealthCheckTool,
  AWSStatusTool
};