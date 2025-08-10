import type { NextApiRequest, NextApiResponse } from 'next';
import { JobManager } from '../../src/orchestrator/jobManager';
import { ImageProcessRequest, APIResponse, ImageProcessingResults } from '../../src/types';
import { logger } from '../../src/utils/logger';
import formidable from 'formidable';
import * as fs from 'fs';

// Disable Next.js body parsing for multipart forms
export const config = {
  api: {
    bodyParser: false,
  },
};

const jobManager = new JobManager({
  region: process.env.AWS_REGION || 'us-east-1',
  inputBucket: process.env.INPUT_S3_BUCKET || '',
  outputBucket: process.env.OUTPUT_S3_BUCKET || '',
});

interface ProcessImageResponse {
  success: boolean;
  data?: {
    jobId: string;
    status: 'processing' | 'completed' | 'failed';
    processingTime?: number;
    results?: ImageProcessingResults;
  };
  error?: APIResponse['error'];
  timestamp: Date;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProcessImageResponse>
) {
  const startTime = Date.now();

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method is allowed',
      },
      timestamp: new Date(),
    });
  }

  try {
    logger.info('Image processing request received', {
      headers: req.headers,
      query: req.query,
    });

    let imageProcessRequest: ImageProcessRequest;

    // Check if the request contains multipart form data
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Parse multipart form data
      const form = formidable({
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowEmptyFiles: false,
      });

      const [fields, files] = await form.parse(req);
      
      // Get the uploaded file
      const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;
      
      if (!imageFile) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_IMAGE_PROVIDED',
            message: 'No image file provided in the request',
          },
          timestamp: new Date(),
        });
      }

      // Read file buffer
      const fileBuffer = await fs.promises.readFile(imageFile.filepath);

      // Parse options from form fields
      const options: ImageProcessRequest['options'] = {};
      if (fields.detailLevel) {
        options.detailLevel = String(fields.detailLevel[0]) as any;
      }
      if (fields.generateAudio) {
        options.generateAudio = fields.generateAudio[0] === 'true';
      }
      if (fields.includeAltText) {
        options.includeAltText = fields.includeAltText[0] === 'true';
      }
      if (fields.voiceId) {
        options.voiceId = String(fields.voiceId[0]);
      }
      if (fields.language) {
        options.language = String(fields.language[0]);
      }

      // Parse metadata from form fields
      const metadata: ImageProcessRequest['metadata'] = {};
      if (fields.title) {
        metadata.title = String(fields.title[0]);
      }
      if (fields.description) {
        metadata.description = String(fields.description[0]);
      }
      if (fields.context) {
        metadata.context = String(fields.context[0]);
      }

      imageProcessRequest = {
        image: fileBuffer,
        options,
        metadata,
      };

      // Clean up temp file
      await fs.promises.unlink(imageFile.filepath).catch(() => {});

    } else if (contentType.includes('application/json')) {
      // Parse JSON body
      const body = JSON.parse(await streamToString(req));
      
      if (!body.s3Uri && !body.image) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_IMAGE_SOURCE',
            message: 'Either s3Uri or image must be provided',
          },
          timestamp: new Date(),
        });
      }

      imageProcessRequest = {
        s3Uri: body.s3Uri,
        image: body.image ? Buffer.from(body.image, 'base64') : undefined,
        options: body.options || {},
        metadata: body.metadata || {},
      };

    } else {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: 'Content-Type must be multipart/form-data or application/json',
        },
        timestamp: new Date(),
      });
    }

    // Create image processing job
    const createResult = await jobManager.createImageJob(imageProcessRequest);
    
    if (!createResult.success) {
      logger.error('Failed to create image job', { error: createResult.error });
      return res.status(400).json({
        success: false,
        error: createResult.error,
        timestamp: new Date(),
      });
    }

    const { jobId } = createResult.data!;

    // Process the image immediately (synchronous processing for single images)
    const processResult = await jobManager.processImageJob(jobId);

    if (!processResult.success) {
      logger.error('Failed to process image', { jobId, error: processResult.error });
      return res.status(500).json({
        success: false,
        data: {
          jobId,
          status: 'failed',
        },
        error: processResult.error,
        timestamp: new Date(),
      });
    }

    const processingTime = (Date.now() - startTime) / 1000; // Convert to seconds

    logger.info('Image processing completed', {
      jobId,
      processingTime,
      confidence: processResult.data?.confidence,
    });

    return res.status(200).json({
      success: true,
      data: {
        jobId,
        status: 'completed',
        processingTime,
        results: processResult.data,
      },
      timestamp: new Date(),
    });

  } catch (error) {
    logger.error('Image processing endpoint error', { error });

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

// Helper function to convert stream to string
async function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}