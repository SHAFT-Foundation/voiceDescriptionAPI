import { z } from 'zod';
import { Tool, ToolContext, MCPToolError, ErrorCode } from '../../types/index.js';
import { APIClient } from '../../adapters/api-client.js';
import { logger, createLogger } from '../../utils/logger.js';

const toolLogger = createLogger('aws-status-tool');

const awsStatusSchema = z.object({
  services: z.array(z.enum(['s3', 'rekognition', 'bedrock', 'polly', 'all']))
    .optional()
    .default(['all'])
    .describe('AWS services to check status for'),
  
  include_quotas: z.boolean()
    .optional()
    .default(false)
    .describe('Include service quota information (may require additional permissions)'),
  
  timeout_seconds: z.number()
    .min(5)
    .max(30)
    .optional()
    .default(15)
    .describe('Timeout for AWS status checks')
});

export class AWSStatusTool implements Tool {
  name = 'voice_description_aws_status';
  description = 'Check AWS service status and availability for Voice Description API';
  inputSchema = awsStatusSchema;
  
  private apiClient: APIClient;
  
  constructor() {
    this.apiClient = new APIClient();
  }
  
  async execute(
    params: z.infer<typeof awsStatusSchema>,
    context: ToolContext
  ) {
    const startTime = Date.now();
    
    toolLogger.info('Starting AWS status check', {
      services: params.services,
      includeQuotas: params.include_quotas,
      timeout: params.timeout_seconds,
      requestId: context.requestId
    });
    
    try {
      // Get AWS status from API
      let awsStatus = null;
      try {
        awsStatus = await this.apiClient.getAWSStatus();
      } catch (error) {
        toolLogger.warn('AWS status API call failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      const checkDuration = Date.now() - startTime;
      
      // Determine which services to report
      const servicesToCheck = params.services.includes('all') 
        ? ['s3', 'rekognition', 'bedrock', 'polly']
        : params.services;
      
      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        check_duration_ms: checkDuration,
        check_duration_human: this.formatDuration(checkDuration),
        
        // Overall AWS status
        overall_status: this.determineOverallStatus(awsStatus),
        
        // Service-specific status
        services: this.formatServiceStatus(awsStatus, servicesToCheck),
        
        // Summary
        summary: {
          total_services_checked: servicesToCheck.length,
          healthy_services: this.countHealthyServices(awsStatus, servicesToCheck),
          degraded_services: this.countDegradedServices(awsStatus, servicesToCheck),
          unavailable_services: this.countUnavailableServices(awsStatus, servicesToCheck)
        },
        
        // API information
        api_info: {
          can_check_aws: !!awsStatus,
          api_response_time: awsStatus ? 'available' : 'unavailable',
          last_updated: awsStatus?.timestamp || 'unknown'
        }
      };
      
      // Add quota information if requested and available
      if (params.include_quotas && awsStatus) {
        response.quotas = this.extractQuotaInformation(awsStatus, servicesToCheck);
      }
      
      // Add recommendations based on status
      response.recommendations = this.generateRecommendations(awsStatus, servicesToCheck);
      
      toolLogger.info('AWS status check completed', {
        overallStatus: response.overall_status,
        healthyServices: response.summary.healthy_services,
        checkDuration: `${checkDuration}ms`,
        requestId: context.requestId
      });
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      toolLogger.error('AWS status check failed', {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
        requestId: context.requestId
      });
      
      // Return error status instead of throwing
      return {
        success: false,
        overall_status: 'unknown',
        timestamp: new Date().toISOString(),
        check_duration_ms: duration,
        error: {
          message: 'Failed to check AWS status',
          details: error instanceof Error ? error.message : String(error)
        },
        services: params.services.reduce((acc, service) => {
          acc[service] = {
            status: 'unknown',
            message: 'Status check failed'
          };
          return acc;
        }, {} as Record<string, any>),
        recommendations: [
          'Check API connectivity and authentication',
          'Verify AWS service permissions are configured correctly',
          'Try again in a few minutes if this is a temporary issue'
        ]
      };
    }
  }
  
  /**
   * Determine overall AWS status
   */
  private determineOverallStatus(awsStatus: any): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
    if (!awsStatus) {
      return 'unknown';
    }
    
    if (awsStatus.status === 'healthy') {
      return 'healthy';
    } else if (awsStatus.status === 'degraded') {
      return 'degraded';
    } else if (awsStatus.status === 'unhealthy') {
      return 'unhealthy';
    }
    
    return 'unknown';
  }
  
  /**
   * Format service status information
   */
  private formatServiceStatus(
    awsStatus: any,
    servicesToCheck: string[]
  ): Record<string, any> {
    const formatted: Record<string, any> = {};
    
    for (const service of servicesToCheck) {
      if (awsStatus && awsStatus.services && awsStatus.services[service]) {
        const serviceStatus = awsStatus.services[service];
        
        formatted[service] = {
          status: serviceStatus.status || 'unknown',
          message: this.getServiceStatusMessage(service, serviceStatus.status),
          latency_ms: serviceStatus.latency,
          last_checked: awsStatus.timestamp,
          ...this.getServiceSpecificInfo(service, serviceStatus)
        };
      } else {
        formatted[service] = {
          status: 'unknown',
          message: 'Status information not available',
          reason: 'API did not return status for this service'
        };
      }
    }
    
    return formatted;
  }
  
  /**
   * Get service-specific additional information
   */
  private getServiceSpecificInfo(service: string, serviceStatus: any): any {
    const info: any = {};
    
    switch (service) {
      case 's3':
        if (serviceStatus.buckets) {
          info.buckets_accessible = serviceStatus.buckets;
        }
        break;
        
      case 'rekognition':
        if (serviceStatus.quotas) {
          info.quota_info = {
            remaining: serviceStatus.quotas.remaining,
            limit: serviceStatus.quotas.limit,
            usage_percentage: Math.round((1 - serviceStatus.quotas.remaining / serviceStatus.quotas.limit) * 100)
          };
        }
        break;
        
      case 'bedrock':
        if (serviceStatus.models) {
          info.available_models = serviceStatus.models;
          info.nova_pro_available = serviceStatus.models.includes('amazon.nova-pro-v1:0');
        }
        break;
        
      case 'polly':
        if (serviceStatus.voices) {
          info.available_voices = serviceStatus.voices;
          info.supports_neural = serviceStatus.voices > 20; // Rough estimate
        }
        break;
    }
    
    return info;
  }
  
  /**
   * Get human-readable status message for service
   */
  private getServiceStatusMessage(service: string, status: string): string {
    const messages: Record<string, Record<string, string>> = {
      s3: {
        available: 'S3 storage is accessible for file operations',
        degraded: 'S3 has some limitations but basic operations work',
        unavailable: 'S3 storage is not accessible'
      },
      rekognition: {
        available: 'Video analysis services are operational',
        degraded: 'Video analysis has reduced capacity',
        unavailable: 'Video analysis services are not available'
      },
      bedrock: {
        available: 'AI description generation is working normally',
        degraded: 'AI services have limited availability',
        unavailable: 'AI description generation is not available'
      },
      polly: {
        available: 'Text-to-speech conversion is operational',
        degraded: 'Audio generation has some limitations',
        unavailable: 'Text-to-speech services are not available'
      }
    };
    
    return messages[service]?.[status] || `${service} status: ${status}`;
  }
  
  /**
   * Count services by status
   */
  private countServicesByStatus(awsStatus: any, services: string[], targetStatus: string): number {
    if (!awsStatus?.services) return 0;
    
    return services.filter(service => 
      awsStatus.services[service]?.status === targetStatus
    ).length;
  }
  
  private countHealthyServices(awsStatus: any, services: string[]): number {
    return this.countServicesByStatus(awsStatus, services, 'available');
  }
  
  private countDegradedServices(awsStatus: any, services: string[]): number {
    return this.countServicesByStatus(awsStatus, services, 'degraded');
  }
  
  private countUnavailableServices(awsStatus: any, services: string[]): number {
    return this.countServicesByStatus(awsStatus, services, 'unavailable');
  }
  
  /**
   * Extract quota information
   */
  private extractQuotaInformation(awsStatus: any, services: string[]): Record<string, any> {
    const quotas: Record<string, any> = {};
    
    for (const service of services) {
      const serviceStatus = awsStatus.services?.[service];
      if (serviceStatus?.quotas) {
        quotas[service] = {
          current_usage: serviceStatus.quotas.limit - serviceStatus.quotas.remaining,
          limit: serviceStatus.quotas.limit,
          remaining: serviceStatus.quotas.remaining,
          usage_percentage: Math.round((1 - serviceStatus.quotas.remaining / serviceStatus.quotas.limit) * 100),
          status: serviceStatus.quotas.remaining > 0 ? 'available' : 'exhausted'
        };
      }
    }
    
    return quotas;
  }
  
  /**
   * Generate recommendations based on status
   */
  private generateRecommendations(awsStatus: any, services: string[]): string[] {
    const recommendations: string[] = [];
    
    if (!awsStatus) {
      return [
        'Unable to check AWS status - verify API connectivity',
        'Check if Voice Description API has proper AWS permissions',
        'Ensure AWS services are configured correctly'
      ];
    }
    
    const unavailableServices = services.filter(service =>
      awsStatus.services?.[service]?.status === 'unavailable'
    );
    
    const degradedServices = services.filter(service =>
      awsStatus.services?.[service]?.status === 'degraded'
    );
    
    if (unavailableServices.length > 0) {
      recommendations.push(
        `Critical: ${unavailableServices.join(', ')} services are unavailable`,
        'Processing may fail until these services are restored',
        'Check AWS service health dashboard for outages'
      );
    }
    
    if (degradedServices.length > 0) {
      recommendations.push(
        `Warning: ${degradedServices.join(', ')} services are degraded`,
        'Processing may be slower than usual',
        'Consider retrying failed operations'
      );
    }
    
    // Check quota warnings
    for (const service of services) {
      const serviceStatus = awsStatus.services?.[service];
      if (serviceStatus?.quotas) {
        const usagePercent = (1 - serviceStatus.quotas.remaining / serviceStatus.quotas.limit) * 100;
        if (usagePercent > 80) {
          recommendations.push(
            `${service} quota is ${Math.round(usagePercent)}% used`,
            'Consider requesting quota increase if usage is high'
          );
        }
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push(
        'All AWS services are operating normally',
        'No immediate action required'
      );
    }
    
    return recommendations;
  }
  
  /**
   * Format duration in milliseconds to human readable string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  }
}