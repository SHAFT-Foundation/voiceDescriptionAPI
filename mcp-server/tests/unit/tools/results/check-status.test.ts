import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CheckStatusTool } from '../../../../src/tools/results/check-status.js';
import { 
  createMockAPIClient,
  createMockLogger,
  createMockCache,
  resetAllMocks 
} from '../../../utils/mocks.js';
import {
  TEST_CONSTANTS,
  mockResponses,
  validateJobId,
} from '../../../utils/test-helpers.js';
import { sampleJobs } from '../../../fixtures/test-data.js';

describe('CheckStatusTool', () => {
  let tool: CheckStatusTool;
  let mockAPIClient: ReturnType<typeof createMockAPIClient>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockCache: ReturnType<typeof createMockCache>;

  beforeEach(() => {
    mockAPIClient = createMockAPIClient();
    mockLogger = createMockLogger();
    mockCache = createMockCache();

    tool = new CheckStatusTool({
      apiClient: mockAPIClient,
      logger: mockLogger,
      cache: mockCache,
    });

    resetAllMocks(mockAPIClient, mockLogger, mockCache);
  });

  describe('Schema Validation', () => {
    it('should have correct tool metadata', () => {
      expect(tool.name).toBe('voice_description_check_status');
      expect(tool.description).toContain('Check processing status');
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.required).toContain('jobId');
    });

    it('should validate required parameters', () => {
      const schema = tool.inputSchema;
      expect(schema.properties).toHaveProperty('jobId');
      expect(schema.properties.jobId.type).toBe('string');
      expect(schema.properties.jobId.pattern).toBeDefined();
    });

    it('should validate optional parameters', () => {
      const schema = tool.inputSchema;
      expect(schema.properties).toHaveProperty('includeDetails');
      expect(schema.properties.includeDetails.type).toBe('boolean');
      expect(schema.properties).toHaveProperty('format');
      expect(schema.properties.format.enum).toContain('simple');
      expect(schema.properties.format.enum).toContain('detailed');
    });
  });

  describe('Status Check Success', () => {
    it('should retrieve pending job status', async () => {
      mockAPIClient.checkStatus.mockResolvedValue({
        data: sampleJobs.pending,
      });

      const result = await tool.execute({
        jobId: TEST_CONSTANTS.VALID_JOB_ID,
      });

      expect(mockAPIClient.checkStatus).toHaveBeenCalledWith(TEST_CONSTANTS.VALID_JOB_ID);
      expect(result).toMatchObject({
        jobId: TEST_CONSTANTS.VALID_JOB_ID,
        status: 'pending',
        progress: 0,
        step: 'initialization',
      });
    });

    it('should retrieve processing job status', async () => {
      mockAPIClient.checkStatus.mockResolvedValue({
        data: sampleJobs.processing,
      });

      const result = await tool.execute({
        jobId: sampleJobs.processing.jobId,
      });

      expect(result).toMatchObject({
        jobId: sampleJobs.processing.jobId,
        status: 'processing',
        progress: 45,
        step: 'segmentation',
        estimatedCompletion: expect.any(String),
      });
    });

    it('should retrieve completed job status', async () => {
      mockAPIClient.checkStatus.mockResolvedValue({
        data: sampleJobs.completed,
      });

      const result = await tool.execute({
        jobId: sampleJobs.completed.jobId,
      });

      expect(result).toMatchObject({
        jobId: sampleJobs.completed.jobId,
        status: 'completed',
        progress: 100,
        results: expect.objectContaining({
          textUrl: expect.any(String),
          audioUrl: expect.any(String),
        }),
      });
    });

    it('should retrieve failed job status', async () => {
      mockAPIClient.checkStatus.mockResolvedValue({
        data: sampleJobs.failed,
      });

      const result = await tool.execute({
        jobId: sampleJobs.failed.jobId,
      });

      expect(result).toMatchObject({
        jobId: sampleJobs.failed.jobId,
        status: 'failed',
        error: expect.objectContaining({
          code: 'VIDEO_PROCESSING_ERROR',
          message: expect.any(String),
        }),
      });
    });
  });

  describe('Output Formatting', () => {
    it('should return simple format by default', async () => {
      mockAPIClient.checkStatus.mockResolvedValue({
        data: sampleJobs.processing,
      });

      const result = await tool.execute({
        jobId: sampleJobs.processing.jobId,
      });

      expect(result).toHaveProperty('jobId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('progress');
      expect(result).not.toHaveProperty('metadata');
    });

    it('should return detailed format when requested', async () => {
      mockAPIClient.checkStatus.mockResolvedValue({
        data: {
          ...sampleJobs.completed,
          metadata: {
            scenes: 5,
            duration: 30,
            wordsGenerated: 250,
            audioLength: 28.5,
          },
          processingStats: {
            startTime: '2024-01-01T00:00:00Z',
            endTime: '2024-01-01T00:10:00Z',
            totalDuration: 600000,
            cpuUsage: 65,
            memoryUsage: 512,
          },
        },
      });

      const result = await tool.execute({
        jobId: sampleJobs.completed.jobId,
        format: 'detailed',
        includeDetails: true,
      });

      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('processingStats');
      expect(result.metadata).toMatchObject({
        scenes: expect.any(Number),
        duration: expect.any(Number),
      });
    });
  });

  describe('Caching Behavior', () => {
    it('should cache status for completed jobs', async () => {
      mockCache.get.mockResolvedValue(null);
      mockAPIClient.checkStatus.mockResolvedValue({
        data: sampleJobs.completed,
      });

      const result = await tool.execute({
        jobId: sampleJobs.completed.jobId,
      });

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining(sampleJobs.completed.jobId),
        sampleJobs.completed,
        expect.any(Number) // TTL
      );
      expect(result.status).toBe('completed');
    });

    it('should use cached status when available', async () => {
      mockCache.get.mockResolvedValue(sampleJobs.completed);

      const result = await tool.execute({
        jobId: sampleJobs.completed.jobId,
      });

      expect(mockAPIClient.checkStatus).not.toHaveBeenCalled();
      expect(result).toMatchObject(sampleJobs.completed);
    });

    it('should not cache processing status', async () => {
      mockCache.get.mockResolvedValue(null);
      mockAPIClient.checkStatus.mockResolvedValue({
        data: sampleJobs.processing,
      });

      const result = await tool.execute({
        jobId: sampleJobs.processing.jobId,
      });

      expect(mockCache.set).not.toHaveBeenCalled();
      expect(result.status).toBe('processing');
    });

    it('should bypass cache when force refresh is requested', async () => {
      mockCache.get.mockResolvedValue(sampleJobs.completed);
      mockAPIClient.checkStatus.mockResolvedValue({
        data: { ...sampleJobs.completed, progress: 95 },
      });

      const result = await tool.execute({
        jobId: sampleJobs.completed.jobId,
        forceRefresh: true,
      });

      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockAPIClient.checkStatus).toHaveBeenCalled();
      expect(result.progress).toBe(95);
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid job ID format', async () => {
      await expect(tool.execute({
        jobId: 'invalid-job-id',
      })).rejects.toThrow('Invalid job ID format');

      expect(mockAPIClient.checkStatus).not.toHaveBeenCalled();
    });

    it('should handle job not found error', async () => {
      mockAPIClient.checkStatus.mockRejectedValue({
        response: {
          status: 404,
          data: { message: 'Job not found' },
        },
      });

      await expect(tool.execute({
        jobId: TEST_CONSTANTS.VALID_JOB_ID,
      })).rejects.toThrow('Job not found');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Job not found'),
        expect.objectContaining({ jobId: TEST_CONSTANTS.VALID_JOB_ID })
      );
    });

    it('should handle API connection error', async () => {
      mockAPIClient.checkStatus.mockRejectedValue(new Error('Network error'));

      await expect(tool.execute({
        jobId: TEST_CONSTANTS.VALID_JOB_ID,
      })).rejects.toThrow('Failed to check status');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Status check failed'),
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should handle API timeout', async () => {
      mockAPIClient.checkStatus.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'Request timeout',
      });

      await expect(tool.execute({
        jobId: TEST_CONSTANTS.VALID_JOB_ID,
      })).rejects.toThrow('Request timeout');
    });
  });

  describe('Job ID Validation', () => {
    it('should validate UUID format', async () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        '550e8400-e29b-41d4-a716-446655440000',
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      ];

      for (const uuid of validUUIDs) {
        expect(validateJobId(uuid)).toBe(true);
      }
    });

    it('should reject invalid UUID formats', async () => {
      const invalidUUIDs = [
        '123456',
        'not-a-uuid',
        '123e4567-e89b-12d3-a456',
        '123e4567e89b12d3a456426614174000',
        '',
      ];

      for (const uuid of invalidUUIDs) {
        expect(validateJobId(uuid)).toBe(false);
      }
    });
  });

  describe('Status Transition Validation', () => {
    it('should track status transitions', async () => {
      const transitions = [
        sampleJobs.pending,
        { ...sampleJobs.processing, progress: 25 },
        { ...sampleJobs.processing, progress: 50 },
        { ...sampleJobs.processing, progress: 75 },
        sampleJobs.completed,
      ];

      for (const status of transitions) {
        mockAPIClient.checkStatus.mockResolvedValueOnce({ data: status });
        const result = await tool.execute({
          jobId: TEST_CONSTANTS.VALID_JOB_ID,
        });
        expect(result.status).toBe(status.status);
        expect(result.progress).toBe(status.progress);
      }

      expect(mockAPIClient.checkStatus).toHaveBeenCalledTimes(5);
    });
  });

  describe('Concurrent Status Checks', () => {
    it('should handle multiple concurrent status checks', async () => {
      const jobIds = Array.from({ length: 5 }, (_, i) => 
        `123e4567-e89b-12d3-a456-42661417400${i}`
      );

      mockAPIClient.checkStatus.mockImplementation(async (jobId) => ({
        data: {
          ...sampleJobs.processing,
          jobId,
          progress: Math.floor(Math.random() * 100),
        },
      }));

      const results = await Promise.all(
        jobIds.map(jobId => tool.execute({ jobId }))
      );

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.jobId).toBe(jobIds[i]);
        expect(result.status).toBe('processing');
      });
    });
  });

  describe('Extended Status Information', () => {
    it('should include step details for processing jobs', async () => {
      const stepDetails = {
        segmentation: {
          current: 3,
          total: 5,
          message: 'Analyzing segment 3 of 5',
        },
        analysis: {
          current: 2,
          total: 5,
          message: 'Processing scene 2 of 5',
        },
        synthesis: {
          current: 1,
          total: 1,
          message: 'Generating audio narration',
        },
      };

      mockAPIClient.checkStatus.mockResolvedValue({
        data: {
          ...sampleJobs.processing,
          stepDetails: stepDetails.segmentation,
        },
      });

      const result = await tool.execute({
        jobId: sampleJobs.processing.jobId,
        includeDetails: true,
      });

      expect(result).toHaveProperty('stepDetails');
      expect(result.stepDetails).toMatchObject({
        current: 3,
        total: 5,
      });
    });

    it('should include queue position for pending jobs', async () => {
      mockAPIClient.checkStatus.mockResolvedValue({
        data: {
          ...sampleJobs.pending,
          queuePosition: 5,
          estimatedStartTime: '2024-01-01T00:05:00Z',
        },
      });

      const result = await tool.execute({
        jobId: sampleJobs.pending.jobId,
        includeDetails: true,
      });

      expect(result).toHaveProperty('queuePosition', 5);
      expect(result).toHaveProperty('estimatedStartTime');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failures', async () => {
      let attempts = 0;
      mockAPIClient.checkStatus.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary network error');
        }
        return { data: sampleJobs.processing };
      });

      const result = await tool.execute({
        jobId: TEST_CONSTANTS.VALID_JOB_ID,
        retryAttempts: 3,
      });

      expect(mockAPIClient.checkStatus).toHaveBeenCalledTimes(3);
      expect(result.status).toBe('processing');
    });
  });
});