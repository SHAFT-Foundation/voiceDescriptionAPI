/**
 * Unit Tests for voice_description_upload_video MCP Tool
 */

import { UploadVideoTool } from '@mcp/tools/video/upload';
import { ToolRegistry } from '@mcp/tools/registry';
import { ValidationError, SecurityError } from '../../utils/testHelpers';
import { createMockAWSServices } from '../../utils/testHelpers';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('UploadVideoTool', () => {
  let tool: UploadVideoTool;
  let mockAWS: ReturnType<typeof createMockAWSServices>;
  let mockRegistry: jest.Mocked<ToolRegistry>;

  beforeEach(() => {
    mockAWS = createMockAWSServices();
    mockRegistry = {
      register: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      validate: jest.fn()
    } as any;

    tool = new UploadVideoTool({
      s3Client: mockAWS.s3 as any,
      registry: mockRegistry
    });

    jest.clearAllMocks();
  });

  describe('Parameter Validation', () => {
    test('should validate required file_path parameter', async () => {
      await expect(
        tool.execute({})
      ).rejects.toThrow(ValidationError);

      await expect(
        tool.execute({ file_path: null })
      ).rejects.toThrow(ValidationError);

      await expect(
        tool.execute({ file_path: '' })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate file_path format', async () => {
      const invalidPaths = [
        'http://example.com/file.mp4', // URLs not allowed
        'file://./video.mp4', // File protocol not allowed
        '../../etc/passwd', // Path traversal
        '/etc/passwd; rm -rf /', // Command injection
        'video<script>.mp4' // XSS attempt
      ];

      for (const invalidPath of invalidPaths) {
        await expect(
          tool.execute({ file_path: invalidPath })
        ).rejects.toThrow(ValidationError);
      }
    });

    test('should validate optional language parameter', async () => {
      const validLanguages = ['en', 'es', 'fr', 'de', 'ja', 'zh'];
      
      for (const lang of validLanguages) {
        const result = await tool.validateParameters({
          file_path: '/valid/path.mp4',
          language: lang
        });
        expect(result.valid).toBe(true);
      }

      await expect(
        tool.execute({
          file_path: '/valid/path.mp4',
          language: 'invalid-lang'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate detail_level parameter', async () => {
      const validLevels = ['basic', 'detailed', 'comprehensive'];
      
      for (const level of validLevels) {
        const result = await tool.validateParameters({
          file_path: '/valid/path.mp4',
          detail_level: level
        });
        expect(result.valid).toBe(true);
      }

      await expect(
        tool.execute({
          file_path: '/valid/path.mp4',
          detail_level: 'super-detailed'
        })
      ).rejects.toThrow(ValidationError);
    });

    test('should validate voice_id parameter', async () => {
      const validVoices = ['Joanna', 'Matthew', 'Amy', 'Brian'];
      
      for (const voice of validVoices) {
        const result = await tool.validateParameters({
          file_path: '/valid/path.mp4',
          voice_id: voice
        });
        expect(result.valid).toBe(true);
      }
    });

    test('should apply default values for optional parameters', async () => {
      const params = tool.applyDefaults({
        file_path: '/valid/path.mp4'
      });

      expect(params.language).toBe('en');
      expect(params.detail_level).toBe('detailed');
      expect(params.voice_id).toBe('Joanna');
      expect(params.wait_for_completion).toBe(false);
    });
  });

  describe('File Validation', () => {
    test('should accept valid video formats', async () => {
      const validFormats = [
        'video.mp4',
        'video.avi',
        'video.mov',
        'video.mkv',
        'video.webm',
        'video.m4v',
        'video.flv',
        'video.wmv',
        'VIDEO.MP4', // Case insensitive
        'my.video.mp4' // Multiple dots
      ];

      for (const filename of validFormats) {
        const result = await tool.validateFileFormat(filename);
        expect(result).toBe(true);
      }
    });

    test('should reject invalid file formats', async () => {
      const invalidFormats = [
        'document.pdf',
        'image.jpg',
        'audio.mp3',
        'script.js',
        'video.txt',
        'video', // No extension
        '.mp4' // No filename
      ];

      for (const filename of invalidFormats) {
        await expect(
          tool.execute({ file_path: `/path/${filename}` })
        ).rejects.toThrow(ValidationError);
      }
    });

    test('should enforce file size limits', async () => {
      const mockStat = jest.spyOn(fs, 'stat');
      
      // File within limit (400MB)
      mockStat.mockResolvedValueOnce({
        size: 400 * 1024 * 1024,
        isFile: () => true
      } as any);
      
      const result1 = await tool.validateFileSize('/path/video.mp4');
      expect(result1).toBe(true);

      // File exceeding limit (600MB)
      mockStat.mockResolvedValueOnce({
        size: 600 * 1024 * 1024,
        isFile: () => true
      } as any);
      
      await expect(
        tool.validateFileSize('/path/large-video.mp4')
      ).rejects.toThrow('File size exceeds maximum limit of 500MB');

      mockStat.mockRestore();
    });

    test('should check file existence', async () => {
      const mockAccess = jest.spyOn(fs, 'access');
      
      // File exists
      mockAccess.mockResolvedValueOnce(undefined);
      await expect(
        tool.checkFileExists('/existing/file.mp4')
      ).resolves.toBe(true);

      // File doesn't exist
      mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
      await expect(
        tool.execute({ file_path: '/nonexistent/file.mp4' })
      ).rejects.toThrow('File not found');

      mockAccess.mockRestore();
    });
  });

  describe('S3 Upload', () => {
    test('should upload file to S3 with correct parameters', async () => {
      const mockReadStream = {
        pipe: jest.fn(),
        on: jest.fn()
      };
      
      jest.spyOn(fs, 'createReadStream' as any).mockReturnValue(mockReadStream);
      jest.spyOn(fs, 'stat').mockResolvedValue({
        size: 100 * 1024 * 1024,
        isFile: () => true
      } as any);
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      const result = await tool.execute({
        file_path: '/path/video.mp4',
        title: 'Test Video',
        description: 'Test Description'
      });

      expect(mockAWS.s3.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: expect.any(String),
          Key: expect.stringMatching(/^videos\/.*\.mp4$/),
          Body: expect.any(Object),
          ContentType: 'video/mp4',
          Metadata: expect.objectContaining({
            title: 'Test Video',
            description: 'Test Description',
            originalFilename: 'video.mp4'
          })
        })
      );

      expect(result.success).toBe(true);
      expect(result.job_id).toMatch(/^[0-9a-f-]+$/);
      expect(result.status).toBe('processing');
    });

    test('should handle multipart upload for large files', async () => {
      jest.spyOn(fs, 'stat').mockResolvedValue({
        size: 200 * 1024 * 1024, // 200MB triggers multipart
        isFile: () => true
      } as any);
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      const mockMultipartUpload = {
        promise: jest.fn().mockResolvedValue({
          Location: 's3://bucket/key',
          ETag: '"abc123"'
        })
      };

      mockAWS.s3.createMultipartUpload = jest.fn().mockReturnValue(mockMultipartUpload);
      mockAWS.s3.uploadPart = jest.fn().mockReturnValue({
        promise: jest.fn().mockResolvedValue({ ETag: '"part1"' })
      });
      mockAWS.s3.completeMultipartUpload = jest.fn().mockReturnValue(mockMultipartUpload);

      await tool.execute({
        file_path: '/path/large-video.mp4'
      });

      expect(mockAWS.s3.createMultipartUpload).toHaveBeenCalled();
    });

    test('should retry S3 upload on transient failures', async () => {
      jest.spyOn(fs, 'stat').mockResolvedValue({
        size: 10 * 1024 * 1024,
        isFile: () => true
      } as any);
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      // Fail twice, succeed on third attempt
      mockAWS.s3.upload
        .mockRejectedValueOnce(new Error('RequestTimeout'))
        .mockRejectedValueOnce(new Error('ServiceUnavailable'))
        .mockResolvedValueOnce({
          Location: 's3://bucket/key',
          ETag: '"abc123"',
          Key: 'test-key',
          Bucket: 'test-bucket'
        });

      const result = await tool.execute({
        file_path: '/path/video.mp4',
        retry_config: {
          max_attempts: 3,
          backoff_multiplier: 2
        }
      });

      expect(result.success).toBe(true);
      expect(mockAWS.s3.upload).toHaveBeenCalledTimes(3);
    });

    test('should fail after max retry attempts', async () => {
      jest.spyOn(fs, 'stat').mockResolvedValue({
        size: 10 * 1024 * 1024,
        isFile: () => true
      } as any);
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      mockAWS.s3.upload.mockRejectedValue(new Error('PermanentFailure'));

      await expect(
        tool.execute({
          file_path: '/path/video.mp4',
          retry_config: {
            max_attempts: 2
          }
        })
      ).rejects.toThrow('PermanentFailure');

      expect(mockAWS.s3.upload).toHaveBeenCalledTimes(2);
    });
  });

  describe('Job Creation', () => {
    test('should create job record with correct metadata', async () => {
      jest.spyOn(fs, 'stat').mockResolvedValue({
        size: 50 * 1024 * 1024,
        isFile: () => true
      } as any);
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      const mockJobManager = {
        createJob: jest.fn().mockResolvedValue({
          job_id: 'test-job-123',
          status: 'queued'
        })
      };

      tool.setJobManager(mockJobManager as any);

      const result = await tool.execute({
        file_path: '/path/video.mp4',
        title: 'Educational Video',
        language: 'es',
        detail_level: 'comprehensive',
        voice_id: 'Miguel'
      });

      expect(mockJobManager.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'video_processing',
          input: expect.objectContaining({
            file_path: expect.any(String),
            s3_uri: expect.any(String),
            title: 'Educational Video'
          }),
          config: expect.objectContaining({
            language: 'es',
            detail_level: 'comprehensive',
            voice_id: 'Miguel'
          }),
          metadata: expect.objectContaining({
            file_size: 50 * 1024 * 1024,
            file_format: 'mp4',
            estimated_processing_time: expect.any(Number)
          })
        })
      );
    });

    test('should handle synchronous processing when wait_for_completion is true', async () => {
      jest.spyOn(fs, 'stat').mockResolvedValue({
        size: 10 * 1024 * 1024,
        isFile: () => true
      } as any);
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      const mockJobManager = {
        createJob: jest.fn().mockResolvedValue({
          job_id: 'sync-job-123',
          status: 'processing'
        }),
        waitForCompletion: jest.fn().mockResolvedValue({
          job_id: 'sync-job-123',
          status: 'completed',
          results: {
            text_description: 'Video description',
            audio_url: 's3://bucket/audio.mp3'
          }
        })
      };

      tool.setJobManager(mockJobManager as any);

      const result = await tool.execute({
        file_path: '/path/video.mp4',
        wait_for_completion: true
      });

      expect(mockJobManager.waitForCompletion).toHaveBeenCalledWith('sync-job-123');
      expect(result.status).toBe('completed');
      expect(result.results).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should sanitize error messages for user output', async () => {
      const sensitiveError = new Error('Failed to connect to internal-db.aws.internal:5432 with password abc123');
      
      mockAWS.s3.upload.mockRejectedValue(sensitiveError);
      
      jest.spyOn(fs, 'stat').mockResolvedValue({
        size: 10 * 1024 * 1024,
        isFile: () => true
      } as any);
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      try {
        await tool.execute({ file_path: '/path/video.mp4' });
      } catch (error: any) {
        expect(error.message).not.toContain('internal-db.aws.internal');
        expect(error.message).not.toContain('abc123');
        expect(error.message).toContain('Failed to upload file');
      }
    });

    test('should clean up resources on failure', async () => {
      jest.spyOn(fs, 'stat').mockResolvedValue({
        size: 10 * 1024 * 1024,
        isFile: () => true
      } as any);
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      // Upload succeeds but job creation fails
      mockAWS.s3.upload.mockResolvedValue({
        Location: 's3://bucket/key',
        Key: 'test-key',
        Bucket: 'test-bucket'
      });

      const mockJobManager = {
        createJob: jest.fn().mockRejectedValue(new Error('Database error'))
      };

      tool.setJobManager(mockJobManager as any);

      await expect(
        tool.execute({ file_path: '/path/video.mp4' })
      ).rejects.toThrow();

      // Should clean up S3 object
      expect(mockAWS.s3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-key'
      });
    });

    test('should handle concurrent upload attempts gracefully', async () => {
      jest.spyOn(fs, 'stat').mockResolvedValue({
        size: 10 * 1024 * 1024,
        isFile: () => true
      } as any);
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      const filePath = '/path/same-video.mp4';
      
      // Simulate concurrent uploads of the same file
      const promises = Array(5).fill(null).map(() => 
        tool.execute({ 
          file_path: filePath,
          deduplicate: true 
        })
      );

      const results = await Promise.all(promises);
      
      // Should return the same job ID for duplicate uploads
      const jobIds = results.map(r => r.job_id);
      const uniqueJobIds = new Set(jobIds);
      
      expect(uniqueJobIds.size).toBe(1);
      expect(mockAWS.s3.upload).toHaveBeenCalledTimes(1);
    });
  });

  describe('Progress Tracking', () => {
    test('should emit progress events during upload', async () => {
      jest.spyOn(fs, 'stat').mockResolvedValue({
        size: 100 * 1024 * 1024,
        isFile: () => true
      } as any);
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      const progressEvents: any[] = [];
      
      tool.on('progress', (event) => {
        progressEvents.push(event);
      });

      // Mock S3 upload with progress
      mockAWS.s3.upload.mockImplementation(() => ({
        on: (event: string, callback: Function) => {
          if (event === 'httpUploadProgress') {
            // Simulate progress events
            setTimeout(() => callback({ loaded: 25000000, total: 100000000 }), 10);
            setTimeout(() => callback({ loaded: 50000000, total: 100000000 }), 20);
            setTimeout(() => callback({ loaded: 100000000, total: 100000000 }), 30);
          }
          return this;
        },
        promise: () => Promise.resolve({
          Location: 's3://bucket/key',
          Key: 'test-key',
          Bucket: 'test-bucket'
        })
      }));

      await tool.execute({ file_path: '/path/video.mp4' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].percentage).toBe(100);
    });
  });
});