import { 
  JobStatus,
  ProcessingJob,
  ImageProcessingJob,
  AWSConfig,
  EnhancedUploadRequest,
  EnhancedImageProcessRequest,
  APIResponse,
  PipelineType,
  PipelineProcessingResult,
  OpenAIVideoAnalysisResult,
  OpenAIImageAnalysisResult,
  SynthesizedDescription,
  VideoChunkingResult
} from '../types';
import { JobManager } from './jobManager';
import { PipelineSelector } from './pipelineSelector';
import { OpenAIImageAnalysisModule } from '../modules/openaiImageAnalysis';
import { VideoChunkingModule } from '../modules/videoChunking';
import { OpenAIVideoAnalysisModule } from '../modules/openaiVideoAnalysis';
import { DescriptionSynthesisModule } from '../modules/descriptionSynthesis';
import { TextToSpeechModule } from '../modules/textToSpeech';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class UnifiedPipelineOrchestrator {
  private awsJobManager: JobManager;
  private pipelineSelector: PipelineSelector;
  private openaiImageAnalysis: OpenAIImageAnalysisModule;
  private videoChunking: VideoChunkingModule;
  private openaiVideoAnalysis: OpenAIVideoAnalysisModule;
  private descriptionSynthesis: DescriptionSynthesisModule;
  private textToSpeech: TextToSpeechModule;
  
  private pipelineJobs: Map<string, {
    pipeline: PipelineType;
    status: JobStatus;
    startTime: Date;
    data?: any;
  }> = new Map();

  constructor(config: AWSConfig) {
    // Initialize AWS job manager for AWS pipeline
    this.awsJobManager = new JobManager(config);
    
    // Initialize pipeline selector
    this.pipelineSelector = new PipelineSelector();
    
    // Initialize OpenAI modules
    this.openaiImageAnalysis = new OpenAIImageAnalysisModule(config);
    this.videoChunking = new VideoChunkingModule(config);
    this.openaiVideoAnalysis = new OpenAIVideoAnalysisModule(config);
    this.descriptionSynthesis = new DescriptionSynthesisModule();
    
    // Initialize shared modules
    this.textToSpeech = new TextToSpeechModule(config);
  }

  /**
   * Process video with automatic or specified pipeline selection
   */
  async processVideo(
    request: EnhancedUploadRequest
  ): Promise<APIResponse<PipelineProcessingResult>> {
    const jobId = uuidv4();
    
    try {
      logger.info('Processing video request', { 
        jobId,
        requestedPipeline: request.pipeline,
        hasFile: !!request.file,
        s3Uri: request.s3Uri
      });

      // Select optimal pipeline
      const pipelineSelection = await this.pipelineSelector.selectVideoProcessingPipeline(
        request,
        request.file ? (request.file as any).size : undefined
      );

      logger.info('Pipeline selected', {
        jobId,
        pipeline: pipelineSelection.pipeline,
        reason: pipelineSelection.reason,
        autoSelected: pipelineSelection.autoSelected
      });

      // Initialize job tracking
      this.pipelineJobs.set(jobId, {
        pipeline: pipelineSelection.pipeline,
        status: {
          jobId,
          status: 'pending',
          step: 'upload',
          progress: 5,
          message: `Processing with ${pipelineSelection.pipeline} pipeline`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        startTime: new Date(),
      });

      // Route to appropriate pipeline
      let result: PipelineProcessingResult;
      
      switch (pipelineSelection.pipeline) {
        case 'openai':
          result = await this.processWithOpenAI(jobId, request);
          break;
          
        case 'aws':
          result = await this.processWithAWS(jobId, request);
          break;
          
        case 'hybrid':
          result = await this.processWithHybrid(jobId, request);
          break;
          
        default:
          throw new Error(`Unknown pipeline: ${pipelineSelection.pipeline}`);
      }

      // Update final status
      this.updatePipelineJobStatus(jobId, {
        status: result.status === 'completed' ? 'completed' : 'failed',
        step: 'synthesis',
        progress: 100,
        message: result.status === 'completed' 
          ? 'Processing completed successfully'
          : 'Processing failed',
      });

      logger.info('Video processing completed', {
        jobId,
        pipeline: result.pipeline,
        status: result.status,
        processingTime: result.metadata.processingTime
      });

      return {
        success: result.status !== 'failed',
        data: result,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Video processing failed', { error, jobId });

      return {
        success: false,
        error: {
          code: 'PROCESSING_FAILED',
          message: 'Failed to process video',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Process image with automatic or specified pipeline selection
   */
  async processImage(
    request: EnhancedImageProcessRequest
  ): Promise<APIResponse<PipelineProcessingResult>> {
    const jobId = uuidv4();
    
    try {
      logger.info('Processing image request', { 
        jobId,
        requestedPipeline: request.pipeline,
        hasFile: !!request.image,
        s3Uri: request.s3Uri
      });

      // Select optimal pipeline
      const pipelineSelection = await this.pipelineSelector.selectImageProcessingPipeline(
        request,
        request.image ? (request.image as any).size : undefined
      );

      logger.info('Pipeline selected for image', {
        jobId,
        pipeline: pipelineSelection.pipeline,
        reason: pipelineSelection.reason
      });

      // Route to appropriate pipeline
      let result: PipelineProcessingResult;
      
      if (pipelineSelection.pipeline === 'openai') {
        result = await this.processImageWithOpenAI(jobId, request);
      } else {
        result = await this.processImageWithAWS(jobId, request);
      }

      return {
        success: result.status !== 'failed',
        data: result,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Image processing failed', { error, jobId });

      return {
        success: false,
        error: {
          code: 'IMAGE_PROCESSING_FAILED',
          message: 'Failed to process image',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Process video using OpenAI pipeline
   */
  private async processWithOpenAI(
    jobId: string,
    request: EnhancedUploadRequest
  ): Promise<PipelineProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Upload/prepare video
      this.updatePipelineJobStatus(jobId, {
        status: 'processing',
        step: 'upload',
        progress: 10,
        message: 'Uploading video for OpenAI processing',
      });

      const uploadResult = await this.awsJobManager.createJob(request);
      if (!uploadResult.success) {
        throw new Error(`Upload failed: ${uploadResult.error?.message}`);
      }

      const s3Uri = uploadResult.data!.s3Uri;

      // Step 2: Chunk video for OpenAI
      this.updatePipelineJobStatus(jobId, {
        step: 'extraction',
        progress: 25,
        message: 'Chunking video for OpenAI Vision API',
      });

      const chunkingResult = await this.videoChunking.chunkVideo(
        s3Uri,
        jobId,
        request.chunkingOptions
      );

      if (!chunkingResult.success) {
        throw new Error(`Video chunking failed: ${chunkingResult.error?.message}`);
      }

      const chunks = chunkingResult.data!;

      // Step 3: Analyze chunks with OpenAI
      this.updatePipelineJobStatus(jobId, {
        step: 'analysis',
        progress: 50,
        message: `Analyzing ${chunks.chunks.length} video chunks with OpenAI`,
      });

      const analysisResult = await this.openaiVideoAnalysis.analyzeVideoChunks(
        chunks.chunks,
        jobId,
        {
          contextualAnalysis: true,
          detailLevel: 'high',
          customPrompt: request.openaiOptions?.customPrompt?.detailed,
        }
      );

      if (!analysisResult.success) {
        throw new Error(`OpenAI analysis failed: ${analysisResult.error?.message}`);
      }

      const openaiAnalysis = analysisResult.data!;

      // Step 4: Synthesize descriptions
      this.updatePipelineJobStatus(jobId, {
        step: 'compilation',
        progress: 75,
        message: 'Synthesizing comprehensive descriptions',
      });

      const synthesisResult = await this.descriptionSynthesis.synthesizeDescriptions(
        openaiAnalysis.chunkAnalyses,
        request.synthesisOptions
      );

      if (!synthesisResult.success) {
        throw new Error(`Description synthesis failed: ${synthesisResult.error?.message}`);
      }

      const synthesized = synthesisResult.data!;

      // Step 5: Generate audio with Polly
      this.updatePipelineJobStatus(jobId, {
        step: 'synthesis',
        progress: 90,
        message: 'Generating audio narration',
      });

      const ttsResult = await this.textToSpeech.synthesizeSpeech(
        {
          cleanText: synthesized.accessibility,
          timestampedText: synthesized.timestamped,
          metadata: {
            totalScenes: openaiAnalysis.chunkAnalyses.length,
            totalDuration: synthesized.metadata.totalDuration,
            averageConfidence: synthesized.metadata.averageConfidence,
            wordCount: synthesized.metadata.wordCount,
          },
        },
        jobId
      );

      let audioUri: string | undefined;
      if (ttsResult.success) {
        const uploadResult = await this.textToSpeech.uploadAudioToS3(
          ttsResult.data!,
          jobId
        );
        audioUri = uploadResult.data?.s3Uri;
      }

      // Prepare result
      const result: PipelineProcessingResult = {
        pipeline: 'openai',
        jobId,
        status: 'completed',
        results: {
          openai: openaiAnalysis,
          synthesized,
        },
        metadata: {
          processingTime: Date.now() - startTime,
          pipelineConfig: this.pipelineSelector['getPipelineConfig']('openai'),
          costsEstimate: {
            openaiTokens: openaiAnalysis.metadata.totalTokensUsed,
          },
        },
      };

      return result;

    } catch (error) {
      logger.error('OpenAI pipeline processing failed', { error, jobId });

      return {
        pipeline: 'openai',
        jobId,
        status: 'failed',
        error: {
          code: 'OPENAI_PIPELINE_FAILED',
          message: 'OpenAI pipeline processing failed',
          details: error instanceof Error ? error.message : String(error),
        },
        metadata: {
          processingTime: Date.now() - startTime,
          pipelineConfig: this.pipelineSelector['getPipelineConfig']('openai'),
        },
      };
    }
  }

  /**
   * Process video using AWS pipeline
   */
  private async processWithAWS(
    jobId: string,
    request: EnhancedUploadRequest
  ): Promise<PipelineProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Use existing AWS job manager
      const createResult = await this.awsJobManager.createJob(request);
      if (!createResult.success) {
        throw new Error(`Job creation failed: ${createResult.error?.message}`);
      }

      const awsJobId = createResult.data!.jobId;
      
      // Process with AWS pipeline
      const processResult = await this.awsJobManager.processJob(awsJobId);
      if (!processResult.success) {
        throw new Error(`AWS processing failed: ${processResult.error?.message}`);
      }

      // Get job details
      const job = this.awsJobManager.getJob(awsJobId) as ProcessingJob;

      const result: PipelineProcessingResult = {
        pipeline: 'aws',
        jobId,
        status: 'completed',
        results: {
          aws: job,
        },
        metadata: {
          processingTime: Date.now() - startTime,
          pipelineConfig: this.pipelineSelector['getPipelineConfig']('aws'),
          costsEstimate: {
            awsServices: {
              rekognition: job.segments.length * 0.1,
              bedrock: job.analyses.length * 0.05,
              polly: 0.02,
            },
          },
        },
      };

      return result;

    } catch (error) {
      logger.error('AWS pipeline processing failed', { error, jobId });

      return {
        pipeline: 'aws',
        jobId,
        status: 'failed',
        error: {
          code: 'AWS_PIPELINE_FAILED',
          message: 'AWS pipeline processing failed',
          details: error instanceof Error ? error.message : String(error),
        },
        metadata: {
          processingTime: Date.now() - startTime,
          pipelineConfig: this.pipelineSelector['getPipelineConfig']('aws'),
        },
      };
    }
  }

  /**
   * Process video using hybrid pipeline
   */
  private async processWithHybrid(
    jobId: string,
    request: EnhancedUploadRequest
  ): Promise<PipelineProcessingResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting hybrid pipeline processing', { jobId });

      // Step 1: Use AWS for segmentation
      this.updatePipelineJobStatus(jobId, {
        status: 'processing',
        step: 'segmentation',
        progress: 15,
        message: 'Using AWS Rekognition for scene detection',
      });

      const awsCreateResult = await this.awsJobManager.createJob(request);
      if (!awsCreateResult.success) {
        throw new Error(`AWS job creation failed: ${awsCreateResult.error?.message}`);
      }

      const awsJobId = awsCreateResult.data!.jobId;
      const s3Uri = awsCreateResult.data!.s3Uri;

      // Get scene segments from AWS
      const segmentationModule = this.awsJobManager['videoSegmentation'];
      const segmentResult = await segmentationModule.processSegmentationResults(
        s3Uri,
        awsJobId,
        30000
      );

      if (!segmentResult.success) {
        throw new Error(`Segmentation failed: ${segmentResult.error?.message}`);
      }

      const segments = segmentResult.data!.segments;

      // Step 2: Smart chunk based on AWS segments
      this.updatePipelineJobStatus(jobId, {
        step: 'extraction',
        progress: 30,
        message: 'Creating intelligent chunks based on scenes',
      });

      const sceneTimestamps = segments.map(s => s.startTime);
      const chunkingResult = await this.videoChunking.smartChunkVideo(
        s3Uri,
        jobId,
        sceneTimestamps
      );

      if (!chunkingResult.success) {
        throw new Error(`Smart chunking failed: ${chunkingResult.error?.message}`);
      }

      // Step 3: Analyze with OpenAI
      this.updatePipelineJobStatus(jobId, {
        step: 'analysis',
        progress: 55,
        message: 'Analyzing scenes with OpenAI Vision',
      });

      const openaiResult = await this.openaiVideoAnalysis.analyzeVideoChunks(
        chunkingResult.data!.chunks,
        jobId,
        {
          contextualAnalysis: true,
          detailLevel: 'high',
        }
      );

      if (!openaiResult.success) {
        throw new Error(`OpenAI analysis failed: ${openaiResult.error?.message}`);
      }

      // Step 4: Synthesize descriptions
      this.updatePipelineJobStatus(jobId, {
        step: 'compilation',
        progress: 80,
        message: 'Synthesizing final descriptions',
      });

      const synthesisResult = await this.descriptionSynthesis.synthesizeDescriptions(
        openaiResult.data!.chunkAnalyses,
        request.synthesisOptions
      );

      if (!synthesisResult.success) {
        throw new Error(`Synthesis failed: ${synthesisResult.error?.message}`);
      }

      // Step 5: Generate audio
      this.updatePipelineJobStatus(jobId, {
        step: 'synthesis',
        progress: 95,
        message: 'Generating audio narration',
      });

      const ttsResult = await this.textToSpeech.synthesizeSpeech(
        {
          cleanText: synthesisResult.data!.accessibility,
          timestampedText: synthesisResult.data!.timestamped,
          metadata: {
            totalScenes: segments.length,
            totalDuration: synthesisResult.data!.metadata.totalDuration,
            averageConfidence: synthesisResult.data!.metadata.averageConfidence,
            wordCount: synthesisResult.data!.metadata.wordCount,
          },
        },
        jobId
      );

      const result: PipelineProcessingResult = {
        pipeline: 'hybrid',
        jobId,
        status: 'completed',
        results: {
          openai: openaiResult.data,
          synthesized: synthesisResult.data,
        },
        metadata: {
          processingTime: Date.now() - startTime,
          pipelineConfig: this.pipelineSelector['getPipelineConfig']('hybrid'),
          costsEstimate: {
            openaiTokens: openaiResult.data!.metadata.totalTokensUsed,
            awsServices: {
              rekognition: segments.length * 0.1,
              polly: 0.02,
            },
          },
        },
      };

      return result;

    } catch (error) {
      logger.error('Hybrid pipeline processing failed', { error, jobId });

      return {
        pipeline: 'hybrid',
        jobId,
        status: 'failed',
        error: {
          code: 'HYBRID_PIPELINE_FAILED',
          message: 'Hybrid pipeline processing failed',
          details: error instanceof Error ? error.message : String(error),
        },
        metadata: {
          processingTime: Date.now() - startTime,
          pipelineConfig: this.pipelineSelector['getPipelineConfig']('hybrid'),
        },
      };
    }
  }

  /**
   * Process image using OpenAI pipeline
   */
  private async processImageWithOpenAI(
    jobId: string,
    request: EnhancedImageProcessRequest
  ): Promise<PipelineProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Upload image to S3 first
      const imageInput = this.awsJobManager['imageJobManager']['imageInput'];
      const uploadResult = await imageInput.uploadImage({
        file: request.image,
        s3Uri: request.s3Uri,
        jobId,
        metadata: request.metadata,
      });

      if (!uploadResult.success) {
        throw new Error(`Image upload failed: ${uploadResult.error?.message}`);
      }

      // Analyze with OpenAI
      const analysisResult = await this.openaiImageAnalysis.analyzeImage(
        {
          jobId,
          s3Uri: uploadResult.data!.s3Uri,
          metadata: request.metadata,
          options: request.options || {},
        },
        request.openaiOptions
      );

      if (!analysisResult.success) {
        throw new Error(`OpenAI image analysis failed: ${analysisResult.error?.message}`);
      }

      // Generate audio if requested
      let audioUri: string | undefined;
      if (request.options?.generateAudio !== false) {
        const ttsResult = await this.textToSpeech.synthesizeSpeech(
          {
            cleanText: analysisResult.data!.detailedDescription,
            timestampedText: '',
            metadata: {
              totalScenes: 1,
              totalDuration: 0,
              averageConfidence: analysisResult.data!.confidence,
              wordCount: analysisResult.data!.detailedDescription.split(' ').length,
            },
          },
          jobId
        );

        if (ttsResult.success) {
          const uploadResult = await this.textToSpeech.uploadAudioToS3(
            ttsResult.data!,
            jobId
          );
          audioUri = uploadResult.data?.s3Uri;
        }
      }

      const result: PipelineProcessingResult = {
        pipeline: 'openai',
        jobId,
        status: 'completed',
        results: {
          openai: analysisResult.data,
        },
        metadata: {
          processingTime: Date.now() - startTime,
          pipelineConfig: this.pipelineSelector['getPipelineConfig']('openai'),
          costsEstimate: {
            openaiTokens: analysisResult.data!.metadata.tokensUsed,
          },
        },
      };

      return result;

    } catch (error) {
      logger.error('OpenAI image pipeline failed', { error, jobId });

      return {
        pipeline: 'openai',
        jobId,
        status: 'failed',
        error: {
          code: 'OPENAI_IMAGE_PIPELINE_FAILED',
          message: 'OpenAI image processing failed',
          details: error instanceof Error ? error.message : String(error),
        },
        metadata: {
          processingTime: Date.now() - startTime,
          pipelineConfig: this.pipelineSelector['getPipelineConfig']('openai'),
        },
      };
    }
  }

  /**
   * Process image using AWS pipeline
   */
  private async processImageWithAWS(
    jobId: string,
    request: EnhancedImageProcessRequest
  ): Promise<PipelineProcessingResult> {
    const startTime = Date.now();
    
    try {
      // Use existing AWS image job manager
      const createResult = await this.awsJobManager.createImageJob(request);
      if (!createResult.success) {
        throw new Error(`Image job creation failed: ${createResult.error?.message}`);
      }

      const awsJobId = createResult.data!.jobId;
      
      // Process with AWS pipeline
      const processResult = await this.awsJobManager.processImageJob(awsJobId);
      if (!processResult.success) {
        throw new Error(`AWS image processing failed: ${processResult.error?.message}`);
      }

      const result: PipelineProcessingResult = {
        pipeline: 'aws',
        jobId,
        status: 'completed',
        results: {
          aws: this.awsJobManager.getJob(awsJobId) as ImageProcessingJob,
        },
        metadata: {
          processingTime: Date.now() - startTime,
          pipelineConfig: this.pipelineSelector['getPipelineConfig']('aws'),
          costsEstimate: {
            awsServices: {
              bedrock: 0.05,
              polly: 0.02,
            },
          },
        },
      };

      return result;

    } catch (error) {
      logger.error('AWS image pipeline failed', { error, jobId });

      return {
        pipeline: 'aws',
        jobId,
        status: 'failed',
        error: {
          code: 'AWS_IMAGE_PIPELINE_FAILED',
          message: 'AWS image processing failed',
          details: error instanceof Error ? error.message : String(error),
        },
        metadata: {
          processingTime: Date.now() - startTime,
          pipelineConfig: this.pipelineSelector['getPipelineConfig']('aws'),
        },
      };
    }
  }

  /**
   * Update pipeline job status
   */
  private updatePipelineJobStatus(jobId: string, updates: Partial<JobStatus>): void {
    const job = this.pipelineJobs.get(jobId);
    if (!job) {
      logger.warn('Attempted to update non-existent pipeline job', { jobId });
      return;
    }

    job.status = {
      ...job.status,
      ...updates,
      updatedAt: new Date(),
    };

    logger.debug('Pipeline job status updated', { 
      jobId, 
      pipeline: job.pipeline,
      status: job.status 
    });
  }

  /**
   * Get pipeline job status
   */
  getPipelineJobStatus(jobId: string): JobStatus | null {
    const job = this.pipelineJobs.get(jobId);
    return job ? job.status : null;
  }

  /**
   * Get all pipeline jobs
   */
  getAllPipelineJobs(): Array<{
    jobId: string;
    pipeline: PipelineType;
    status: JobStatus;
  }> {
    return Array.from(this.pipelineJobs.entries()).map(([jobId, job]) => ({
      jobId,
      pipeline: job.pipeline,
      status: job.status,
    }));
  }

  /**
   * Validate OpenAI API availability
   */
  async validateOpenAIAvailability(): Promise<boolean> {
    try {
      const imageAvailable = await this.openaiImageAnalysis.validateAPIConnection();
      const videoAvailable = await this.openaiVideoAnalysis.validateAPIConnection();
      
      return imageAvailable && videoAvailable;
    } catch (error) {
      logger.error('OpenAI availability check failed', { error });
      return false;
    }
  }

  /**
   * Get pipeline statistics
   */
  getPipelineStatistics(): any {
    return this.pipelineSelector.getPipelineStatistics();
  }
}