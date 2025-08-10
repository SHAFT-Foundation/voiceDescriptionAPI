import type { NextApiRequest, NextApiResponse } from 'next';
import { JobManager } from '../../src/orchestrator/jobManager';
import { BatchImageProcessRequest, BatchImageProcessResponse } from '../../src/types';
import { logger } from '../../src/utils/logger';

const jobManager = new JobManager({
  region: process.env.AWS_REGION || 'us-east-1',
  inputBucket: process.env.INPUT_S3_BUCKET || '',
  outputBucket: process.env.OUTPUT_S3_BUCKET || '',
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BatchImageProcessResponse>
) {
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
    logger.info('Batch image processing request received', {
      imageCount: req.body?.images?.length,
    });

    // Validate request body
    if (!req.body || !req.body.images || !Array.isArray(req.body.images)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request must include an array of images',
        },
        timestamp: new Date(),
      });
    }

    if (req.body.images.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_IMAGES_PROVIDED',
          message: 'At least one image must be provided',
        },
        timestamp: new Date(),
      });
    }

    if (req.body.images.length > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOO_MANY_IMAGES',
          message: 'Maximum 100 images can be processed in a single batch',
        },
        timestamp: new Date(),
      });
    }

    // Validate each image has a source
    const invalidImages = req.body.images.filter(
      (img: any, index: number) => !img.source || typeof img.source !== 'string'
    );

    if (invalidImages.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_IMAGE_SOURCES',
          message: 'All images must have a valid source (S3 URI or base64 data URI)',
        },
        timestamp: new Date(),
      });
    }

    const batchRequest: BatchImageProcessRequest = {
      images: req.body.images.map((img: any) => ({
        source: img.source,
        id: img.id || undefined,
        metadata: img.metadata || undefined,
      })),
      options: req.body.options || {},
    };

    // Process batch
    const batchResult = await jobManager.processBatchImages(batchRequest);

    if (!batchResult.success) {
      logger.error('Batch processing failed', { error: batchResult.error });
      return res.status(500).json({
        success: false,
        error: batchResult.error,
        timestamp: new Date(),
      });
    }

    logger.info('Batch processing completed', {
      batchId: batchResult.data?.batchId,
      totalImages: batchResult.data?.totalImages,
      status: batchResult.data?.status,
      completedCount: batchResult.data?.results.filter(r => r.status === 'completed').length,
      failedCount: batchResult.data?.results.filter(r => r.status === 'failed').length,
    });

    return res.status(200).json({
      success: true,
      data: batchResult.data,
      timestamp: new Date(),
    });

  } catch (error) {
    logger.error('Batch processing endpoint error', { error });

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