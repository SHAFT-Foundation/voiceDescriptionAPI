import type { NextApiRequest, NextApiResponse } from 'next';
import { JobManager } from '../../../../src/orchestrator/jobManager';
import { ImageJobStatus, ImageProcessingResults } from '../../../../src/types';
import { logger } from '../../../../src/utils/logger';

const jobManager = new JobManager({
  region: process.env.AWS_REGION || 'us-east-1',
  inputBucket: process.env.INPUT_S3_BUCKET || '',
  outputBucket: process.env.OUTPUT_S3_BUCKET || '',
});

interface ImageJobStatusResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  step: 'upload' | 'analysis' | 'compilation' | 'synthesis' | 'completed';
  progress: number;
  message: string;
  imageType?: string;
  processingTime?: number;
  results?: ImageProcessingResults;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImageJobStatusResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  try {
    logger.info('Image status request', { jobId });

    // Check if this is an image job
    const jobType = jobManager.determineJobType(jobId);
    
    if (jobType !== 'image') {
      if (jobType === 'video') {
        return res.status(400).json({ 
          error: 'This is a video job. Use /api/status/[jobId] instead' 
        });
      }
      return res.status(404).json({ error: 'Image job not found' });
    }

    const status = jobManager.getJobStatus(jobId) as ImageJobStatus | null;
    
    if (!status) {
      logger.warn('Image job not found', { jobId });
      return res.status(404).json({ error: 'Image job not found' });
    }

    // Get full job details if completed
    let results: ImageProcessingResults | undefined;
    if (status.status === 'completed') {
      const job = jobManager.getJob(jobId) as any;
      if (job && job.compiledDescription) {
        results = {
          detailedDescription: job.compiledDescription.detailedDescription,
          altText: job.compiledDescription.altText,
          visualElements: job.analysis?.visualElements || [],
          colors: job.analysis?.colors || [],
          composition: job.analysis?.composition || '',
          context: job.analysis?.context || '',
          confidence: job.analysis?.confidence || 0,
          htmlMetadata: job.compiledDescription.htmlMetadata,
        };

        // Add audio file info if generated
        if (job.audioUri) {
          results.audioFile = {
            url: `/api/results/image/${jobId}/audio`,
            duration: 0, // Could be populated from TTS metadata
            format: 'mp3',
          };
        }
      }
    }

    const response: ImageJobStatusResponse = {
      jobId: status.jobId,
      status: status.status,
      step: status.step,
      progress: status.progress,
      message: status.message,
      imageType: status.imageType,
      results,
      error: status.error,
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
    };

    if (status.status === 'completed' && results) {
      const processingTime = (status.updatedAt.getTime() - status.createdAt.getTime()) / 1000;
      response.processingTime = processingTime;
    }

    logger.info('Image status returned', { 
      jobId, 
      status: status.status,
      step: status.step,
      progress: status.progress 
    });

    return res.status(200).json(response);

  } catch (error) {
    logger.error('Error retrieving image job status', { error, jobId });
    return res.status(500).json({ 
      error: 'Failed to retrieve image job status' 
    });
  }
}