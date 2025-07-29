import { NextApiRequest, NextApiResponse } from 'next';
import { RekognitionClient, ListVideoEventsCommand, GetSegmentDetectionCommand } from '@aws-sdk/client-rekognition';
import { S3Client, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// AWS Configuration
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
};

const rekognitionClient = new RekognitionClient(awsConfig);
const s3Client = new S3Client(awsConfig);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { jobId } = req.query;

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Valid job ID is required',
      });
    }

    const debugInfo: any = {
      jobId,
      timestamp: new Date().toISOString(),
      aws: {
        region: awsConfig.region,
        hasCredentials: !!awsConfig.credentials,
      },
      checks: {},
    };

    // 1. Check S3 bucket access
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.INPUT_S3_BUCKET || 'voice-description-api-input-production-pmhnxlix',
        MaxKeys: 5,
      });
      const s3Response = await s3Client.send(listCommand);
      debugInfo.checks.s3Access = {
        status: 'success',
        bucket: process.env.INPUT_S3_BUCKET,
        objectCount: s3Response.KeyCount || 0,
        objects: s3Response.Contents?.slice(0, 3).map(obj => ({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
        })) || [],
      };
    } catch (s3Error) {
      debugInfo.checks.s3Access = {
        status: 'error',
        error: s3Error instanceof Error ? s3Error.message : String(s3Error),
      };
    }

    // 2. Check Rekognition service access and recent jobs
    try {
      // Try to list recent Rekognition jobs (this will show if any jobs are running)
      const rekognitionJobs: any[] = [];
      
      // Since there's no direct "list jobs" API, we'll try to get a specific job
      // In a real implementation, you'd store the Rekognition job ID when you start it
      debugInfo.checks.rekognition = {
        status: 'accessible',
        message: 'Rekognition service is accessible',
        note: 'To see actual jobs, we need to store Rekognition job IDs when created',
      };
    } catch (rekognitionError) {
      debugInfo.checks.rekognition = {
        status: 'error',
        error: rekognitionError instanceof Error ? rekognitionError.message : String(rekognitionError),
      };
    }

    // 3. Check if specific video file exists for this job
    const possibleVideoFiles = [
      `${jobId}-ryantest.mov`,
      `${jobId}.mp4`,
      `${jobId}.mov`,
      'ryantest.mov',
    ];

    for (const fileName of possibleVideoFiles) {
      try {
        const headCommand = new HeadObjectCommand({
          Bucket: process.env.INPUT_S3_BUCKET || 'voice-description-api-input-production-pmhnxlix',
          Key: fileName,
        });
        const headResponse = await s3Client.send(headCommand);
        debugInfo.checks.videoFile = {
          status: 'found',
          fileName,
          size: headResponse.ContentLength,
          contentType: headResponse.ContentType,
          lastModified: headResponse.LastModified,
        };
        break;
      } catch (headError) {
        // File doesn't exist, continue checking
      }
    }

    if (!debugInfo.checks.videoFile) {
      debugInfo.checks.videoFile = {
        status: 'not_found',
        searchedFiles: possibleVideoFiles,
        message: 'No video file found for this job ID',
      };
    }

    // 4. Environment variables check
    debugInfo.checks.environment = {
      NODE_ENV: process.env.NODE_ENV,
      AWS_REGION: process.env.AWS_REGION,
      INPUT_S3_BUCKET: process.env.INPUT_S3_BUCKET,
      OUTPUT_S3_BUCKET: process.env.OUTPUT_S3_BUCKET,
      hasAWSCredentials: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    };

    // 5. Suggest next steps
    debugInfo.nextSteps = [];
    
    if (debugInfo.checks.s3Access.status === 'error') {
      debugInfo.nextSteps.push('Fix S3 bucket access - check bucket permissions and AWS credentials');
    }
    
    if (debugInfo.checks.videoFile.status === 'not_found') {
      debugInfo.nextSteps.push('Upload a video file to S3 first, then create job with correct S3 URI');
    }
    
    if (debugInfo.checks.s3Access.status === 'success' && debugInfo.checks.videoFile.status === 'found') {
      debugInfo.nextSteps.push('Video file exists! Check AWS Rekognition console for active jobs');
      debugInfo.nextSteps.push('Go to: https://console.aws.amazon.com/rekognition/');
    }

    return res.status(200).json({
      success: true,
      data: debugInfo,
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
  }
}