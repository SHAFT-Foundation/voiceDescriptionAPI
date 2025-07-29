import { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { RekognitionClient, StartSegmentDetectionCommand } from '@aws-sdk/client-rekognition';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files only
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

const uploadMiddleware = promisify(upload.single('video'));

// AWS Configuration with proper secret key encoding
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  inputBucket: process.env.INPUT_S3_BUCKET || 'voice-description-api-input-production-pmhnxlix',
  outputBucket: process.env.OUTPUT_S3_BUCKET || 'voice-description-api-output-production-pmhnxlix',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: decodeURIComponent(process.env.AWS_SECRET_ACCESS_KEY!),
  } : undefined,
};

// AWS SDK Clients
const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
});

const rekognitionClient = new RekognitionClient({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
});

import { setJob } from '../../lib/jobStorage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method allowed',
      },
      timestamp: new Date(),
    });
  }

  try {
    console.log('Upload request received');

    // Handle multipart file upload
    await uploadMiddleware(req as any, res as any);

    const file = (req as any).file;
    const { s3Uri, title, description, language } = req.body;

    // Validate request
    if (!file && !s3Uri) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_INPUT',
          message: 'Either file upload or S3 URI must be provided',
        },
        timestamp: new Date(),
      });
    }

    const jobId = uuidv4();
    let videoS3Uri = s3Uri;

    // If file was uploaded, upload to S3
    if (file) {
      try {
        const fileName = `${jobId}-${file.originalname}`;
        
        const uploadCommand = new PutObjectCommand({
          Bucket: awsConfig.inputBucket,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
          Metadata: {
            title: title || 'Untitled Video',
            description: description || '',
            language: language || 'en',
            jobId: jobId,
          },
        });

        await s3Client.send(uploadCommand);
        videoS3Uri = `s3://${awsConfig.inputBucket}/${fileName}`;
        console.log('Video uploaded to S3:', videoS3Uri);

      } catch (uploadError) {
        console.error('S3 upload error:', uploadError);
        return res.status(500).json({
          success: false,
          error: {
            code: 'UPLOAD_ERROR',
            message: 'Failed to upload video to S3',
            details: uploadError instanceof Error ? uploadError.message : String(uploadError),
          },
          timestamp: new Date(),
        });
      }
    }

    // Create job record
    const job = {
      id: jobId,
      status: 'processing',
      step: 'segmentation',
      progress: 0,
      message: 'Starting video segmentation...',
      createdAt: new Date().toISOString(),
      s3Uri: videoS3Uri,
      metadata: {
        title: title || 'Untitled Video',
        description: description || '',
        language: language || 'en',
      },
      fileInfo: file ? {
        size: file.size,
        name: file.originalname,
        type: file.mimetype,
      } : null,
    };

    // Store job
    setJob(jobId, job);

    // Parse S3 URI to get bucket and key
    let s3Bucket, s3Key;
    if (videoS3Uri.startsWith('s3://')) {
      const s3Parts = videoS3Uri.replace('s3://', '').split('/');
      s3Bucket = s3Parts[0];
      s3Key = s3Parts.slice(1).join('/');
    } else {
      s3Bucket = awsConfig.inputBucket;
      s3Key = videoS3Uri.split('/').pop()!;
    }

    console.log(`Starting Rekognition for: s3://${s3Bucket}/${s3Key}`);

    // Start Rekognition video segmentation with correct S3 location
    try {
      const segmentCommand = new StartSegmentDetectionCommand({
        Video: {
          S3Object: {
            Bucket: s3Bucket,
            Name: s3Key,
          },
        },
        SegmentTypes: ['SHOT'],
        JobTag: jobId,
      });

      const segmentResult = await rekognitionClient.send(segmentCommand);
      console.log('✅ Rekognition segmentation started:', segmentResult.JobId);

      // Update job with real Rekognition job ID
      setJob(jobId, {
        ...job,
        rekognitionJobId: segmentResult.JobId,
        s3Bucket: s3Bucket,
        s3Key: s3Key,
        message: 'AWS Rekognition video segmentation started...',
        step: 'segmentation',
        progress: 10,
      });

    } catch (rekognitionError) {
      console.error('❌ Rekognition error:', rekognitionError);
      
      // Store error details in job
      setJob(jobId, {
        ...job,
        status: 'failed',
        error: rekognitionError instanceof Error ? rekognitionError.message : String(rekognitionError),
        message: 'Failed to start video segmentation',
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'REKOGNITION_ERROR',
          message: 'Failed to start video processing',
          details: rekognitionError instanceof Error ? rekognitionError.message : String(rekognitionError),
        },
        timestamp: new Date(),
      });
    }

    console.log('Upload successful, job created:', jobId);

    return res.status(200).json({
      success: true,
      data: {
        jobId,
        s3Uri: videoS3Uri,
        message: 'Video uploaded successfully, processing started',
        statusUrl: `/api/status/${jobId}`,
      },
      timestamp: new Date(),
    });

  } catch (error) {
    console.error('Upload handler error:', error);

    if (error instanceof Error && error.message.includes('Only video files')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Only video files are allowed',
        },
        timestamp: new Date(),
      });
    }

    if (error instanceof Error && error.message.includes('File too large')) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds 500MB limit',
        },
        timestamp: new Date(),
      });
    }

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

// Disable default body parser for multipart
export const config = {
  api: {
    bodyParser: false,
  },
};