import { z } from 'zod';
import { Tool, ToolContext, MCPToolError, ErrorCode } from '../../types/index.js';
import { APIClient } from '../../adapters/api-client.js';
import { logger, createLogger } from '../../utils/logger.js';

const toolLogger = createLogger('health-check-tool');

const healthCheckSchema = z.object({
  include_details: z.boolean()
    .optional()
    .default(false)
    .describe('Include detailed system health information'),
  
  timeout_seconds: z.number()
    .min(1)
    .max(30)
    .optional()
    .default(10)
    .describe('Timeout for health check operations')
});

export class HealthCheckTool implements Tool {
  name = 'voice_description_health_check';
  description = 'Check Voice Description API health and system status';
  inputSchema = healthCheckSchema;
  
  private apiClient: APIClient;
  
  constructor() {
    this.apiClient = new APIClient();
  }
  
  async execute(
    params: z.infer<typeof healthCheckSchema>,
    context: ToolContext
  ) {
    const startTime = Date.now();
    
    toolLogger.info('Starting health check', {
      includeDetails: params.include_details,
      timeout: params.timeout_seconds,
      requestId: context.requestId
    });
    
    try {
      // Test API connectivity
      const connectivityTest = await this.testConnectivity();
      
      // Get health status from API
      let apiHealth = null;
      try {
        apiHealth = await this.apiClient.healthCheck();
      } catch (error) {
        toolLogger.warn('API health check failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      const checkDuration = Date.now() - startTime;
      
      // Determine overall health status
      const overallStatus = this.determineOverallHealth(connectivityTest, apiHealth);
      
      const response = {
        success: true,
        overall_status: overallStatus,
        timestamp: new Date().toISOString(),
        check_duration_ms: checkDuration,
        check_duration_human: this.formatDuration(checkDuration),
        
        // MCP Server status
        mcp_server: {
          status: 'healthy',
          uptime_seconds: process.uptime(),
          uptime_human: this.formatDuration(process.uptime() * 1000),
          memory_usage: process.memoryUsage(),
          node_version: process.version,
          platform: process.platform
        },
        
        // API connectivity
        api_connectivity: {
          can_connect: connectivityTest.success,
          response_time_ms: connectivityTest.responseTime,
          base_url: this.apiClient.getConfig().baseURL,
          has_api_key: this.apiClient.getConfig().hasApiKey
        },
        
        // API health (if available)
        api_health: apiHealth ? {
          status: apiHealth.status,
          version: apiHealth.version,
          response_time: apiHealth.responseTime,
          checks: apiHealth.checks
        } : {
          status: 'unavailable',
          message: 'Could not retrieve API health information'
        }
      };
      
      if (params.include_details) {
        response.detailed_info = {
          process_info: {
            pid: process.pid,
            ppid: process.ppid,
            arch: process.arch,
            execPath: process.execPath,
            argv: process.argv
          },
          system_info: {
            platform: process.platform,
            release: process.release,
            versions: process.versions
          },
          environment: {
            node_env: process.env.NODE_ENV,
            has_required_env_vars: this.checkEnvironmentVariables()
          }
        };
      }
      
      toolLogger.info('Health check completed', {
        overallStatus,
        checkDuration: `${checkDuration}ms`,
        apiConnectable: connectivityTest.success,
        requestId: context.requestId
      });
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      toolLogger.error('Health check failed', {
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
        requestId: context.requestId
      });
      
      // Don't throw errors for health checks - return degraded status instead
      return {
        success: false,
        overall_status: 'unhealthy',
        timestamp: new Date().toISOString(),
        check_duration_ms: duration,
        
        mcp_server: {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error)
        },
        
        api_connectivity: {
          can_connect: false,
          error: 'Health check failed'
        }
      };
    }
  }
  
  /**
   * Test basic connectivity to the API
   */
  private async testConnectivity(): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const connected = await this.apiClient.testConnection();
      const responseTime = Date.now() - startTime;
      
      return {
        success: connected,
        responseTime,
        error: connected ? undefined : 'Connection test failed'
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Determine overall health status
   */
  private determineOverallHealth(
    connectivity: { success: boolean },
    apiHealth: any
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (!connectivity.success) {
      return 'unhealthy';
    }
    
    if (apiHealth) {
      if (apiHealth.status === 'healthy') {
        return 'healthy';
      } else if (apiHealth.status === 'degraded') {
        return 'degraded';
      } else {
        return 'unhealthy';
      }
    }
    
    // If we can connect but no health info, consider degraded
    return 'degraded';
  }
  
  /**
   * Check if required environment variables are set
   */
  private checkEnvironmentVariables(): {
    all_present: boolean;
    missing: string[];
    optional_missing: string[];
  } {
    const required = ['API_BASE_URL'];
    const optional = ['API_KEY', 'LOG_LEVEL'];
    
    const missing = required.filter(key => !process.env[key]);
    const optionalMissing = optional.filter(key => !process.env[key]);
    
    return {
      all_present: missing.length === 0,
      missing,
      optional_missing: optionalMissing
    };
  }
  
  /**
   * Format duration in milliseconds to human readable string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}