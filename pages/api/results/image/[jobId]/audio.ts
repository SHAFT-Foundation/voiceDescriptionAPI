import type { NextApiRequest, NextApiResponse } from 'next';
import { JobManager } from '../../../../../src/orchestrator/jobManager';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { logger } from '../../../../../src/utils/logger';

const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
};

const jobManager = new JobManager({
  region: awsConfig.region,
  inputBucket: process.env.INPUT_S3_BUCKET || '',
  outputBucket: process.env.OUTPUT_S3_BUCKET || '',
  credentials: awsConfig.credentials,
});

const s3Client = new S3Client(awsConfig);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  try {
    logger.info('Image audio result request', { jobId });

    // Check if this is an image job
    const jobType = jobManager.determineJobType(jobId);
    
    if (jobType !== 'image') {
      if (jobType === 'video') {
        return res.status(400).json({ 
          error: 'This is a video job. Use /api/results/[jobId]/audio instead' 
        });
      }
      return res.status(404).json({ error: 'Image job not found' });
    }

    // Get job details
    const job = jobManager.getJob(jobId) as any;
    
    if (!job) {
      logger.warn('Image job not found', { jobId });
      return res.status(404).json({ error: 'Image job not found' });
    }

    // Check if job is completed
    if (job.status.status !== 'completed') {
      return res.status(400).json({ 
        error: `Job is ${job.status.status}. Audio is only available for completed jobs.` 
      });
    }

    // Check if audio was generated
    if (!job.audioUri) {
      return res.status(404).json({ 
        error: 'No audio generated for this job. Audio generation may have been disabled.' 
      });
    }

    // Parse S3 URI
    const match = job.audioUri.match(/^s3:\/\/([^\/]+)\/(.+)$/);
    if (!match) {
      logger.error('Invalid audio S3 URI', { audioUri: job.audioUri });
      return res.status(500).json({ error: 'Invalid audio file location' });
    }

    const [, bucket, key] = match;

    // Get audio from S3
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      logger.error('No audio data in S3 response', { bucket, key });
      return res.status(500).json({ error: 'Failed to retrieve audio file' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', response.ContentType || 'audio/mpeg');
    res.setHeader('Content-Length', response.ContentLength?.toString() || '0');
    res.setHeader('Content-Disposition', `attachment; filename="image-description-${jobId}.mp3"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Stream the audio
    const stream = response.Body as any;
    stream.pipe(res);

    logger.info('Image audio delivered', { 
      jobId, 
      contentLength: response.ContentLength 
    });

  } catch (error) {
    logger.error('Error retrieving image audio', { error, jobId });
    
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Failed to retrieve audio file' 
      });
    }
  }
}