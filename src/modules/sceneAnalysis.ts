import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import * as fs from 'fs';
import * as path from 'path';
import { 
  AWSConfig, 
  SceneAnalysis, 
  APIResponse, 
  ImageData, 
  ImageAnalysis 
} from '../types';
import { ExtractedScene } from './sceneExtraction';
import { logger } from '../utils/logger';
import { retryWithBackoff, isRetryableError } from '../utils/retry';

export class SceneAnalysisModule {
  private bedrockClient: BedrockRuntimeClient;
  private config: AWSConfig;
  private modelId: string;

  constructor(config: AWSConfig) {
    this.config = config;
    this.modelId = process.env.NOVA_MODEL_ID || 'amazon.nova-pro-v1:0';
    this.bedrockClient = new BedrockRuntimeClient({
      region: config.region,
      credentials: config.credentials,
    });
  }

  async analyzeScenes(
    extractedScenes: ExtractedScene[],
    jobId: string
  ): Promise<APIResponse<{
    analyses: SceneAnalysis[];
    errors: string[];
  }>> {
    const startTime = Date.now();

    try {
      logger.info('Starting scene analysis', { 
        jobId, 
        sceneCount: extractedScenes.length,
        modelId: this.modelId
      });

      const analyses: SceneAnalysis[] = [];
      const errors: string[] = [];

      // Process scenes sequentially to avoid rate limiting
      for (const scene of extractedScenes) {
        try {
          const analysisResult = await this.analyzeSingleScene(scene);
          
          if (analysisResult.success && analysisResult.data) {
            analyses.push(analysisResult.data);
            logger.debug('Scene analysis completed', { 
              segmentId: scene.segmentId,
              confidence: analysisResult.data.confidence 
            });
          } else {
            const errorMsg = `${scene.segmentId}: ${analysisResult.error?.message}`;
            errors.push(errorMsg);
            logger.warn('Scene analysis failed', { 
              segmentId: scene.segmentId, 
              error: errorMsg 
            });
          }

          // Rate limiting: small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          const errorMsg = `${scene.segmentId}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          logger.error('Scene analysis error', { 
            segmentId: scene.segmentId, 
            error: errorMsg 
          });
        }
      }

      const processingTime = Date.now() - startTime;
      
      logger.info('Scene analysis completed', {
        jobId,
        totalScenes: extractedScenes.length,
        successfulAnalyses: analyses.length,
        errors: errors.length,
        processingTime,
      });

      return {
        success: true,
        data: {
          analyses,
          errors,
        },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Scene analysis batch failed', { error, jobId });

      return {
        success: false,
        error: {
          code: 'SCENE_ANALYSIS_BATCH_FAILED',
          message: 'Failed to analyze video scenes',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  async analyzeSingleScene(scene: ExtractedScene): Promise<APIResponse<SceneAnalysis>> {
    try {
      logger.debug('Analyzing single scene', { segmentId: scene.segmentId, localPath: scene.localPath });

      // Encode video to base64
      const encodingResult = await this.encodeVideoToBase64(scene.localPath);
      if (!encodingResult.success) {
        return encodingResult;
      }

      const { base64Data, mimeType } = encodingResult.data!;
      const prompt = this.constructAnalysisPrompt(scene);

      // Prepare Bedrock request
      const request = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
      };

      // Call Bedrock with retry logic
      const response = await retryWithBackoff(
        async () => {
          const command = new InvokeModelCommand({
            modelId: this.modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: new TextEncoder().encode(JSON.stringify(request)),
          });

          return await this.bedrockClient.send(command);
        },
        { 
          maxRetries: 3,
          baseDelay: 2000, // Longer delay for rate limiting
        },
        `Bedrock analysis for ${scene.segmentId}`
      );

      if (!response.body) {
        throw new Error('No response body from Bedrock');
      }

      // Parse response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const parseResult = this.parseBedrockResponse(responseBody, scene.segmentId);
      
      if (!parseResult.success) {
        return parseResult;
      }

      // Add scene timing information
      const sceneAnalysis: SceneAnalysis = {
        ...parseResult.data!,
        startTime: scene.startTime,
        endTime: scene.endTime,
      };

      logger.debug('Scene analysis successful', { 
        segmentId: scene.segmentId,
        confidence: sceneAnalysis.confidence,
        descriptionLength: sceneAnalysis.description.length
      });

      return {
        success: true,
        data: sceneAnalysis,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Single scene analysis failed', { 
        error, 
        segmentId: scene.segmentId,
        localPath: scene.localPath
      });

      // Check if it's a file read error
      if (error instanceof Error && error.message.includes('ENOENT')) {
        return {
          success: false,
          error: {
            code: 'FILE_READ_FAILED',
            message: `Failed to read scene file: ${scene.localPath}`,
            details: error.message,
          },
          timestamp: new Date(),
        };
      }

      return {
        success: false,
        error: {
          code: 'BEDROCK_ANALYSIS_FAILED',
          message: `Failed to analyze scene ${scene.segmentId}`,
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  async encodeVideoToBase64(filePath: string): Promise<APIResponse<{
    base64Data: string;
    mimeType: string;
  }>> {
    try {
      const videoBuffer = await fs.promises.readFile(filePath);
      const base64Data = videoBuffer.toString('base64');
      const mimeType = this.getMimeTypeFromPath(filePath);

      logger.debug('Video encoded to base64', { 
        filePath, 
        size: videoBuffer.length,
        base64Length: base64Data.length,
        mimeType
      });

      return {
        success: true,
        data: {
          base64Data,
          mimeType,
        },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to encode video to base64', { error, filePath });

      return {
        success: false,
        error: {
          code: 'FILE_READ_FAILED',
          message: 'Failed to read and encode video file',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  constructAnalysisPrompt(scene: ExtractedScene): string {
    return `You are creating an accessibility audio description for visually impaired viewers. 

Analyze this video segment and provide a clear, concise description that would help someone who cannot see the video understand what is happening.

**Requirements:**
- Focus on visual elements, actions, and context that are important for understanding
- Keep descriptions natural and flowing, suitable for audio narration
- Avoid overly technical or redundant language
- Include relevant visual details like setting, people, objects, and actions
- Provide confidence score based on clarity of visual content

**Video Segment Information:**
- Segment ID: ${scene.segmentId}
- Duration: ${scene.duration.toFixed(1)} seconds
- Time range: ${scene.startTime.toFixed(1)}s - ${scene.endTime.toFixed(1)}s

**Response Format (JSON only):**
{
  "description": "Clear, natural description suitable for audio narration",
  "visualElements": ["array", "of", "key", "visual", "elements"],
  "actions": ["array", "of", "observed", "actions"],
  "context": "brief context or setting description",
  "confidence": 85.5
}

Analyze the video segment and respond with JSON only:`;
  }

  parseBedrockResponse(response: any, segmentId: string): APIResponse<Omit<SceneAnalysis, 'startTime' | 'endTime'>> {
    try {
      if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE_FORMAT',
            message: 'Invalid response format from Bedrock',
          },
          timestamp: new Date(),
        };
      }

      const textContent = response.content[0].text;
      if (!textContent) {
        return {
          success: false,
          error: {
            code: 'EMPTY_CONTENT',
            message: 'Empty content in Bedrock response',
          },
          timestamp: new Date(),
        };
      }

      // Parse JSON response
      let parsedContent;
      try {
        parsedContent = JSON.parse(textContent);
      } catch (parseError) {
        return {
          success: false,
          error: {
            code: 'JSON_PARSE_FAILED',
            message: 'Failed to parse JSON from Bedrock response',
            details: parseError instanceof Error ? parseError.message : String(parseError),
          },
          timestamp: new Date(),
        };
      }

      // Validate required fields
      const requiredFields = ['description', 'visualElements', 'actions', 'context', 'confidence'];
      const missingFields = requiredFields.filter(field => !parsedContent.hasOwnProperty(field));
      
      if (missingFields.length > 0) {
        return {
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: `Missing required fields: ${missingFields.join(', ')}`,
          },
          timestamp: new Date(),
        };
      }

      // Clean and validate data
      const analysis = {
        segmentId,
        description: this.cleanDescription(parsedContent.description),
        confidence: Math.max(0, Math.min(100, parsedContent.confidence || 0)),
        visualElements: Array.isArray(parsedContent.visualElements) 
          ? parsedContent.visualElements.map(String) 
          : [],
        actions: Array.isArray(parsedContent.actions) 
          ? parsedContent.actions.map(String) 
          : [],
        context: String(parsedContent.context || ''),
      };

      return {
        success: true,
        data: analysis,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to parse Bedrock response', { error, segmentId, response });

      return {
        success: false,
        error: {
          code: 'RESPONSE_PARSE_FAILED',
          message: 'Failed to parse Bedrock response',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private cleanDescription(description: string): string {
    if (!description || typeof description !== 'string') {
      return '';
    }

    return description
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/^\w/, c => c.toUpperCase()) // Capitalize first letter
      .replace(/([.!?])\s*$/, '$1'); // Ensure proper ending punctuation
  }

  private getMimeTypeFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
      '.mp4': 'video/mp4',
      '.avi': 'video/avi',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      // Image formats
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };

    return mimeTypes[ext] || 'video/mp4'; // Default to mp4
  }

  // Image-specific analysis methods
  async analyzeImage(imageData: ImageData, jobId: string): Promise<APIResponse<ImageAnalysis>> {
    try {
      logger.info('Starting image analysis', { 
        jobId, 
        s3Uri: imageData.s3Uri,
        detailLevel: imageData.options.detailLevel,
        modelId: this.modelId 
      });

      // Get image data
      let base64Data: string;
      let mimeType: string;

      if (imageData.localPath) {
        // Read from local file
        const encodingResult = await this.encodeImageToBase64(imageData.localPath);
        if (!encodingResult.success) {
          return encodingResult as APIResponse<ImageAnalysis>;
        }
        base64Data = encodingResult.data!.base64Data;
        mimeType = encodingResult.data!.mimeType;
      } else {
        // Get from S3
        const { ImageInputModule } = await import('./imageInput');
        const imageInput = new ImageInputModule(this.config);
        const s3Result = await imageInput.getImageFromS3(imageData.s3Uri);
        
        if (!s3Result.success) {
          return {
            success: false,
            error: s3Result.error,
            timestamp: new Date(),
          };
        }

        base64Data = s3Result.data!.toString('base64');
        mimeType = this.getMimeTypeFromS3Uri(imageData.s3Uri);
      }

      const prompt = this.constructImageAnalysisPrompt(imageData);

      // Prepare Bedrock request
      const request = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1500, // More tokens for comprehensive descriptions
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
      };

      // Call Bedrock with retry logic
      const response = await retryWithBackoff(
        async () => {
          const command = new InvokeModelCommand({
            modelId: this.modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: new TextEncoder().encode(JSON.stringify(request)),
          });

          return await this.bedrockClient.send(command);
        },
        { 
          maxRetries: 3,
          baseDelay: 2000,
        },
        `Bedrock image analysis for ${jobId}`
      );

      if (!response.body) {
        throw new Error('No response body from Bedrock');
      }

      // Parse response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const parseResult = this.parseImageBedrockResponse(responseBody, jobId);
      
      if (!parseResult.success) {
        return parseResult;
      }

      const imageAnalysis: ImageAnalysis = parseResult.data!;

      logger.info('Image analysis successful', { 
        jobId,
        confidence: imageAnalysis.confidence,
        imageType: imageAnalysis.imageType,
        descriptionLength: imageAnalysis.description.length
      });

      return {
        success: true,
        data: imageAnalysis,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Image analysis failed', { 
        error, 
        jobId,
        s3Uri: imageData.s3Uri
      });

      return {
        success: false,
        error: {
          code: 'IMAGE_ANALYSIS_FAILED',
          message: `Failed to analyze image for job ${jobId}`,
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private async encodeImageToBase64(filePath: string): Promise<APIResponse<{
    base64Data: string;
    mimeType: string;
  }>> {
    try {
      const imageBuffer = await fs.promises.readFile(filePath);
      const base64Data = imageBuffer.toString('base64');
      const mimeType = this.getMimeTypeFromPath(filePath);

      logger.debug('Image encoded to base64', { 
        filePath, 
        size: imageBuffer.length,
        base64Length: base64Data.length,
        mimeType
      });

      return {
        success: true,
        data: {
          base64Data,
          mimeType,
        },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to encode image to base64', { error, filePath });

      return {
        success: false,
        error: {
          code: 'FILE_READ_FAILED',
          message: 'Failed to read and encode image file',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private constructImageAnalysisPrompt(imageData: ImageData): string {
    const detailLevel = imageData.options.detailLevel || 'comprehensive';
    const context = imageData.metadata?.context || '';
    const title = imageData.metadata?.title || '';

    let detailInstructions = '';
    switch (detailLevel) {
      case 'basic':
        detailInstructions = 'Provide a concise description focusing on the main subject and essential visual elements.';
        break;
      case 'technical':
        detailInstructions = 'Provide a detailed technical analysis including composition, color theory, visual hierarchy, and design elements.';
        break;
      case 'comprehensive':
      default:
        detailInstructions = 'Provide a comprehensive description including all visual elements, colors, composition, and context.';
    }

    return `You are creating an accessibility description for visually impaired users. 

Analyze this image and provide descriptions that would help someone who cannot see the image understand its content completely.

**Requirements:**
- Generate BOTH a concise alt text (under 125 characters) AND a detailed description
- Focus on conveying the essential information and visual experience
- Use clear, natural language suitable for screen readers
- Identify the type of image (photo, illustration, chart, diagram, text, other)
- Include dominant colors and composition details
- ${detailInstructions}

${title ? `**Image Title:** ${title}` : ''}
${context ? `**Additional Context:** ${context}` : ''}

**Response Format (JSON only):**
{
  "description": "Detailed description suitable for extended accessibility description",
  "altText": "Concise description under 125 characters for HTML alt attribute",
  "visualElements": ["array", "of", "key", "visual", "elements"],
  "actions": ["any", "visible", "actions", "or", "movements"],
  "context": "overall context or purpose of the image",
  "colors": ["dominant", "color", "palette"],
  "composition": "description of layout and visual composition",
  "imageType": "photo|illustration|chart|diagram|text|other",
  "confidence": 85.5
}

Analyze the image and respond with JSON only:`;
  }

  private parseImageBedrockResponse(response: any, jobId: string): APIResponse<ImageAnalysis> {
    try {
      if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE_FORMAT',
            message: 'Invalid response format from Bedrock',
          },
          timestamp: new Date(),
        };
      }

      const textContent = response.content[0].text;
      if (!textContent) {
        return {
          success: false,
          error: {
            code: 'EMPTY_CONTENT',
            message: 'Empty content in Bedrock response',
          },
          timestamp: new Date(),
        };
      }

      // Parse JSON response
      let parsedContent;
      try {
        parsedContent = JSON.parse(textContent);
      } catch (parseError) {
        return {
          success: false,
          error: {
            code: 'JSON_PARSE_FAILED',
            message: 'Failed to parse JSON from Bedrock response',
            details: parseError instanceof Error ? parseError.message : String(parseError),
          },
          timestamp: new Date(),
        };
      }

      // Validate required fields for image analysis
      const requiredFields = ['description', 'altText', 'visualElements', 'colors', 'composition', 'imageType', 'confidence'];
      const missingFields = requiredFields.filter(field => !parsedContent.hasOwnProperty(field));
      
      if (missingFields.length > 0) {
        return {
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: `Missing required fields: ${missingFields.join(', ')}`,
          },
          timestamp: new Date(),
        };
      }

      // Clean and validate data
      const analysis: ImageAnalysis = {
        segmentId: jobId,
        description: this.cleanDescription(parsedContent.description),
        confidence: Math.max(0, Math.min(100, parsedContent.confidence || 0)),
        visualElements: Array.isArray(parsedContent.visualElements) 
          ? parsedContent.visualElements.map(String) 
          : [],
        actions: Array.isArray(parsedContent.actions) 
          ? parsedContent.actions.map(String) 
          : [],
        context: String(parsedContent.context || ''),
        colors: Array.isArray(parsedContent.colors)
          ? parsedContent.colors.map(String)
          : [],
        composition: String(parsedContent.composition || ''),
        imageType: this.validateImageType(parsedContent.imageType),
      };

      // Store alt text temporarily (will be used by compilation module)
      (analysis as any).altText = this.cleanDescription(parsedContent.altText || '');

      return {
        success: true,
        data: analysis,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to parse image Bedrock response', { error, jobId, response });

      return {
        success: false,
        error: {
          code: 'RESPONSE_PARSE_FAILED',
          message: 'Failed to parse Bedrock response',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private validateImageType(type: string): ImageAnalysis['imageType'] {
    const validTypes: ImageAnalysis['imageType'][] = ['photo', 'illustration', 'chart', 'diagram', 'text', 'other'];
    const lowerType = (type || '').toLowerCase() as ImageAnalysis['imageType'];
    return validTypes.includes(lowerType) ? lowerType : 'other';
  }

  private getMimeTypeFromS3Uri(s3Uri: string): string {
    const match = s3Uri.match(/\.([^.]+)$/);
    if (!match) return 'image/jpeg';
    
    const ext = '.' + match[1].toLowerCase();
    return this.getMimeTypeFromPath(ext);
  }
}