import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ToolRegistry } from '../../src/tools/registry.js';
import { APIClient } from '../../src/adapters/api-client.js';
import { FileHandler } from '../../src/adapters/file-handler.js';
import { JobPoller } from '../../src/adapters/job-poller.js';
import {
  generateTestVideo,
  generateTestImage,
  generateBatchImages,
  createTestFile,
  cleanupTestFile,
  wait,
  PerformanceMonitor,
  TestCleanup,
} from '../utils/test-helpers.js';

describe('End-to-End Workflow Tests', () => {
  let toolRegistry: ToolRegistry;
  let apiClient: APIClient;
  let fileHandler: FileHandler;
  let jobPoller: JobPoller;
  let performanceMonitor: PerformanceMonitor;
  let cleanup: TestCleanup;
  const baseURL = process.env.API_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    // Initialize components
    apiClient = new APIClient({ baseUrl: baseURL });
    fileHandler = new FileHandler();
    jobPoller = new JobPoller(apiClient);
    performanceMonitor = new PerformanceMonitor();
    cleanup = new TestCleanup();

    // Initialize tool registry
    toolRegistry = new ToolRegistry({
      apiClient,
      fileHandler,
      jobPoller,
    });

    // Verify API is accessible
    const health = await apiClient.checkHealth();
    if (health.data.status !== 'healthy') {
      throw new Error('API is not healthy for E2E tests');
    }
  });

  afterAll(async () => {
    await cleanup.execute();
  });

  beforeEach(() => {
    performanceMonitor.reset();
  });

  describe('Complete Video Processing Workflow', () => {
    it('should process video from upload to audio download', async () => {
      const workflowTimer = performanceMonitor.startTimer('video-workflow');
      const videoPath = '/tmp/e2e-video.mp4';
      const video = generateTestVideo(5 * 1024 * 1024); // 5MB
      
      // Step 1: Create test video
      await createTestFile(videoPath, video);
      cleanup.add(() => cleanupTestFile(videoPath));

      // Step 2: Upload video
      const uploadTimer = performanceMonitor.startTimer('upload');
      const uploadTool = toolRegistry.get('voice_description_upload_video');
      const uploadResult = await uploadTool.execute({ filePath: videoPath });
      uploadTimer();
      
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.jobId).toBeTruthy();
      const jobId = uploadResult.jobId;

      // Step 3: Monitor processing status
      const processingTimer = performanceMonitor.startTimer('processing');
      let status = 'processing';
      let attempts = 0;
      const maxAttempts = 60; // 60 * 2 seconds = 2 minutes max
      
      while (status === 'processing' && attempts < maxAttempts) {
        const statusTool = toolRegistry.get('voice_description_check_status');
        const statusResult = await statusTool.execute({ jobId });
        status = statusResult.status;
        
        if (status === 'processing') {
          await wait(2000);
          attempts++;
        }
      }
      processingTimer();
      
      expect(status).toBe('completed');

      // Step 4: Download text results
      const textTimer = performanceMonitor.startTimer('download-text');
      const textTool = toolRegistry.get('voice_description_download_results');
      const textResult = await textTool.execute({
        jobId,
        resultType: 'text',
      });
      textTimer();
      
      expect(textResult.success).toBe(true);
      expect(textResult.content).toBeTruthy();
      expect(textResult.content.length).toBeGreaterThan(0);

      // Step 5: Download audio results
      const audioTimer = performanceMonitor.startTimer('download-audio');
      const audioResult = await textTool.execute({
        jobId,
        resultType: 'audio',
      });
      audioTimer();
      
      expect(audioResult.success).toBe(true);
      expect(audioResult.content).toBeTruthy();
      expect(Buffer.isBuffer(audioResult.content)).toBe(true);

      workflowTimer();

      // Verify performance metrics
      const metrics = {
        upload: performanceMonitor.getMetrics('upload'),
        processing: performanceMonitor.getMetrics('processing'),
        downloadText: performanceMonitor.getMetrics('download-text'),
        downloadAudio: performanceMonitor.getMetrics('download-audio'),
        total: performanceMonitor.getMetrics('video-workflow'),
      };

      expect(metrics.upload?.avg).toBeLessThan(10000);
      expect(metrics.downloadText?.avg).toBeLessThan(2000);
      expect(metrics.downloadAudio?.avg).toBeLessThan(3000);
      expect(metrics.total?.avg).toBeLessThan(180000); // 3 minutes
    });
  });

  describe('Complete Image Processing Workflow', () => {
    it('should process single image with full lifecycle', async () => {
      const workflowTimer = performanceMonitor.startTimer('image-workflow');
      const imagePath = '/tmp/e2e-image.jpg';
      const image = generateTestImage(1024 * 1024); // 1MB
      
      // Step 1: Create test image
      await createTestFile(imagePath, image);
      cleanup.add(() => cleanupTestFile(imagePath));

      // Step 2: Process image
      const processTimer = performanceMonitor.startTimer('process');
      const processTool = toolRegistry.get('voice_description_process_image');
      const processResult = await processTool.execute({
        imagePath,
        waitForCompletion: true,
        outputFormat: 'both',
      });
      processTimer();
      
      expect(processResult.success).toBe(true);
      expect(processResult.status).toBe('completed');
      expect(processResult.results).toBeTruthy();
      expect(processResult.results.textUrl).toBeTruthy();
      expect(processResult.results.audioUrl).toBeTruthy();

      // Step 3: Verify results are accessible
      const jobId = processResult.jobId;
      const downloadTool = toolRegistry.get('voice_description_download_results');
      
      const textResult = await downloadTool.execute({
        jobId,
        resultType: 'text',
      });
      
      expect(textResult.success).toBe(true);
      expect(textResult.content).toContain('Scene');

      workflowTimer();

      // Verify performance
      const metrics = performanceMonitor.getMetrics('image-workflow');
      expect(metrics?.avg).toBeLessThan(60000); // 1 minute
    });
  });

  describe('Batch Image Processing Workflow', () => {
    it('should process multiple images in batch', async () => {
      const workflowTimer = performanceMonitor.startTimer('batch-workflow');
      const batchImages = generateBatchImages(5);
      const imagePaths: string[] = [];
      
      // Step 1: Create test images
      for (let i = 0; i < batchImages.length; i++) {
        const path = `/tmp/e2e-batch-${i}.jpg`;
        await createTestFile(path, batchImages[i].content);
        imagePaths.push(path);
        cleanup.add(() => cleanupTestFile(path));
      }

      // Step 2: Batch process images
      const batchTimer = performanceMonitor.startTimer('batch-process');
      const batchTool = toolRegistry.get('voice_description_batch_images');
      const batchResult = await batchTool.execute({
        imagePaths,
        parallel: true,
        maxConcurrent: 3,
        continueOnError: true,
      });
      batchTimer();
      
      expect(batchResult.success).toBe(true);
      expect(batchResult.totalImages).toBe(5);
      expect(batchResult.processed).toBeGreaterThanOrEqual(4); // Allow 1 failure
      expect(batchResult.results).toHaveLength(5);

      // Step 3: Verify individual results
      const successfulResults = batchResult.results.filter(r => r.status === 'completed');
      expect(successfulResults.length).toBeGreaterThanOrEqual(4);
      
      for (const result of successfulResults) {
        expect(result.description).toBeTruthy();
        if (result.audioUrl) {
          expect(result.audioUrl).toContain('http');
        }
      }

      workflowTimer();

      // Verify performance
      const metrics = {
        batch: performanceMonitor.getMetrics('batch-process'),
        total: performanceMonitor.getMetrics('batch-workflow'),
      };

      expect(metrics.batch?.avg).toBeLessThan(90000); // 1.5 minutes
      expect(metrics.total?.avg).toBeLessThan(120000); // 2 minutes
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle and recover from processing failures', async () => {
      const workflowTimer = performanceMonitor.startTimer('error-recovery');
      
      // Step 1: Attempt to process corrupted image
      const corruptedPath = '/tmp/e2e-corrupted.jpg';
      await createTestFile(corruptedPath, Buffer.from('corrupted data'));
      cleanup.add(() => cleanupTestFile(corruptedPath));

      const processTool = toolRegistry.get('voice_description_process_image');
      
      // Step 2: First attempt should fail gracefully
      let result = await processTool.execute({
        imagePath: corruptedPath,
        waitForCompletion: false,
      }).catch(error => ({ success: false, error: error.message }));
      
      expect(result.success).toBe(false);

      // Step 3: Create valid image and retry
      const validPath = '/tmp/e2e-valid.jpg';
      await createTestFile(validPath, generateTestImage());
      cleanup.add(() => cleanupTestFile(validPath));

      result = await processTool.execute({
        imagePath: validPath,
        waitForCompletion: true,
      });
      
      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');

      workflowTimer();

      const metrics = performanceMonitor.getMetrics('error-recovery');
      expect(metrics?.avg).toBeLessThan(60000);
    });

    it('should handle partial batch failures', async () => {
      const imagePaths: string[] = [];
      
      // Create mix of valid and invalid images
      for (let i = 0; i < 5; i++) {
        const path = `/tmp/e2e-mixed-${i}.jpg`;
        if (i === 2) {
          // Create invalid image
          await createTestFile(path, Buffer.from('invalid'));
        } else {
          await createTestFile(path, generateTestImage());
        }
        imagePaths.push(path);
        cleanup.add(() => cleanupTestFile(path));
      }

      const batchTool = toolRegistry.get('voice_description_batch_images');
      const result = await batchTool.execute({
        imagePaths,
        continueOnError: true,
      });
      
      expect(result.totalImages).toBe(5);
      expect(result.processed).toBeGreaterThanOrEqual(3);
      expect(result.failed).toBeGreaterThanOrEqual(1);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Concurrent Workflow Execution', () => {
    it('should handle multiple workflows simultaneously', async () => {
      const workflowTimer = performanceMonitor.startTimer('concurrent-workflows');
      
      // Create test files
      const files = [];
      for (let i = 0; i < 3; i++) {
        const imagePath = `/tmp/e2e-concurrent-${i}.jpg`;
        await createTestFile(imagePath, generateTestImage());
        files.push(imagePath);
        cleanup.add(() => cleanupTestFile(imagePath));
      }

      // Execute workflows concurrently
      const workflows = files.map(async (filePath, index) => {
        const timer = performanceMonitor.startTimer(`workflow-${index}`);
        
        const processTool = toolRegistry.get('voice_description_process_image');
        const result = await processTool.execute({
          imagePath: filePath,
          waitForCompletion: true,
        });
        
        timer();
        return result;
      });

      const results = await Promise.all(workflows);
      workflowTimer();

      // Verify all workflows completed
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.status).toBe('completed');
      });

      // Check individual workflow times
      for (let i = 0; i < 3; i++) {
        const metrics = performanceMonitor.getMetrics(`workflow-${i}`);
        expect(metrics?.avg).toBeLessThan(60000);
      }

      // Total time should be less than sequential execution
      const totalMetrics = performanceMonitor.getMetrics('concurrent-workflows');
      expect(totalMetrics?.avg).toBeLessThan(90000); // Less than 3 * 30s
    });
  });

  describe('Long-Running Job Workflow', () => {
    it('should handle jobs with extended processing time', async () => {
      const videoPath = '/tmp/e2e-long-video.mp4';
      const video = generateTestVideo(10 * 1024 * 1024); // 10MB
      
      await createTestFile(videoPath, video);
      cleanup.add(() => cleanupTestFile(videoPath));

      // Upload with extended timeout
      const uploadTool = toolRegistry.get('voice_description_upload_video');
      const uploadResult = await uploadTool.execute({
        filePath: videoPath,
      });
      
      expect(uploadResult.success).toBe(true);
      const jobId = uploadResult.jobId;

      // Poll with longer timeout
      const poller = new JobPoller(apiClient);
      const result = await poller.pollUntilComplete(jobId, {
        interval: 5000,
        timeout: 300000, // 5 minutes
        onProgress: (update) => {
          console.log(`Job ${jobId}: ${update.status} - ${update.progress}%`);
        },
      });
      
      expect(result.status).toMatch(/completed|failed/);
      
      if (result.status === 'completed') {
        expect(result.results).toBeDefined();
      }
    });
  });

  describe('System Health During Workflows', () => {
    it('should maintain system health during heavy load', async () => {
      const healthChecks: any[] = [];
      const workflows: Promise<any>[] = [];
      
      // Start background health monitoring
      const healthMonitor = setInterval(async () => {
        try {
          const health = await apiClient.checkHealth();
          healthChecks.push(health.data);
        } catch (error) {
          healthChecks.push({ status: 'error', error: error.message });
        }
      }, 2000);

      // Execute multiple workflows
      for (let i = 0; i < 5; i++) {
        const imagePath = `/tmp/e2e-load-${i}.jpg`;
        await createTestFile(imagePath, generateTestImage());
        cleanup.add(() => cleanupTestFile(imagePath));
        
        const workflow = (async () => {
          const processTool = toolRegistry.get('voice_description_process_image');
          return processTool.execute({
            imagePath,
            waitForCompletion: false,
          });
        })();
        
        workflows.push(workflow);
      }

      // Wait for workflows to complete
      await Promise.allSettled(workflows);
      
      // Stop health monitoring
      clearInterval(healthMonitor);
      
      // Verify system remained healthy
      const healthyChecks = healthChecks.filter(h => h.status === 'healthy');
      expect(healthyChecks.length).toBeGreaterThan(healthChecks.length * 0.8); // 80% healthy
    });
  });

  describe('Data Integrity Workflow', () => {
    it('should maintain data integrity throughout processing', async () => {
      const imagePath = '/tmp/e2e-integrity.jpg';
      const originalImage = generateTestImage(512 * 1024);
      const originalHash = Buffer.from(originalImage).toString('base64').substring(0, 32);
      
      await createTestFile(imagePath, originalImage);
      cleanup.add(() => cleanupTestFile(imagePath));

      // Process image
      const processTool = toolRegistry.get('voice_description_process_image');
      const processResult = await processTool.execute({
        imagePath,
        waitForCompletion: true,
      });
      
      const jobId = processResult.jobId;

      // Verify job tracking
      const statusTool = toolRegistry.get('voice_description_check_status');
      const status1 = await statusTool.execute({ jobId });
      const status2 = await statusTool.execute({ jobId });
      
      expect(status1.jobId).toBe(status2.jobId);
      expect(status1.status).toBe(status2.status);
      
      // Download and verify results
      const downloadTool = toolRegistry.get('voice_description_download_results');
      const textResult1 = await downloadTool.execute({
        jobId,
        resultType: 'text',
      });
      const textResult2 = await downloadTool.execute({
        jobId,
        resultType: 'text',
      });
      
      expect(textResult1.content).toBe(textResult2.content);
    });
  });
});