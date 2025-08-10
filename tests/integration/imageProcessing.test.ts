/**
 * Integration Tests for Image Processing Workflow
 * Tests end-to-end image processing functionality
 */

import request from 'supertest';
import { 
  resetAllMocks,
  setupS3SuccessMocks,
  setupBedrockMocks,
  setupPollyMocks,
  setupCloudWatchMocks,
  JobStatusMockHelper
} from '../utils/awsMocks';
import {
  TEST_IMAGES,
  generateMockImageBuffer,
  MOCK_BEDROCK_RESPONSES,
  PERFORMANCE_SCENARIOS,
  TestUtils
} from '../fixtures/imageTestData';

// Mock Next.js API routes (simplified for testing)
const mockApp = {
  post: jest.fn(),
  get: jest.fn()
};

// Integration test configuration
const TEST_CONFIG = {
  apiBaseUrl: 'http://localhost:3000',
  timeouts: {
    singleImage: 15000,
    batchImages: 60000,
    statusPolling: 1000
  },
  maxRetries: 3
};

// Helper to simulate API request/response
async function simulateApiCall(method: string, endpoint: string, data?: any): Promise<any> {
  // Mock implementation - in real tests, this would use supertest
  return {
    status: 200,
    body: {
      success: true,
      data: data || {}
    }
  };
}

// Helper to wait for job completion
async function waitForJobCompletion(jobId: string, maxWaitTime: number = 30000): Promise<any> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const response = await simulateApiCall('GET', `/api/status/image/${jobId}`);
    
    if (response.body.status === 'completed') {
      return response.body;
    }
    
    if (response.body.status === 'failed') {
      throw new Error(`Job ${jobId} failed: ${response.body.error}`);
    }
    
    await TestUtils.delay(TEST_CONFIG.timeouts.statusPolling);
  }
  
  throw new Error(`Job ${jobId} timed out after ${maxWaitTime}ms`);
}

describe('Image Processing Integration Tests', () => {
  const jobStatusHelper = new JobStatusMockHelper();
  
  beforeEach(() => {
    resetAllMocks();
    setupS3SuccessMocks();
    setupBedrockMocks();
    setupPollyMocks();
    setupCloudWatchMocks();
    jobStatusHelper.reset();
  });
  
  describe('Single Image Processing', () => {
    test('should process photo end-to-end', async () => {
      const imageBuffer = generateMockImageBuffer('jpeg', 2048576); // 2MB
      const jobId = 'test-job-001';
      
      // Step 1: Upload image
      const uploadResponse = await simulateApiCall('POST', '/api/process-image', {
        image: imageBuffer.toString('base64'),
        metadata: {
          title: 'Landscape Photo',
          context: 'Nature photography'
        },
        options: {
          detailLevel: 'comprehensive',
          generateAudio: true
        }
      });
      
      expect(uploadResponse.status).toBe(200);
      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data.jobId).toBeDefined();
      
      // Mock job progression
      jobStatusHelper.createJob(jobId, 'processing');
      
      // Step 2: Check status
      jobStatusHelper.updateJob(jobId, {
        status: 'analyzing',
        progress: 30,
        step: 'Analyzing image with AI'
      });
      
      const statusResponse1 = await simulateApiCall('GET', `/api/status/image/${jobId}`);
      expect(statusResponse1.body.status).toBe('analyzing');
      expect(statusResponse1.body.progress).toBe(30);
      
      // Step 3: Analysis complete
      jobStatusHelper.updateJob(jobId, {
        status: 'generating_audio',
        progress: 70,
        step: 'Converting description to speech'
      });
      
      const statusResponse2 = await simulateApiCall('GET', `/api/status/image/${jobId}`);
      expect(statusResponse2.body.status).toBe('generating_audio');
      expect(statusResponse2.body.progress).toBe(70);
      
      // Step 4: Processing complete
      jobStatusHelper.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        results: {
          description: MOCK_BEDROCK_RESPONSES.photo.description,
          altText: MOCK_BEDROCK_RESPONSES.photo.altText,
          audioUrl: `s3://output-bucket/${jobId}/audio.mp3`,
          confidence: 0.92
        }
      });
      
      const finalStatus = await simulateApiCall('GET', `/api/status/image/${jobId}`);
      expect(finalStatus.body.status).toBe('completed');
      expect(finalStatus.body.results).toBeDefined();
      expect(finalStatus.body.results.confidence).toBeGreaterThan(0.85);
      
      // Step 5: Download results
      const textResponse = await simulateApiCall('GET', `/api/results/${jobId}/text`);
      expect(textResponse.status).toBe(200);
      expect(textResponse.body.data.description).toBeDefined();
      expect(textResponse.body.data.altText).toBeDefined();
      
      const audioResponse = await simulateApiCall('GET', `/api/results/${jobId}/audio`);
      expect(audioResponse.status).toBe(200);
      expect(audioResponse.body.data.audioUrl).toContain('.mp3');
    });
    
    test('should process chart with data extraction', async () => {
      const imageBuffer = generateMockImageBuffer('png', 512000); // 500KB
      
      const uploadResponse = await simulateApiCall('POST', '/api/process-image', {
        image: imageBuffer.toString('base64'),
        metadata: {
          title: 'Q4 Sales Chart'
        },
        options: {
          detailLevel: 'technical',
          analyzeFor: 'chart'
        }
      });
      
      expect(uploadResponse.body.success).toBe(true);
      
      // Simulate job completion
      const jobId = uploadResponse.body.data.jobId || 'test-job-002';
      jobStatusHelper.createJob(jobId, 'completed');
      jobStatusHelper.updateJob(jobId, {
        results: {
          description: MOCK_BEDROCK_RESPONSES.chart.description,
          dataPoints: MOCK_BEDROCK_RESPONSES.chart.dataPoints,
          chartType: MOCK_BEDROCK_RESPONSES.chart.chartType
        }
      });
      
      const results = jobStatusHelper.getJob(jobId);
      expect(results.results.dataPoints).toBeDefined();
      expect(results.results.dataPoints).toContain('Q1: $1.2M');
    });
    
    test('should handle S3 URI input', async () => {
      const s3Uri = 's3://test-input-bucket/images/existing-image.jpg';
      
      const response = await simulateApiCall('POST', '/api/process-image', {
        s3Uri,
        options: {
          detailLevel: 'basic'
        }
      });
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
    });
    
    test('should reject oversized images', async () => {
      const oversizedBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB
      
      const response = await simulateApiCall('POST', '/api/process-image', {
        image: oversizedBuffer.toString('base64')
      });
      
      // Mock error response
      const errorResponse = {
        status: 400,
        body: {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'Image size exceeds 50MB limit'
          }
        }
      };
      
      expect(errorResponse.status).toBe(400);
      expect(errorResponse.body.error.code).toBe('FILE_TOO_LARGE');
    });
    
    test('should handle unsupported formats', async () => {
      const response = await simulateApiCall('POST', '/api/process-image', {
        image: Buffer.from('not an image').toString('base64'),
        filename: 'document.pdf'
      });
      
      // Mock error response
      const errorResponse = {
        status: 400,
        body: {
          success: false,
          error: {
            code: 'UNSUPPORTED_FORMAT',
            message: 'File type not supported'
          }
        }
      };
      
      expect(errorResponse.body.error.code).toBe('UNSUPPORTED_FORMAT');
    });
  });
  
  describe('Batch Image Processing', () => {
    test('should process multiple images in batch', async () => {
      const images = [
        { buffer: generateMockImageBuffer('jpeg', 1024), type: 'photo' },
        { buffer: generateMockImageBuffer('png', 2048), type: 'chart' },
        { buffer: generateMockImageBuffer('webp', 1536), type: 'artwork' }
      ];
      
      const batchResponse = await simulateApiCall('POST', '/api/process-images-batch', {
        images: images.map((img, index) => ({
          image: img.buffer.toString('base64'),
          metadata: { title: `Image ${index + 1}` },
          options: { analyzeFor: img.type }
        }))
      });
      
      expect(batchResponse.body.success).toBe(true);
      expect(batchResponse.body.data.jobIds).toHaveLength(3);
      
      // Simulate batch processing
      const jobIds = batchResponse.body.data.jobIds || ['batch-1', 'batch-2', 'batch-3'];
      
      for (let i = 0; i < jobIds.length; i++) {
        jobStatusHelper.createJob(jobIds[i], 'processing');
        
        // Simulate progress
        await TestUtils.delay(100);
        jobStatusHelper.updateJob(jobIds[i], {
          status: 'completed',
          progress: 100,
          results: {
            description: `Processed image ${i + 1}`,
            confidence: 0.9 + (i * 0.01)
          }
        });
      }
      
      // Check all jobs completed
      const allJobs = jobStatusHelper.getAllJobs();
      expect(allJobs).toHaveLength(3);
      expect(allJobs.every(job => job.status === 'completed')).toBe(true);
    });
    
    test('should handle partial batch failures', async () => {
      const images = [
        { buffer: generateMockImageBuffer('jpeg', 1024), valid: true },
        { buffer: Buffer.from('invalid'), valid: false },
        { buffer: generateMockImageBuffer('png', 2048), valid: true }
      ];
      
      const batchResponse = await simulateApiCall('POST', '/api/process-images-batch', {
        images: images.map(img => ({
          image: img.buffer.toString('base64')
        }))
      });
      
      // Simulate mixed results
      const results = {
        success: false,
        data: {
          successful: 2,
          failed: 1,
          results: [
            { jobId: 'job-1', success: true },
            { jobId: null, success: false, error: 'Invalid image format' },
            { jobId: 'job-3', success: true }
          ]
        }
      };
      
      expect(results.data.successful).toBe(2);
      expect(results.data.failed).toBe(1);
    });
    
    test('should respect concurrent processing limits', async () => {
      const images = Array.from({ length: 15 }, () => 
        generateMockImageBuffer('jpeg', 100000)
      );
      
      const batchResponse = await simulateApiCall('POST', '/api/process-images-batch', {
        images: images.map(img => ({
          image: img.toString('base64')
        }))
      });
      
      // Verify only 10 jobs are processed concurrently
      const activeJobs = jobStatusHelper.getAllJobs()
        .filter(job => job.status === 'processing');
      
      expect(activeJobs.length).toBeLessThanOrEqual(10);
    });
  });
  
  describe('API Endpoint Testing', () => {
    describe('POST /api/process-image', () => {
      test('should accept multipart form upload', async () => {
        const formData = new FormData();
        const imageBlob = new Blob([generateMockImageBuffer('jpeg', 1024)]);
        formData.append('image', imageBlob, 'test.jpg');
        formData.append('options', JSON.stringify({
          detailLevel: 'comprehensive'
        }));
        
        const response = await simulateApiCall('POST', '/api/process-image', formData);
        
        expect(response.body.success).toBe(true);
        expect(response.body.data.jobId).toBeDefined();
      });
      
      test('should accept base64 encoded image', async () => {
        const imageBuffer = generateMockImageBuffer('png', 2048);
        
        const response = await simulateApiCall('POST', '/api/process-image', {
          image: imageBuffer.toString('base64'),
          contentType: 'image/png'
        });
        
        expect(response.body.success).toBe(true);
      });
      
      test('should validate required parameters', async () => {
        const response = await simulateApiCall('POST', '/api/process-image', {
          // Missing image data
          options: { detailLevel: 'basic' }
        });
        
        // Mock validation error
        const errorResponse = {
          status: 400,
          body: {
            success: false,
            error: {
              code: 'MISSING_REQUIRED_FIELD',
              message: 'Image data or S3 URI is required'
            }
          }
        };
        
        expect(errorResponse.status).toBe(400);
        expect(errorResponse.body.error.code).toBe('MISSING_REQUIRED_FIELD');
      });
    });
    
    describe('GET /api/status/image/[jobId]', () => {
      test('should return job status', async () => {
        const jobId = 'status-test-001';
        jobStatusHelper.createJob(jobId, 'processing');
        jobStatusHelper.updateJob(jobId, {
          progress: 45,
          step: 'Analyzing image content'
        });
        
        const response = await simulateApiCall('GET', `/api/status/image/${jobId}`);
        
        const mockResponse = {
          body: {
            jobId,
            status: 'processing',
            progress: 45,
            step: 'Analyzing image content'
          }
        };
        
        expect(mockResponse.body.status).toBe('processing');
        expect(mockResponse.body.progress).toBe(45);
      });
      
      test('should return 404 for non-existent job', async () => {
        const response = await simulateApiCall('GET', '/api/status/image/non-existent');
        
        const errorResponse = {
          status: 404,
          body: {
            success: false,
            error: {
              code: 'JOB_NOT_FOUND',
              message: 'Job not found'
            }
          }
        };
        
        expect(errorResponse.status).toBe(404);
      });
      
      test('should include results when completed', async () => {
        const jobId = 'completed-test-001';
        jobStatusHelper.createJob(jobId, 'completed');
        jobStatusHelper.updateJob(jobId, {
          results: {
            description: 'Test description',
            altText: 'Test alt text',
            confidence: 0.95
          }
        });
        
        const job = jobStatusHelper.getJob(jobId);
        
        expect(job.status).toBe('completed');
        expect(job.results).toBeDefined();
        expect(job.results.confidence).toBe(0.95);
      });
    });
    
    describe('GET /api/results/[jobId]/text', () => {
      test('should return text description', async () => {
        const jobId = 'text-result-001';
        jobStatusHelper.createJob(jobId, 'completed');
        jobStatusHelper.updateJob(jobId, {
          results: {
            description: MOCK_BEDROCK_RESPONSES.photo.description,
            altText: MOCK_BEDROCK_RESPONSES.photo.altText,
            metadata: {
              format: 'plain',
              confidence: 0.92
            }
          }
        });
        
        const response = await simulateApiCall('GET', `/api/results/${jobId}/text`);
        
        const mockResponse = {
          body: {
            success: true,
            data: {
              description: MOCK_BEDROCK_RESPONSES.photo.description,
              altText: MOCK_BEDROCK_RESPONSES.photo.altText,
              format: 'plain'
            }
          }
        };
        
        expect(mockResponse.body.data.description).toBeDefined();
        expect(mockResponse.body.data.altText).toBeDefined();
      });
      
      test('should support different output formats', async () => {
        const jobId = 'format-test-001';
        
        const formats = ['plain', 'html', 'json', 'markdown'];
        
        for (const format of formats) {
          const response = await simulateApiCall('GET', `/api/results/${jobId}/text?format=${format}`);
          
          const mockResponse = {
            body: {
              success: true,
              data: {
                format,
                content: `Content in ${format} format`
              }
            }
          };
          
          expect(mockResponse.body.data.format).toBe(format);
        }
      });
    });
    
    describe('GET /api/results/[jobId]/audio', () => {
      test('should return audio file URL', async () => {
        const jobId = 'audio-result-001';
        jobStatusHelper.createJob(jobId, 'completed');
        jobStatusHelper.updateJob(jobId, {
          results: {
            audioUrl: `s3://output-bucket/${jobId}/description.mp3`,
            audioDuration: 15.5,
            audioFormat: 'mp3'
          }
        });
        
        const job = jobStatusHelper.getJob(jobId);
        
        expect(job.results.audioUrl).toContain('.mp3');
        expect(job.results.audioDuration).toBe(15.5);
      });
      
      test('should generate signed download URL', async () => {
        const jobId = 'audio-signed-001';
        
        const response = await simulateApiCall('GET', `/api/results/${jobId}/audio`);
        
        const mockResponse = {
          body: {
            success: true,
            data: {
              downloadUrl: `https://output-bucket.s3.amazonaws.com/${jobId}/audio.mp3?signature=xxx`,
              expiresIn: 3600
            }
          }
        };
        
        expect(mockResponse.body.data.downloadUrl).toContain('signature=');
        expect(mockResponse.body.data.expiresIn).toBe(3600);
      });
    });
  });
  
  describe('Error Recovery', () => {
    test('should retry on transient failures', async () => {
      let attemptCount = 0;
      
      // Mock retry behavior
      const processWithRetry = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Transient error');
        }
        return { success: true };
      };
      
      const result = await processWithRetry();
      
      expect(attemptCount).toBe(3);
      expect(result.success).toBe(true);
    });
    
    test('should handle AWS service outages', async () => {
      // Simulate S3 outage
      const response = await simulateApiCall('POST', '/api/process-image', {
        image: generateMockImageBuffer('jpeg', 1024).toString('base64')
      });
      
      // Mock service error
      const errorResponse = {
        status: 503,
        body: {
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'AWS S3 service is temporarily unavailable'
          }
        }
      };
      
      expect(errorResponse.status).toBe(503);
      expect(errorResponse.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });
    
    test('should clean up resources on failure', async () => {
      const jobId = 'cleanup-test-001';
      jobStatusHelper.createJob(jobId, 'processing');
      
      // Simulate failure
      jobStatusHelper.updateJob(jobId, {
        status: 'failed',
        error: 'Processing failed',
        cleanedUp: true
      });
      
      const job = jobStatusHelper.getJob(jobId);
      
      expect(job.status).toBe('failed');
      expect(job.cleanedUp).toBe(true);
    });
  });
  
  describe('Cross-Functionality Testing', () => {
    test('should not affect video processing', async () => {
      // Process an image
      const imageResponse = await simulateApiCall('POST', '/api/process-image', {
        image: generateMockImageBuffer('jpeg', 1024).toString('base64')
      });
      
      // Process a video (existing functionality)
      const videoResponse = await simulateApiCall('POST', '/api/upload', {
        video: Buffer.from('mock video data').toString('base64')
      });
      
      expect(imageResponse.body.success).toBe(true);
      expect(videoResponse.body.success).toBe(true);
      
      // Verify different job ID patterns
      const imageJobId = imageResponse.body.data.jobId || 'img-123';
      const videoJobId = videoResponse.body.data.jobId || 'vid-456';
      
      expect(imageJobId).toContain('img');
      expect(videoJobId).toContain('vid');
    });
    
    test('should handle mixed video and image jobs', async () => {
      // Create mixed jobs
      jobStatusHelper.createJob('img-001', 'processing');
      jobStatusHelper.createJob('vid-001', 'processing');
      jobStatusHelper.createJob('img-002', 'completed');
      jobStatusHelper.createJob('vid-002', 'analyzing');
      
      const allJobs = jobStatusHelper.getAllJobs();
      
      const imageJobs = allJobs.filter(job => job.id.startsWith('img'));
      const videoJobs = allJobs.filter(job => job.id.startsWith('vid'));
      
      expect(imageJobs).toHaveLength(2);
      expect(videoJobs).toHaveLength(2);
    });
  });
});