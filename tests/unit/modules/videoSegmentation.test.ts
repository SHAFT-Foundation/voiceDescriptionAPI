import { mockClient } from 'aws-sdk-client-mock';
import { RekognitionClient, StartSegmentDetectionCommand, GetSegmentDetectionCommand } from '@aws-sdk/client-rekognition';
import { VideoSegmentationModule } from '../../../src/modules/videoSegmentation';
import { VideoSegment } from '../../../src/types';

const rekognitionMock = mockClient(RekognitionClient);

describe('VideoSegmentationModule', () => {
  let videoSegmentation: VideoSegmentationModule;

  beforeEach(() => {
    rekognitionMock.reset();
    videoSegmentation = new VideoSegmentationModule({
      region: 'us-east-1',
      inputBucket: 'test-input-bucket',
      outputBucket: 'test-output-bucket',
    });
  });

  describe('startSegmentDetection', () => {
    test('should start segment detection job successfully', async () => {
      const s3Uri = 's3://test-input-bucket/test-video.mp4';
      const expectedJobId = 'mock-rekognition-job-id';

      rekognitionMock.on(StartSegmentDetectionCommand).resolves({
        JobId: expectedJobId,
      });

      const result = await videoSegmentation.startSegmentDetection(s3Uri);

      expect(result.success).toBe(true);
      expect(result.data?.rekognitionJobId).toBe(expectedJobId);
      
      const startCommand = rekognitionMock.commandCalls(StartSegmentDetectionCommand)[0];
      expect(startCommand.args[0].input.Video?.S3Object?.Bucket).toBe('test-input-bucket');
      expect(startCommand.args[0].input.Video?.S3Object?.Name).toBe('test-video.mp4');
      expect(startCommand.args[0].input.SegmentTypes).toContain('TECHNICAL_CUE');
      expect(startCommand.args[0].input.SegmentTypes).toContain('SHOT');
    });

    test('should handle invalid S3 URI', async () => {
      const invalidS3Uri = 'https://example.com/video.mp4';

      const result = await videoSegmentation.startSegmentDetection(invalidS3Uri);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_S3_URI');
      expect(rekognitionMock.commandCalls(StartSegmentDetectionCommand)).toHaveLength(0);
    });

    test('should handle Rekognition API errors', async () => {
      const s3Uri = 's3://test-input-bucket/test-video.mp4';

      rekognitionMock.on(StartSegmentDetectionCommand).rejects(
        new Error('InvalidS3ObjectException')
      );

      const result = await videoSegmentation.startSegmentDetection(s3Uri);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REKOGNITION_START_FAILED');
    });
  });

  describe('pollSegmentDetectionJob', () => {
    test('should successfully poll completed job and return segments', async () => {
      const rekognitionJobId = 'mock-job-id';
      const mockSegments: VideoSegment[] = [
        {
          startTime: 0,
          endTime: 5.5,
          confidence: 99.8,
          type: 'SHOT',
        },
        {
          startTime: 5.5,
          endTime: 12.3,
          confidence: 98.2,
          type: 'SHOT',
        },
      ];

      rekognitionMock.on(GetSegmentDetectionCommand).resolves({
        JobStatus: 'SUCCEEDED',
        Segments: [
          {
            Type: 'SHOT',
            StartTimestampMillis: 0,
            EndTimestampMillis: 5500,
            ShotSegment: {
              Confidence: 99.8,
            },
          },
          {
            Type: 'SHOT',
            StartTimestampMillis: 5500,
            EndTimestampMillis: 12300,
            ShotSegment: {
              Confidence: 98.2,
            },
          },
        ],
      });

      const result = await videoSegmentation.pollSegmentDetectionJob(rekognitionJobId);

      expect(result.success).toBe(true);
      expect(result.data?.segments).toHaveLength(2);
      expect(result.data?.segments[0].startTime).toBe(0);
      expect(result.data?.segments[0].endTime).toBe(5.5);
      expect(result.data?.segments[0].confidence).toBe(99.8);
      expect(result.data?.segments[0].type).toBe('SHOT');
    });

    test('should handle job still in progress', async () => {
      const rekognitionJobId = 'mock-job-id';

      rekognitionMock.on(GetSegmentDetectionCommand).resolves({
        JobStatus: 'IN_PROGRESS',
      });

      const result = await videoSegmentation.pollSegmentDetectionJob(rekognitionJobId);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('IN_PROGRESS');
      expect(result.data?.segments).toBeUndefined();
    });

    test('should handle failed job', async () => {
      const rekognitionJobId = 'mock-job-id';

      rekognitionMock.on(GetSegmentDetectionCommand).resolves({
        JobStatus: 'FAILED',
        StatusMessage: 'Video format not supported',
      });

      const result = await videoSegmentation.pollSegmentDetectionJob(rekognitionJobId);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('REKOGNITION_JOB_FAILED');
      expect(result.error?.details).toContain('Video format not supported');
    });

    test('should handle pagination for large result sets', async () => {
      const rekognitionJobId = 'mock-job-id';

      // First page
      rekognitionMock.on(GetSegmentDetectionCommand).resolvesOnce({
        JobStatus: 'SUCCEEDED',
        NextToken: 'next-page-token',
        Segments: [
          {
            Type: 'SHOT',
            StartTimestampMillis: 0,
            EndTimestampMillis: 5000,
            ShotSegment: { Confidence: 99.0 },
          },
        ],
      });

      // Second page
      rekognitionMock.on(GetSegmentDetectionCommand).resolvesOnce({
        JobStatus: 'SUCCEEDED',
        Segments: [
          {
            Type: 'SHOT',
            StartTimestampMillis: 5000,
            EndTimestampMillis: 10000,
            ShotSegment: { Confidence: 98.0 },
          },
        ],
      });

      const result = await videoSegmentation.pollSegmentDetectionJob(rekognitionJobId);

      expect(result.success).toBe(true);
      expect(result.data?.segments).toHaveLength(2);
      expect(rekognitionMock.commandCalls(GetSegmentDetectionCommand)).toHaveLength(2);
    });
  });

  describe('processSegmentationResults', () => {
    test('should filter and sort segments correctly', async () => {
      const s3Uri = 's3://test-input-bucket/test-video.mp4';
      const jobId = 'test-job-id';

      // Mock start detection
      rekognitionMock.on(StartSegmentDetectionCommand).resolves({
        JobId: 'rekognition-job-id',
      });

      // Mock successful job completion
      rekognitionMock.on(GetSegmentDetectionCommand).resolves({
        JobStatus: 'SUCCEEDED',
        Segments: [
          {
            Type: 'SHOT',
            StartTimestampMillis: 10000,
            EndTimestampMillis: 15000,
            ShotSegment: { Confidence: 95.0 },
          },
          {
            Type: 'SHOT',
            StartTimestampMillis: 0,
            EndTimestampMillis: 5000,
            ShotSegment: { Confidence: 99.0 },
          },
          {
            Type: 'SHOT',
            StartTimestampMillis: 5000,
            EndTimestampMillis: 10000,
            ShotSegment: { Confidence: 60.0 }, // Low confidence, should be filtered
          },
        ],
      });

      const result = await videoSegmentation.processSegmentationResults(s3Uri, jobId);

      expect(result.success).toBe(true);
      expect(result.data?.segments).toHaveLength(2); // One filtered out due to low confidence
      
      // Should be sorted by start time
      expect(result.data?.segments[0].startTime).toBe(0);
      expect(result.data?.segments[1].startTime).toBe(10);
    });

    test('should handle timeout for long-running jobs', async () => {
      const s3Uri = 's3://test-input-bucket/test-video.mp4';
      const jobId = 'test-job-id';

      // Mock start detection
      rekognitionMock.on(StartSegmentDetectionCommand).resolves({
        JobId: 'rekognition-job-id',
      });

      // Mock job that never completes
      rekognitionMock.on(GetSegmentDetectionCommand).resolves({
        JobStatus: 'IN_PROGRESS',
      });

      // Set a very short timeout for testing
      const result = await videoSegmentation.processSegmentationResults(s3Uri, jobId, 1000);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SEGMENTATION_TIMEOUT');
    }, 10000);
  });

  describe('parseS3Uri', () => {
    test('should correctly parse valid S3 URI', () => {
      const s3Uri = 's3://my-bucket/path/to/video.mp4';
      const result = videoSegmentation.parseS3Uri(s3Uri);

      expect(result.bucket).toBe('my-bucket');
      expect(result.key).toBe('path/to/video.mp4');
    });

    test('should throw error for invalid S3 URI', () => {
      expect(() => {
        videoSegmentation.parseS3Uri('https://example.com/video.mp4');
      }).toThrow('Invalid S3 URI format');
    });
  });
});