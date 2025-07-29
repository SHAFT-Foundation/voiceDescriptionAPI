import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { VideoInputModule } from '../../../src/modules/videoInput';
import { UploadRequest } from '../../../src/types';

const s3Mock = mockClient(S3Client);

describe('VideoInputModule', () => {
  let videoInput: VideoInputModule;

  beforeEach(() => {
    s3Mock.reset();
    videoInput = new VideoInputModule({
      region: 'us-east-1',
      inputBucket: 'test-input-bucket',
      outputBucket: 'test-output-bucket',
    });
  });

  describe('uploadFile', () => {
    test('should upload video file to S3 with correct parameters', async () => {
      const mockBuffer = Buffer.from('mock video data');
      const uploadRequest: UploadRequest = {
        file: mockBuffer,
        metadata: {
          title: 'Test Video',
          description: 'Test video description',
          language: 'en',
        },
      };

      s3Mock.on(PutObjectCommand).resolves({
        ETag: '"mock-etag"',
        Location: 's3://test-input-bucket/mock-key',
      });

      const result = await videoInput.uploadFile(uploadRequest);

      expect(result.success).toBe(true);
      expect(result.data?.s3Uri).toMatch(/^s3:\/\/test-input-bucket\//);
      expect(result.data?.jobId).toBeDefined();
      
      const putObjectCall = s3Mock.commandCalls(PutObjectCommand)[0];
      expect(putObjectCall.args[0].input.Bucket).toBe('test-input-bucket');
      expect(putObjectCall.args[0].input.Body).toBe(mockBuffer);
      expect(putObjectCall.args[0].input.ContentType).toBe('video/mp4');
    });

    test('should validate file size and reject oversized files', async () => {
      const oversizedBuffer = Buffer.alloc(600 * 1024 * 1024); // 600MB
      const uploadRequest: UploadRequest = {
        file: oversizedBuffer,
      };

      const result = await videoInput.uploadFile(uploadRequest);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
      expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
    });

    test('should validate file format and reject unsupported formats', async () => {
      const textBuffer = Buffer.from('This is not a video file');
      const uploadRequest: UploadRequest = {
        file: textBuffer,
      };

      const result = await videoInput.uploadFile(uploadRequest);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_FILE_FORMAT');
    });

    test('should handle S3 upload errors gracefully', async () => {
      const mockBuffer = Buffer.from('mock video data');
      const uploadRequest: UploadRequest = {
        file: mockBuffer,
      };

      s3Mock.on(PutObjectCommand).rejects(new Error('S3 service unavailable'));

      const result = await videoInput.uploadFile(uploadRequest);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UPLOAD_FAILED');
      expect(result.error?.message).toContain('S3 service unavailable');
    });
  });

  describe('validateS3Uri', () => {
    test('should validate correct S3 URI', async () => {
      const s3Uri = 's3://test-input-bucket/valid-video.mp4';
      
      s3Mock.on(HeadObjectCommand).resolves({
        ContentLength: 1024 * 1024,
        ContentType: 'video/mp4',
        LastModified: new Date(),
      });

      const result = await videoInput.validateS3Uri(s3Uri);

      expect(result.success).toBe(true);
      expect(result.data?.exists).toBe(true);
      expect(result.data?.size).toBe(1024 * 1024);
    });

    test('should reject invalid S3 URI format', async () => {
      const invalidUri = 'https://example.com/video.mp4';

      const result = await videoInput.validateS3Uri(invalidUri);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_S3_URI');
    });

    test('should handle non-existent S3 objects', async () => {
      const s3Uri = 's3://test-input-bucket/nonexistent.mp4';
      
      s3Mock.on(HeadObjectCommand).rejects({ name: 'NotFound' });

      const result = await videoInput.validateS3Uri(s3Uri);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('generateJobId', () => {
    test('should generate unique job IDs', () => {
      const jobId1 = videoInput.generateJobId();
      const jobId2 = videoInput.generateJobId();

      expect(jobId1).toBeDefined();
      expect(jobId2).toBeDefined();
      expect(jobId1).not.toBe(jobId2);
      expect(jobId1).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    });
  });

  describe('getSignedUploadUrl', () => {
    test('should generate signed upload URL for large files', async () => {
      const fileName = 'large-video.mp4';
      const contentType = 'video/mp4';

      const result = await videoInput.getSignedUploadUrl(fileName, contentType);

      expect(result.success).toBe(true);
      expect(result.data?.uploadUrl).toContain('test-input-bucket');
      expect(result.data?.s3Key).toBeDefined();
      expect(result.data?.jobId).toBeDefined();
    });
  });
});