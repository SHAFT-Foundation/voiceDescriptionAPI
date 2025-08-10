import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UploadVideoTool } from '../../../../src/tools/video/upload-video.js';
import { 
  createMockAPIClient, 
  createMockFileHandler,
  createMockLogger,
  resetAllMocks 
} from '../../../utils/mocks.js';
import {
  TEST_CONSTANTS,
  mockResponses,
  generateTestVideo,
  createTestFile,
  cleanupTestFile,
} from '../../../utils/test-helpers.js';
import { sampleVideoMetadata, sampleJobs } from '../../../fixtures/test-data.js';

describe('UploadVideoTool', () => {
  let tool: UploadVideoTool;
  let mockAPIClient: ReturnType<typeof createMockAPIClient>;
  let mockFileHandler: ReturnType<typeof createMockFileHandler>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockAPIClient = createMockAPIClient();
    mockFileHandler = createMockFileHandler();
    mockLogger = createMockLogger();

    tool = new UploadVideoTool({
      apiClient: mockAPIClient,
      fileHandler: mockFileHandler,
      logger: mockLogger,
    });

    resetAllMocks(mockAPIClient, mockFileHandler, mockLogger);
  });

  describe('Schema Validation', () => {
    it('should have correct tool metadata', () => {
      expect(tool.name).toBe('voice_description_upload_video');
      expect(tool.description).toContain('Upload a video file');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.required).toContain('filePath');
    });

    it('should validate required parameters', () => {
      const schema = tool.inputSchema;
      expect(schema.properties).toHaveProperty('filePath');
      expect(schema.properties.filePath.type).toBe('string');
    });

    it('should validate optional parameters', () => {
      const schema = tool.inputSchema;
      expect(schema.properties).toHaveProperty('metadata');
      expect(schema.properties.metadata.type).toBe('object');
    });
  });

  describe('File Upload Success', () => {
    const testVideoPath = '/tmp/test-video.mp4';
    const testVideo = generateTestVideo(1024 * 1024); // 1MB

    beforeEach(async () => {
      await createTestFile(testVideoPath, testVideo);
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(testVideo);
      mockFileHandler.getFileMetadata.mockResolvedValue(sampleVideoMetadata);
      mockFileHandler.createMultipartUpload.mockResolvedValue({
        headers: { 'content-type': 'multipart/form-data' },
        body: testVideo,
      });

      mockAPIClient.upload.mockResolvedValue({
        data: mockResponses.uploadSuccess(),
      });
    });

    afterEach(async () => {
      await cleanupTestFile(testVideoPath);
    });

    it('should upload video file successfully', async () => {
      const result = await tool.execute({
        filePath: testVideoPath,
      });

      expect(mockFileHandler.validateFile).toHaveBeenCalledWith(testVideoPath);
      expect(mockFileHandler.readFileAsBuffer).toHaveBeenCalledWith(testVideoPath);
      expect(mockAPIClient.upload).toHaveBeenCalled();
      
      expect(result).toMatchObject({
        success: true,
        jobId: TEST_CONSTANTS.VALID_JOB_ID,
        message: expect.stringContaining('uploaded successfully'),
      });
    });

    it('should include metadata in upload', async () => {
      const metadata = {
        title: 'Test Video',
        description: 'A test video for unit testing',
        tags: ['test', 'sample'],
      };

      const result = await tool.execute({
        filePath: testVideoPath,
        metadata,
      });

      expect(mockAPIClient.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining(metadata),
        })
      );

      expect(result.success).toBe(true);
    });

    it('should handle large file upload with multipart', async () => {
      const largeVideo = generateTestVideo(50 * 1024 * 1024); // 50MB
      mockFileHandler.readFileAsBuffer.mockResolvedValue(largeVideo);
      mockFileHandler.getFileMetadata.mockResolvedValue({
        ...sampleVideoMetadata,
        size: largeVideo.length,
      });

      const result = await tool.execute({
        filePath: testVideoPath,
      });

      expect(mockFileHandler.createMultipartUpload).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('File Validation Errors', () => {
    it('should reject invalid file path', async () => {
      mockFileHandler.validateFile.mockResolvedValue(false);

      await expect(tool.execute({
        filePath: '/invalid/path/video.mp4',
      })).rejects.toThrow('File not found or invalid');

      expect(mockFileHandler.validateFile).toHaveBeenCalled();
      expect(mockAPIClient.upload).not.toHaveBeenCalled();
    });

    it('should reject unsupported file format', async () => {
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.validateFileType.mockResolvedValue(false);

      await expect(tool.execute({
        filePath: '/tmp/file.txt',
      })).rejects.toThrow('Unsupported file format');

      expect(mockFileHandler.validateFileType).toHaveBeenCalled();
    });

    it('should reject file exceeding size limit', async () => {
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.validateFileSize.mockResolvedValue(false);
      mockFileHandler.getFileMetadata.mockResolvedValue({
        ...sampleVideoMetadata,
        size: 200 * 1024 * 1024, // 200MB
      });

      await expect(tool.execute({
        filePath: '/tmp/large-video.mp4',
      })).rejects.toThrow('File size exceeds limit');

      expect(mockFileHandler.validateFileSize).toHaveBeenCalled();
    });

    it('should handle empty file path', async () => {
      await expect(tool.execute({
        filePath: '',
      })).rejects.toThrow('File path is required');

      expect(mockFileHandler.validateFile).not.toHaveBeenCalled();
    });
  });

  describe('API Error Handling', () => {
    const testVideoPath = '/tmp/test-video.mp4';

    beforeEach(async () => {
      await createTestFile(testVideoPath, generateTestVideo());
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestVideo());
      mockFileHandler.getFileMetadata.mockResolvedValue(sampleVideoMetadata);
    });

    afterEach(async () => {
      await cleanupTestFile(testVideoPath);
    });

    it('should handle API upload failure', async () => {
      mockAPIClient.upload.mockRejectedValue(new Error('Network error'));

      await expect(tool.execute({
        filePath: testVideoPath,
      })).rejects.toThrow('Failed to upload video');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Upload failed'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should handle API rate limiting', async () => {
      mockAPIClient.upload.mockRejectedValue({
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' },
        },
      });

      await expect(tool.execute({
        filePath: testVideoPath,
      })).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle API authentication error', async () => {
      mockAPIClient.upload.mockRejectedValue({
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      });

      await expect(tool.execute({
        filePath: testVideoPath,
      })).rejects.toThrow('Authentication failed');
    });

    it('should handle API server error', async () => {
      mockAPIClient.upload.mockRejectedValue({
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      });

      await expect(tool.execute({
        filePath: testVideoPath,
      })).rejects.toThrow('Server error');
    });
  });

  describe('Progress Tracking', () => {
    const testVideoPath = '/tmp/test-video.mp4';

    beforeEach(async () => {
      await createTestFile(testVideoPath, generateTestVideo());
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestVideo());
      mockFileHandler.getFileMetadata.mockResolvedValue(sampleVideoMetadata);
    });

    afterEach(async () => {
      await cleanupTestFile(testVideoPath);
    });

    it('should track upload progress', async () => {
      const progressCallback = jest.fn();
      
      mockAPIClient.upload.mockImplementation(async (options) => {
        // Simulate progress updates
        if (options.onUploadProgress) {
          options.onUploadProgress({ loaded: 500000, total: 1000000 });
          options.onUploadProgress({ loaded: 1000000, total: 1000000 });
        }
        return { data: mockResponses.uploadSuccess() };
      });

      const result = await tool.execute({
        filePath: testVideoPath,
        onProgress: progressCallback,
      });

      expect(progressCallback).toHaveBeenCalledWith({
        phase: 'uploading',
        progress: 50,
      });
      expect(progressCallback).toHaveBeenCalledWith({
        phase: 'uploading',
        progress: 100,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    const testVideoPath = '/tmp/test-video.mp4';

    beforeEach(async () => {
      await createTestFile(testVideoPath, generateTestVideo());
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestVideo());
      mockFileHandler.getFileMetadata.mockResolvedValue(sampleVideoMetadata);
    });

    afterEach(async () => {
      await cleanupTestFile(testVideoPath);
    });

    it('should retry on transient failures', async () => {
      let attempts = 0;
      mockAPIClient.upload.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Connection reset');
        }
        return { data: mockResponses.uploadSuccess() };
      });

      const result = await tool.execute({
        filePath: testVideoPath,
        retryAttempts: 3,
      });

      expect(mockAPIClient.upload).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it('should fail after max retry attempts', async () => {
      mockAPIClient.upload.mockRejectedValue(new Error('Connection timeout'));

      await expect(tool.execute({
        filePath: testVideoPath,
        retryAttempts: 2,
      })).rejects.toThrow('Failed to upload after 2 attempts');

      expect(mockAPIClient.upload).toHaveBeenCalledTimes(2);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup temporary files on success', async () => {
      const testVideoPath = '/tmp/test-video.mp4';
      const tempFile = '/tmp/temp-upload.tmp';
      
      await createTestFile(testVideoPath, generateTestVideo());
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestVideo());
      mockFileHandler.saveTemporaryFile.mockResolvedValue(tempFile);
      mockFileHandler.getFileMetadata.mockResolvedValue(sampleVideoMetadata);
      mockAPIClient.upload.mockResolvedValue({
        data: mockResponses.uploadSuccess(),
      });

      const result = await tool.execute({
        filePath: testVideoPath,
      });

      expect(mockFileHandler.cleanupTemporaryFile).toHaveBeenCalledWith(tempFile);
      expect(result.success).toBe(true);

      await cleanupTestFile(testVideoPath);
    });

    it('should cleanup temporary files on failure', async () => {
      const testVideoPath = '/tmp/test-video.mp4';
      const tempFile = '/tmp/temp-upload.tmp';
      
      await createTestFile(testVideoPath, generateTestVideo());
      
      mockFileHandler.validateFile.mockResolvedValue(true);
      mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestVideo());
      mockFileHandler.saveTemporaryFile.mockResolvedValue(tempFile);
      mockFileHandler.getFileMetadata.mockResolvedValue(sampleVideoMetadata);
      mockAPIClient.upload.mockRejectedValue(new Error('Upload failed'));

      await expect(tool.execute({
        filePath: testVideoPath,
      })).rejects.toThrow();

      expect(mockFileHandler.cleanupTemporaryFile).toHaveBeenCalledWith(tempFile);

      await cleanupTestFile(testVideoPath);
    });
  });

  describe('Concurrent Upload Handling', () => {
    it('should handle multiple concurrent uploads', async () => {
      const uploads = Array.from({ length: 5 }, async (_, i) => {
        const filePath = `/tmp/video-${i}.mp4`;
        await createTestFile(filePath, generateTestVideo());
        
        mockFileHandler.validateFile.mockResolvedValue(true);
        mockFileHandler.readFileAsBuffer.mockResolvedValue(generateTestVideo());
        mockFileHandler.getFileMetadata.mockResolvedValue(sampleVideoMetadata);
        mockAPIClient.upload.mockResolvedValue({
          data: mockResponses.uploadSuccess(`job-${i}`),
        });

        const result = await tool.execute({ filePath });
        await cleanupTestFile(filePath);
        return result;
      });

      const results = await Promise.all(uploads);
      
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.jobId).toBe(`job-${i}`);
      });
    });
  });
});