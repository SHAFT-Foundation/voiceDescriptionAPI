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

    console.log(`📄 Text result request for job: ${jobId}`);

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

    // Check if job is completed and has text results
    if (job.status !== 'completed' || !job.textUrl) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'RESULTS_NOT_READY',
          message: job.status === 'failed' ? 'Job failed - no results available' : 'Job is still processing, results not ready',
          jobStatus: job.status,
        },
        timestamp: new Date(),
      });
    }

    try {
      // Extract S3 key from textUrl
      const textKey = job.textUrl.replace(`s3://${awsConfig.outputBucket}/`, '');
      
      console.log(`📥 Downloading text from S3: ${textKey}`);
      
      const getCommand = new GetObjectCommand({
        Bucket: awsConfig.outputBucket,
        Key: textKey,
      });

      const s3Response = await s3Client.send(getCommand);
      
      if (!s3Response.Body) {
        throw new Error('No content returned from S3');
      }

      // Convert stream to string
      const textContent = await streamToString(s3Response.Body);
      
      console.log(`✅ Retrieved text content (${textContent.length} characters)`);

      // Set proper content type for text download
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${jobId}_description.txt"`);
      
      return res.status(200).send(textContent);

    } catch (s3Error) {
      console.error('❌ S3 download error:', s3Error);
      
      return res.status(500).json({
        success: false,
        error: {
          code: 'DOWNLOAD_ERROR',
          message: 'Failed to download text results from S3',
          details: s3Error instanceof Error ? s3Error.message : String(s3Error),
        },
        timestamp: new Date(),
      });
    }

  } catch (error) {
    console.error('❌ Text results endpoint error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : String(error),
      },
      timestamp: new Date(),
    });
  }
}

/**
 * Convert readable stream to string
 */
async function streamToString(stream: any): Promise<string> {
  const chunks: Uint8Array[] = [];
  
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks).toString('utf-8');
}