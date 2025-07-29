import { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getJob } from '../../../../lib/jobStorage';

// AWS Configuration with proper secret key encoding
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  outputBucket: process.env.OUTPUT_S3_BUCKET || 'voice-description-api-output-production-pmhnxlix',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.replace(/\s/g, '+'),
  } : undefined,
};

const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
});

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

  try {
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

    console.log(`🎵 Audio result request for job: ${jobId}`);

    // Get job from storage
    const job = getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Job not found',
        },
        timestamp: new Date(),
      });
    }

    // Check if job is completed and has audio results
    if (job.status !== 'completed' || !job.audioUrl) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'RESULTS_NOT_READY',
          message: job.status === 'failed' ? 'Job failed - no results available' : 'Job is still processing, audio not ready',
          jobStatus: job.status,
        },
        timestamp: new Date(),
      });
    }

    try {
      // Extract S3 key from audioUrl
      const audioKey = job.audioUrl.replace(`s3://${awsConfig.outputBucket}/`, '');
      
      console.log(`🎧 Downloading audio from S3: ${audioKey}`);

      // Get audio file from S3
      const command = new GetObjectCommand({
        Bucket: awsConfig.outputBucket,
        Key: audioKey,
      });

      const s3Response = await s3Client.send(command);

      if (!s3Response.Body) {
        throw new Error('No audio content returned from S3');
      }

      console.log(`✅ Retrieved audio file (${s3Response.ContentLength} bytes)`);

      // Set appropriate headers for audio download
      res.setHeader('Content-Type', s3Response.ContentType || 'audio/mpeg');
      res.setHeader('Content-Length', s3Response.ContentLength || 0);
      res.setHeader('Content-Disposition', `attachment; filename="${jobId}_audio.mp3"`);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      // Stream the audio data efficiently
      const audioBuffer = await streamToBuffer(s3Response.Body);
      res.write(audioBuffer);
      res.end();

    } catch (s3Error) {
      console.error('❌ S3 audio download error:', s3Error);
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'DOWNLOAD_ERROR',
          message: 'Failed to download audio results from S3',
          details: s3Error instanceof Error ? s3Error.message : String(s3Error),
        },
        timestamp: new Date(),
      });
    }

  } catch (error) {
    console.error('❌ Audio results endpoint error:', error);

    // If response hasn't started, send JSON error
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while retrieving audio',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      });
    }

    // If response has started, just end it
    res.end();
  }
}

/**
 * Convert stream to buffer
 */
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}