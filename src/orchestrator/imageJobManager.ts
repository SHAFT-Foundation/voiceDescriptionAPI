import { 
  ImageJobStatus, 
  ImageProcessingJob, 
  AWSConfig, 
  ImageProcessRequest, 
  APIResponse,
  ImageData,
  ImageAnalysis,
  CompiledImageDescription,
  ImageProcessingResults,
  BatchImageProcessRequest,
  BatchImageProcessResponse,
  ImageProcessingOptions,
  ImageMetadata
} from '../types';
import { ImageInputModule } from '../modules/imageInput';
import { SceneAnalysisModule } from '../modules/sceneAnalysis';
import { DescriptionCompilationModule } from '../modules/descriptionCompilation';
import { TextToSpeechModule } from '../modules/textToSpeech';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class ImageJobManager {
  private imageInput: ImageInputModule;
  private sceneAnalysis: SceneAnalysisModule;
  private descriptionCompilation: DescriptionCompilationModule;
  private textToSpeech: TextToSpeechModule;
  
  private jobs: Map<string, ImageProcessingJob> = new Map();
  private config: AWSConfig;

  constructor(config: AWSConfig) {
    this.config = config;
    
    // Initialize modules
    this.imageInput = new ImageInputModule(config);
    this.sceneAnalysis = new SceneAnalysisModule(config);
    this.descriptionCompilation = new DescriptionCompilationModule();
    this.textToSpeech = new TextToSpeechModule(config);
  }

  async createImageJob(request: ImageProcessRequest): Promise<APIResponse<{ jobId: string; s3Uri: string }>> {
    try {
      const jobId = uuidv4();
      
      logger.info('Creating new image processing job', { 
        jobId,
        hasFile: !!request.image, 
        s3Uri: request.s3Uri,
        metadata: request.metadata,
        options: request.options
      });

      // Handle image upload/validation
      const uploadResult = await this.imageInput.uploadImage({
        file: request.image,
        s3Uri: request.s3Uri,
        jobId,
        metadata: request.metadata,
      });

      if (!uploadResult.success) {
        return uploadResult;
      }

      const { s3Uri, format } = uploadResult.data!;

      // Initialize job
      const job: ImageProcessingJob = {
        jobId,
        inputUri: s3Uri,
        status: {
          jobId,
          status: 'pending',
          step: 'upload',
          progress: 10,
          message: 'Image uploaded successfully, queued for processing',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        config: {
          maxVideoSizeMB: 0, // Not used for images
          processingTimeoutMinutes: parseInt(process.env.IMAGE_PROCESSING_TIMEOUT_MINUTES || '5'),
          novaModelId: process.env.NOVA_MODEL_ID || 'amazon.nova-pro-v1:0',
          pollyVoiceId: request.options?.voiceId || process.env.POLLY_VOICE_ID || 'Joanna',
          ffmpegConcurrency: 0, // Not used for images
        },
        options: {
          detailLevel: request.options?.detailLevel || 'comprehensive',
          generateAudio: request.options?.generateAudio !== false, // Default true
          includeAltText: request.options?.includeAltText !== false, // Default true
          voiceId: request.options?.voiceId || process.env.POLLY_VOICE_ID || 'Joanna',
          language: request.options?.language || 'en',
        },
        metadata: request.metadata,
      };

      this.jobs.set(jobId, job);

      logger.info('Image processing job created', { jobId, s3Uri, format });

      return {
        success: true,
        data: { jobId, s3Uri },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to create image processing job', { error, request });

      return {
        success: false,
        error: {
          code: 'IMAGE_JOB_CREATION_FAILED',
          message: 'Failed to create image processing job',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  async processImageJob(jobId: string): Promise<APIResponse<ImageProcessingResults>> {
    try {
      const job = this.jobs.get(jobId);
      if (!job) {
        return {
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: `Image job ${jobId} not found`,
          },
          timestamp: new Date(),
        };
      }

      logger.info('Starting image job processing', { jobId, inputUri: job.inputUri });

      // Update job status to processing
      this.updateJobStatus(jobId, {
        status: 'processing',
        step: 'analysis',
        progress: 20,
        message: 'Analyzing image with AI...',
      });

      try {
        // Step 1: Image Analysis (no segmentation or extraction needed)
        await this.performImageAnalysis(job);

        // Step 2: Description Compilation
        await this.performDescriptionCompilation(job);

        // Step 3: Text-to-Speech Synthesis (if enabled)
        if (job.options.generateAudio) {
          await this.performTextToSpeech(job);
        }

        // Prepare results
        const results = this.prepareResults(job);

        // Job completed successfully
        this.updateJobStatus(jobId, {
          status: 'completed',
          step: 'completed',
          progress: 100,
          message: 'Image processing completed successfully',
        });

        logger.info('Image job processing completed successfully', { jobId });

        return {
          success: true,
          data: results,
          timestamp: new Date(),
        };

      } catch (processingError) {
        // Handle processing failure
        this.updateJobStatus(jobId, {
          status: 'failed',
          step: job.status.step,
          progress: job.status.progress,
          message: 'Processing failed',
          error: {
            code: 'IMAGE_PROCESSING_FAILED',
            message: 'Image processing failed',
            details: processingError instanceof Error ? processingError.message : String(processingError),
          },
        });

        throw processingError;
      }

    } catch (error) {
      logger.error('Image job processing failed', { error, jobId });

      return {
        success: false,
        error: {
          code: 'IMAGE_JOB_PROCESSING_FAILED',
          message: `Failed to process image job ${jobId}`,
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  async processBatchImages(request: BatchImageProcessRequest): Promise<APIResponse<BatchImageProcessResponse['data']>> {
    try {
      const batchId = uuidv4();

      logger.info('Starting batch image processing', { 
        batchId, 
        imageCount: request.images.length 
      });

      // Process images sequentially to avoid rate limiting
      const batchResults: BatchImageProcessResponse['data']['results'] = [];
    
      for (const imageRequest of request.images) {
        const jobId = uuidv4();
        
        try {
          // Create job for each image
          const createResult = await this.createImageJob({
            s3Uri: imageRequest.source,
            options: request.options,
            metadata: imageRequest.metadata,
          });

          if (!createResult.success) {
            batchResults.push({
              id: imageRequest.id,
              jobId,
              status: 'failed',
              error: createResult.error,
            });
            continue;
          }

          // Process the job
          const processResult = await this.processImageJob(createResult.data!.jobId);

          if (processResult.success) {
            batchResults.push({
              id: imageRequest.id,
              jobId: createResult.data!.jobId,
              status: 'completed',
              result: processResult.data,
            });
          } else {
            batchResults.push({
              id: imageRequest.id,
              jobId: createResult.data!.jobId,
              status: 'failed',
              error: processResult.error,
            });
          }

        } catch (error) {
          logger.error('Batch image processing error', { 
            error, 
            imageId: imageRequest.id,
            batchId 
          });

          batchResults.push({
            id: imageRequest.id,
            jobId,
            status: 'failed',
            error: {
              code: 'BATCH_PROCESSING_ERROR',
              message: 'Failed to process image in batch',
              details: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }

      const completedCount = batchResults.filter((r: any) => r.status === 'completed').length;
      const failedCount = batchResults.filter((r: any) => r.status === 'failed').length;

      const batchStatus = completedCount === request.images.length ? 'completed' :
                         failedCount === request.images.length ? 'failed' : 'partial';

      logger.info('Batch image processing completed', { 
        batchId, 
        batchStatus,
        completedCount,
        failedCount 
      });

      return {
        success: true,
        data: {
          batchId,
          totalImages: request.images.length,
          status: batchStatus,
          results: batchResults,
        },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Batch image processing failed', { error });

      return {
        success: false,
        error: {
          code: 'BATCH_PROCESSING_FAILED',
          message: 'Failed to process batch images',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private async performImageAnalysis(job: ImageProcessingJob): Promise<void> {
    logger.info('Starting image analysis', { jobId: job.jobId });

    this.updateJobStatus(job.jobId, {
      step: 'analysis',
      progress: 40,
      message: 'Analyzing image content and visual elements...',
    });

    const imageData: ImageData = {
      jobId: job.jobId,
      s3Uri: job.inputUri,
      metadata: job.metadata,
      options: job.options,
    };

    const analysisResult = await this.sceneAnalysis.analyzeImage(imageData, job.jobId);

    if (!analysisResult.success) {
      throw new Error(`Image analysis failed: ${analysisResult.error?.message}`);
    }

    job.analysis = analysisResult.data!;

    // Detect and store image type in status
    this.updateJobStatus(job.jobId, {
      step: 'analysis',
      progress: 60,
      message: `Analyzed ${job.analysis.imageType} successfully`,
      imageType: job.analysis.imageType,
    });

    logger.info('Image analysis completed', { 
      jobId: job.jobId, 
      imageType: job.analysis.imageType,
      confidence: job.analysis.confidence 
    });
  }

  private async performDescriptionCompilation(job: ImageProcessingJob): Promise<void> {
    logger.info('Starting description compilation', { jobId: job.jobId });

    this.updateJobStatus(job.jobId, {
      step: 'compilation',
      progress: 70,
      message: 'Compiling accessibility descriptions...',
    });

    if (!job.analysis) {
      throw new Error('No analysis available for compilation');
    }

    const compilationResult = await this.descriptionCompilation.compileImageDescription(
      job.analysis,
      job.options
    );

    if (!compilationResult.success) {
      throw new Error(`Description compilation failed: ${compilationResult.error?.message}`);
    }

    job.compiledDescription = compilationResult.data!;

    this.updateJobStatus(job.jobId, {
      step: 'compilation',
      progress: 85,
      message: `Compiled descriptions (${compilationResult.data!.metadata.wordCount} words)`,
    });

    logger.info('Description compilation completed', { 
      jobId: job.jobId, 
      wordCount: compilationResult.data!.metadata.wordCount,
      altTextLength: compilationResult.data!.altText.length
    });
  }

  private async performTextToSpeech(job: ImageProcessingJob): Promise<void> {
    logger.info('Starting text-to-speech synthesis', { jobId: job.jobId });

    this.updateJobStatus(job.jobId, {
      step: 'synthesis',
      progress: 90,
      message: 'Generating audio narration...',
    });

    if (!job.compiledDescription) {
      throw new Error('No compiled description available for TTS');
    }

    // Format description for TTS
    const ttsText = this.descriptionCompilation.formatImageDescriptionForTTS(job.compiledDescription);

    // Create a simplified compiled description for TTS module
    const ttsInput = {
      cleanText: ttsText,
      timestampedText: '', // Not used for images
      metadata: {
        totalScenes: 1,
        totalDuration: 0,
        averageConfidence: job.compiledDescription.metadata.confidence,
        wordCount: job.compiledDescription.metadata.wordCount,
      },
    };

    const ttsResult = await this.textToSpeech.synthesizeSpeech(ttsInput, job.jobId);

    if (!ttsResult.success) {
      throw new Error(`Text-to-speech failed: ${ttsResult.error?.message}`);
    }

    // Upload audio to S3
    const uploadResult = await this.textToSpeech.uploadAudioToS3(ttsResult.data!, job.jobId);
    
    if (!uploadResult.success) {
      throw new Error(`Audio upload failed: ${uploadResult.error?.message}`);
    }

    job.audioUri = uploadResult.data!.s3Uri;

    this.updateJobStatus(job.jobId, {
      step: 'synthesis',
      progress: 95,
      message: 'Audio narration generated successfully',
    });

    logger.info('Text-to-speech synthesis completed', { 
      jobId: job.jobId, 
      audioUri: job.audioUri,
      duration: ttsResult.data!.metadata.duration
    });
  }

  private prepareResults(job: ImageProcessingJob): ImageProcessingResults {
    if (!job.compiledDescription || !job.analysis) {
      throw new Error('Job not fully processed');
    }

    const results: ImageProcessingResults = {
      detailedDescription: job.compiledDescription.detailedDescription,
      altText: job.compiledDescription.altText,
      visualElements: job.analysis.visualElements,
      colors: job.analysis.colors,
      composition: job.analysis.composition,
      context: job.analysis.context,
      confidence: job.analysis.confidence,
      htmlMetadata: job.compiledDescription.htmlMetadata,
    };

    // Add audio file info if generated
    if (job.audioUri && job.options.generateAudio) {
      results.audioFile = {
        url: `/api/results/image/${job.jobId}/audio`,
        duration: 0, // Will be populated from TTS metadata
        format: 'mp3',
      };
    }

    return results;
  }

  private updateJobStatus(jobId: string, updates: Partial<ImageJobStatus>): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn('Attempted to update non-existent image job', { jobId });
      return;
    }

    job.status = {
      ...job.status,
      ...updates,
      updatedAt: new Date(),
    };

    logger.debug('Image job status updated', { jobId, status: job.status });
  }

  getJobStatus(jobId: string): ImageJobStatus | null {
    const job = this.jobs.get(jobId);
    return job ? job.status : null;
  }

  getJob(jobId: string): ImageProcessingJob | null {
    return this.jobs.get(jobId) || null;
  }

  getAllJobs(): ImageProcessingJob[] {
    return Array.from(this.jobs.values());
  }

  deleteJob(jobId: string): boolean {
    const deleted = this.jobs.delete(jobId);
    if (deleted) {
      logger.info('Image job deleted', { jobId });
    }
    return deleted;
  }

  // Cleanup method for old jobs
  cleanupOldJobs(maxAgeHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status.createdAt < cutoffTime) {
        this.jobs.delete(jobId);
        deletedCount++;
        logger.info('Old image job cleaned up', { jobId, createdAt: job.status.createdAt });
      }
    }

    if (deletedCount > 0) {
      logger.info('Image job cleanup completed', { deletedCount, maxAgeHours });
    }

    return deletedCount;
  }

  // Health check method
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
  } {
    const jobs = Array.from(this.jobs.values());
    const activeJobs = jobs.filter(j => j.status.status === 'processing').length;
    const completedJobs = jobs.filter(j => j.status.status === 'completed').length;
    const failedJobs = jobs.filter(j => j.status.status === 'failed').length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (failedJobs > activeJobs && failedJobs > 0) {
      status = 'unhealthy';
    } else if (failedJobs > 0 || activeJobs > 10) {
      status = 'degraded';
    }

    return {
      status,
      activeJobs,
      completedJobs,
      failedJobs,
    };
  }
}