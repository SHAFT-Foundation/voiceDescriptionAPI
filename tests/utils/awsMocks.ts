/**
 * AWS Service Mocking Utilities
 * Provides comprehensive mocking for AWS SDK clients used in image processing
 */

import { mockClient } from 'aws-sdk-client-mock';
import { 
  S3Client, 
  PutObjectCommand, 
  HeadObjectCommand, 
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand
} from '@aws-sdk/client-s3';
import { 
  BedrockRuntimeClient, 
  InvokeModelCommand 
} from '@aws-sdk/client-bedrock-runtime';
import { 
  PollyClient, 
  SynthesizeSpeechCommand 
} from '@aws-sdk/client-polly';
import {
  RekognitionClient,
  StartSegmentDetectionCommand,
  GetSegmentDetectionCommand
} from '@aws-sdk/client-rekognition';
import { 
  CloudWatchLogsClient, 
  CreateLogGroupCommand, 
  PutLogEventsCommand 
} from '@aws-sdk/client-cloudwatch-logs';
import { MOCK_BEDROCK_RESPONSES, MOCK_S3_RESPONSES } from '../fixtures/imageTestData';

// Create mock clients
export const s3Mock = mockClient(S3Client);
export const bedrockMock = mockClient(BedrockRuntimeClient);
export const pollyMock = mockClient(PollyClient);
export const rekognitionMock = mockClient(RekognitionClient);
export const cloudWatchMock = mockClient(CloudWatchLogsClient);

/**
 * Reset all AWS mocks to clean state
 */
export function resetAllMocks(): void {
  s3Mock.reset();
  bedrockMock.reset();
  pollyMock.reset();
  rekognitionMock.reset();
  cloudWatchMock.reset();
}

/**
 * Configure S3 mock for successful operations
 */
export function setupS3SuccessMocks(): void {
  // Mock successful upload
  s3Mock.on(PutObjectCommand).resolves(MOCK_S3_RESPONSES.uploadSuccess);
  
  // Mock successful head object
  s3Mock.on(HeadObjectCommand).resolves(MOCK_S3_RESPONSES.headObjectSuccess);
  
  // Mock successful get object
  s3Mock.on(GetObjectCommand).resolves({
    Body: {
      transformToByteArray: async () => new Uint8Array([0xFF, 0xD8, 0xFF]),
      transformToString: async () => 'mock-content'
    },
    ContentType: 'image/jpeg',
    ContentLength: 1048576
  });
  
  // Mock successful delete
  s3Mock.on(DeleteObjectCommand).resolves({
    DeleteMarker: false,
    VersionId: 'mock-version'
  });
  
  // Mock multipart upload
  s3Mock.on(CreateMultipartUploadCommand).resolves({
    UploadId: 'mock-upload-id'
  });
  
  s3Mock.on(UploadPartCommand).resolves({
    ETag: '"mock-part-etag"'
  });
  
  s3Mock.on(CompleteMultipartUploadCommand).resolves({
    Location: 's3://test-bucket/mock-key',
    ETag: '"mock-complete-etag"'
  });
}

/**
 * Configure S3 mock for error scenarios
 */
export function setupS3ErrorMocks(errorType: 'NotFound' | 'AccessDenied' | 'ServiceError'): void {
  const errors = {
    NotFound: {
      name: 'NoSuchKey',
      message: 'The specified key does not exist',
      $metadata: { httpStatusCode: 404 }
    },
    AccessDenied: {
      name: 'AccessDenied',
      message: 'Access Denied',
      $metadata: { httpStatusCode: 403 }
    },
    ServiceError: {
      name: 'ServiceUnavailable',
      message: 'Service is currently unavailable',
      $metadata: { httpStatusCode: 503 }
    }
  };
  
  const error = errors[errorType];
  s3Mock.on(PutObjectCommand).rejects(error);
  s3Mock.on(HeadObjectCommand).rejects(error);
  s3Mock.on(GetObjectCommand).rejects(error);
}

/**
 * Configure Bedrock mock for image analysis
 */
export function setupBedrockMocks(imageType: keyof typeof MOCK_BEDROCK_RESPONSES = 'photo'): void {
  const response = MOCK_BEDROCK_RESPONSES[imageType];
  
  bedrockMock.on(InvokeModelCommand).resolves({
    body: new TextEncoder().encode(JSON.stringify({
      content: [
        {
          text: response.description
        }
      ],
      altText: response.altText,
      confidence: response.confidence,
      visualElements: response.visualElements
    }))
  });
}

/**
 * Configure Bedrock mock for error scenarios
 */
export function setupBedrockErrorMocks(errorType: 'RateLimit' | 'ModelError' | 'InvalidInput'): void {
  const errors = {
    RateLimit: {
      name: 'ThrottlingException',
      message: 'Rate exceeded',
      $metadata: { httpStatusCode: 429 }
    },
    ModelError: {
      name: 'ModelErrorException',
      message: 'Model inference failed',
      $metadata: { httpStatusCode: 500 }
    },
    InvalidInput: {
      name: 'ValidationException',
      message: 'Invalid input parameters',
      $metadata: { httpStatusCode: 400 }
    }
  };
  
  bedrockMock.on(InvokeModelCommand).rejects(errors[errorType]);
}

/**
 * Configure Polly mock for text-to-speech
 */
export function setupPollyMocks(): void {
  const mockAudioStream = Buffer.from([
    0x49, 0x44, 0x33, 0x04, // MP3 header
    0x00, 0x00, 0x00, 0x00
  ]);
  
  pollyMock.on(SynthesizeSpeechCommand).resolves({
    AudioStream: {
      transformToByteArray: async () => new Uint8Array(mockAudioStream),
      transformToString: async () => mockAudioStream.toString('base64')
    },
    ContentType: 'audio/mpeg',
    RequestCharacters: 1500
  });
}

/**
 * Configure CloudWatch Logs mock
 */
export function setupCloudWatchMocks(): void {
  cloudWatchMock.on(CreateLogGroupCommand).resolves({});
  cloudWatchMock.on(PutLogEventsCommand).resolves({
    nextSequenceToken: 'mock-token'
  });
}

/**
 * Mock utilities for testing retry logic
 */
export class RetryMockHelper {
  private attemptCount = 0;
  private readonly maxFailures: number;
  private readonly finalResponse: any;
  
  constructor(maxFailures: number, finalResponse: any) {
    this.maxFailures = maxFailures;
    this.finalResponse = finalResponse;
  }
  
  async execute(): Promise<any> {
    this.attemptCount++;
    
    if (this.attemptCount <= this.maxFailures) {
      throw new Error(`Simulated failure ${this.attemptCount}/${this.maxFailures}`);
    }
    
    return this.finalResponse;
  }
  
  getAttemptCount(): number {
    return this.attemptCount;
  }
  
  reset(): void {
    this.attemptCount = 0;
  }
}

/**
 * Mock helper for simulating rate limiting
 */
export class RateLimitMockHelper {
  private requestTimes: number[] = [];
  private readonly limit: number;
  private readonly windowMs: number;
  
  constructor(limit: number = 10, windowMs: number = 1000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }
  
  async checkLimit(): Promise<boolean> {
    const now = Date.now();
    
    // Remove old requests outside window
    this.requestTimes = this.requestTimes.filter(
      time => now - time < this.windowMs
    );
    
    if (this.requestTimes.length >= this.limit) {
      throw new Error('Rate limit exceeded');
    }
    
    this.requestTimes.push(now);
    return true;
  }
  
  reset(): void {
    this.requestTimes = [];
  }
}

/**
 * Mock helper for simulating parallel processing
 */
export class ParallelProcessingMockHelper {
  private activeJobs = 0;
  private readonly maxConcurrent: number;
  private readonly processingTime: number;
  
  constructor(maxConcurrent: number = 10, processingTime: number = 100) {
    this.maxConcurrent = maxConcurrent;
    this.processingTime = processingTime;
  }
  
  async startJob(): Promise<void> {
    if (this.activeJobs >= this.maxConcurrent) {
      throw new Error('Maximum concurrent jobs reached');
    }
    
    this.activeJobs++;
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, this.processingTime));
  }
  
  finishJob(): void {
    if (this.activeJobs > 0) {
      this.activeJobs--;
    }
  }
  
  getActiveJobs(): number {
    return this.activeJobs;
  }
  
  reset(): void {
    this.activeJobs = 0;
  }
}

/**
 * Mock helper for simulating memory usage
 */
export class MemoryUsageMockHelper {
  private usedMemory = 0;
  private readonly maxMemory: number;
  
  constructor(maxMemoryMB: number = 512) {
    this.maxMemory = maxMemoryMB * 1024 * 1024; // Convert to bytes
  }
  
  allocate(bytes: number): void {
    if (this.usedMemory + bytes > this.maxMemory) {
      throw new Error('Out of memory');
    }
    this.usedMemory += bytes;
  }
  
  free(bytes: number): void {
    this.usedMemory = Math.max(0, this.usedMemory - bytes);
  }
  
  getUsagePercent(): number {
    return (this.usedMemory / this.maxMemory) * 100;
  }
  
  reset(): void {
    this.usedMemory = 0;
  }
}

/**
 * Create a mock response generator for streaming
 */
export function createStreamMock(chunks: string[]): ReadableStream {
  let index = 0;
  
  return new ReadableStream({
    async pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(new TextEncoder().encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    }
  });
}

/**
 * Mock helper for job status tracking
 */
export class JobStatusMockHelper {
  private jobs = new Map<string, any>();
  
  createJob(jobId: string, initialStatus: string = 'pending'): void {
    this.jobs.set(jobId, {
      id: jobId,
      status: initialStatus,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  updateJob(jobId: string, updates: any): void {
    const job = this.jobs.get(jobId);
    if (job) {
      this.jobs.set(jobId, {
        ...job,
        ...updates,
        updatedAt: new Date()
      });
    }
  }
  
  getJob(jobId: string): any {
    return this.jobs.get(jobId);
  }
  
  getAllJobs(): any[] {
    return Array.from(this.jobs.values());
  }
  
  reset(): void {
    this.jobs.clear();
  }
}

// Export all mocks and helpers
export default {
  s3Mock,
  bedrockMock,
  pollyMock,
  rekognitionMock,
  cloudWatchMock,
  resetAllMocks,
  setupS3SuccessMocks,
  setupS3ErrorMocks,
  setupBedrockMocks,
  setupBedrockErrorMocks,
  setupPollyMocks,
  setupCloudWatchMocks,
  RetryMockHelper,
  RateLimitMockHelper,
  ParallelProcessingMockHelper,
  MemoryUsageMockHelper,
  createStreamMock,
  JobStatusMockHelper
};