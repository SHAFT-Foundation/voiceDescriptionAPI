import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import FormData from 'form-data';

/**
 * Test Helper Utilities for MCP Server Testing
 */

// Constants for test data
export const TEST_CONSTANTS = {
  VALID_JOB_ID: '123e4567-e89b-12d3-a456-426614174000',
  INVALID_JOB_ID: 'invalid-uuid',
  TEST_VIDEO_PATH: '/tmp/test-video.mp4',
  TEST_IMAGE_PATH: '/tmp/test-image.jpg',
  TEST_AUDIO_PATH: '/tmp/test-audio.mp3',
  TEST_TEXT_PATH: '/tmp/test-description.txt',
  API_TIMEOUT: 5000,
  POLLING_INTERVAL: 100,
  MAX_RETRIES: 3,
};

// Mock response generators
export const mockResponses = {
  uploadSuccess: (jobId: string = TEST_CONSTANTS.VALID_JOB_ID) => ({
    success: true,
    jobId,
    message: 'Video uploaded successfully',
    uploadUrl: `https://s3.amazonaws.com/bucket/${jobId}/video.mp4`,
  }),

  processingStatus: (status: 'processing' | 'completed' | 'failed' = 'processing', progress: number = 50) => ({
    jobId: TEST_CONSTANTS.VALID_JOB_ID,
    status,
    progress,
    step: status === 'processing' ? 'segmentation' : null,
    message: status === 'processing' ? 'Processing video segments' : 'Processing complete',
    results: status === 'completed' ? {
      textUrl: `https://api.example.com/results/${TEST_CONSTANTS.VALID_JOB_ID}/text`,
      audioUrl: `https://api.example.com/results/${TEST_CONSTANTS.VALID_JOB_ID}/audio`,
    } : null,
  }),

  healthCheck: (healthy: boolean = true) => ({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: {
      api: healthy ? 'up' : 'down',
      database: healthy ? 'up' : 'down',
      aws: healthy ? 'up' : 'down',
    },
    version: '1.0.0',
  }),

  awsStatus: (operational: boolean = true) => ({
    operational,
    services: {
      s3: { status: operational ? 'operational' : 'degraded', latency: 45 },
      rekognition: { status: operational ? 'operational' : 'degraded', latency: 120 },
      bedrock: { status: operational ? 'operational' : 'degraded', latency: 200 },
      polly: { status: operational ? 'operational' : 'degraded', latency: 80 },
    },
    timestamp: new Date().toISOString(),
  }),

  textDescription: () => `Scene 1 (0:00-0:05):
A person standing in front of a building, speaking to camera.

Scene 2 (0:05-0:10):
Wide shot of a city street with people walking.

Scene 3 (0:10-0:15):
Close-up of hands working on a computer keyboard.`,

  batchResults: (count: number = 3) => ({
    success: true,
    totalImages: count,
    processed: count,
    failed: 0,
    results: Array.from({ length: count }, (_, i) => ({
      id: `image-${i + 1}`,
      status: 'completed',
      description: `Description for image ${i + 1}`,
      audioUrl: `https://api.example.com/batch/audio-${i + 1}.mp3`,
    })),
  }),

  error: (message: string = 'Internal server error', code: string = 'INTERNAL_ERROR') => ({
    error: true,
    message,
    code,
    details: 'An unexpected error occurred',
  }),
};

// File creation utilities
export async function createTestFile(filePath: string, content: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

export async function cleanupTestFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // Ignore if file doesn't exist
  }
}

// Stream utilities
export function createMockReadStream(content: string): Readable {
  const stream = new Readable();
  stream.push(content);
  stream.push(null);
  return stream;
}

export function createMockFormData(files: Record<string, { content: string | Buffer; filename: string }>) {
  const form = new FormData();
  Object.entries(files).forEach(([field, file]) => {
    form.append(field, Buffer.from(file.content), {
      filename: file.filename,
      contentType: 'application/octet-stream',
    });
  });
  return form;
}

// API Mock Factory
export class MockAPIClient {
  private responses: Map<string, any> = new Map();
  private errors: Map<string, Error> = new Map();
  private callHistory: Array<{ method: string; url: string; data?: any }> = [];

  setResponse(url: string, response: any) {
    this.responses.set(url, response);
    return this;
  }

  setError(url: string, error: Error) {
    this.errors.set(url, error);
    return this;
  }

  async request(method: string, url: string, data?: any) {
    this.callHistory.push({ method, url, data });

    if (this.errors.has(url)) {
      throw this.errors.get(url);
    }

    if (this.responses.has(url)) {
      return { data: this.responses.get(url) };
    }

    return { data: {} };
  }

  getCallHistory() {
    return this.callHistory;
  }

  reset() {
    this.responses.clear();
    this.errors.clear();
    this.callHistory = [];
  }
}

// Job Poller Mock
export class MockJobPoller {
  private statuses: Array<{ status: string; progress: number }> = [];
  private currentIndex = 0;

  setStatuses(statuses: Array<{ status: string; progress: number }>) {
    this.statuses = statuses;
    this.currentIndex = 0;
    return this;
  }

  async poll() {
    if (this.currentIndex >= this.statuses.length) {
      return this.statuses[this.statuses.length - 1];
    }
    const status = this.statuses[this.currentIndex];
    this.currentIndex++;
    return status;
  }

  reset() {
    this.statuses = [];
    this.currentIndex = 0;
  }
}

// WebSocket Mock
export class MockWebSocket {
  public readyState: number = 1; // OPEN
  private messageHandlers: Array<(data: any) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];

  on(event: string, handler: Function) {
    switch (event) {
      case 'message':
        this.messageHandlers.push(handler as any);
        break;
      case 'close':
        this.closeHandlers.push(handler as any);
        break;
      case 'error':
        this.errorHandlers.push(handler as any);
        break;
    }
  }

  send(data: any) {
    // Simulate echo for testing
    setTimeout(() => {
      this.simulateMessage(data);
    }, 10);
  }

  simulateMessage(data: any) {
    this.messageHandlers.forEach(handler => handler(data));
  }

  simulateClose() {
    this.readyState = 3; // CLOSED
    this.closeHandlers.forEach(handler => handler());
  }

  simulateError(error: Error) {
    this.errorHandlers.forEach(handler => handler(error));
  }

  close() {
    this.simulateClose();
  }
}

// Performance Testing Utilities
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  startTimer(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }
      this.metrics.get(label)!.push(duration);
    };
  }

  getMetrics(label: string): { avg: number; min: number; max: number; p95: number } | null {
    const values = this.metrics.get(label);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index];

    return { avg, min, max, p95 };
  }

  reset() {
    this.metrics.clear();
  }
}

// Assertion Helpers
export const assertToolResponse = (response: any, expectedShape: Record<string, string>) => {
  Object.keys(expectedShape).forEach(key => {
    expect(response).toHaveProperty(key);
    expect(typeof response[key]).toBe(expectedShape[key]);
  });
};

export const assertErrorResponse = (response: any, expectedCode?: string) => {
  expect(response).toHaveProperty('error', true);
  expect(response).toHaveProperty('message');
  if (expectedCode) {
    expect(response).toHaveProperty('code', expectedCode);
  }
};

// Wait Utilities
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await wait(interval);
  }
  throw new Error('Timeout waiting for condition');
};

// Mock AWS Service Responses
export const mockAWSResponses = {
  s3Upload: {
    ETag: '"abc123"',
    Location: 'https://bucket.s3.amazonaws.com/key',
    Key: 'test-key',
    Bucket: 'test-bucket',
  },

  rekognitionStartSegment: {
    JobId: 'rekognition-job-123',
  },

  rekognitionGetSegment: {
    JobStatus: 'SUCCEEDED',
    VideoMetadata: {
      DurationMillis: 15000,
      FrameRate: 30,
    },
    Segments: [
      {
        Type: 'SHOT',
        StartTimeMillis: 0,
        EndTimeMillis: 5000,
        Confidence: 98.5,
      },
      {
        Type: 'SHOT',
        StartTimeMillis: 5000,
        EndTimeMillis: 10000,
        Confidence: 97.2,
      },
    ],
  },

  bedrockInvoke: {
    body: JSON.stringify({
      completion: 'A professional setting with modern office furniture and natural lighting.',
    }),
  },

  pollySynthesize: {
    AudioStream: createMockReadStream('mock audio data'),
  },
};

// Test Data Generators
export function generateTestVideo(sizeInBytes: number = 1024): Buffer {
  return Buffer.alloc(sizeInBytes, 'video');
}

export function generateTestImage(sizeInBytes: number = 512): Buffer {
  return Buffer.alloc(sizeInBytes, 'image');
}

export function generateBatchImages(count: number = 3): Array<{ name: string; content: Buffer }> {
  return Array.from({ length: count }, (_, i) => ({
    name: `image-${i + 1}.jpg`,
    content: generateTestImage(),
  }));
}

// Request Validator Helpers
export function validateJobId(jobId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(jobId);
}

export function validateURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Cleanup Utilities
export class TestCleanup {
  private cleanupTasks: Array<() => Promise<void>> = [];

  add(task: () => Promise<void>) {
    this.cleanupTasks.push(task);
  }

  async execute() {
    await Promise.all(this.cleanupTasks.map(task => task().catch(() => {})));
    this.cleanupTasks = [];
  }
}

// Export all test utilities
export default {
  TEST_CONSTANTS,
  mockResponses,
  createTestFile,
  cleanupTestFile,
  createMockReadStream,
  createMockFormData,
  MockAPIClient,
  MockJobPoller,
  MockWebSocket,
  PerformanceMonitor,
  assertToolResponse,
  assertErrorResponse,
  wait,
  waitFor,
  mockAWSResponses,
  generateTestVideo,
  generateTestImage,
  generateBatchImages,
  validateJobId,
  validateURL,
  TestCleanup,
};