import OpenAI from 'openai';
import { 
  APIResponse,
  VideoChunk,
  OpenAIVideoAnalysisResult,
  OpenAIChunkAnalysis,
  RetryConfig
} from '../types';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import * as path from 'path';

export class OpenAIVideoAnalysisModule {
  private openai: OpenAI;
  private s3Client: S3Client;
  private retryConfig: RetryConfig;
  private modelId: string;
  private concurrentAnalyses: number;

  constructor(config: { region: string }) {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID,
    });

    // Initialize S3 client
    this.s3Client = new S3Client({ region: config.region });

    // Configuration
    this.modelId = process.env.OPENAI_VISION_MODEL || 'gpt-4-vision-preview';
    this.concurrentAnalyses = parseInt(process.env.OPENAI_CONCURRENT_ANALYSES || '3');

    // Retry configuration
    this.retryConfig = {
      maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3'),
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBase: 2,
    };
  }

  /**
   * Analyze video chunks using OpenAI Vision API
   */
  async analyzeVideoChunks(
    chunks: VideoChunk[],
    jobId: string,
    options?: {
      contextualAnalysis?: boolean;
      detailLevel?: 'low' | 'high' | 'auto';
      customPrompt?: string;
    }
  ): Promise<APIResponse<OpenAIVideoAnalysisResult>> {
    try {
      logger.info('Starting OpenAI video chunk analysis', {
        jobId,
        totalChunks: chunks.length,
        options
      });

      // Process chunks with controlled concurrency
      const chunkAnalyses = await this.processChunksWithConcurrency(
        chunks,
        jobId,
        options
      );

      // Perform contextual analysis if requested
      let contextualSummary: string | undefined;
      if (options?.contextualAnalysis) {
        contextualSummary = await this.generateContextualSummary(
          chunkAnalyses,
          jobId
        );
      }

      // Calculate overall statistics
      const statistics = this.calculateStatistics(chunkAnalyses);

      const result: OpenAIVideoAnalysisResult = {
        jobId,
        chunkAnalyses,
        contextualSummary,
        metadata: {
          totalChunks: chunks.length,
          successfulAnalyses: chunkAnalyses.length,
          failedAnalyses: chunks.length - chunkAnalyses.length,
          averageConfidence: statistics.averageConfidence,
          totalTokensUsed: statistics.totalTokens,
          processingTime: Date.now(),
          model: this.modelId,
        },
      };

      logger.info('OpenAI video analysis completed', {
        jobId,
        successfulAnalyses: result.metadata.successfulAnalyses,
        totalTokens: result.metadata.totalTokensUsed,
      });

      return {
        success: true,
        data: result,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('OpenAI video analysis failed', { 
        error, 
        jobId 
      });

      return {
        success: false,
        error: {
          code: 'OPENAI_VIDEO_ANALYSIS_FAILED',
          message: 'Failed to analyze video chunks with OpenAI',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Analyze a single video frame or short clip
   */
  async analyzeFrame(
    frameData: string | Buffer,
    timestamp: number,
    options?: {
      detailLevel?: 'low' | 'high' | 'auto';
      customPrompt?: string;
    }
  ): Promise<APIResponse<OpenAIChunkAnalysis>> {
    try {
      const base64Data = typeof frameData === 'string' 
        ? frameData 
        : frameData.toString('base64');

      const prompt = options?.customPrompt || 
        `Analyze this video frame and provide:
         1. A detailed description of what's happening
         2. Key visual elements and their positions
         3. Any text or important information visible
         4. The mood or atmosphere
         5. Notable actions or movements
         
         Context: This is frame at ${timestamp} seconds in the video.`;

      const response = await retryWithBackoff(
        async () => {
          return await this.openai.chat.completions.create({
            model: this.modelId,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { 
                    type: 'image_url', 
                    image_url: { 
                      url: `data:image/jpeg;base64,${base64Data}`,
                      detail: options?.detailLevel || 'high'
                    } 
                  },
                ],
              },
            ],
            max_tokens: 500,
            temperature: 0.5,
          });
        },
        this.retryConfig
      );

      const description = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || 0;

      // Extract structured information from the description
      const analysis = this.parseFrameAnalysis(description, timestamp);

      const result: OpenAIChunkAnalysis = {
        chunkId: `frame_${timestamp}`,
        startTime: timestamp,
        endTime: timestamp,
        description,
        visualElements: analysis.visualElements,
        actions: analysis.actions,
        context: analysis.context,
        confidence: analysis.confidence,
        tokensUsed,
      };

      return {
        success: true,
        data: result,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Frame analysis failed', { error, timestamp });

      return {
        success: false,
        error: {
          code: 'FRAME_ANALYSIS_FAILED',
          message: 'Failed to analyze video frame',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Process chunks with controlled concurrency
   */
  private async processChunksWithConcurrency(
    chunks: VideoChunk[],
    jobId: string,
    options?: any
  ): Promise<OpenAIChunkAnalysis[]> {
    const results: OpenAIChunkAnalysis[] = [];
    
    // Process in batches to control concurrency
    for (let i = 0; i < chunks.length; i += this.concurrentAnalyses) {
      const batch = chunks.slice(i, i + this.concurrentAnalyses);
      
      logger.debug('Processing chunk batch', {
        batchStart: i,
        batchSize: batch.length,
        totalChunks: chunks.length,
      });

      const batchPromises = batch.map(chunk => 
        this.analyzeChunk(chunk, jobId, options)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.success) {
          results.push(result.value.data!);
        } else {
          logger.warn('Chunk analysis failed', {
            reason: result.status === 'rejected' ? result.reason : result.value.error,
          });
        }
      }

      // Rate limiting delay between batches
      if (i + this.concurrentAnalyses < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Analyze a single video chunk
   */
  private async analyzeChunk(
    chunk: VideoChunk,
    jobId: string,
    options?: any
  ): Promise<APIResponse<OpenAIChunkAnalysis>> {
    try {
      logger.debug('Analyzing chunk', {
        chunkId: chunk.chunkId,
        index: chunk.index,
        duration: chunk.duration,
      });

      // Extract key frames from chunk
      const keyFrames = await this.extractKeyFrames(chunk.s3Uri, chunk.chunkId);
      
      // Analyze each key frame
      const frameAnalyses = await Promise.all(
        keyFrames.map(frame => 
          this.analyzeKeyFrame(frame, chunk, options)
        )
      );

      // Combine frame analyses into chunk analysis
      const combinedAnalysis = this.combineFrameAnalyses(
        frameAnalyses,
        chunk
      );

      return {
        success: true,
        data: combinedAnalysis,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Chunk analysis failed', { 
        error, 
        chunkId: chunk.chunkId 
      });

      return {
        success: false,
        error: {
          code: 'CHUNK_ANALYSIS_FAILED',
          message: `Failed to analyze chunk ${chunk.chunkId}`,
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Extract key frames from video chunk
   */
  private async extractKeyFrames(
    s3Uri: string,
    chunkId: string
  ): Promise<Array<{ timestamp: number; data: string }>> {
    try {
      // For now, extract frames at regular intervals
      // In production, could use scene detection or motion analysis
      const frames: Array<{ timestamp: number; data: string }> = [];
      
      // Download chunk from S3
      const videoBuffer = await this.downloadFromS3(s3Uri);
      
      // Extract frames using FFmpeg (simplified for example)
      // In production, would use proper frame extraction
      const frameCount = 3; // Extract 3 key frames per chunk
      
      for (let i = 0; i < frameCount; i++) {
        const timestamp = i * 10; // Every 10 seconds
        
        // Here you would use FFmpeg to extract the actual frame
        // For now, using placeholder
        frames.push({
          timestamp,
          data: videoBuffer.toString('base64').substring(0, 1000), // Placeholder
        });
      }

      return frames;

    } catch (error) {
      logger.error('Failed to extract key frames', { error, chunkId });
      return [];
    }
  }

  /**
   * Analyze a key frame
   */
  private async analyzeKeyFrame(
    frame: { timestamp: number; data: string },
    chunk: VideoChunk,
    options?: any
  ): Promise<any> {
    const prompt = options?.customPrompt || 
      `Analyze this video frame from timestamp ${chunk.startTime + frame.timestamp} seconds.
       Describe what you see, including:
       - Main subjects and their actions
       - Setting and environment
       - Any text or important visual information
       - The overall mood or tone
       
       Be concise but thorough.`;

    const response = await retryWithBackoff(
      async () => {
        return await this.openai.chat.completions.create({
          model: this.modelId,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { 
                  type: 'image_url', 
                  image_url: { 
                    url: `data:image/jpeg;base64,${frame.data}`,
                    detail: options?.detailLevel || 'high'
                  } 
                },
              ],
            },
          ],
          max_tokens: 300,
          temperature: 0.5,
        });
      },
      this.retryConfig
    );

    return {
      timestamp: chunk.startTime + frame.timestamp,
      description: response.choices[0]?.message?.content || '',
      tokensUsed: response.usage?.total_tokens || 0,
    };
  }

  /**
   * Combine frame analyses into chunk analysis
   */
  private combineFrameAnalyses(
    frameAnalyses: any[],
    chunk: VideoChunk
  ): OpenAIChunkAnalysis {
    // Combine descriptions
    const combinedDescription = frameAnalyses
      .map(f => f.description)
      .join(' ');

    // Extract elements from combined description
    const analysis = this.parseFrameAnalysis(
      combinedDescription,
      chunk.startTime
    );

    // Sum tokens
    const totalTokens = frameAnalyses.reduce(
      (sum, f) => sum + (f.tokensUsed || 0),
      0
    );

    return {
      chunkId: chunk.chunkId,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
      description: combinedDescription,
      visualElements: analysis.visualElements,
      actions: analysis.actions,
      context: analysis.context,
      confidence: analysis.confidence,
      tokensUsed: totalTokens,
    };
  }

  /**
   * Parse frame analysis to extract structured information
   */
  private parseFrameAnalysis(
    description: string,
    timestamp: number
  ): {
    visualElements: string[];
    actions: string[];
    context: string;
    confidence: number;
  } {
    // Simple extraction logic - in production would use NLP
    const visualElements: string[] = [];
    const actions: string[] = [];
    
    // Extract visual elements (words after "see", "shows", "displays")
    const visualRegex = /(?:see|shows|displays|contains|features)\s+([^,.]+)/gi;
    let match;
    while ((match = visualRegex.exec(description)) !== null) {
      visualElements.push(match[1].trim());
    }

    // Extract actions (verbs in -ing form)
    const actionRegex = /\b(\w+ing)\b/gi;
    while ((match = actionRegex.exec(description)) !== null) {
      if (!['showing', 'displaying', 'containing'].includes(match[1].toLowerCase())) {
        actions.push(match[1]);
      }
    }

    // Context is the first sentence
    const context = description.split('.')[0] || description;

    // Calculate confidence based on description length and detail
    const confidence = Math.min(0.95, 0.7 + (description.length / 1000) * 0.25);

    return {
      visualElements: [...new Set(visualElements)], // Remove duplicates
      actions: [...new Set(actions)],
      context,
      confidence,
    };
  }

  /**
   * Generate contextual summary of all chunks
   */
  private async generateContextualSummary(
    chunkAnalyses: OpenAIChunkAnalysis[],
    jobId: string
  ): Promise<string> {
    try {
      // Combine all chunk descriptions
      const allDescriptions = chunkAnalyses
        .map(c => `[${c.startTime}-${c.endTime}s]: ${c.description}`)
        .join('\n\n');

      const prompt = `Based on these video segment descriptions, provide a comprehensive summary of the entire video:

${allDescriptions}

Create a cohesive narrative that:
1. Describes the overall content and story
2. Highlights key moments and transitions
3. Identifies recurring themes or subjects
4. Provides context for accessibility purposes

Keep the summary under 500 words.`;

      const response = await retryWithBackoff(
        async () => {
          return await this.openai.chat.completions.create({
            model: this.modelId,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: 700,
            temperature: 0.6,
          });
        },
        this.retryConfig
      );

      return response.choices[0]?.message?.content || '';

    } catch (error) {
      logger.error('Failed to generate contextual summary', { error, jobId });
      return 'Summary generation failed';
    }
  }

  /**
   * Calculate statistics from chunk analyses
   */
  private calculateStatistics(
    chunkAnalyses: OpenAIChunkAnalysis[]
  ): {
    averageConfidence: number;
    totalTokens: number;
  } {
    const totalConfidence = chunkAnalyses.reduce(
      (sum, c) => sum + c.confidence,
      0
    );

    const totalTokens = chunkAnalyses.reduce(
      (sum, c) => sum + c.tokensUsed,
      0
    );

    return {
      averageConfidence: chunkAnalyses.length > 0 
        ? totalConfidence / chunkAnalyses.length 
        : 0,
      totalTokens,
    };
  }

  /**
   * Download content from S3
   */
  private async downloadFromS3(s3Uri: string): Promise<Buffer> {
    const match = s3Uri.match(/^s3:\/\/([^\/]+)\/(.+)$/);
    if (!match) {
      throw new Error('Invalid S3 URI format');
    }

    const [, bucket, key] = match;

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

    return Buffer.concat(chunks);
  }

  /**
   * Validate OpenAI API availability
   */
  async validateAPIConnection(): Promise<boolean> {
    try {
      const response = await this.openai.models.list();
      return response.data.some(model => 
        model.id.includes('gpt-4') || model.id.includes('vision')
      );
    } catch (error) {
      logger.error('Failed to validate OpenAI API connection', { error });
      return false;
    }
  }
}