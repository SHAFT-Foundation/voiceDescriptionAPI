import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ProcessImageTool } from '../../../../src/tools/image/process-image.js';
import { 
  createMockAPIClient, 
  createMockFileHandler,
  createMockJobPoller,
  createMockLogger,
  resetAllMocks 
} from '../../../utils/mocks.js';
import {
  TEST_CONSTANTS,
  mockResponses,
  generateTestImage,
  createTestFile,
  cleanupTestFile,
} from '../../../utils/test-helpers.js';
import { sampleImageMetadata, sampleJobs } from '../../../fixtures/test-data.js';

describe('ProcessImageTool', () => {
  let tool: ProcessImageTool;
  let mockAPIClient: ReturnType<typeof createMockAPIClient>;
  let mockFileHandler: ReturnType<typeof createMockFileHandler>;
  let mockJobPoller: ReturnType<typeof createMockJobPoller>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockAPIClient = createMockAPIClient();
    mockFileHandler = createMockFileHandler();
    mockJobPoller = createMockJobPoller();
    mockLogger = createMockLogger();

    tool = new ProcessImageTool({
      apiClient: mockAPIClient,
      fileHandler: mockFileHandler,
      jobPoller: mockJobPoller,
      logger: mockLogger,
    });

    resetAllMocks(mockAPIClient, mockFileHandler, mockJobPoller, mockLogger);
  });

  describe('Schema Validation', () => {
    it('should have correct tool metadata', () => {
      expect(tool.name).toBe('voice_description_process_image');
      expect(tool.description).toContain('Process a single image');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.required).toContain('imagePath');
    });

    it('should validate required parameters', () => {
      const schema = tool.inputSchema;
      expect(schema.properties).toHaveProperty('imagePath');
      expect(schema.properties.imagePath.type).toBe('string');
    });

    it('should validate optional parameters', () => {
      const schema = tool.inputSchema;
      expect(schema.properties).toHaveProperty('waitForCompletion');
      expect(schema.properties.waitForCompletion.type).toBe('boolean');
      expect(schema.properties).toHaveProperty('outputFormat');
      expect(schema.properties.outputFormat.enum).toContain('text');
      expect(schema.properties.outputFormat.enum).toContain('audio');
      expect(schema.properties.outputFormat.enum).toContain('both');
    });
  });

  describe('Image Processing Success', () => {
    const testImagePath = '/tmp/test-image.jpg';
    const testImage = generateTestImage(512 * 1024); // 512KB

    beforeEach(async () => {
      await createTestFile(testImagePath, testImage);
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(testImage);
      mockFileHandler.getFileMetadata.mockResolvedValue(sampleImageMetadata);
      mockFileHandler.validateFileType.mockResolvedValue(true);

      mockAPIClient.processImage.mockResolvedValue({
        data: {
          success: true,
          jobId: TEST_CONSTANTS.VALID_JOB_ID,
          message: 'Image processing started',
        },
      });
    });

    afterEach(async () => {
      await cleanupTestFile(testImagePath);
    });

    it('should process image successfully without waiting', async () => {
      const result = await tool.execute({
        imagePath: testImagePath,
        waitForCompletion: false,
      });

      expect(mockFileHandler.validateFile).toHaveBeenCalledWith(testImagePath);
      expect(mockFileHandler.readFileAsBuffer).toHaveBeenCalledWith(testImagePath);
      expect(mockAPIClient.processImage).toHaveBeenCalled();
      expect(mockJobPoller.pollUntilComplete).not.toHaveBeenCalled();
      
      expect(result).toMatchObject({
        success: true,
        jobId: TEST_CONSTANTS.VALID_JOB_ID,
        status: 'processing',
      });
    });

    it('should process image and wait for completion', async () => {
      mockJobPoller.pollUntilComplete.mockResolvedValue(sampleJobs.completed);

      const result = await tool.execute({
        imagePath: testImagePath,
        waitForCompletion: true,
      });

      expect(mockAPIClient.processImage).toHaveBeenCalled();
      expect(mockJobPoller.pollUntilComplete).toHaveBeenCalledWith(
        TEST_CONSTANTS.VALID_JOB_ID,
        expect.any(Object)
      );
      
      expect(result).toMatchObject({
        success: true,
        jobId: TEST_CONSTANTS.VALID_JOB_ID,
        status: 'completed',
        results: expect.objectContaining({
          textUrl: expect.any(String),
          audioUrl: expect.any(String),
        }),
      });
    });

    it('should process with text output format only', async () => {
      mockJobPoller.pollUntilComplete.mockResolvedValue({
        ...sampleJobs.completed,
        results: {
          textUrl: 'https://api.example.com/results/text',
          audioUrl: null,
        },
      });

      const result = await tool.execute({
        imagePath: testImagePath,
        outputFormat: 'text',
        waitForCompletion: true,
      });

      expect(mockAPIClient.processImage).toHaveBeenCalledWith(
        expect.objectContaining({
          outputFormat: 'text',
        })
      );
      
      expect(result.results).toHaveProperty('textUrl');
      expect(result.results.audioUrl).toBeNull();
    });

    it('should process with audio output format only', async () => {
      mockJobPoller.pollUntilComplete.mockResolvedValue({
        ...sampleJobs.completed,
        results: {
          textUrl: null,
          audioUrl: 'https://api.example.com/results/audio',
        },
      });

      const result = await tool.execute({
        imagePath: testImagePath,
        outputFormat: 'audio',
        waitForCompletion: true,
      });

      expect(mockAPIClient.processImage).toHaveBeenCalledWith(
        expect.objectContaining({
          outputFormat: 'audio',
        })
      );
      
      expect(result.results).toHaveProperty('audioUrl');
      expect(result.results.textUrl).toBeNull();
    });
  });

  describe('Image Validation Errors', () => {
    it('should reject invalid image path', async () => {
      mockFileHandler.validateFile.mockResolvedValue(false);

      await expect(tool.execute({
        imagePath: '/invalid/path/image.jpg',
      })).rejects.toThrow('Image file not found');

      expect(mockFileHandler.validateFile).toHaveBeenCalled();
      expect(mockAPIClient.processImage).not.toHaveBeenCalled();
    });

    it('should reject unsupported image format', async () => {
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.validateFileType.mockResolvedValue(false);
      mockFileHandler.getFileMetadata.mockResolvedValue({
        ...sampleImageMetadata,
        mimeType: 'text/plain',
      });

      await expect(tool.execute({
        imagePath: '/tmp/file.txt',
      })).rejects.toThrow('Unsupported image format');

      expect(mockFileHandler.validateFileType).toHaveBeenCalled();
    });

    it('should reject image exceeding size limit', async () => {
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.validateFileType.mockResolvedValue(true);
      mockFileHandler.validateFileSize.mockResolvedValue(false);
      mockFileHandler.getFileMetadata.mockResolvedValue({
        ...sampleImageMetadata,
        size: 50 * 1024 * 1024, // 50MB
      });

      await expect(tool.execute({
        imagePath: '/tmp/large-image.jpg',
      })).rejects.toThrow('Image size exceeds limit');

      expect(mockFileHandler.validateFileSize).toHaveBeenCalled();
    });

    it('should validate supported image formats', async () => {
      const supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
      
      for (const format of supportedFormats) {
        mockFileHandler.validateFile.mockResolvedValue(true);
        mockFileHandler.validateFileType.mockResolvedValue(true);
        mockFileHandler.getFileMetadata.mockResolvedValue({
          ...sampleImageMetadata,
          filename: `test.${format}`,
          mimeType: `image/${format}`,
        });
        mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
        mockAPIClient.processImage.mockResolvedValue({
          data: { success: true, jobId: TEST_CONSTANTS.VALID_JOB_ID },
        });

        const result = await tool.execute({
          imagePath: `/tmp/test.${format}`,
        });

        expect(result.success).toBe(true);
      }
    });
  });

  describe('Processing Status Tracking', () => {
    const testImagePath = '/tmp/test-image.jpg';

    beforeEach(async () => {
      await createTestFile(testImagePath, generateTestImage());
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
      mockFileHandler.getFileMetadata.mockResolvedValue(sampleImageMetadata);
      mockFileHandler.validateFileType.mockResolvedValue(true);

      mockAPIClient.processImage.mockResolvedValue({
        data: {
          success: true,
          jobId: TEST_CONSTANTS.VALID_JOB_ID,
        },
      });
    });

    afterEach(async () => {
      await cleanupTestFile(testImagePath);
    });

    it('should track processing progress', async () => {
      const progressCallback = jest.fn();
      
      mockJobPoller.pollUntilComplete.mockImplementation(async (jobId, options) => {
        // Simulate progress updates
        if (options.onProgress) {
          await options.onProgress({ status: 'processing', progress: 25 });
          await options.onProgress({ status: 'processing', progress: 50 });
          await options.onProgress({ status: 'processing', progress: 75 });
          await options.onProgress({ status: 'completed', progress: 100 });
        }
        return sampleJobs.completed;
      });

      const result = await tool.execute({
        imagePath: testImagePath,
        waitForCompletion: true,
        onProgress: progressCallback,
      });

      expect(progressCallback).toHaveBeenCalledTimes(4);
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ progress: 25 })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ progress: 100 })
      );
      expect(result.status).toBe('completed');
    });

    it('should handle processing failure', async () => {
      mockJobPoller.pollUntilComplete.mockResolvedValue(sampleJobs.failed);

      const result = await tool.execute({
        imagePath: testImagePath,
        waitForCompletion: true,
      });

      expect(result).toMatchObject({
        success: false,
        jobId: TEST_CONSTANTS.VALID_JOB_ID,
        status: 'failed',
        error: expect.objectContaining({
          code: 'VIDEO_PROCESSING_ERROR',
        }),
      });
    });

    it('should handle polling timeout', async () => {
      mockJobPoller.pollUntilComplete.mockRejectedValue(
        new Error('Polling timeout exceeded')
      );

      await expect(tool.execute({
        imagePath: testImagePath,
        waitForCompletion: true,
        timeout: 1000,
      })).rejects.toThrow('Polling timeout exceeded');
    });
  });

  describe('API Error Handling', () => {
    const testImagePath = '/tmp/test-image.jpg';

    beforeEach(async () => {
      await createTestFile(testImagePath, generateTestImage());
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
      mockFileHandler.getFileMetadata.mockResolvedValue(sampleImageMetadata);
      mockFileHandler.validateFileType.mockResolvedValue(true);
    });

    afterEach(async () => {
      await cleanupTestFile(testImagePath);
    });

    it('should handle API processing failure', async () => {
      mockAPIClient.processImage.mockRejectedValue(new Error('Processing failed'));

      await expect(tool.execute({
        imagePath: testImagePath,
      })).rejects.toThrow('Failed to process image');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Processing failed'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should handle rate limiting', async () => {
      mockAPIClient.processImage.mockRejectedValue({
        response: {
          status: 429,
          data: { 
            message: 'Rate limit exceeded',
            retryAfter: 60,
          },
        },
      });

      await expect(tool.execute({
        imagePath: testImagePath,
      })).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle insufficient quota', async () => {
      mockAPIClient.processImage.mockRejectedValue({
        response: {
          status: 402,
          data: { message: 'Insufficient quota' },
        },
      });

      await expect(tool.execute({
        imagePath: testImagePath,
      })).rejects.toThrow('Insufficient quota');
    });
  });

  describe('Retry Logic', () => {
    const testImagePath = '/tmp/test-image.jpg';

    beforeEach(async () => {
      await createTestFile(testImagePath, generateTestImage());
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
      mockFileHandler.getFileMetadata.mockResolvedValue(sampleImageMetadata);
      mockFileHandler.validateFileType.mockResolvedValue(true);
    });

    afterEach(async () => {
      await cleanupTestFile(testImagePath);
    });

    it('should retry on transient failures', async () => {
      let attempts = 0;
      mockAPIClient.processImage.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return {
          data: {
            success: true,
            jobId: TEST_CONSTANTS.VALID_JOB_ID,
          },
        };
      });

      const result = await tool.execute({
        imagePath: testImagePath,
        retryAttempts: 3,
      });

      expect(mockAPIClient.processImage).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should not retry on non-retryable errors', async () => {
      mockAPIClient.processImage.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Invalid request' },
        },
      });

      await expect(tool.execute({
        imagePath: testImagePath,
        retryAttempts: 3,
      })).rejects.toThrow('Invalid request');

      expect(mockAPIClient.processImage).toHaveBeenCalledTimes(1);
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle multiple concurrent image processing', async () => {
      const processes = Array.from({ length: 5 }, async (_, i) => {
        const imagePath = `/tmp/image-${i}.jpg`;
        await createTestFile(imagePath, generateTestImage());
        
        mockFileHandler.validateFile.mockResolvedValue(true);
        mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
        mockFileHandler.getFileMetadata.mockResolvedValue(sampleImageMetadata);
        mockFileHandler.validateFileType.mockResolvedValue(true);
        mockAPIClient.processImage.mockResolvedValue({
          data: {
            success: true,
            jobId: `job-${i}`,
          },
        });

        const result = await tool.execute({ imagePath });
        await cleanupTestFile(imagePath);
        return result;
      });

      const results = await Promise.all(processes);
      
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.jobId).toBe(`job-${i}`);
      });
    });
  });

  describe('Caching Behavior', () => {
    const testImagePath = '/tmp/test-image.jpg';

    beforeEach(async () => {
      await createTestFile(testImagePath, generateTestImage());
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestImage());
      mockFileHandler.getFileMetadata.mockResolvedValue(sampleImageMetadata);
      mockFileHandler.validateFileType.mockResolvedValue(true);
    });

    afterEach(async () => {
      await cleanupTestFile(testImagePath);
    });

    it('should cache processing results', async () => {
      mockAPIClient.processImage.mockResolvedValue({
        data: {
          success: true,
          jobId: TEST_CONSTANTS.VALID_JOB_ID,
        },
      });
      mockJobPoller.pollUntilComplete.mockResolvedValue(sampleJobs.completed);

      // First call
      const result1 = await tool.execute({
        imagePath: testImagePath,
        waitForCompletion: true,
        enableCache: true,
      });

      // Second call should use cache
      const result2 = await tool.execute({
        imagePath: testImagePath,
        waitForCompletion: true,
        enableCache: true,
      });

      expect(mockAPIClient.processImage).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });
  });
});