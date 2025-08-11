import { NextApiRequest, NextApiResponse } from 'next';
import { UnifiedPipelineOrchestrator } from '../../../../src/orchestrator/unifiedPipelineOrchestrator';
import { logger } from '../../../../src/utils/logger';

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

// Initialize unified pipeline orchestrator
const orchestrator = new UnifiedPipelineOrchestrator(awsConfig);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET method allowed',
      },
      timestamp: new Date(),
    });
  }

  const { jobId } = req.query;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JOB_ID',
        message: 'Valid job ID is required',
      },
      timestamp: new Date(),
    });
  }

  try {
    logger.info('Enhanced status check requested', { jobId });

    // Get job status from unified orchestrator
    const status = orchestrator.getPipelineJobStatus(jobId);

    if (!status) {
      // Check if it might be an AWS or regular job
      const awsJobManager = orchestrator['awsJobManager'];
      const awsStatus = awsJobManager.getJobStatus(jobId);
      
      if (!awsStatus) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: `Job ${jobId} not found`,
          },
          timestamp: new Date(),
        });
      }

      // Return AWS job status
      return res.status(200).json({
        success: true,
        data: {
          ...awsStatus,
          pipeline: 'aws', // Indicate this is an AWS pipeline job
        },
        timestamp: new Date(),
      });
    }

    // Get full job details if available
    const pipelineJobs = orchestrator['pipelineJobs'];
    const jobDetails = pipelineJobs.get(jobId);

    let responseData: any = {
      ...status,
      pipeline: jobDetails?.pipeline,
    };

    // Add results URLs if job is completed
    if (status.status === 'completed') {
      responseData.results = {
        textUrl: `/api/results/enhanced/${jobId}/text`,
        audioUrl: `/api/results/enhanced/${jobId}/audio`,
        jsonUrl: `/api/results/enhanced/${jobId}/json`,
      };

      // Add synthesis results if available
      if (jobDetails?.data?.synthesized) {
        responseData.preview = {
          keyMoments: jobDetails.data.synthesized.keyMoments?.slice(0, 3),
          highlights: jobDetails.data.synthesized.highlights?.slice(0, 5),
          chapterCount: jobDetails.data.synthesized.chapters?.length || 0,
          wordCount: jobDetails.data.synthesized.metadata?.wordCount,
          confidence: jobDetails.data.synthesized.metadata?.averageConfidence,
        };
      }

      // Add cost estimates if available
      if (jobDetails?.data?.metadata?.costsEstimate) {
        responseData.costEstimate = jobDetails.data.metadata.costsEstimate;
      }
    }

    logger.info('Enhanced status check completed', { 
      jobId,
      status: status.status,
      pipeline: jobDetails?.pipeline 
    });

    return res.status(200).json({
      success: true,
      data: responseData,
      timestamp: new Date(),
    });

  } catch (error) {
    logger.error('Enhanced status check failed', { error, jobId });

    return res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_FAILED',
        message: 'Failed to retrieve job status',
        details: error instanceof Error ? error.message : String(error),
      },
      timestamp: new Date(),
    });
  }
}