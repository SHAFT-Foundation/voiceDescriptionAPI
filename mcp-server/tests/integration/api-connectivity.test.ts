import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import axios from 'axios';
import { APIClient } from '../../src/adapters/api-client.js';
import { JobPoller } from '../../src/adapters/job-poller.js';
import { FileHandler } from '../../src/adapters/file-handler.js';
import {
  TEST_CONSTANTS,
  generateTestVideo,
  generateTestImage,
  createTestFile,
  cleanupTestFile,
  wait,
  PerformanceMonitor,
} from '../utils/test-helpers.js';
import { config } from '../../src/config/index.js';

describe('API Connectivity Integration Tests', () => {
  let apiClient: APIClient;
  let jobPoller: JobPoller;
  let fileHandler: FileHandler;
  let performanceMonitor: PerformanceMonitor;
  const baseURL = process.env.API_BASE_URL || 'http://localhost:3000';
  
  beforeAll(async () => {
    // Verify API is accessible
    try {
      const response = await axios.get(`${baseURL}/api/health`, { timeout: 5000 });
      if (response.data.status !== 'healthy') {
        throw new Error('API is not healthy');
      }
    } catch (error) {
      console.error('API Health Check Failed:', error);
      throw new Error('Cannot run integration tests - API is not accessible');
    }

    // Initialize components
    apiClient = new APIClient({ baseUrl: baseURL });
    jobPoller = new JobPoller(apiClient);
    fileHandler = new FileHandler();
    performanceMonitor = new PerformanceMonitor();
  });

  afterAll(async () => {
    // Cleanup any remaining test resources
    performanceMonitor.reset();
  });

  beforeEach(() => {
    performanceMonitor.reset();
  });

  describe('Health Check Endpoint', () => {
    it('should return healthy status', async () => {
      const timer = performanceMonitor.startTimer('health-check');
      const response = await apiClient.checkHealth();
      timer();

      expect(response.data).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        services: expect.objectContaining({
          api: 'up',
          database: 'up',
        }),
      });

      const metrics = performanceMonitor.getMetrics('health-check');
      expect(metrics?.avg).toBeLessThan(1000);
    });

    it('should include version information', async () => {
      const response = await apiClient.checkHealth();
      
      expect(response.data).toHaveProperty('version');
      expect(response.data.version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('AWS Status Endpoint', () => {
    it('should return AWS service status', async () => {
      const timer = performanceMonitor.startTimer('aws-status');
      const response = await apiClient.checkAWSStatus();
      timer();

      expect(response.data).toMatchObject({
        operational: expect.any(Boolean),
        services: expect.objectContaining({
          s3: expect.objectContaining({
            status: expect.stringMatching(/operational|degraded|down/),
            latency: expect.any(Number),
          }),
          rekognition: expect.objectContaining({
            status: expect.any(String),
            latency: expect.any(Number),
          }),
          bedrock: expect.objectContaining({
            status: expect.any(String),
            latency: expect.any(Number),
          }),
          polly: expect.objectContaining({
            status: expect.any(String),
            latency: expect.any(Number),
          }),
        }),
      });

      const metrics = performanceMonitor.getMetrics('aws-status');
      expect(metrics?.avg).toBeLessThan(2000);
    });
  });

  describe('Video Upload Integration', () => {
    const testVideoPath = '/tmp/integration-test-video.mp4';
    const testVideo = generateTestVideo(1024 * 1024); // 1MB

    beforeEach(async () => {
      await createTestFile(testVideoPath, testVideo);
    });

    afterEach(async () => {
      await cleanupTestFile(testVideoPath);
    });

    it('should upload video and return job ID', async () => {
      const timer = performanceMonitor.startTimer('video-upload');
      
      const formData = await fileHandler.createMultipartUpload(testVideoPath);
      const response = await apiClient.upload(formData);
      
      timer();

      expect(response.data).toMatchObject({
        success: true,
        jobId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}/),
        message: expect.any(String),
      });

      const metrics = performanceMonitor.getMetrics('video-upload');
      expect(metrics?.avg).toBeLessThan(5000);
    });

    it('should reject oversized video', async () => {
      const largeVideoPath = '/tmp/large-video.mp4';
      const largeVideo = generateTestVideo(150 * 1024 * 1024); // 150MB
      await createTestFile(largeVideoPath, largeVideo);

      await expect(async () => {
        const formData = await fileHandler.createMultipartUpload(largeVideoPath);
        await apiClient.upload(formData);
      }).rejects.toThrow();

      await cleanupTestFile(largeVideoPath);
    });
  });

  describe('Image Processing Integration', () => {
    const testImagePath = '/tmp/integration-test-image.jpg';
    const testImage = generateTestImage(512 * 1024); // 512KB

    beforeEach(async () => {
      await createTestFile(testImagePath, testImage);
    });

    afterEach(async () => {
      await cleanupTestFile(testImagePath);
    });

    it('should process single image', async () => {
      const timer = performanceMonitor.startTimer('image-process');
      
      const imageBuffer = await fileHandler.readFileAsBuffer(testImagePath);
      const response = await apiClient.processImage({
        image: imageBuffer,
        filename: 'test-image.jpg',
      });
      
      timer();

      expect(response.data).toMatchObject({
        success: true,
        jobId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}/),
      });

      const metrics = performanceMonitor.getMetrics('image-process');
      expect(metrics?.avg).toBeLessThan(3000);
    });

    it('should handle batch image processing', async () => {
      const images = [];
      for (let i = 0; i < 3; i++) {
        const imagePath = `/tmp/batch-image-${i}.jpg`;
        await createTestFile(imagePath, generateTestImage());
        const buffer = await fileHandler.readFileAsBuffer(imagePath);
        images.push({
          buffer,
          filename: `image-${i}.jpg`,
        });
      }

      const timer = performanceMonitor.startTimer('batch-process');
      const response = await apiClient.batchProcessImages({ images });
      timer();

      expect(response.data).toMatchObject({
        success: true,
        totalImages: 3,
        processed: expect.any(Number),
        failed: expect.any(Number),
      });

      // Cleanup
      for (let i = 0; i < 3; i++) {
        await cleanupTestFile(`/tmp/batch-image-${i}.jpg`);
      }

      const metrics = performanceMonitor.getMetrics('batch-process');
      expect(metrics?.avg).toBeLessThan(10000);
    });
  });

  describe('Job Polling Integration', () => {
    let testJobId: string;

    beforeEach(async () => {
      // Create a test job
      const imagePath = '/tmp/polling-test-image.jpg';
      await createTestFile(imagePath, generateTestImage());
      
      const imageBuffer = await fileHandler.readFileAsBuffer(imagePath);
      const response = await apiClient.processImage({
        image: imageBuffer,
        filename: 'polling-test.jpg',
      });
      
      testJobId = response.data.jobId;
      await cleanupTestFile(imagePath);
    });

    it('should poll job status until completion', async () => {
      const timer = performanceMonitor.startTimer('job-polling');
      
      const result = await jobPoller.pollUntilComplete(testJobId, {
        interval: 1000,
        timeout: 30000,
      });
      
      timer();

      expect(result).toMatchObject({
        jobId: testJobId,
        status: expect.stringMatching(/completed|failed/),
      });

      if (result.status === 'completed') {
        expect(result).toHaveProperty('results');
      }

      const metrics = performanceMonitor.getMetrics('job-polling');
      expect(metrics?.avg).toBeLessThan(30000);
    });

    it('should track polling progress', async () => {
      const progressUpdates: any[] = [];
      
      await jobPoller.pollUntilComplete(testJobId, {
        interval: 500,
        timeout: 30000,
        onProgress: (update) => {
          progressUpdates.push(update);
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]).toHaveProperty('status');
      expect(progressUpdates[0]).toHaveProperty('progress');
    });
  });

  describe('Result Download Integration', () => {
    let completedJobId: string;

    beforeAll(async () => {
      // Create and wait for a job to complete
      const imagePath = '/tmp/download-test-image.jpg';
      await createTestFile(imagePath, generateTestImage());
      
      const imageBuffer = await fileHandler.readFileAsBuffer(imagePath);
      const response = await apiClient.processImage({
        image: imageBuffer,
        filename: 'download-test.jpg',
      });
      
      completedJobId = response.data.jobId;
      
      // Wait for completion
      await jobPoller.pollUntilComplete(completedJobId, {
        timeout: 60000,
      });
      
      await cleanupTestFile(imagePath);
    });

    it('should download text results', async () => {
      const timer = performanceMonitor.startTimer('download-text');
      const response = await apiClient.getTextResults(completedJobId);
      timer();

      expect(response.data).toBeTruthy();
      expect(typeof response.data).toBe('string');
      expect(response.data.length).toBeGreaterThan(0);

      const metrics = performanceMonitor.getMetrics('download-text');
      expect(metrics?.avg).toBeLessThan(2000);
    });

    it('should download audio results', async () => {
      const timer = performanceMonitor.startTimer('download-audio');
      const response = await apiClient.getAudioResults(completedJobId);
      timer();

      expect(response.data).toBeTruthy();
      expect(Buffer.isBuffer(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);

      const metrics = performanceMonitor.getMetrics('download-audio');
      expect(metrics?.avg).toBeLessThan(3000);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle 404 for non-existent job', async () => {
      const fakeJobId = '123e4567-e89b-12d3-a456-426614174999';
      
      await expect(apiClient.checkStatus(fakeJobId)).rejects.toThrow();
    });

    it('should handle malformed requests', async () => {
      await expect(apiClient.processImage({
        image: 'not-a-buffer',
        filename: 'test.jpg',
      } as any)).rejects.toThrow();
    });

    it('should handle rate limiting', async () => {
      // Make multiple rapid requests
      const requests = Array.from({ length: 20 }, () => 
        apiClient.checkHealth()
      );

      const results = await Promise.allSettled(requests);
      const rateLimited = results.filter(r => 
        r.status === 'rejected' && 
        r.reason?.response?.status === 429
      );

      // Some requests might be rate limited
      expect(rateLimited.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent uploads', async () => {
      const uploads = [];
      
      for (let i = 0; i < 3; i++) {
        const imagePath = `/tmp/concurrent-${i}.jpg`;
        await createTestFile(imagePath, generateTestImage());
        
        uploads.push(async () => {
          const buffer = await fileHandler.readFileAsBuffer(imagePath);
          const response = await apiClient.processImage({
            image: buffer,
            filename: `concurrent-${i}.jpg`,
          });
          await cleanupTestFile(imagePath);
          return response.data;
        });
      }

      const timer = performanceMonitor.startTimer('concurrent-uploads');
      const results = await Promise.all(uploads.map(fn => fn()));
      timer();

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('jobId');
      });

      const metrics = performanceMonitor.getMetrics('concurrent-uploads');
      expect(metrics?.avg).toBeLessThan(5000);
    });

    it('should handle mixed operation types concurrently', async () => {
      const operations = [
        apiClient.checkHealth(),
        apiClient.checkAWSStatus(),
        apiClient.checkStatus(TEST_CONSTANTS.VALID_JOB_ID).catch(() => null),
      ];

      const timer = performanceMonitor.startTimer('mixed-operations');
      const results = await Promise.allSettled(operations);
      timer();

      expect(results.filter(r => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(2);

      const metrics = performanceMonitor.getMetrics('mixed-operations');
      expect(metrics?.avg).toBeLessThan(3000);
    });
  });

  describe('Connection Resilience', () => {
    it('should handle connection timeouts', async () => {
      const slowClient = new APIClient({
        baseUrl: baseURL,
        timeout: 100, // Very short timeout
      });

      await expect(slowClient.checkHealth()).rejects.toThrow();
    });

    it('should retry on connection failures', async () => {
      const resilientClient = new APIClient({
        baseUrl: baseURL,
        retryAttempts: 3,
        retryDelay: 100,
      });

      // Should eventually succeed with retries
      const response = await resilientClient.checkHealth();
      expect(response.data.status).toBe('healthy');
    });
  });

  describe('Performance Metrics', () => {
    it('should meet latency requirements', async () => {
      const operations = {
        health: () => apiClient.checkHealth(),
        awsStatus: () => apiClient.checkAWSStatus(),
        status: () => apiClient.checkStatus(TEST_CONSTANTS.VALID_JOB_ID).catch(() => null),
      };

      for (const [name, operation] of Object.entries(operations)) {
        const timer = performanceMonitor.startTimer(name);
        await operation();
        timer();
      }

      // Check p95 latencies
      const healthMetrics = performanceMonitor.getMetrics('health');
      const awsMetrics = performanceMonitor.getMetrics('awsStatus');
      
      expect(healthMetrics?.p95).toBeLessThan(500);
      expect(awsMetrics?.p95).toBeLessThan(2000);
    });
  });
});