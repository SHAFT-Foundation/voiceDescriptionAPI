import { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import { promisify } from 'util';
import { UnifiedPipelineOrchestrator } from '../../src/orchestrator/unifiedPipelineOrchestrator';
import { EnhancedUploadRequest, PipelineType } from '../../src/types';
import { logger } from '../../src/utils/logger';

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
    logger.info('Enhanced upload request received');

    // Handle multipart file upload
    await uploadMiddleware(req as any, res as any);

    const file = (req as any).file;
    const { 
      s3Uri, 
      title, 
      description, 
      language,
      pipeline,
      priority,
      openaiOptions,
      chunkingOptions,
      synthesisOptions
    } = req.body;

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

    // Validate pipeline parameter if provided
    if (pipeline && !['openai', 'aws', 'hybrid'].includes(pipeline)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PIPELINE',
          message: 'Pipeline must be one of: openai, aws, hybrid',
        },
        timestamp: new Date(),
      });
    }

    // Parse options if they were sent as JSON strings
    let parsedOpenAIOptions, parsedChunkingOptions, parsedSynthesisOptions;
    
    try {
      if (openaiOptions) {
        parsedOpenAIOptions = typeof openaiOptions === 'string' 
          ? JSON.parse(openaiOptions) 
          : openaiOptions;
      }
      if (chunkingOptions) {
        parsedChunkingOptions = typeof chunkingOptions === 'string'
          ? JSON.parse(chunkingOptions)
          : chunkingOptions;
      }
      if (synthesisOptions) {
        parsedSynthesisOptions = typeof synthesisOptions === 'string'
          ? JSON.parse(synthesisOptions)
          : synthesisOptions;
      }
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OPTIONS',
          message: 'Invalid options format. Options must be valid JSON.',
          details: parseError instanceof Error ? parseError.message : String(parseError),
        },
        timestamp: new Date(),
      });
    }

    // Create enhanced upload request
    const enhancedRequest: EnhancedUploadRequest = {
      file: file ? file.buffer : undefined,
      s3Uri,
      metadata: {
        title: title || 'Untitled Video',
        description: description || '',
        language: language || 'en',
        priority: priority || 'medium',
      },
      pipeline: pipeline as PipelineType,
      openaiOptions: parsedOpenAIOptions,
      chunkingOptions: parsedChunkingOptions,
      synthesisOptions: parsedSynthesisOptions,
    };

    // Process with unified pipeline orchestrator
    const result = await orchestrator.processVideo(enhancedRequest);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date(),
      });
    }

    logger.info('Enhanced upload successful', { 
      jobId: result.data?.jobId,
      pipeline: result.data?.pipeline,
      status: result.data?.status
    });

    return res.status(200).json({
      success: true,
      data: {
        jobId: result.data?.jobId,
        pipeline: result.data?.pipeline,
        status: result.data?.status,
        message: `Video processing started with ${result.data?.pipeline} pipeline`,
        statusUrl: `/api/status/enhanced/${result.data?.jobId}`,
        metadata: result.data?.metadata,
      },
      timestamp: new Date(),
    });

  } catch (error) {
    logger.error('Enhanced upload handler error:', error);

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