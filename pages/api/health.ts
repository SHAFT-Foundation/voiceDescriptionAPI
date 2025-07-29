import { NextApiRequest, NextApiResponse } from 'next';
import { JobManager } from '../../src/orchestrator/jobManager';
import { AWSConfig } from '../../src/types';

// Initialize JobManager for health checks
const awsConfig: AWSConfig = {
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  inputBucket: process.env.INPUT_S3_BUCKET || 'default-input-bucket',
  outputBucket: process.env.OUTPUT_S3_BUCKET || 'default-output-bucket',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
};

let jobManager: JobManager;
try {
  jobManager = new JobManager(awsConfig);
} catch (error) {
  console.warn('JobManager initialization failed in health check:', error);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed',
    });
  }

  const startTime = Date.now();
  const checks: any = {
    server: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  try {
    // Check environment variables
    const requiredEnvVars = [
      'INPUT_S3_BUCKET',
      'OUTPUT_S3_BUCKET',
      'AWS_DEFAULT_REGION'
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingEnvVars.length > 0) {
      checks.environment = {
        status: 'warning',
        message: `Missing environment variables: ${missingEnvVars.join(', ')}`,
        missing: missingEnvVars,
      };
    } else {
      checks.environment = {
        status: 'healthy',
        buckets: {
          input: process.env.INPUT_S3_BUCKET,
          output: process.env.OUTPUT_S3_BUCKET,
        },
        region: process.env.AWS_DEFAULT_REGION,
      };
    }

    // Check JobManager health if available
    if (jobManager) {
      try {
        const systemHealth = jobManager.getSystemHealth();
        checks.jobManager = {
          status: systemHealth.status,
          activeJobs: systemHealth.activeJobs,
          completedJobs: systemHealth.completedJobs,
          failedJobs: systemHealth.failedJobs,
        };
      } catch (error) {
        checks.jobManager = {
          status: 'error',
          message: 'Failed to get job manager health',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    } else {
      checks.jobManager = {
        status: 'warning',
        message: 'JobManager not initialized',
      };
    }

    // Check disk space (basic check)
    checks.system = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };

    // Overall health determination
    let overallStatus = 'healthy';
    
    if (checks.jobManager?.status === 'unhealthy' || checks.environment?.status === 'error') {
      overallStatus = 'unhealthy';
    } else if (checks.jobManager?.status === 'degraded' || checks.environment?.status === 'warning') {
      overallStatus = 'degraded';
    }

    const responseTime = Date.now() - startTime;
    
    const healthResponse = {
      status: overallStatus,
      version: process.env.npm_package_version || '1.0.0',
      timestamp: checks.timestamp,
      responseTime: `${responseTime}ms`,
      checks,
    };

    // Set appropriate HTTP status code
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return res.status(httpStatus).json(healthResponse);

  } catch (error) {
    console.error('Health check error:', error);

    return res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: {
        message: 'Health check failed',
        details: error instanceof Error ? error.message : String(error),
      },
      responseTime: `${Date.now() - startTime}ms`,
    });
  }
}