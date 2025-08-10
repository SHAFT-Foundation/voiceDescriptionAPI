import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BatchProcessImagesTool } from '../../../../src/tools/image/batch-process.js';
import { 
  createMockAPIClient, 
  createMockFileHandler,
  createMockJobPoller,
  createMockLogger,
  createMockQueue,
  resetAllMocks 
} from '../../../utils/mocks.js';
import {
  TEST_CONSTANTS,
  mockResponses,
  generateTestImage,
  generateBatchImages,
  createTestFile,
  cleanupTestFile,
  wait,
} from '../../../utils/test-helpers.js';
import { sampleBatchData } from '../../../fixtures/test-data.js';

describe('BatchProcessImagesTool', () => {
  let tool: BatchProcessImagesTool;
  let mockAPIClient: ReturnType<typeof createMockAPIClient>;
  let mockFileHandler: ReturnType<typeof createMockFileHandler>;
  let mockJobPoller: ReturnType<typeof createMockJobPoller>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockQueue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    mockAPIClient = createMockAPIClient();
    mockFileHandler = createMockFileHandler();
    mockJobPoller = createMockJobPoller();
    mockLogger = createMockLogger();
    mockQueue = createMockQueue();

    tool = new BatchProcessImagesTool({
      apiClient: mockAPIClient,
      fileHandler: mockFileHandler,
      jobPoller: mockJobPoller,
      logger: mockLogger,
      queue: mockQueue,
    });

    resetAllMocks(mockAPIClient, mockFileHandler, mockJobPoller, mockLogger, mockQueue);
  });

  describe('Schema Validation', () => {
    it('should have correct tool metadata', () => {
      expect(tool.name).toBe('voice_description_batch_images');
      expect(tool.description).toContain('Process multiple images in batch');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.required).toContain('imagePaths');
    });

    it('should validate required parameters', () => {
      const schema = tool.inputSchema;
      expect(schema.properties).toHaveProperty('imagePaths');
      expect(schema.properties.imagePaths.type).toBe('array');
      expect(schema.properties.imagePaths.items.type).toBe('string');
    });

    it('should validate optional parameters', () => {
      const schema = tool.inputSchema;
      expect(schema.properties).toHaveProperty('parallel');
      expect(schema.properties.parallel.type).toBe('boolean');
      expect(schema.properties).toHaveProperty('maxConcurrent');
      expect(schema.properties.maxConcurrent.type).toBe('number');
      expect(schema.properties).toHaveProperty('continueOnError');
      expect(schema.properties.continueOnError.type).toBe('boolean');
    });
  });

  describe('Batch Processing Success', () => {
    const testImages = generateBatchImages(3);
    const imagePaths = testImages.map((img, i) => `/tmp/batch-image-${i}.jpg`);

    beforeEach(async () => {
      // Create test files
      for (let i = 0; i < testImages.length; i++) {
        await createTestFile(imagePaths[i], testImages[i].content);
      }
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.validateFileType.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockImplementation(async (path) => {
        const index = imagePaths.indexOf(path);
        return testImages[index].content;
      });

      mockAPIClient.batchProcessImages.mockResolvedValue({
        data: mockResponses.batchResults(3),
      });
    });

    afterEach(async () => {
      // Cleanup test files
      for (const path of imagePaths) {
        await cleanupTestFile(path);
      }
    });

    it('should process batch of images successfully', async () => {
      const result = await tool.execute({
        imagePaths,
      });

      expect(mockFileHandler.validateFile).toHaveBeenCalledTimes(3);
      expect(mockAPIClient.batchProcessImages).toHaveBeenCalled();
      
      expect(result).toMatchObject({
        success: true,
        totalImages: 3,
        processed: 3,
        failed: 0,
        results: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            status: 'completed',
            description: expect.any(String),
          }),
        ]),
      });
    });

    it('should process images in parallel mode', async () => {
      mockQueue.addAll.mockImplementation(async (tasks) => {
        return Promise.all(tasks.map(task => task()));
      });

      const result = await tool.execute({
        imagePaths,
        parallel: true,
        maxConcurrent: 2,
      });

      expect(mockQueue.addAll).toHaveBeenCalled();
      expect(result.processed).toBe(3);
    });

    it('should process images sequentially', async () => {
      const processOrder: string[] = [];
      
      mockAPIClient.batchProcessImages.mockImplementation(async (data) => {
        processOrder.push(...data.images.map((img: any) => img.path));
        return { data: mockResponses.batchResults(data.images.length) };
      });

      const result = await tool.execute({
        imagePaths,
        parallel: false,
      });

      expect(processOrder).toEqual(imagePaths);
      expect(result.processed).toBe(3);
    });

    it('should handle large batch with pagination', async () => {
      const largeBatch = Array.from({ length: 25 }, (_, i) => `/tmp/image-${i}.jpg`);
      
      // Create files
      for (const path of largeBatch) {
        await createTestFile(path, generateTestImage());
      }

      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.validateFileType.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
      
      let callCount = 0;
      mockAPIClient.batchProcessImages.mockImplementation(async (data) => {
        callCount++;
        const count = data.images.length;
        return { data: mockResponses.batchResults(count) };
      });

      const result = await tool.execute({
        imagePaths: largeBatch,
        batchSize: 10,
      });

      expect(callCount).toBe(3); // 25 images / 10 batch size = 3 calls
      expect(result.totalImages).toBe(25);
      expect(result.processed).toBe(25);

      // Cleanup
      for (const path of largeBatch) {
        await cleanupTestFile(path);
      }
    });
  });

  describe('Error Handling', () => {
    const imagePaths = ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'];

    beforeEach(async () => {
      for (const path of imagePaths) {
        await createTestFile(path, generateTestImage());
      }
    });

    afterEach(async () => {
      for (const path of imagePaths) {
        await cleanupTestFile(path);
      }
    });

    it('should handle partial failures with continueOnError', async () => {
      mockFileHandler.validateFile.mockImplementation(async (path) => {
        return path !== imagePaths[1]; // Second image fails validation
      });
      mockFileHandler.validateFileType.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
      
      mockAPIClient.batchProcessImages.mockResolvedValue({
        data: {
          success: true,
          totalImages: 3,
          processed: 2,
          failed: 1,
          results: [
            { id: 'img-0', status: 'completed', description: 'Success' },
            { id: 'img-1', status: 'failed', error: 'Validation failed' },
            { id: 'img-2', status: 'completed', description: 'Success' },
          ],
        },
      });

      const result = await tool.execute({
        imagePaths,
        continueOnError: true,
      });

      expect(result.totalImages).toBe(3);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should stop on first error when continueOnError is false', async () => {
      mockFileHandler.validateFile.mockImplementation(async (path) => {
        if (path === imagePaths[1]) {
          throw new Error('File corrupted');
        }
        return true;
      });
      mockFileHandler.validateFileType.mockResolvedValue(true);

      await expect(tool.execute({
        imagePaths,
        continueOnError: false,
      })).rejects.toThrow('File corrupted');

      expect(mockFileHandler.validateFile).toHaveBeenCalledTimes(2);
    });

    it('should handle empty image paths array', async () => {
      await expect(tool.execute({
        imagePaths: [],
      })).rejects.toThrow('No images provided');
    });

    it('should handle invalid image formats in batch', async () => {
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.validateFileType.mockImplementation(async (path) => {
        return !path.includes('img2'); // Second image has invalid format
      });

      const result = await tool.execute({
        imagePaths,
        continueOnError: true,
      });

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: imagePaths[1],
          error: expect.stringContaining('format'),
        })
      );
    });

    it('should handle API batch processing failure', async () => {
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.validateFileType.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
      
      mockAPIClient.batchProcessImages.mockRejectedValue(
        new Error('Batch processing failed')
      );

      await expect(tool.execute({
        imagePaths,
      })).rejects.toThrow('Batch processing failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Batch processing error'),
        expect.any(Object)
      );
    });
  });

  describe('Progress Tracking', () => {
    const imagePaths = ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'];

    beforeEach(async () => {
      for (const path of imagePaths) {
        await createTestFile(path, generateTestImage());
      }
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.validateFileType.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
    });

    afterEach(async () => {
      for (const path of imagePaths) {
        await cleanupTestFile(path);
      }
    });

    it('should track progress for batch processing', async () => {
      const progressCallback = jest.fn();
      
      mockAPIClient.batchProcessImages.mockImplementation(async (data) => {
        // Simulate progress
        if (data.onProgress) {
          await data.onProgress({ completed: 1, total: 3 });
          await wait(10);
          await data.onProgress({ completed: 2, total: 3 });
          await wait(10);
          await data.onProgress({ completed: 3, total: 3 });
        }
        return { data: mockResponses.batchResults(3) };
      });

      const result = await tool.execute({
        imagePaths,
        onProgress: progressCallback,
      });

      expect(progressCallback).toHaveBeenCalledWith({
        phase: 'processing',
        completed: 1,
        total: 3,
        percentage: 33,
      });
      expect(progressCallback).toHaveBeenCalledWith({
        phase: 'processing',
        completed: 3,
        total: 3,
        percentage: 100,
      });
      expect(result.processed).toBe(3);
    });

    it('should report individual image progress', async () => {
      const progressCallback = jest.fn();
      
      mockAPIClient.batchProcessImages.mockImplementation(async (data) => {
        // Simulate per-image progress
        for (let i = 0; i < data.images.length; i++) {
          if (data.onImageProgress) {
            await data.onImageProgress({
              imageId: `img-${i}`,
              status: 'processing',
              progress: 50,
            });
            await wait(10);
            await data.onImageProgress({
              imageId: `img-${i}`,
              status: 'completed',
              progress: 100,
            });
          }
        }
        return { data: mockResponses.batchResults(data.images.length) };
      });

      const result = await tool.execute({
        imagePaths,
        onImageProgress: progressCallback,
      });

      expect(progressCallback).toHaveBeenCalledTimes(6); // 2 updates per image
      expect(result.processed).toBe(3);
    });
  });

  describe('Concurrency Control', () => {
    it('should respect max concurrent limit', async () => {
      const imagePaths = Array.from({ length: 10 }, (_, i) => `/tmp/img-${i}.jpg`);
      
      // Create files
      for (const path of imagePaths) {
        await createTestFile(path, generateTestImage());
      }

      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.validateFileType.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
      
      let concurrentCount = 0;
      let maxConcurrent = 0;
      
      mockQueue.addAll.mockImplementation(async (tasks) => {
        const results = [];
        for (const task of tasks) {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          const result = await task();
          concurrentCount--;
          results.push(result);
        }
        return results;
      });

      mockAPIClient.batchProcessImages.mockResolvedValue({
        data: mockResponses.batchResults(10),
      });

      const result = await tool.execute({
        imagePaths,
        parallel: true,
        maxConcurrent: 3,
      });

      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(result.processed).toBe(10);

      // Cleanup
      for (const path of imagePaths) {
        await cleanupTestFile(path);
      }
    });
  });

  describe('Retry Logic', () => {
    const imagePaths = ['/tmp/img1.jpg', '/tmp/img2.jpg'];

    beforeEach(async () => {
      for (const path of imagePaths) {
        await createTestFile(path, generateTestImage());
      }
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.validateFileType.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
    });

    afterEach(async () => {
      for (const path of imagePaths) {
        await cleanupTestFile(path);
      }
    });

    it('should retry failed images', async () => {
      let attempts = 0;
      
      mockAPIClient.batchProcessImages.mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          return {
            data: {
              success: true,
              totalImages: 2,
              processed: 1,
              failed: 1,
              results: [
                { id: 'img-0', status: 'completed' },
                { id: 'img-1', status: 'failed', error: 'Temporary error' },
              ],
            },
          };
        }
        return {
          data: {
            success: true,
            totalImages: 1,
            processed: 1,
            failed: 0,
            results: [
              { id: 'img-1', status: 'completed' },
            ],
          },
        };
      });

      const result = await tool.execute({
        imagePaths,
        retryFailed: true,
        maxRetries: 2,
      });

      expect(mockAPIClient.batchProcessImages).toHaveBeenCalledTimes(2);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe('Output Format Options', () => {
    const imagePaths = ['/tmp/img1.jpg', '/tmp/img2.jpg'];

    beforeEach(async () => {
      for (const path of imagePaths) {
        await createTestFile(path, generateTestImage());
      }
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.validateFileType.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
    });

    afterEach(async () => {
      for (const path of imagePaths) {
        await cleanupTestFile(path);
      }
    });

    it('should generate consolidated report', async () => {
      mockAPIClient.batchProcessImages.mockResolvedValue({
        data: {
          ...mockResponses.batchResults(2),
          report: {
            totalProcessingTime: 5000,
            averageProcessingTime: 2500,
            successRate: 100,
            formats: ['text', 'audio'],
          },
        },
      });

      const result = await tool.execute({
        imagePaths,
        generateReport: true,
      });

      expect(result).toHaveProperty('report');
      expect(result.report).toMatchObject({
        totalProcessingTime: expect.any(Number),
        successRate: expect.any(Number),
      });
    });

    it('should aggregate descriptions when requested', async () => {
      mockAPIClient.batchProcessImages.mockResolvedValue({
        data: {
          ...mockResponses.batchResults(2),
          aggregatedDescription: 'Combined description of all images',
        },
      });

      const result = await tool.execute({
        imagePaths,
        aggregateDescriptions: true,
      });

      expect(result).toHaveProperty('aggregatedDescription');
      expect(result.aggregatedDescription).toBe('Combined description of all images');
    });
  });
});