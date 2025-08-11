/**
 * Unit Tests for OpenAI Image Analysis Module
 * Tests image processing capabilities using OpenAI Vision API
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  mockOpenAIClient,
  setupOpenAIMocks,
  MOCK_OPENAI_RESPONSES,
  MOCK_OPENAI_ERRORS,
  costCalculationHelper,
  cacheMockHelper
} from '../../utils/openaiMocks';
import { s3Mock, setupS3SuccessMocks, resetAllMocks } from '../../utils/awsMocks';

// Mock the OpenAI module
jest.mock('openai', () => ({
  default: jest.fn(() => mockOpenAIClient)
}));

// Import module under test (will be created)
let OpenAIImageAnalysis: any;

describe('OpenAI Image Analysis Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAllMocks();
    setupS3SuccessMocks();
    setupOpenAIMocks('success');
    cacheMockHelper.clear();
    
    // Reset module cache to ensure fresh import
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    test('should analyze a single image successfully', async () => {
      const imageData = Buffer.from('fake-image-data');
      const result = await analyzeImage(imageData, {
        model: 'gpt-4-vision-preview',
        maxTokens: 300
      });

      expect(result).toHaveProperty('description');
      expect(result.description).toContain('mountain landscape');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.model).toBe('gpt-4-vision-preview');
      expect(result.metadata.tokens).toBeGreaterThan(0);
    });

    test('should handle base64 encoded images', async () => {
      const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';
      const result = await analyzeImage(base64Image, {
        model: 'gpt-4-vision-preview'
      });

      expect(result).toHaveProperty('description');
      expect(mockOpenAIClient.getStats().requestCount).toBe(1);
    });

    test('should handle S3 image URLs', async () => {
      const s3Url = 's3://test-bucket/test-image.jpg';
      const result = await analyzeImageFromS3(s3Url);

      expect(result).toHaveProperty('description');
      expect(s3Mock.calls()).toHaveLength(1); // Should fetch from S3
    });

    test('should apply custom prompts correctly', async () => {
      const customPrompt = 'Describe this image for a visually impaired person, focusing on spatial relationships';
      const result = await analyzeImage(Buffer.from('image'), {
        prompt: customPrompt
      });

      const requestLog = mockOpenAIClient.getStats().requestLog;
      expect(requestLog[0].messages[0].content).toContain(customPrompt);
    });
  });

  describe('Error Handling', () => {
    test('should retry on transient errors', async () => {
      mockOpenAIClient.reset();
      mockOpenAIClient.queueError(MOCK_OPENAI_ERRORS.api_error);
      mockOpenAIClient.queueResponse(MOCK_OPENAI_RESPONSES.imageAnalysis.landscape);

      const result = await analyzeImage(Buffer.from('image'), {
        retryAttempts: 3
      });

      expect(result).toHaveProperty('description');
      expect(mockOpenAIClient.getStats().requestCount).toBe(2);
    });

    test('should handle rate limit errors with backoff', async () => {
      mockOpenAIClient.reset();
      mockOpenAIClient.enableRateLimit(1, 100);

      const promises = [
        analyzeImage(Buffer.from('image1')),
        analyzeImage(Buffer.from('image2')),
        analyzeImage(Buffer.from('image3'))
      ];

      const results = await Promise.allSettled(promises);
      const rejected = results.filter(r => r.status === 'rejected');
      
      expect(rejected.length).toBeGreaterThan(0);
      expect(rejected[0].reason).toMatchObject(MOCK_OPENAI_ERRORS.rate_limit);
    });

    test('should validate image size limits', async () => {
      const largeImage = Buffer.alloc(21 * 1024 * 1024); // 21MB
      
      await expect(analyzeImage(largeImage)).rejects.toThrow('Image size exceeds maximum limit');
    });

    test('should handle invalid image formats', async () => {
      const invalidImage = Buffer.from('not-an-image');
      
      await expect(analyzeImage(invalidImage)).rejects.toThrow('Invalid image format');
    });

    test('should timeout long-running requests', async () => {
      mockOpenAIClient.reset();
      mockOpenAIClient.chat.completions.create.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      await expect(analyzeImage(Buffer.from('image'), {
        timeout: 1000
      })).rejects.toThrow('Request timeout');
    });
  });

  describe('Batch Processing', () => {
    test('should process multiple images in parallel', async () => {
      const images = Array(5).fill(null).map((_, i) => 
        Buffer.from(`image-${i}`)
      );

      const results = await analyzeImageBatch(images, {
        maxConcurrent: 3
      });

      expect(results).toHaveLength(5);
      expect(results.every(r => r.description)).toBe(true);
    });

    test('should respect concurrency limits', async () => {
      const images = Array(10).fill(null).map((_, i) => 
        Buffer.from(`image-${i}`)
      );

      const startTime = Date.now();
      const results = await analyzeImageBatch(images, {
        maxConcurrent: 2,
        delayBetweenRequests: 100
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThan(400); // At least 5 batches * 100ms
      expect(results).toHaveLength(10);
    });

    test('should handle partial batch failures gracefully', async () => {
      mockOpenAIClient.reset();
      mockOpenAIClient.queueResponse(MOCK_OPENAI_RESPONSES.imageAnalysis.landscape);
      mockOpenAIClient.queueError(MOCK_OPENAI_ERRORS.api_error);
      mockOpenAIClient.queueResponse(MOCK_OPENAI_RESPONSES.imageAnalysis.portrait);

      const images = Array(3).fill(null).map((_, i) => 
        Buffer.from(`image-${i}`)
      );

      const results = await analyzeImageBatch(images, {
        continueOnError: true
      });

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('Caching', () => {
    test('should cache successful responses', async () => {
      const imageData = Buffer.from('test-image');
      
      // First call - cache miss
      const result1 = await analyzeImage(imageData, {
        enableCache: true
      });

      // Second call - cache hit
      const result2 = await analyzeImage(imageData, {
        enableCache: true
      });

      expect(result1.description).toBe(result2.description);
      expect(mockOpenAIClient.getStats().requestCount).toBe(1);
      expect(cacheMockHelper.getStats().hits).toBe(1);
    });

    test('should respect cache TTL', async () => {
      const imageData = Buffer.from('test-image');
      cacheMockHelper.clear();
      
      const cacheHelper = new (require('../../utils/openaiMocks').CacheMockHelper)(100); // 100ms TTL
      
      await analyzeImage(imageData, {
        enableCache: true,
        cacheTTL: 100
      });

      await new Promise(resolve => setTimeout(resolve, 150));

      await analyzeImage(imageData, {
        enableCache: true,
        cacheTTL: 100
      });

      expect(mockOpenAIClient.getStats().requestCount).toBe(2); // Cache expired
    });

    test('should generate unique cache keys for different parameters', async () => {
      const imageData = Buffer.from('test-image');
      
      await analyzeImage(imageData, {
        enableCache: true,
        model: 'gpt-4-vision-preview'
      });

      await analyzeImage(imageData, {
        enableCache: true,
        model: 'gpt-3.5-turbo'
      });

      expect(mockOpenAIClient.getStats().requestCount).toBe(2);
    });
  });

  describe('Cost Optimization', () => {
    test('should track API costs accurately', async () => {
      mockOpenAIClient.reset();
      mockOpenAIClient.queueResponse(MOCK_OPENAI_RESPONSES.imageAnalysis.landscape);

      const result = await analyzeImage(Buffer.from('image'), {
        trackCosts: true
      });

      expect(result.cost).toBeDefined();
      expect(result.cost.inputTokens).toBe(285);
      expect(result.cost.outputTokens).toBe(67);
      expect(result.cost.totalCost).toBeCloseTo(0.0055, 4);
    });

    test('should respect budget limits', async () => {
      const images = Array(10).fill(null).map((_, i) => 
        Buffer.from(`image-${i}`)
      );

      await expect(analyzeImageBatch(images, {
        maxBudget: 0.01 // $0.01 limit
      })).rejects.toThrow('Budget limit exceeded');
    });

    test('should optimize model selection based on requirements', async () => {
      const result = await analyzeImage(Buffer.from('image'), {
        qualityLevel: 'low',
        optimizeForCost: true
      });

      const requestLog = mockOpenAIClient.getStats().requestLog;
      expect(requestLog[0].model).toBe('gpt-3.5-turbo');
    });
  });

  describe('Quality Validation', () => {
    test('should validate description quality scores', async () => {
      const result = await analyzeImage(Buffer.from('image'), {
        requireQualityScore: true
      });

      expect(result.qualityScore).toBeDefined();
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    test('should retry if quality score is too low', async () => {
      mockOpenAIClient.reset();
      
      // Queue low quality response first
      mockOpenAIClient.queueResponse({
        ...MOCK_OPENAI_RESPONSES.imageAnalysis.landscape,
        choices: [{
          message: {
            role: 'assistant',
            content: 'Image.' // Very short, low quality
          },
          finish_reason: 'stop'
        }]
      });
      
      // Then queue good quality response
      mockOpenAIClient.queueResponse(MOCK_OPENAI_RESPONSES.imageAnalysis.landscape);

      const result = await analyzeImage(Buffer.from('image'), {
        minQualityScore: 70,
        maxRetries: 2
      });

      expect(mockOpenAIClient.getStats().requestCount).toBe(2);
      expect(result.qualityScore).toBeGreaterThan(70);
    });
  });

  describe('Advanced Features', () => {
    test('should support streaming responses', async () => {
      const chunks: string[] = [];
      
      await analyzeImageStream(Buffer.from('image'), {
        onChunk: (chunk: string) => chunks.push(chunk)
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('landscape');
    });

    test('should extract structured data from images', async () => {
      const result = await analyzeImage(Buffer.from('image'), {
        extractStructuredData: true,
        schema: {
          objects: 'array',
          primaryColor: 'string',
          sceneType: 'string'
        }
      });

      expect(result.structuredData).toBeDefined();
      expect(result.structuredData.objects).toBeInstanceOf(Array);
      expect(result.structuredData.sceneType).toBe('landscape');
    });

    test('should support custom vision models', async () => {
      const result = await analyzeImage(Buffer.from('image'), {
        model: 'custom-vision-model',
        modelEndpoint: 'https://custom.endpoint.com'
      });

      expect(result).toHaveProperty('description');
      const requestLog = mockOpenAIClient.getStats().requestLog;
      expect(requestLog[0].model).toBe('custom-vision-model');
    });

    test('should generate accessibility-focused descriptions', async () => {
      const result = await analyzeImage(Buffer.from('image'), {
        descriptionType: 'accessibility',
        includeColorInfo: false,
        focusOnLayout: true
      });

      expect(result.description).toContain('foreground');
      expect(result.description).not.toContain('golden');
    });
  });

  describe('Integration with Pipeline', () => {
    test('should integrate with pipeline selector', async () => {
      const criteria = {
        fileType: 'image',
        size: 1024000,
        requiresHighAccuracy: false,
        budget: 'low'
      };

      const pipeline = selectOptimalPipeline(criteria);
      expect(pipeline).toBe('openai-image');
    });

    test('should fallback to AWS pipeline on OpenAI errors', async () => {
      mockOpenAIClient.reset();
      mockOpenAIClient.queueError(MOCK_OPENAI_ERRORS.api_error);
      mockOpenAIClient.queueError(MOCK_OPENAI_ERRORS.api_error);
      mockOpenAIClient.queueError(MOCK_OPENAI_ERRORS.api_error);

      const result = await analyzeImage(Buffer.from('image'), {
        fallbackPipeline: 'aws-bedrock',
        maxRetries: 2
      });

      expect(result.pipeline).toBe('aws-bedrock');
    });
  });

  describe('Performance Metrics', () => {
    test('should track processing time', async () => {
      const result = await analyzeImage(Buffer.from('image'), {
        trackMetrics: true
      });

      expect(result.metrics).toBeDefined();
      expect(result.metrics.processingTime).toBeGreaterThan(0);
      expect(result.metrics.processingTime).toBeLessThan(5000);
    });

    test('should track memory usage', async () => {
      const result = await analyzeImage(Buffer.from('image'), {
        trackMetrics: true
      });

      expect(result.metrics.memoryUsed).toBeDefined();
      expect(result.metrics.memoryUsed).toBeGreaterThan(0);
    });
  });
});

// Helper functions that would be in the actual module
async function analyzeImage(imageData: any, options: any = {}): Promise<any> {
  // This would be the actual implementation
  const response = await mockOpenAIClient.chat.completions.create({
    model: options.model || 'gpt-4-vision-preview',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: options.prompt || 'Describe this image' },
        { type: 'image_url', image_url: { url: imageData } }
      ]
    }],
    max_tokens: options.maxTokens || 300
  });

  return {
    description: response.choices[0].message.content,
    metadata: {
      model: response.model,
      tokens: response.usage.total_tokens
    },
    cost: options.trackCosts ? {
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      totalCost: costCalculationHelper.calculateCost(
        response.model,
        response.usage.prompt_tokens,
        response.usage.completion_tokens
      )
    } : undefined
  };
}

async function analyzeImageFromS3(s3Url: string): Promise<any> {
  // Mock implementation
  return analyzeImage(Buffer.from('s3-image-data'));
}

async function analyzeImageBatch(images: any[], options: any = {}): Promise<any[]> {
  // Mock implementation
  const results = [];
  for (const image of images) {
    try {
      const result = await analyzeImage(image, options);
      results.push({ ...result, success: true });
    } catch (error) {
      if (options.continueOnError) {
        results.push({ success: false, error });
      } else {
        throw error;
      }
    }
  }
  return results;
}

async function analyzeImageStream(imageData: any, options: any = {}): Promise<void> {
  // Mock streaming implementation
  const chunks = ['A serene ', 'mountain ', 'landscape'];
  for (const chunk of chunks) {
    await new Promise(resolve => setTimeout(resolve, 50));
    options.onChunk?.(chunk);
  }
}

function selectOptimalPipeline(criteria: any): string {
  // Mock pipeline selection
  if (criteria.budget === 'low') return 'openai-image';
  if (criteria.requiresHighAccuracy) return 'aws-bedrock';
  return 'openai-image';
}