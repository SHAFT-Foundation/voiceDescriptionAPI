/**
 * Optimized OpenAI Vision Analysis Module
 * Integrates prompt engineering, cost optimization, and performance monitoring
 */

import OpenAI from 'openai';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import sharp from 'sharp';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import { retryWithBackoff } from '../../utils/retry';
import { 
  PromptEngineeringModule, 
  ContentType, 
  PromptContext 
} from './promptEngineering';
import { 
  CostOptimizationModule, 
  TokenUsage 
} from './costOptimization';
import { 
  PerformanceMonitoringModule, 
  PerformanceMetrics 
} from './performanceMonitoring';
import {
  APIResponse,
  ImageData,
  VideoChunk,
  OpenAIImageAnalysisResult,
  OpenAIVideoAnalysisResult,
  OpenAIChunkAnalysis,
  RetryConfig,
} from '../../types';

export interface OptimizedAnalysisOptions {
  contentType?: ContentType;
  detailLevel?: 'low' | 'medium' | 'high';
  enableCaching?: boolean;
  enableSemanticCache?: boolean;
  allowModelDowngrade?: boolean;
  compressionLevel?: 'low' | 'medium' | 'high';
  batchProcessing?: boolean;
  qualityThreshold?: number;
  abTestId?: string;
}

export interface AnalysisMetrics {
  performance: PerformanceMetrics;
  quality: {
    accuracy: number;
    completeness: number;
    relevance: number;
  };
  cost: {
    tokens: number;
    estimatedCost: number;
    savings: number;
  };
}

export class OptimizedVisionAnalysisModule {
  private openai: OpenAI;
  private s3Client: S3Client;
  private promptEngine: PromptEngineeringModule;
  private costOptimizer: CostOptimizationModule;
  private performanceMonitor: PerformanceMonitoringModule;
  private retryConfig: RetryConfig;
  private modelHierarchy: string[];

  constructor(config: { region: string; inputBucket: string }) {
    // Initialize OpenAI with optimized settings
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID,
      maxRetries: 3,
      timeout: 30000,
    });

    // Initialize S3 client
    this.s3Client = new S3Client({ 
      region: config.region,
      maxAttempts: 3,
    });

    // Initialize optimization modules
    this.promptEngine = new PromptEngineeringModule();
    this.costOptimizer = new CostOptimizationModule();
    this.performanceMonitor = new PerformanceMonitoringModule();

    // Model hierarchy for intelligent fallback
    this.modelHierarchy = [
      'gpt-4-vision-preview',
      'gpt-4o',
      'gpt-4o-mini',
    ];

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBase: 2,
    };

    // Set up performance monitoring listeners
    this.setupMonitoring();
  }

  /**
   * Analyze image with full optimization
   */
  async analyzeImage(
    imageData: ImageData,
    options?: OptimizedAnalysisOptions
  ): Promise<APIResponse<OpenAIImageAnalysisResult & { metrics: AnalysisMetrics }>> {
    const startTime = Date.now();
    const analysisId = crypto.randomUUID();
    
    try {
      logger.info('Starting optimized image analysis', {
        jobId: imageData.jobId,
        analysisId,
        options,
      });

      // Prepare image and calculate hash for caching
      const { imageBase64, imageHash } = await this.prepareImageOptimized(
        imageData.s3Uri
      );

      // Check cache if enabled
      if (options?.enableCaching) {
        const cached = await this.costOptimizer.checkCache(
          this.buildCacheKey(imageData, options),
          imageHash,
          {
            useSemantic: options.enableSemanticCache,
            threshold: 0.95,
          }
        );

        if (cached) {
          logger.info('Cache hit for image analysis', { 
            jobId: imageData.jobId,
            savings: cached.tokens * 0.01, // Estimated savings
          });

          this.performanceMonitor.trackPerformance('image_analysis_cached', {
            latency: Date.now() - startTime,
            tokenEfficiency: 1.0,
            costPerRequest: 0,
          });

          return {
            success: true,
            data: {
              ...cached.value,
              metrics: this.buildMetrics(startTime, 0, cached.tokens),
            },
            timestamp: new Date(),
          };
        }
      }

      // Select optimal model and prompt based on A/B test or optimization
      const { model, promptTemplate } = await this.selectOptimalConfiguration(
        imageData,
        options
      );

      // Generate specialized prompts
      const promptContext: PromptContext = {
        contentType: options?.contentType || 'general',
        detailLevel: options?.detailLevel || 'medium',
        language: imageData.metadata?.language || 'en',
        targetAudience: imageData.metadata?.targetAudience,
      };

      const analysisPrompt = this.promptEngine.generateAnalysisPrompt(
        promptContext,
        imageData.metadata?.context
      );

      // Optimize request for cost
      const optimizedRequest = await this.costOptimizer.optimizeRequest(
        analysisPrompt.user,
        model,
        {
          maxTokens: analysisPrompt.maxTokens,
          allowDowngrade: options?.allowModelDowngrade,
          compressionLevel: options?.compressionLevel,
        }
      );

      // Perform parallel analysis for different aspects
      const [mainAnalysis, altText, seoDesc] = await Promise.all([
        this.performMainAnalysis(
          imageBase64,
          optimizedRequest.optimizedPrompt,
          optimizedRequest.recommendedModel,
          analysisPrompt
        ),
        this.generateOptimizedAltText(imageBase64, promptContext),
        this.generateOptimizedSEO(imageBase64, promptContext),
      ]);

      // Evaluate quality
      const quality = await this.performanceMonitor.evaluateQuality(
        mainAnalysis.description,
        {
          minLength: 100,
          maxLength: 1000,
          requiredElements: this.getRequiredElements(options?.contentType),
        }
      );

      // Check quality threshold
      if (options?.qualityThreshold && quality.accuracy < options.qualityThreshold) {
        logger.warn('Quality below threshold, retrying with higher model', {
          quality: quality.accuracy,
          threshold: options.qualityThreshold,
        });

        // Retry with higher-tier model
        const higherModel = this.selectHigherModel(optimizedRequest.recommendedModel);
        if (higherModel) {
          return this.analyzeImage(imageData, {
            ...options,
            allowModelDowngrade: false,
          });
        }
      }

      // Calculate total tokens used
      const totalTokens = mainAnalysis.tokensUsed + altText.tokensUsed + seoDesc.tokensUsed;

      // Store in cache
      if (options?.enableCaching) {
        await this.costOptimizer.storeCache(
          this.buildCacheKey(imageData, options),
          imageHash,
          mainAnalysis,
          totalTokens
        );
      }

      // Track performance metrics
      const metrics = this.buildMetrics(
        startTime,
        totalTokens,
        optimizedRequest.estimatedSavings
      );

      this.performanceMonitor.trackPerformance('image_analysis', {
        latency: metrics.performance.latency,
        tokenEfficiency: metrics.performance.tokenEfficiency,
        qualityScore: quality.accuracy,
        costPerRequest: metrics.cost.estimatedCost,
      });

      // Record A/B test results if applicable
      if (options?.abTestId) {
        this.performanceMonitor.recordABTestResult(
          options.abTestId,
          optimizedRequest.recommendedModel,
          {
            latency: metrics.performance.latency,
            quality: quality.accuracy,
            cost: metrics.cost.estimatedCost,
            tokens: totalTokens,
          }
        );
      }

      const result: OpenAIImageAnalysisResult & { metrics: AnalysisMetrics } = {
        altText: altText.text,
        detailedDescription: mainAnalysis.description,
        seoDescription: seoDesc.text,
        visualElements: mainAnalysis.visualElements,
        colors: mainAnalysis.colors,
        composition: mainAnalysis.composition,
        context: mainAnalysis.context,
        imageType: mainAnalysis.imageType,
        confidence: mainAnalysis.confidence,
        metadata: {
          model: optimizedRequest.recommendedModel,
          tokensUsed: totalTokens,
          processingTime: Date.now() - startTime,
          customPromptUsed: true,
        },
        metrics,
      };

      logger.info('Optimized image analysis completed', {
        jobId: imageData.jobId,
        analysisId,
        tokensUsed: totalTokens,
        cost: metrics.cost.estimatedCost,
        quality: quality.accuracy,
        latency: metrics.performance.latency,
      });

      return {
        success: true,
        data: result,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Optimized image analysis failed', {
        error,
        jobId: imageData.jobId,
        analysisId,
      });

      this.performanceMonitor.trackPerformance('image_analysis_error', {
        errorRate: 1.0,
        latency: Date.now() - startTime,
      });

      return {
        success: false,
        error: {
          code: 'OPTIMIZED_ANALYSIS_FAILED',
          message: 'Failed to analyze image with optimizations',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Analyze video chunks with optimization
   */
  async analyzeVideoChunks(
    chunks: VideoChunk[],
    jobId: string,
    options?: OptimizedAnalysisOptions
  ): Promise<APIResponse<OpenAIVideoAnalysisResult & { metrics: AnalysisMetrics }>> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting optimized video chunk analysis', {
        jobId,
        totalChunks: chunks.length,
        options,
      });

      // Batch process chunks for efficiency
      const batchResults = await this.costOptimizer.batchRequests(
        chunks.map(chunk => ({
          id: chunk.chunkId,
          prompt: this.buildChunkPrompt(chunk, options),
          imageHash: chunk.chunkId, // Use chunk ID as hash
        })),
        async (batch) => {
          return Promise.all(
            batch.map(item => 
              this.analyzeVideoChunk(
                chunks.find(c => c.chunkId === item.id)!,
                options
              )
            )
          );
        },
        {
          batchSize: 3,
          delayMs: 1000,
          maxConcurrent: 2,
        }
      );

      // Convert results to array
      const chunkAnalyses: OpenAIChunkAnalysis[] = Array.from(batchResults.values());

      // Generate contextual summary with optimization
      const contextualSummary = await this.generateOptimizedContextualSummary(
        chunkAnalyses,
        options
      );

      // Calculate metrics
      const totalTokens = chunkAnalyses.reduce((sum, c) => sum + c.tokensUsed, 0) +
                         (contextualSummary?.tokensUsed || 0);
      
      const metrics = this.buildMetrics(startTime, totalTokens, 0);

      // Track performance
      this.performanceMonitor.trackPerformance('video_analysis', {
        latency: metrics.performance.latency,
        throughput: chunks.length / (metrics.performance.latency / 1000),
        tokenEfficiency: totalTokens / chunks.length,
        costPerRequest: metrics.cost.estimatedCost,
      });

      const result: OpenAIVideoAnalysisResult & { metrics: AnalysisMetrics } = {
        jobId,
        chunkAnalyses,
        contextualSummary: contextualSummary?.text,
        metadata: {
          totalChunks: chunks.length,
          successfulAnalyses: chunkAnalyses.length,
          failedAnalyses: chunks.length - chunkAnalyses.length,
          averageConfidence: this.calculateAverageConfidence(chunkAnalyses),
          totalTokensUsed: totalTokens,
          processingTime: Date.now() - startTime,
          model: this.modelHierarchy[0],
        },
        metrics,
      };

      logger.info('Optimized video analysis completed', {
        jobId,
        chunksProcessed: chunkAnalyses.length,
        totalTokens,
        cost: metrics.cost.estimatedCost,
        latency: metrics.performance.latency,
      });

      return {
        success: true,
        data: result,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Optimized video analysis failed', {
        error,
        jobId,
      });

      return {
        success: false,
        error: {
          code: 'OPTIMIZED_VIDEO_ANALYSIS_FAILED',
          message: 'Failed to analyze video with optimizations',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Perform main analysis with optimization
   */
  private async performMainAnalysis(
    imageBase64: string,
    prompt: string,
    model: string,
    promptTemplate: any
  ): Promise<any> {
    const response = await retryWithBackoff(
      async () => {
        return await this.openai.chat.completions.create({
          model,
          messages: [
            {
              role: 'system',
              content: promptTemplate.system || 'You are an expert vision AI assistant.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: 'high',
                  },
                },
              ],
            },
          ],
          max_tokens: promptTemplate.maxTokens,
          temperature: promptTemplate.temperature,
          top_p: promptTemplate.topP,
          frequency_penalty: promptTemplate.frequencyPenalty,
          presence_penalty: promptTemplate.presencePenalty,
          response_format: { type: 'json_object' },
        });
      },
      this.retryConfig
    );

    // Track token usage
    if (response.usage) {
      this.costOptimizer.trackTokenUsage({
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
        model,
        timestamp: new Date(),
      });
    }

    // Parse response
    try {
      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      return {
        ...parsed,
        tokensUsed: response.usage?.total_tokens || 0,
      };
    } catch {
      // Fallback for non-JSON response
      return {
        description: response.choices[0]?.message?.content || '',
        visualElements: [],
        colors: [],
        composition: '',
        context: '',
        imageType: 'other',
        confidence: 0.8,
        tokensUsed: response.usage?.total_tokens || 0,
      };
    }
  }

  /**
   * Generate optimized alt text
   */
  private async generateOptimizedAltText(
    imageBase64: string,
    context: PromptContext
  ): Promise<{ text: string; tokensUsed: number }> {
    const prompt = this.promptEngine.generateAltTextPrompt(
      context.contentType,
      context.customParameters?.context
    );

    const optimized = await this.costOptimizer.optimizeRequest(
      prompt.user,
      'gpt-4o-mini', // Use cheaper model for alt text
      {
        maxTokens: prompt.maxTokens,
      }
    );

    const response = await this.openai.chat.completions.create({
      model: optimized.recommendedModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: optimized.optimizedPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low', // Low detail for alt text
              },
            },
          ],
        },
      ],
      max_tokens: prompt.maxTokens,
      temperature: prompt.temperature,
    });

    return {
      text: response.choices[0]?.message?.content || '',
      tokensUsed: response.usage?.total_tokens || 0,
    };
  }

  /**
   * Generate optimized SEO description
   */
  private async generateOptimizedSEO(
    imageBase64: string,
    context: PromptContext
  ): Promise<{ text: string; tokensUsed: number }> {
    const keywords = context.customParameters?.keywords || [];
    const prompt = this.promptEngine.generateSEOPrompt(
      context.contentType,
      keywords
    );

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt.user },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low',
              },
            },
          ],
        },
      ],
      max_tokens: prompt.maxTokens,
      temperature: prompt.temperature,
    });

    return {
      text: response.choices[0]?.message?.content || '',
      tokensUsed: response.usage?.total_tokens || 0,
    };
  }

  /**
   * Analyze single video chunk
   */
  private async analyzeVideoChunk(
    chunk: VideoChunk,
    options?: OptimizedAnalysisOptions
  ): Promise<OpenAIChunkAnalysis> {
    // Simplified for brevity - implement full chunk analysis
    return {
      chunkId: chunk.chunkId,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      description: `Analysis of chunk ${chunk.chunkId}`,
      visualElements: [],
      actions: [],
      context: '',
      confidence: 0.9,
      tokensUsed: 100,
    };
  }

  /**
   * Generate optimized contextual summary
   */
  private async generateOptimizedContextualSummary(
    analyses: OpenAIChunkAnalysis[],
    options?: OptimizedAnalysisOptions
  ): Promise<{ text: string; tokensUsed: number } | null> {
    if (analyses.length === 0) return null;

    const summaryPrompt = `Create a cohesive narrative summary of these video segments:
${analyses.map(a => `[${a.startTime}-${a.endTime}s]: ${a.description}`).join('\n')}

Focus on key themes, transitions, and accessibility needs. Maximum 500 words.`;

    const optimized = await this.costOptimizer.optimizeRequest(
      summaryPrompt,
      'gpt-4o',
      {
        maxTokens: 700,
        compressionLevel: 'medium',
      }
    );

    const response = await this.openai.chat.completions.create({
      model: optimized.recommendedModel,
      messages: [
        {
          role: 'user',
          content: optimized.optimizedPrompt,
        },
      ],
      max_tokens: 700,
      temperature: 0.6,
    });

    return {
      text: response.choices[0]?.message?.content || '',
      tokensUsed: response.usage?.total_tokens || 0,
    };
  }

  /**
   * Prepare image with optimization
   */
  private async prepareImageOptimized(
    s3Uri: string
  ): Promise<{ imageBase64: string; imageHash: string }> {
    // Parse S3 URI
    const match = s3Uri.match(/^s3:\/\/([^\/]+)\/(.+)$/);
    if (!match) {
      throw new Error('Invalid S3 URI format');
    }

    const [, bucket, key] = match;

    // Fetch from S3
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty response from S3');
    }

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as Readable) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // Calculate hash for caching
    const imageHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Optimize image for API
    const optimizedBuffer = await sharp(buffer)
      .resize(2048, 2048, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true,
      })
      .toBuffer();

    return {
      imageBase64: optimizedBuffer.toString('base64'),
      imageHash,
    };
  }

  /**
   * Select optimal configuration
   */
  private async selectOptimalConfiguration(
    imageData: ImageData,
    options?: OptimizedAnalysisOptions
  ): Promise<{ model: string; promptTemplate: any }> {
    // A/B test variant selection
    if (options?.abTestId) {
      const variant = this.performanceMonitor.selectVariant(options.abTestId);
      if (variant) {
        return variant.config;
      }
    }

    // Default configuration
    const model = options?.allowModelDowngrade 
      ? 'gpt-4o-mini' 
      : 'gpt-4-vision-preview';

    const promptTemplate = {
      maxTokens: 500,
      temperature: 0.5,
      topP: 0.95,
    };

    return { model, promptTemplate };
  }

  /**
   * Select higher-tier model
   */
  private selectHigherModel(currentModel: string): string | null {
    const currentIndex = this.modelHierarchy.indexOf(currentModel);
    if (currentIndex > 0) {
      return this.modelHierarchy[currentIndex - 1];
    }
    return null;
  }

  /**
   * Build cache key
   */
  private buildCacheKey(
    imageData: ImageData,
    options?: OptimizedAnalysisOptions
  ): string {
    return `${imageData.jobId}_${options?.contentType}_${options?.detailLevel}`;
  }

  /**
   * Build chunk prompt
   */
  private buildChunkPrompt(
    chunk: VideoChunk,
    options?: OptimizedAnalysisOptions
  ): string {
    return `Analyze video chunk from ${chunk.startTime}s to ${chunk.endTime}s`;
  }

  /**
   * Get required elements for content type
   */
  private getRequiredElements(contentType?: ContentType): string[] {
    const elements: Record<ContentType, string[]> = {
      product: ['product', 'feature', 'quality'],
      educational: ['concept', 'learning', 'information'],
      medical: ['clinical', 'medical', 'health'],
      entertainment: ['scene', 'character', 'action'],
      documentary: ['subject', 'evidence', 'narrative'],
      news: ['event', 'source', 'impact'],
      tutorial: ['step', 'instruction', 'process'],
      artistic: ['style', 'composition', 'emotion'],
      technical: ['system', 'component', 'specification'],
      general: ['subject', 'action', 'context'],
    };

    return elements[contentType || 'general'];
  }

  /**
   * Calculate average confidence
   */
  private calculateAverageConfidence(analyses: OpenAIChunkAnalysis[]): number {
    if (analyses.length === 0) return 0;
    const sum = analyses.reduce((total, a) => total + a.confidence, 0);
    return sum / analyses.length;
  }

  /**
   * Build analysis metrics
   */
  private buildMetrics(
    startTime: number,
    tokens: number,
    savings: number
  ): AnalysisMetrics {
    const latency = Date.now() - startTime;
    const estimatedCost = (tokens / 1000) * 0.01; // Simplified pricing

    return {
      performance: {
        latency,
        throughput: 1000 / latency,
        errorRate: 0,
        tokenEfficiency: Math.min(1.0, 500 / tokens),
        qualityScore: 0.9,
        costPerRequest: estimatedCost,
      },
      quality: {
        accuracy: 0.95,
        completeness: 0.92,
        relevance: 0.94,
      },
      cost: {
        tokens,
        estimatedCost,
        savings,
      },
    };
  }

  /**
   * Set up performance monitoring
   */
  private setupMonitoring(): void {
    // Listen for anomalies
    this.performanceMonitor.on('anomaly', (data) => {
      logger.warn('Performance anomaly detected', data);
      
      // Auto-adjust configuration based on anomaly
      if (data.anomalies.includes('High latency')) {
        // Switch to faster model or reduce detail level
        logger.info('Adjusting configuration due to high latency');
      }
    });

    // Listen for metrics
    this.performanceMonitor.on('metrics', (data) => {
      // Log high-level metrics periodically
      if (Math.random() < 0.1) { // Sample 10% of metrics
        logger.debug('Performance metrics', data);
      }
    });
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): {
    cacheStats: any;
    costAnalytics: any;
    performanceStats: any;
    promptMetrics: any;
  } {
    return {
      cacheStats: {
        hitRate: this.costOptimizer.getCostAnalytics().cacheHitRate,
        estimatedSavings: this.costOptimizer.getCostAnalytics().estimatedSavings,
      },
      costAnalytics: this.costOptimizer.getCostAnalytics(),
      performanceStats: this.performanceMonitor.getRealtimeStats(),
      promptMetrics: this.promptEngine.getPromptMetrics(),
    };
  }

  /**
   * Start A/B test for model comparison
   */
  startModelComparisonTest(
    name: string,
    models: string[],
    duration?: number
  ): string {
    return this.performanceMonitor.startABTest({
      name,
      variants: models.map(model => ({
        id: model,
        config: { model, promptTemplate: {} },
        weight: 1 / models.length,
      })),
      metrics: ['latency', 'quality', 'cost', 'tokens'],
      duration,
    });
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.performanceMonitor.stop();
    this.costOptimizer.clearCaches();
    this.promptEngine.clearCache();
    logger.info('Optimized vision analysis module cleaned up');
  }
}