import OpenAI from 'openai';
import { 
  APIResponse, 
  ImageData, 
  ImageAnalysis,
  RetryConfig,
  OpenAIImageAnalysisOptions,
  OpenAIImageAnalysisResult
} from '../types';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import sharp from 'sharp';

export class OpenAIImageAnalysisModule {
  private openai: OpenAI;
  private s3Client: S3Client;
  private retryConfig: RetryConfig;
  private maxImageSize: number;
  private modelId: string;

  constructor(config: { region: string; inputBucket: string }) {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID,
    });

    // Initialize S3 client for fetching images
    this.s3Client = new S3Client({ region: config.region });

    // Configuration
    this.maxImageSize = parseInt(process.env.OPENAI_MAX_IMAGE_SIZE_MB || '20') * 1024 * 1024;
    this.modelId = process.env.OPENAI_VISION_MODEL || 'gpt-4-vision-preview';

    // Retry configuration
    this.retryConfig = {
      maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3'),
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBase: 2,
    };
  }

  /**
   * Analyze image using OpenAI Vision API
   */
  async analyzeImage(
    imageData: ImageData,
    options?: OpenAIImageAnalysisOptions
  ): Promise<APIResponse<OpenAIImageAnalysisResult>> {
    try {
      logger.info('Starting OpenAI image analysis', { 
        jobId: imageData.jobId,
        s3Uri: imageData.s3Uri,
        options 
      });

      // Fetch and prepare image
      const imageBase64 = await this.prepareImage(imageData.s3Uri);
      
      // Generate multiple description formats in parallel
      const [altText, detailed, seo] = await Promise.all([
        this.generateAltText(imageBase64, imageData.metadata, options),
        this.generateDetailedDescription(imageBase64, imageData.metadata, options),
        this.generateSEODescription(imageBase64, imageData.metadata, options),
      ]);

      // Extract visual elements and metadata
      const analysis = await this.performComprehensiveAnalysis(
        imageBase64,
        imageData.metadata,
        options
      );

      const result: OpenAIImageAnalysisResult = {
        altText: altText.text,
        detailedDescription: detailed.text,
        seoDescription: seo.text,
        visualElements: analysis.visualElements,
        colors: analysis.colors,
        composition: analysis.composition,
        context: analysis.context,
        imageType: analysis.imageType,
        confidence: analysis.confidence,
        metadata: {
          model: this.modelId,
          tokensUsed: altText.tokensUsed + detailed.tokensUsed + seo.tokensUsed,
          processingTime: Date.now(),
          customPromptUsed: !!options?.customPrompt,
        },
      };

      logger.info('OpenAI image analysis completed', {
        jobId: imageData.jobId,
        imageType: result.imageType,
        tokensUsed: result.metadata.tokensUsed,
      });

      return {
        success: true,
        data: result,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('OpenAI image analysis failed', { 
        error, 
        jobId: imageData.jobId 
      });

      return {
        success: false,
        error: {
          code: 'OPENAI_IMAGE_ANALYSIS_FAILED',
          message: 'Failed to analyze image with OpenAI',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Analyze multiple images in batch
   */
  async analyzeBatch(
    images: ImageData[],
    options?: OpenAIImageAnalysisOptions
  ): Promise<APIResponse<OpenAIImageAnalysisResult[]>> {
    try {
      logger.info('Starting batch OpenAI image analysis', { 
        imageCount: images.length,
        options 
      });

      // Process images with concurrency control
      const batchSize = parseInt(process.env.OPENAI_BATCH_SIZE || '3');
      const results: OpenAIImageAnalysisResult[] = [];
      
      for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        
        const batchResults = await Promise.all(
          batch.map(image => this.analyzeImage(image, options))
        );

        for (const result of batchResults) {
          if (result.success && result.data) {
            results.push(result.data);
          } else {
            logger.warn('Failed to analyze image in batch', { 
              error: result.error 
            });
          }
        }

        // Rate limiting delay between batches
        if (i + batchSize < images.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info('Batch OpenAI image analysis completed', {
        totalImages: images.length,
        successfulAnalyses: results.length,
      });

      return {
        success: true,
        data: results,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Batch OpenAI image analysis failed', { error });

      return {
        success: false,
        error: {
          code: 'OPENAI_BATCH_ANALYSIS_FAILED',
          message: 'Failed to analyze images in batch',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Generate alt text for accessibility
   */
  private async generateAltText(
    imageBase64: string,
    metadata?: any,
    options?: OpenAIImageAnalysisOptions
  ): Promise<{ text: string; tokensUsed: number }> {
    const prompt = options?.customPrompt?.altText || 
      `Generate a concise, descriptive alt text for this image that captures its essential content for screen readers. 
       Maximum 125 characters. Focus on the main subject and action.
       ${metadata?.context ? `Context: ${metadata.context}` : ''}`;

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
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: options?.detail || 'auto'
                  } 
                },
              ],
            },
          ],
          max_tokens: 100,
          temperature: 0.3,
        });
      },
      this.retryConfig
    );

    return {
      text: response.choices[0]?.message?.content || '',
      tokensUsed: response.usage?.total_tokens || 0,
    };
  }

  /**
   * Generate detailed description for comprehensive understanding
   */
  private async generateDetailedDescription(
    imageBase64: string,
    metadata?: any,
    options?: OpenAIImageAnalysisOptions
  ): Promise<{ text: string; tokensUsed: number }> {
    const prompt = options?.customPrompt?.detailed || 
      `Provide a comprehensive description of this image including:
       1. Main subjects and their positions
       2. Actions or activities depicted
       3. Background and setting
       4. Notable visual elements, colors, and composition
       5. Mood or atmosphere
       6. Any text visible in the image
       
       Be thorough but organized. Use clear, descriptive language.
       ${metadata?.context ? `Additional context: ${metadata.context}` : ''}`;

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
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: options?.detail || 'high'
                  } 
                },
              ],
            },
          ],
          max_tokens: 800,
          temperature: 0.5,
        });
      },
      this.retryConfig
    );

    return {
      text: response.choices[0]?.message?.content || '',
      tokensUsed: response.usage?.total_tokens || 0,
    };
  }

  /**
   * Generate SEO-optimized description
   */
  private async generateSEODescription(
    imageBase64: string,
    metadata?: any,
    options?: OpenAIImageAnalysisOptions
  ): Promise<{ text: string; tokensUsed: number }> {
    const prompt = options?.customPrompt?.seo || 
      `Create an SEO-optimized description of this image that:
       1. Includes relevant keywords naturally
       2. Describes the content accurately
       3. Is between 150-160 characters
       4. Would work well as a meta description
       
       ${metadata?.title ? `Page title: ${metadata.title}` : ''}
       ${metadata?.context ? `Context: ${metadata.context}` : ''}`;

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
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: options?.detail || 'auto'
                  } 
                },
              ],
            },
          ],
          max_tokens: 150,
          temperature: 0.4,
        });
      },
      this.retryConfig
    );

    return {
      text: response.choices[0]?.message?.content || '',
      tokensUsed: response.usage?.total_tokens || 0,
    };
  }

  /**
   * Perform comprehensive image analysis
   */
  private async performComprehensiveAnalysis(
    imageBase64: string,
    metadata?: any,
    options?: OpenAIImageAnalysisOptions
  ): Promise<{
    visualElements: string[];
    colors: string[];
    composition: string;
    context: string;
    imageType: 'photo' | 'illustration' | 'chart' | 'diagram' | 'text' | 'other';
    confidence: number;
  }> {
    const prompt = `Analyze this image and provide a JSON response with:
    {
      "visualElements": ["list of key visual elements"],
      "colors": ["dominant colors"],
      "composition": "description of composition and layout",
      "context": "likely context or purpose",
      "imageType": "photo|illustration|chart|diagram|text|other",
      "confidence": 0.0-1.0
    }`;

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
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: 'high'
                  } 
                },
              ],
            },
          ],
          max_tokens: 500,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        });
      },
      this.retryConfig
    );

    try {
      const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        visualElements: analysis.visualElements || [],
        colors: analysis.colors || [],
        composition: analysis.composition || '',
        context: analysis.context || '',
        imageType: analysis.imageType || 'other',
        confidence: analysis.confidence || 0.8,
      };
    } catch (error) {
      logger.warn('Failed to parse OpenAI analysis response', { error });
      
      return {
        visualElements: [],
        colors: [],
        composition: '',
        context: '',
        imageType: 'other',
        confidence: 0.5,
      };
    }
  }

  /**
   * Fetch and prepare image from S3
   */
  private async prepareImage(s3Uri: string): Promise<string> {
    try {
      // Parse S3 URI
      const match = s3Uri.match(/^s3:\/\/([^\/]+)\/(.+)$/);
      if (!match) {
        throw new Error('Invalid S3 URI format');
      }

      const [, bucket, key] = match;

      // Fetch image from S3
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

      // Optimize image if needed
      let processedBuffer = buffer;
      
      if (buffer.length > this.maxImageSize) {
        logger.info('Resizing large image for OpenAI', {
          originalSize: buffer.length,
          maxSize: this.maxImageSize,
        });

        processedBuffer = await sharp(buffer)
          .resize(2048, 2048, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ quality: 85 })
          .toBuffer();
      }

      // Convert to base64
      return processedBuffer.toString('base64');

    } catch (error) {
      logger.error('Failed to prepare image from S3', { error, s3Uri });
      throw error;
    }
  }

  /**
   * Validate OpenAI API availability
   */
  async validateAPIConnection(): Promise<boolean> {
    try {
      const response = await this.openai.models.list();
      return response.data.length > 0;
    } catch (error) {
      logger.error('Failed to validate OpenAI API connection', { error });
      return false;
    }
  }
}