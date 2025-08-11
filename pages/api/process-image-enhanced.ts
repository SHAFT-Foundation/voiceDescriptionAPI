import { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import { promisify } from 'util';
import { UnifiedPipelineOrchestrator } from '../../src/orchestrator/unifiedPipelineOrchestrator';
import { EnhancedImageProcessRequest, PipelineType } from '../../src/types';
import { logger } from '../../src/utils/logger';

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for images
  },
  fileFilter: (req, file, cb) => {
    // Accept image files only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const uploadMiddleware = promisify(upload.single('image'));

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
    logger.info('Enhanced image processing request received');

    // Handle multipart file upload
    await uploadMiddleware(req as any, res as any);

    const file = (req as any).file;
    const { 
      s3Uri, 
      title, 
      description, 
      context,
      pipeline,
      detailLevel,
      generateAudio,
      includeAltText,
      voiceId,
      language,
      openaiOptions
    } = req.body;

    // Validate request
    if (!file && !s3Uri) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_INPUT',
          message: 'Either image file or S3 URI must be provided',
        },
        timestamp: new Date(),
      });
    }

    // Validate pipeline parameter if provided
    if (pipeline && !['openai', 'aws'].includes(pipeline)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PIPELINE',
          message: 'Pipeline must be one of: openai, aws',
        },
        timestamp: new Date(),
      });
    }

    // Parse OpenAI options if provided
    let parsedOpenAIOptions;
    try {
      if (openaiOptions) {
        parsedOpenAIOptions = typeof openaiOptions === 'string' 
          ? JSON.parse(openaiOptions) 
          : openaiOptions;
      }
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OPTIONS',
          message: 'Invalid OpenAI options format',
          details: parseError instanceof Error ? parseError.message : String(parseError),
        },
        timestamp: new Date(),
      });
    }

    // Create enhanced image process request
    const enhancedRequest: EnhancedImageProcessRequest = {
      image: file ? file.buffer : undefined,
      s3Uri,
      options: {
        detailLevel: detailLevel || 'comprehensive',
        generateAudio: generateAudio !== 'false', // Convert string to boolean
        includeAltText: includeAltText !== 'false',
        voiceId: voiceId || process.env.POLLY_VOICE_ID || 'Joanna',
        language: language || 'en',
      },
      metadata: {
        title: title || 'Untitled Image',
        description: description || '',
        context: context || '',
      },
      pipeline: pipeline as PipelineType,
      openaiOptions: parsedOpenAIOptions,
    };

    // Process with unified pipeline orchestrator
    const result = await orchestrator.processImage(enhancedRequest);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        timestamp: new Date(),
      });
    }

    logger.info('Enhanced image processing successful', { 
      jobId: result.data?.jobId,
      pipeline: result.data?.pipeline,
      status: result.data?.status
    });

    // Format response based on pipeline used
    let responseData: any = {
      jobId: result.data?.jobId,
      pipeline: result.data?.pipeline,
      status: result.data?.status,
    };

    // Add OpenAI-specific results if OpenAI pipeline was used
    if (result.data?.pipeline === 'openai' && result.data?.results?.openai) {
      const openaiResults = result.data.results.openai as any;
      responseData = {
        ...responseData,
        altText: openaiResults.altText,
        detailedDescription: openaiResults.detailedDescription,
        seoDescription: openaiResults.seoDescription,
        visualElements: openaiResults.visualElements,
        colors: openaiResults.colors,
        composition: openaiResults.composition,
        imageType: openaiResults.imageType,
        confidence: openaiResults.confidence,
        tokensUsed: openaiResults.metadata?.tokensUsed,
      };
    }

    // Add cost estimates if available
    if (result.data?.metadata?.costsEstimate) {
      responseData.costEstimate = result.data.metadata.costsEstimate;
    }

    return res.status(200).json({
      success: true,
      data: responseData,
      timestamp: new Date(),
    });

  } catch (error) {
    logger.error('Enhanced image processing handler error:', error);

    if (error instanceof Error && error.message.includes('Only image files')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Only image files are allowed',
        },
        timestamp: new Date(),
      });
    }

    if (error instanceof Error && error.message.includes('File too large')) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds 50MB limit',
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