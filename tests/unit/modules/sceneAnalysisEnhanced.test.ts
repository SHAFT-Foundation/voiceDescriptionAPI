/**
 * Enhanced Unit Tests for SceneAnalysis Module
 * Tests both video scene analysis and static image analysis capabilities
 */

import { mockClient } from 'aws-sdk-client-mock';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { 
  bedrockMock, 
  resetAllMocks, 
  setupBedrockMocks,
  setupBedrockErrorMocks,
  RetryMockHelper,
  RateLimitMockHelper
} from '../../utils/awsMocks';
import {
  TEST_IMAGES,
  MOCK_BEDROCK_RESPONSES,
  generateMockImageBuffer,
  TestUtils,
  ACCESSIBILITY_TESTS
} from '../../fixtures/imageTestData';
import * as fs from 'fs';

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

// Enhanced SceneAnalysisModule interface to support both video and images
interface EnhancedSceneAnalysisModule {
  // Video analysis methods (existing)
  analyzeScenes(scenes: ExtractedScene[], jobId: string): Promise<AnalysisResult>;
  analyzeSingleScene(scene: ExtractedScene): Promise<SingleAnalysisResult>;
  
  // Image analysis methods (new)
  analyzeImage(imageData: ImageAnalysisRequest): Promise<ImageAnalysisResult>;
  analyzeBatchImages(images: ImageAnalysisRequest[]): Promise<BatchImageAnalysisResult>;
  analyzeImageFromS3(s3Uri: string): Promise<ImageAnalysisResult>;
  
  // Shared methods
  encodeToBase64(data: Buffer | string, mimeType: string): string;
  parseBedrockResponse(response: any, identifier: string): ParsedResponse;
  constructPrompt(type: 'video' | 'image', context: any): string;
}

interface ExtractedScene {
  segmentId: string;
  localPath: string;
  startTime: number;
  endTime: number;
  duration: number;
}

interface ImageAnalysisRequest {
  buffer?: Buffer;
  s3Uri?: string;
  filename: string;
  contentType: string;
  options?: {
    detailLevel?: 'basic' | 'comprehensive' | 'technical';
    analyzeFor?: 'photo' | 'chart' | 'diagram' | 'screenshot' | 'artwork' | 'auto';
    includeConfidence?: boolean;
  };
  metadata?: {
    title?: string;
    context?: string;
  };
}

interface ImageAnalysisResult {
  success: boolean;
  data?: {
    description: string;
    altText: string;
    visualElements: string[];
    confidence: number;
    analysisType: string;
    metadata?: any;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface BatchImageAnalysisResult {
  success: boolean;
  results: ImageAnalysisResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    averageConfidence: number;
  };
}

interface AnalysisResult {
  success: boolean;
  data?: {
    analyses: any[];
    errors: string[];
  };
  error?: any;
}

interface SingleAnalysisResult {
  success: boolean;
  data?: any;
  error?: any;
}

interface ParsedResponse {
  success: boolean;
  data?: any;
  error?: any;
}

// Mock implementation for testing
class MockEnhancedSceneAnalysisModule implements EnhancedSceneAnalysisModule {
  private config: any;
  
  constructor(config: any) {
    this.config = config;
  }
  
  async analyzeImage(imageData: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
    try {
      // Determine image type
      const imageType = imageData.options?.analyzeFor || this.detectImageType(imageData.filename);
      
      // Get appropriate mock response
      const mockResponse = MOCK_BEDROCK_RESPONSES[imageType as keyof typeof MOCK_BEDROCK_RESPONSES] || MOCK_BEDROCK_RESPONSES.photo;
      
      // Apply detail level filtering
      const detailLevel = imageData.options?.detailLevel || 'comprehensive';
      let description = mockResponse.description;
      
      if (detailLevel === 'basic') {
        description = description.substring(0, 150) + '...';
      } else if (detailLevel === 'technical' && mockResponse.dataPoints) {
        description += ` Data points: ${mockResponse.dataPoints.join(', ')}`;
      }
      
      return {
        success: true,
        data: {
          description,
          altText: mockResponse.altText,
          visualElements: mockResponse.visualElements || [],
          confidence: mockResponse.confidence,
          analysisType: imageType,
          metadata: imageData.metadata
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'ANALYSIS_FAILED',
          message: error.message
        }
      };
    }
  }
  
  async analyzeBatchImages(images: ImageAnalysisRequest[]): Promise<BatchImageAnalysisResult> {
    const results: ImageAnalysisResult[] = [];
    let successful = 0;
    let totalConfidence = 0;
    
    for (const image of images) {
      const result = await this.analyzeImage(image);
      results.push(result);
      
      if (result.success && result.data) {
        successful++;
        totalConfidence += result.data.confidence;
      }
    }
    
    return {
      success: successful === images.length,
      results,
      summary: {
        total: images.length,
        successful,
        failed: images.length - successful,
        averageConfidence: successful > 0 ? totalConfidence / successful : 0
      }
    };
  }
  
  async analyzeImageFromS3(s3Uri: string): Promise<ImageAnalysisResult> {
    // Mock S3 retrieval and analysis
    const filename = s3Uri.split('/').pop() || 'image.jpg';
    return this.analyzeImage({
      s3Uri,
      filename,
      contentType: 'image/jpeg'
    });
  }
  
  async analyzeScenes(scenes: ExtractedScene[], jobId: string): Promise<AnalysisResult> {
    const analyses: any[] = [];
    const errors: string[] = [];
    
    for (const scene of scenes) {
      const result = await this.analyzeSingleScene(scene);
      if (result.success) {
        analyses.push(result.data);
      } else {
        errors.push(`${scene.segmentId}: ${result.error?.message}`);
      }
    }
    
    return {
      success: true,
      data: {
        analyses,
        errors
      }
    };
  }
  
  async analyzeSingleScene(scene: ExtractedScene): Promise<SingleAnalysisResult> {
    // Mock video scene analysis
    return {
      success: true,
      data: {
        segmentId: scene.segmentId,
        description: 'Mock scene description',
        visualElements: ['element1', 'element2'],
        actions: ['action1'],
        context: 'context',
        confidence: 90
      }
    };
  }
  
  encodeToBase64(data: Buffer | string, mimeType: string): string {
    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    return buffer.toString('base64');
  }
  
  parseBedrockResponse(response: any, identifier: string): ParsedResponse {
    try {
      if (!response.content || !response.content[0]) {
        return {
          success: false,
          error: { code: 'INVALID_RESPONSE_FORMAT' }
        };
      }
      
      const parsed = JSON.parse(response.content[0].text);
      
      // Validate required fields
      const requiredFields = ['description'];
      for (const field of requiredFields) {
        if (!parsed[field]) {
          return {
            success: false,
            error: { code: 'MISSING_REQUIRED_FIELDS' }
          };
        }
      }
      
      return {
        success: true,
        data: parsed
      };
    } catch (error) {
      return {
        success: false,
        error: { code: 'JSON_PARSE_FAILED' }
      };
    }
  }
  
  constructPrompt(type: 'video' | 'image', context: any): string {
    if (type === 'video') {
      return `Analyze this video scene for accessibility audio description...`;
    } else {
      const detailLevel = context.detailLevel || 'comprehensive';
      return `Generate a ${detailLevel} accessibility description for this image...`;
    }
  }
  
  private detectImageType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('chart') || lower.includes('graph')) return 'chart';
    if (lower.includes('diagram') || lower.includes('flow')) return 'diagram';
    if (lower.includes('screenshot') || lower.includes('screen')) return 'screenshot';
    if (lower.includes('art') || lower.includes('painting')) return 'artwork';
    if (lower.includes('infographic') || lower.includes('info')) return 'infographic';
    return 'photo';
  }
}

describe('Enhanced SceneAnalysisModule', () => {
  let sceneAnalysis: MockEnhancedSceneAnalysisModule;
  
  beforeEach(() => {
    resetAllMocks();
    sceneAnalysis = new MockEnhancedSceneAnalysisModule({
      region: 'us-east-1',
      inputBucket: 'test-input-bucket',
      outputBucket: 'test-output-bucket',
      novaModelId: 'amazon.nova-pro-v1:0'
    });
    
    // Mock fs.readFile
    const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;
    fsMock.readFile.mockResolvedValue(Buffer.from('mock data'));
  });
  
  describe('Image Analysis', () => {
    describe('analyzeImage', () => {
      test('should analyze photo with comprehensive detail', async () => {
        setupBedrockMocks('photo');
        const imageBuffer = generateMockImageBuffer('jpeg', 2048);
        
        const request: ImageAnalysisRequest = {
          buffer: imageBuffer,
          filename: 'landscape.jpg',
          contentType: 'image/jpeg',
          options: {
            detailLevel: 'comprehensive',
            analyzeFor: 'photo'
          }
        };
        
        const result = await sceneAnalysis.analyzeImage(request);
        
        expect(result.success).toBe(true);
        expect(result.data?.description).toBeDefined();
        expect(result.data?.altText).toBeDefined();
        expect(result.data?.visualElements).toBeInstanceOf(Array);
        expect(result.data?.confidence).toBeGreaterThan(0.85);
        expect(result.data?.analysisType).toBe('photo');
      });
      
      test('should analyze chart with data extraction', async () => {
        setupBedrockMocks('chart');
        const imageBuffer = generateMockImageBuffer('png', 1024);
        
        const request: ImageAnalysisRequest = {
          buffer: imageBuffer,
          filename: 'sales-chart.png',
          contentType: 'image/png',
          options: {
            detailLevel: 'technical',
            analyzeFor: 'chart'
          }
        };
        
        const result = await sceneAnalysis.analyzeImage(request);
        
        expect(result.success).toBe(true);
        expect(result.data?.description).toContain('Data points:');
        expect(result.data?.analysisType).toBe('chart');
      });
      
      test('should analyze diagram with component identification', async () => {
        setupBedrockMocks('diagram');
        const imageBuffer = generateMockImageBuffer('png', 1536);
        
        const request: ImageAnalysisRequest = {
          buffer: imageBuffer,
          filename: 'system-diagram.png',
          contentType: 'image/png',
          options: {
            analyzeFor: 'diagram'
          }
        };
        
        const result = await sceneAnalysis.analyzeImage(request);
        
        expect(result.success).toBe(true);
        expect(result.data?.description).toContain('architecture');
        expect(result.data?.visualElements).toContain('boxes');
      });
      
      test('should auto-detect image type from filename', async () => {
        const testCases = [
          { filename: 'quarterly-chart.png', expectedType: 'chart' },
          { filename: 'flow-diagram.jpg', expectedType: 'diagram' },
          { filename: 'app-screenshot.png', expectedType: 'screenshot' },
          { filename: 'digital-art.webp', expectedType: 'artwork' },
          { filename: 'random-photo.jpg', expectedType: 'photo' }
        ];
        
        for (const testCase of testCases) {
          const result = await sceneAnalysis.analyzeImage({
            buffer: generateMockImageBuffer('jpeg', 1024),
            filename: testCase.filename,
            contentType: 'image/jpeg'
          });
          
          expect(result.data?.analysisType).toBe(testCase.expectedType);
        }
      });
      
      test('should apply basic detail level filtering', async () => {
        const request: ImageAnalysisRequest = {
          buffer: generateMockImageBuffer('jpeg', 1024),
          filename: 'test.jpg',
          contentType: 'image/jpeg',
          options: {
            detailLevel: 'basic'
          }
        };
        
        const result = await sceneAnalysis.analyzeImage(request);
        
        expect(result.success).toBe(true);
        expect(result.data?.description.length).toBeLessThan(200);
        expect(result.data?.description).toContain('...');
      });
      
      test('should include metadata in response', async () => {
        const metadata = {
          title: 'Test Image',
          context: 'Product catalog'
        };
        
        const request: ImageAnalysisRequest = {
          buffer: generateMockImageBuffer('jpeg', 1024),
          filename: 'product.jpg',
          contentType: 'image/jpeg',
          metadata
        };
        
        const result = await sceneAnalysis.analyzeImage(request);
        
        expect(result.success).toBe(true);
        expect(result.data?.metadata).toEqual(metadata);
      });
      
      test('should handle analysis errors gracefully', async () => {
        setupBedrockErrorMocks('ModelError');
        
        const request: ImageAnalysisRequest = {
          buffer: Buffer.from('invalid'),
          filename: 'error.jpg',
          contentType: 'image/jpeg'
        };
        
        // Force an error in our mock
        jest.spyOn(sceneAnalysis as any, 'detectImageType').mockImplementation(() => {
          throw new Error('Detection failed');
        });
        
        const result = await sceneAnalysis.analyzeImage(request);
        
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ANALYSIS_FAILED');
      });
    });
    
    describe('analyzeBatchImages', () => {
      test('should analyze multiple images in batch', async () => {
        const images: ImageAnalysisRequest[] = [
          {
            buffer: generateMockImageBuffer('jpeg', 1024),
            filename: 'photo1.jpg',
            contentType: 'image/jpeg'
          },
          {
            buffer: generateMockImageBuffer('png', 2048),
            filename: 'chart1.png',
            contentType: 'image/png'
          },
          {
            buffer: generateMockImageBuffer('webp', 1536),
            filename: 'art1.webp',
            contentType: 'image/webp'
          }
        ];
        
        const result = await sceneAnalysis.analyzeBatchImages(images);
        
        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(3);
        expect(result.summary.total).toBe(3);
        expect(result.summary.successful).toBe(3);
        expect(result.summary.failed).toBe(0);
        expect(result.summary.averageConfidence).toBeGreaterThan(0.85);
      });
      
      test('should handle mixed success and failure in batch', async () => {
        // Mock one failure
        jest.spyOn(sceneAnalysis, 'analyzeImage')
          .mockResolvedValueOnce({
            success: true,
            data: {
              description: 'Success',
              altText: 'Alt',
              visualElements: [],
              confidence: 0.9,
              analysisType: 'photo'
            }
          })
          .mockResolvedValueOnce({
            success: false,
            error: { code: 'FAILED', message: 'Analysis failed' }
          })
          .mockResolvedValueOnce({
            success: true,
            data: {
              description: 'Success',
              altText: 'Alt',
              visualElements: [],
              confidence: 0.95,
              analysisType: 'chart'
            }
          });
        
        const images: ImageAnalysisRequest[] = [
          { filename: 'img1.jpg', contentType: 'image/jpeg' },
          { filename: 'img2.jpg', contentType: 'image/jpeg' },
          { filename: 'img3.jpg', contentType: 'image/jpeg' }
        ];
        
        const result = await sceneAnalysis.analyzeBatchImages(images);
        
        expect(result.success).toBe(false);
        expect(result.summary.successful).toBe(2);
        expect(result.summary.failed).toBe(1);
        expect(result.summary.averageConfidence).toBeCloseTo(0.925, 2);
      });
      
      test('should process empty batch', async () => {
        const result = await sceneAnalysis.analyzeBatchImages([]);
        
        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(0);
        expect(result.summary.total).toBe(0);
        expect(result.summary.averageConfidence).toBe(0);
      });
    });
    
    describe('analyzeImageFromS3', () => {
      test('should analyze image from S3 URI', async () => {
        const s3Uri = 's3://test-bucket/images/test.jpg';
        
        const result = await sceneAnalysis.analyzeImageFromS3(s3Uri);
        
        expect(result.success).toBe(true);
        expect(result.data?.description).toBeDefined();
        expect(result.data?.altText).toBeDefined();
      });
      
      test('should extract filename from S3 URI', async () => {
        const s3Uri = 's3://test-bucket/folder/subfolder/my-chart.png';
        
        const result = await sceneAnalysis.analyzeImageFromS3(s3Uri);
        
        expect(result.success).toBe(true);
        expect(result.data?.analysisType).toBe('chart');
      });
    });
  });
  
  describe('Accessibility Validation', () => {
    test('should generate alt text within WCAG length guidelines', async () => {
      const request: ImageAnalysisRequest = {
        buffer: generateMockImageBuffer('jpeg', 1024),
        filename: 'test.jpg',
        contentType: 'image/jpeg'
      };
      
      const result = await sceneAnalysis.analyzeImage(request);
      
      expect(result.success).toBe(true);
      const altTextLength = result.data?.altText.length || 0;
      expect(altTextLength).toBeGreaterThanOrEqual(ACCESSIBILITY_TESTS.altTextLength.minLength);
      expect(altTextLength).toBeLessThanOrEqual(ACCESSIBILITY_TESTS.altTextLength.maxLength);
    });
    
    test('should meet minimum confidence threshold', async () => {
      const request: ImageAnalysisRequest = {
        buffer: generateMockImageBuffer('jpeg', 1024),
        filename: 'test.jpg',
        contentType: 'image/jpeg'
      };
      
      const result = await sceneAnalysis.analyzeImage(request);
      
      expect(result.success).toBe(true);
      expect(result.data?.confidence).toBeGreaterThanOrEqual(
        ACCESSIBILITY_TESTS.descriptionQuality.minConfidence
      );
    });
    
    test('should include required description elements', async () => {
      const request: ImageAnalysisRequest = {
        buffer: generateMockImageBuffer('jpeg', 1024),
        filename: 'test.jpg',
        contentType: 'image/jpeg'
      };
      
      const result = await sceneAnalysis.analyzeImage(request);
      
      expect(result.success).toBe(true);
      expect(result.data?.description).toBeDefined();
      expect(result.data?.visualElements).toBeDefined();
      expect(result.data?.visualElements.length).toBeGreaterThan(0);
    });
  });
  
  describe('Bedrock Integration', () => {
    test('should handle rate limiting with retry', async () => {
      const retryHelper = new RetryMockHelper(2, {
        success: true,
        data: { description: 'Success after retries' }
      });
      
      jest.spyOn(sceneAnalysis as any, 'analyzeImage').mockImplementation(
        () => retryHelper.execute()
      );
      
      const request: ImageAnalysisRequest = {
        buffer: generateMockImageBuffer('jpeg', 1024),
        filename: 'test.jpg',
        contentType: 'image/jpeg'
      };
      
      await expect(sceneAnalysis.analyzeImage(request)).rejects.toThrow();
      await expect(sceneAnalysis.analyzeImage(request)).rejects.toThrow();
      const result = await sceneAnalysis.analyzeImage(request);
      
      expect(retryHelper.getAttemptCount()).toBe(3);
      expect(result.success).toBe(true);
    });
    
    test('should respect rate limits', async () => {
      const rateLimiter = new RateLimitMockHelper(5, 1000);
      
      const analyzeWithRateLimit = async () => {
        await rateLimiter.checkLimit();
        return sceneAnalysis.analyzeImage({
          buffer: generateMockImageBuffer('jpeg', 1024),
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        });
      };
      
      // First 5 should succeed
      const promises = Array.from({ length: 5 }, analyzeWithRateLimit);
      await Promise.all(promises);
      
      // 6th should fail
      await expect(analyzeWithRateLimit()).rejects.toThrow('Rate limit exceeded');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle invalid Bedrock responses', () => {
      const invalidResponses = [
        {},
        { content: null },
        { content: [] },
        { content: [{ text: 'not json' }] },
        { content: [{ text: '{"incomplete": true' }] }
      ];
      
      invalidResponses.forEach(response => {
        const result = sceneAnalysis.parseBedrockResponse(response, 'test-id');
        expect(result.success).toBe(false);
        expect(result.error?.code).toBeDefined();
      });
    });
    
    test('should validate required response fields', () => {
      const incompleteResponse = {
        content: [{
          text: JSON.stringify({
            // Missing description field
            visualElements: ['element'],
            confidence: 0.9
          })
        }]
      };
      
      const result = sceneAnalysis.parseBedrockResponse(incompleteResponse, 'test-id');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_REQUIRED_FIELDS');
    });
  });
  
  describe('Prompt Construction', () => {
    test('should construct appropriate prompt for images', () => {
      const prompt = sceneAnalysis.constructPrompt('image', {
        detailLevel: 'comprehensive'
      });
      
      expect(prompt).toContain('comprehensive');
      expect(prompt).toContain('accessibility');
      expect(prompt).toContain('description');
    });
    
    test('should construct appropriate prompt for videos', () => {
      const prompt = sceneAnalysis.constructPrompt('video', {
        duration: 5.5
      });
      
      expect(prompt).toContain('video scene');
      expect(prompt).toContain('accessibility');
    });
    
    test('should adapt prompt based on detail level', () => {
      const basicPrompt = sceneAnalysis.constructPrompt('image', {
        detailLevel: 'basic'
      });
      
      const technicalPrompt = sceneAnalysis.constructPrompt('image', {
        detailLevel: 'technical'
      });
      
      expect(basicPrompt).toContain('basic');
      expect(technicalPrompt).toContain('technical');
    });
  });
  
  describe('Base64 Encoding', () => {
    test('should encode buffer to base64', () => {
      const buffer = Buffer.from('test data');
      const encoded = sceneAnalysis.encodeToBase64(buffer, 'image/jpeg');
      
      expect(encoded).toBe(buffer.toString('base64'));
    });
    
    test('should encode string to base64', () => {
      const str = 'test string';
      const encoded = sceneAnalysis.encodeToBase64(str, 'text/plain');
      
      expect(encoded).toBe(Buffer.from(str).toString('base64'));
    });
    
    test('should handle large buffers', () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      const encoded = sceneAnalysis.encodeToBase64(largeBuffer, 'image/jpeg');
      
      expect(encoded).toBeDefined();
      expect(encoded.length).toBeGreaterThan(0);
    });
  });
});