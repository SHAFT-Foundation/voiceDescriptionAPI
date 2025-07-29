import { SceneExtractionModule } from '../../../src/modules/sceneExtraction';
import { VideoSegment } from '../../../src/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fluent-ffmpeg
const mockFfmpeg = {
  input: jest.fn().mockReturnThis(),
  seekInput: jest.fn().mockReturnThis(),
  duration: jest.fn().mockReturnThis(),
  output: jest.fn().mockReturnThis(),
  run: jest.fn(),
  on: jest.fn().mockReturnThis(),
  save: jest.fn().mockReturnThis(),
};

jest.mock('fluent-ffmpeg', () => {
  return jest.fn(() => mockFfmpeg);
});

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    unlink: jest.fn(),
    access: jest.fn(),
    stat: jest.fn(),
  },
  constants: {
    F_OK: 0,
  },
}));

// Mock AWS S3 for downloading
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn(),
  })),
  GetObjectCommand: jest.fn(),
}));

describe('SceneExtractionModule', () => {
  let sceneExtraction: SceneExtractionModule;
  const mockSegments: VideoSegment[] = [
    { startTime: 0, endTime: 5.5, confidence: 99.0, type: 'SHOT' },
    { startTime: 5.5, endTime: 12.3, confidence: 98.0, type: 'SHOT' },
    { startTime: 12.3, endTime: 20.0, confidence: 95.0, type: 'SHOT' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    sceneExtraction = new SceneExtractionModule({
      region: 'us-east-1',
      inputBucket: 'test-input-bucket',
      outputBucket: 'test-output-bucket',
    });
  });

  describe('extractScenes', () => {
    test('should extract all scenes successfully', async () => {
      const s3Uri = 's3://test-input-bucket/test-video.mp4';
      const jobId = 'test-job-id';

      // Mock S3 download
      const mockS3Client = require('@aws-sdk/client-s3').S3Client;
      mockS3Client.prototype.send = jest.fn().mockResolvedValue({
        Body: {
          transformToWebStream: () => ({
            pipeTo: jest.fn().mockResolvedValue(undefined),
          }),
        },
      });

      // Mock fs operations
      const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.access.mockResolvedValue(undefined);
      fsMock.unlink.mockResolvedValue(undefined);

      // Mock successful FFmpeg extraction
      mockFfmpeg.run.mockImplementation((callback) => {
        callback(null); // Success
      });

      const result = await sceneExtraction.extractScenes(s3Uri, mockSegments, jobId);

      expect(result.success).toBe(true);
      expect(result.data?.extractedScenes).toHaveLength(3);
      expect(result.data?.extractedScenes[0].segmentId).toContain('segment-0');
      expect(result.data?.extractedScenes[0].localPath).toContain('.mp4');

      // Verify FFmpeg was called for each segment
      expect(mockFfmpeg.run).toHaveBeenCalledTimes(3);
    });

    test('should handle FFmpeg extraction errors gracefully', async () => {
      const s3Uri = 's3://test-input-bucket/test-video.mp4';
      const jobId = 'test-job-id';

      // Mock S3 download success
      const mockS3Client = require('@aws-sdk/client-s3').S3Client;
      mockS3Client.prototype.send = jest.fn().mockResolvedValue({
        Body: {
          transformToWebStream: () => ({
            pipeTo: jest.fn().mockResolvedValue(undefined),
          }),
        },
      });

      const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.access.mockResolvedValue(undefined);

      // Mock FFmpeg failure for second segment
      mockFfmpeg.run
        .mockImplementationOnce((callback) => callback(null)) // First segment succeeds
        .mockImplementationOnce((callback) => callback(new Error('FFmpeg failed'))) // Second fails
        .mockImplementationOnce((callback) => callback(null)); // Third succeeds

      const result = await sceneExtraction.extractScenes(s3Uri, mockSegments, jobId);

      expect(result.success).toBe(true);
      expect(result.data?.extractedScenes).toHaveLength(2); // Only successful extractions
      expect(result.data?.errors).toHaveLength(1);
      expect(result.data?.errors[0]).toContain('segment-1');
    });

    test('should handle parallel processing with concurrency limit', async () => {
      const s3Uri = 's3://test-input-bucket/test-video.mp4';
      const jobId = 'test-job-id';
      const manySegments: VideoSegment[] = Array.from({ length: 10 }, (_, i) => ({
        startTime: i * 10,
        endTime: (i + 1) * 10,
        confidence: 95.0,
        type: 'SHOT',
      }));

      // Mock S3 download
      const mockS3Client = require('@aws-sdk/client-s3').S3Client;
      mockS3Client.prototype.send = jest.fn().mockResolvedValue({
        Body: {
          transformToWebStream: () => ({
            pipeTo: jest.fn().mockResolvedValue(undefined),
          }),
        },
      });

      const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.access.mockResolvedValue(undefined);

      // Track concurrent executions
      let concurrentCount = 0;
      let maxConcurrent = 0;

      mockFfmpeg.run.mockImplementation((callback) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        
        setTimeout(() => {
          concurrentCount--;
          callback(null);
        }, 100);
      });

      const result = await sceneExtraction.extractScenes(s3Uri, manySegments, jobId);

      expect(result.success).toBe(true);
      expect(result.data?.extractedScenes).toHaveLength(10);
      expect(maxConcurrent).toBeLessThanOrEqual(3); // Default concurrency limit
    }, 10000);

    test('should clean up temporary files on completion', async () => {
      const s3Uri = 's3://test-input-bucket/test-video.mp4';
      const jobId = 'test-job-id';

      const mockS3Client = require('@aws-sdk/client-s3').S3Client;
      mockS3Client.prototype.send = jest.fn().mockResolvedValue({
        Body: {
          transformToWebStream: () => ({
            pipeTo: jest.fn().mockResolvedValue(undefined),
          }),
        },
      });

      const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;
      fsMock.mkdir.mockResolvedValue(undefined);
      fsMock.access.mockResolvedValue(undefined);
      fsMock.unlink.mockResolvedValue(undefined);

      mockFfmpeg.run.mockImplementation((callback) => callback(null));

      await sceneExtraction.extractScenes(s3Uri, mockSegments, jobId);

      // Should clean up the downloaded video file
      expect(fsMock.unlink).toHaveBeenCalledWith(
        expect.stringContaining('test-video.mp4')
      );
    });
  });

  describe('downloadVideoFromS3', () => {
    test('should download video file successfully', async () => {
      const s3Uri = 's3://test-input-bucket/test-video.mp4';
      const localPath = '/tmp/test-video.mp4';

      const mockS3Client = require('@aws-sdk/client-s3').S3Client;
      mockS3Client.prototype.send = jest.fn().mockResolvedValue({
        Body: {
          transformToWebStream: () => ({
            pipeTo: jest.fn().mockResolvedValue(undefined),
          }),
        },
      });

      const result = await sceneExtraction.downloadVideoFromS3(s3Uri, localPath);

      expect(result.success).toBe(true);
      expect(result.data?.localPath).toBe(localPath);
    });

    test('should handle S3 download errors', async () => {
      const s3Uri = 's3://test-input-bucket/nonexistent.mp4';
      const localPath = '/tmp/nonexistent.mp4';

      const mockS3Client = require('@aws-sdk/client-s3').S3Client;
      mockS3Client.prototype.send = jest.fn().mockRejectedValue(
        new Error('NoSuchKey')
      );

      const result = await sceneExtraction.downloadVideoFromS3(s3Uri, localPath);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DOWNLOAD_FAILED');
    });
  });

  describe('extractSingleScene', () => {
    test('should extract single scene with correct FFmpeg parameters', async () => {
      const segment = mockSegments[0];
      const inputPath = '/tmp/input-video.mp4';
      const outputPath = '/tmp/scene-0.mp4';

      mockFfmpeg.run.mockImplementation((callback) => {
        callback(null); // Success
      });

      const result = await sceneExtraction.extractSingleScene(
        segment,
        inputPath,
        outputPath,
        'segment-0'
      );

      expect(result.success).toBe(true);
      expect(result.data?.segmentId).toBe('segment-0');
      expect(result.data?.localPath).toBe(outputPath);

      // Verify FFmpeg was configured correctly
      expect(mockFfmpeg.input).toHaveBeenCalledWith(inputPath);
      expect(mockFfmpeg.seekInput).toHaveBeenCalledWith(0);
      expect(mockFfmpeg.duration).toHaveBeenCalledWith(5.5);
      expect(mockFfmpeg.output).toHaveBeenCalledWith(outputPath);
    });

    test('should handle FFmpeg errors', async () => {
      const segment = mockSegments[0];
      const inputPath = '/tmp/input-video.mp4';
      const outputPath = '/tmp/scene-0.mp4';

      mockFfmpeg.run.mockImplementation((callback) => {
        callback(new Error('FFmpeg extraction failed'));
      });

      const result = await sceneExtraction.extractSingleScene(
        segment,
        inputPath,
        outputPath,
        'segment-0'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXTRACTION_FAILED');
      expect(result.error?.details).toContain('FFmpeg extraction failed');
    });
  });

  describe('generateTempPaths', () => {
    test('should generate unique temporary paths', () => {
      const jobId = 'test-job-id';
      const s3Uri = 's3://bucket/video.mp4';

      const paths1 = sceneExtraction.generateTempPaths(jobId, s3Uri);
      const paths2 = sceneExtraction.generateTempPaths(jobId, s3Uri);

      expect(paths1.inputVideo).toBeDefined();
      expect(paths1.outputDir).toBeDefined();
      expect(paths1.inputVideo).not.toBe(paths2.inputVideo);
      expect(paths1.outputDir).not.toBe(paths2.outputDir);
    });
  });

  describe('cleanup', () => {
    test('should clean up all temporary files and directories', async () => {
      const tempDir = '/tmp/test-cleanup';
      const tempFiles = ['/tmp/file1.mp4', '/tmp/file2.mp4'];

      const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;
      fsMock.unlink.mockResolvedValue(undefined);

      await sceneExtraction.cleanup(tempFiles, tempDir);

      expect(fsMock.unlink).toHaveBeenCalledTimes(tempFiles.length);
      tempFiles.forEach(file => {
        expect(fsMock.unlink).toHaveBeenCalledWith(file);
      });
    });

    test('should handle cleanup errors gracefully', async () => {
      const tempFiles = ['/tmp/nonexistent.mp4'];

      const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;
      fsMock.unlink.mockRejectedValue(new Error('File not found'));

      // Should not throw
      await expect(sceneExtraction.cleanup(tempFiles)).resolves.toBeUndefined();
    });
  });
});