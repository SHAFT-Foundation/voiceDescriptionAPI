import { 
  JobStatus, 
  ProcessingJob, 
  AWSConfig, 
  UploadRequest, 
  APIResponse,
  VideoSegment,
  SceneAnalysis
} from '../types';
import { VideoInputModule } from '../modules/videoInput';
import { VideoSegmentationModule } from '../modules/videoSegmentation';
import { SceneExtractionModule } from '../modules/sceneExtraction';
import { SceneAnalysisModule } from '../modules/sceneAnalysis';
import { DescriptionCompilationModule } from '../modules/descriptionCompilation';
import { TextToSpeechModule } from '../modules/textToSpeech';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class JobManager {
  private videoInput: VideoInputModule;
  private videoSegmentation: VideoSegmentationModule;
  private sceneExtraction: SceneExtractionModule;
  private sceneAnalysis: SceneAnalysisModule;
  private descriptionCompilation: DescriptionCompilationModule;
  private textToSpeech: TextToSpeechModule;
  
  private jobs: Map<string, ProcessingJob> = new Map();
  private config: AWSConfig;

  constructor(config: AWSConfig) {
    this.config = config;
    
    // Initialize all modules
    this.videoInput = new VideoInputModule(config);
    this.videoSegmentation = new VideoSegmentationModule(config);
    this.sceneExtraction = new SceneExtractionModule(config);
    this.sceneAnalysis = new SceneAnalysisModule(config);
    this.descriptionCompilation = new DescriptionCompilationModule();
    this.textToSpeech = new TextToSpeechModule(config);
  }

  async createJob(request: UploadRequest): Promise<APIResponse<{ jobId: string; s3Uri: string }>> {
    try {
      logger.info('Creating new processing job', { 
        hasFile: !!request.file, 
        s3Uri: request.s3Uri,
        metadata: request.metadata 
      });

      // Handle video upload/validation
      const uploadResult = await this.videoInput.uploadFile(request);
      if (!uploadResult.success) {
        return uploadResult;
      }

      const { jobId, s3Uri } = uploadResult.data!;

      // Initialize job status
      const job: ProcessingJob = {
        jobId,
        inputUri: s3Uri,
        status: {
          jobId,
          status: 'pending',
          step: 'upload',
          progress: 10,
          message: 'Video uploaded successfully, queued for processing',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        segments: [],
        analyses: [],
        config: {
          maxVideoSizeMB: parseInt(process.env.MAX_VIDEO_SIZE_MB || '500'),
          processingTimeoutMinutes: parseInt(process.env.PROCESSING_TIMEOUT_MINUTES || '30'),
          novaModelId: process.env.NOVA_MODEL_ID || 'amazon.nova-pro-v1:0',
          pollyVoiceId: process.env.POLLY_VOICE_ID || 'Joanna',
          ffmpegConcurrency: parseInt(process.env.FFMPEG_CONCURRENCY || '3'),
        },
      };

      this.jobs.set(jobId, job);

      logger.info('Processing job created', { jobId, s3Uri });

      return {
        success: true,
        data: { jobId, s3Uri },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to create processing job', { error, request });

      return {
        success: false,
        error: {
          code: 'JOB_CREATION_FAILED',
          message: 'Failed to create processing job',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  async processJob(jobId: string): Promise<APIResponse<{ jobId: string; status: string }>> {
    try {
      const job = this.jobs.get(jobId);
      if (!job) {
        return {
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: `Job ${jobId} not found`,
          },
          timestamp: new Date(),
        };
      }

      logger.info('Starting job processing', { jobId, inputUri: job.inputUri });

      // Update job status to processing
      this.updateJobStatus(jobId, {
        status: 'processing',
        step: 'segmentation',
        progress: 15,
        message: 'Starting video segmentation...',
      });

      try {
        // Step 1: Video Segmentation
        await this.performVideoSegmentation(job);

        // Step 2: Scene Extraction
        await this.performSceneExtraction(job);

        // Step 3: Scene Analysis
        await this.performSceneAnalysis(job);

        // Step 4: Description Compilation
        await this.performDescriptionCompilation(job);

        // Step 5: Text-to-Speech Synthesis
        await this.performTextToSpeech(job);

        // Job completed successfully
        this.updateJobStatus(jobId, {
          status: 'completed',
          step: 'synthesis',
          progress: 100,
          message: 'Processing completed successfully',
          results: {
            textUrl: `/api/results/${jobId}/text`,
            audioUrl: `/api/results/${jobId}/audio`,
          },
        });

        logger.info('Job processing completed successfully', { jobId });

        return {
          success: true,
          data: { jobId, status: 'completed' },
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
            code: 'PROCESSING_FAILED',
            message: 'Job processing failed',
            details: processingError instanceof Error ? processingError.message : String(processingError),
          },
        });

        throw processingError;
      }

    } catch (error) {
      logger.error('Job processing failed', { error, jobId });

      return {
        success: false,
        error: {
          code: 'JOB_PROCESSING_FAILED',
          message: `Failed to process job ${jobId}`,
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private async performVideoSegmentation(job: ProcessingJob): Promise<void> {
    logger.info('Starting video segmentation', { jobId: job.jobId });
    
    this.updateJobStatus(job.jobId, {
      step: 'segmentation',
      progress: 20,
      message: 'Analyzing video segments with Rekognition...',
    });

    const segmentationResult = await this.videoSegmentation.processSegmentationResults(
      job.inputUri,
      job.jobId,
      job.config.processingTimeoutMinutes * 60 * 1000
    );

    if (!segmentationResult.success) {
      throw new Error(`Segmentation failed: ${segmentationResult.error?.message}`);
    }

    job.segments = segmentationResult.data!.segments;
    
    this.updateJobStatus(job.jobId, {
      step: 'segmentation',
      progress: 35,
      message: `Found ${job.segments.length} video segments`,
    });

    logger.info('Video segmentation completed', { 
      jobId: job.jobId, 
      segmentCount: job.segments.length 
    });
  }

  private async performSceneExtraction(job: ProcessingJob): Promise<void> {
    logger.info('Starting scene extraction', { jobId: job.jobId });

    this.updateJobStatus(job.jobId, {
      step: 'extraction',
      progress: 40,
      message: 'Extracting video scenes with FFmpeg...',
    });

    const extractionResult = await this.sceneExtraction.extractScenes(
      job.inputUri,
      job.segments,
      job.jobId
    );

    if (!extractionResult.success) {
      throw new Error(`Scene extraction failed: ${extractionResult.error?.message}`);
    }

    // Store extracted scenes in job context
    (job as any).extractedScenes = extractionResult.data!.extractedScenes;
    
    if (extractionResult.data!.errors.length > 0) {
      logger.warn('Some scenes failed to extract', {
        jobId: job.jobId,
        errors: extractionResult.data!.errors,
      });
    }

    this.updateJobStatus(job.jobId, {
      step: 'extraction',
      progress: 55,
      message: `Extracted ${extractionResult.data!.extractedScenes.length} scenes`,
    });

    logger.info('Scene extraction completed', { 
      jobId: job.jobId, 
      extractedCount: extractionResult.data!.extractedScenes.length,
      errorCount: extractionResult.data!.errors.length
    });
  }

  private async performSceneAnalysis(job: ProcessingJob): Promise<void> {
    logger.info('Starting scene analysis', { jobId: job.jobId });

    this.updateJobStatus(job.jobId, {
      step: 'analysis',
      progress: 60,
      message: 'Analyzing scenes with Bedrock Nova Pro...',
    });

    const extractedScenes = (job as any).extractedScenes;
    if (!extractedScenes || extractedScenes.length === 0) {
      throw new Error('No extracted scenes available for analysis');
    }

    const analysisResult = await this.sceneAnalysis.analyzeScenes(extractedScenes, job.jobId);

    if (!analysisResult.success) {
      throw new Error(`Scene analysis failed: ${analysisResult.error?.message}`);
    }

    job.analyses = analysisResult.data!.analyses;

    if (analysisResult.data!.errors.length > 0) {
      logger.warn('Some scenes failed to analyze', {
        jobId: job.jobId,
        errors: analysisResult.data!.errors,
      });
    }

    this.updateJobStatus(job.jobId, {
      step: 'analysis',
      progress: 75,
      message: `Analyzed ${job.analyses.length} scenes`,
    });

    logger.info('Scene analysis completed', { 
      jobId: job.jobId, 
      analysisCount: job.analyses.length,
      errorCount: analysisResult.data!.errors.length
    });
  }

  private async performDescriptionCompilation(job: ProcessingJob): Promise<void> {
    logger.info('Starting description compilation', { jobId: job.jobId });

    this.updateJobStatus(job.jobId, {
      step: 'compilation',
      progress: 80,
      message: 'Compiling scene descriptions...',
    });

    const compilationResult = await this.descriptionCompilation.compileDescriptions(
      job.analyses,
      job.jobId
    );

    if (!compilationResult.success) {
      throw new Error(`Description compilation failed: ${compilationResult.error?.message}`);
    }

    // Store compiled description
    (job as any).compiledDescription = compilationResult.data!;
    job.compiledText = compilationResult.data!.cleanText;

    this.updateJobStatus(job.jobId, {
      step: 'compilation',
      progress: 85,
      message: `Compiled ${compilationResult.data!.metadata.wordCount} words`,
    });

    logger.info('Description compilation completed', { 
      jobId: job.jobId, 
      wordCount: compilationResult.data!.metadata.wordCount,
      totalScenes: compilationResult.data!.metadata.totalScenes
    });
  }

  private async performTextToSpeech(job: ProcessingJob): Promise<void> {
    logger.info('Starting text-to-speech synthesis', { jobId: job.jobId });

    this.updateJobStatus(job.jobId, {
      step: 'synthesis',
      progress: 90,
      message: 'Generating audio with Polly...',
    });

    const compiledDescription = (job as any).compiledDescription;
    if (!compiledDescription) {
      throw new Error('No compiled description available for TTS');
    }

    const ttsResult = await this.textToSpeech.synthesizeSpeech(compiledDescription, job.jobId);

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
      message: 'Audio generated and uploaded successfully',
    });

    logger.info('Text-to-speech synthesis completed', { 
      jobId: job.jobId, 
      audioUri: job.audioUri,
      duration: ttsResult.data!.metadata.duration
    });
  }

  private updateJobStatus(jobId: string, updates: Partial<JobStatus>): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.warn('Attempted to update non-existent job', { jobId });
      return;
    }

    job.status = {
      ...job.status,
      ...updates,
      updatedAt: new Date(),
    };

    logger.debug('Job status updated', { jobId, status: job.status });
  }

  getJobStatus(jobId: string): JobStatus | null {
    const job = this.jobs.get(jobId);
    return job ? job.status : null;
  }

  getJob(jobId: string): ProcessingJob | null {
    return this.jobs.get(jobId) || null;
  }

  getAllJobs(): ProcessingJob[] {
    return Array.from(this.jobs.values());
  }

  deleteJob(jobId: string): boolean {
    const deleted = this.jobs.delete(jobId);
    if (deleted) {
      logger.info('Job deleted', { jobId });
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
        logger.info('Old job cleaned up', { jobId, createdAt: job.status.createdAt });
      }
    }

    if (deletedCount > 0) {
      logger.info('Job cleanup completed', { deletedCount, maxAgeHours });
    }

    return deletedCount;
  }

  // Health check method
  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    lastCleanup?: Date;
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