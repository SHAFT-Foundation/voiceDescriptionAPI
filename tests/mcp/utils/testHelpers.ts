/**
 * MCP Server Test Utilities and Helpers
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

// ==================== MCP Client Helpers ====================

export interface MCPClientConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retryConfig?: {
    maxAttempts?: number;
    backoffMultiplier?: number;
  };
}

export class MCPClient extends EventEmitter {
  private config: MCPClientConfig;
  private authToken?: string;
  private tokenRefreshCount = 0;
  private connectionId: string;

  constructor(config: MCPClientConfig = {}) {
    super();
    this.config = {
      baseUrl: process.env.MCP_SERVER_URL || 'http://localhost:3001',
      timeout: 30000,
      ...config
    };
    this.connectionId = uuidv4();
  }

  async callTool(toolName: string, args: any = {}): Promise<any> {
    const requestId = uuidv4();
    
    // Simulate MCP protocol request
    const request = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    // Add authentication if configured
    if (this.config.apiKey) {
      request.params['auth'] = {
        type: 'api_key',
        key: this.config.apiKey
      };
    }

    // Simulate network call with configurable behavior
    return this.executeRequest(request);
  }

  private async executeRequest(request: any): Promise<any> {
    // This would be replaced with actual HTTP/WebSocket call in production
    // For testing, we return mock responses based on the tool being called
    
    const toolName = request.params.name;
    const args = request.params.arguments;

    // Simulate different tool responses
    switch (toolName) {
      case 'voice_description_upload_video':
        return this.mockUploadVideo(args);
      case 'voice_description_video_status':
        return this.mockVideoStatus(args);
      case 'voice_description_process_image':
        return this.mockProcessImage(args);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private mockUploadVideo(args: any) {
    return {
      success: true,
      job_id: uuidv4(),
      status: 'processing',
      estimated_time: 300,
      message: 'Video uploaded successfully'
    };
  }

  private mockVideoStatus(args: any) {
    return {
      job_id: args.job_id,
      status: 'completed',
      progress: 100,
      results_available: true
    };
  }

  private mockProcessImage(args: any) {
    return {
      success: true,
      job_id: `img-${uuidv4()}`,
      status: 'completed',
      description: 'A test image description',
      confidence: 0.95
    };
  }

  getTokenRefreshCount(): number {
    return this.tokenRefreshCount;
  }

  getConnectionId(): string {
    return this.connectionId;
  }

  async disconnect(): Promise<void> {
    this.emit('disconnect');
  }
}

// ==================== Test Data Generators ====================

export class TestDataGenerator {
  private static testDataDir = path.join(__dirname, '../../fixtures/mcp');

  static async createTestVideo(
    filename: string, 
    sizeInMB: number = 10
  ): Promise<string> {
    const filePath = path.join(this.testDataDir, 'videos', filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Create a dummy video file of specified size
    const buffer = Buffer.alloc(sizeInMB * 1024 * 1024);
    await fs.writeFile(filePath, buffer);
    
    return filePath;
  }

  static async createTestImage(
    filename: string,
    width: number = 1920,
    height: number = 1080
  ): Promise<string> {
    const filePath = path.join(this.testDataDir, 'images', filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Create a simple PNG header for testing
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    ]);
    
    await fs.writeFile(filePath, pngHeader);
    return filePath;
  }

  static async createCorruptedFile(
    filename: string,
    sizeInBytes: number = 1024
  ): Promise<string> {
    const filePath = path.join(this.testDataDir, 'corrupted', filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Create random bytes that don't form a valid file
    const buffer = Buffer.alloc(sizeInBytes);
    for (let i = 0; i < sizeInBytes; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  static generateMockJobResponse(overrides: any = {}) {
    return {
      job_id: uuidv4(),
      status: 'processing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      progress: 0,
      estimated_completion: new Date(Date.now() + 300000).toISOString(),
      ...overrides
    };
  }

  static generateMockErrorResponse(
    code: string = 'UNKNOWN_ERROR',
    message: string = 'An error occurred'
  ) {
    return {
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        request_id: uuidv4()
      }
    };
  }
}

// ==================== Polling Utilities ====================

export interface PollOptions {
  maxAttempts?: number;
  interval?: number;
  timeout?: number;
  onProgress?: (status: any) => void;
}

export async function pollUntilComplete(
  client: MCPClient,
  jobId: string,
  options: PollOptions = {}
): Promise<any> {
  const {
    maxAttempts = 60,
    interval = 2000,
    timeout = 120000,
    onProgress
  } = options;

  const startTime = Date.now();
  let attempts = 0;

  while (attempts < maxAttempts) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Polling timeout exceeded');
    }

    const status = await client.callTool('voice_description_video_status', {
      job_id: jobId
    });

    if (onProgress) {
      onProgress(status);
    }

    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }

    await sleep(interval);
    attempts++;
  }

  throw new Error('Max polling attempts exceeded');
}

export async function monitorBatchProgress(
  client: MCPClient,
  batchId: string,
  options: PollOptions = {}
): Promise<any[]> {
  const progressUpdates: any[] = [];
  
  const finalStatus = await pollUntilComplete(client, batchId, {
    ...options,
    onProgress: (update) => {
      progressUpdates.push(update);
      if (options.onProgress) {
        options.onProgress(update);
      }
    }
  });

  return progressUpdates;
}

// ==================== Mock AWS Services ====================

export function createMockAWSServices() {
  return {
    s3: {
      upload: jest.fn().mockResolvedValue({
        Location: 'https://s3.amazonaws.com/bucket/key',
        ETag: '"abc123"',
        Key: 'test-key',
        Bucket: 'test-bucket'
      }),
      getObject: jest.fn().mockResolvedValue({
        Body: Buffer.from('test content'),
        ContentType: 'video/mp4',
        ContentLength: 1024
      }),
      deleteObject: jest.fn().mockResolvedValue({}),
      listObjects: jest.fn().mockResolvedValue({
        Contents: [],
        IsTruncated: false
      })
    },
    rekognition: {
      startSegmentDetection: jest.fn().mockResolvedValue({
        JobId: uuidv4()
      }),
      getSegmentDetection: jest.fn().mockResolvedValue({
        JobStatus: 'SUCCEEDED',
        Segments: [
          {
            Type: 'SHOT',
            StartTimestampMillis: 0,
            EndTimestampMillis: 5000,
            StartTimecodeSMPTE: '00:00:00:00',
            EndTimecodeSMPTE: '00:00:05:00'
          }
        ]
      })
    },
    bedrock: {
      invokeModel: jest.fn().mockResolvedValue({
        body: JSON.stringify({
          content: [{
            text: 'A scene showing a person walking in a park'
          }]
        })
      })
    },
    polly: {
      synthesizeSpeech: jest.fn().mockResolvedValue({
        AudioStream: Buffer.from('audio data'),
        ContentType: 'audio/mpeg'
      })
    }
  };
}

// ==================== Performance Testing Utilities ====================

export interface LoadTestConfig {
  duration: number;
  rps: number;
  scenario: () => Promise<any>;
}

export interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  throughput: number;
}

export async function runLoadTest(
  config: LoadTestConfig
): Promise<LoadTestMetrics> {
  const results: number[] = [];
  const errors: Error[] = [];
  const startTime = Date.now();
  const intervalMs = 1000 / config.rps;
  
  const endTime = startTime + config.duration;
  
  while (Date.now() < endTime) {
    const requestStart = Date.now();
    
    try {
      await config.scenario();
      results.push(Date.now() - requestStart);
    } catch (error) {
      errors.push(error as Error);
    }
    
    const elapsed = Date.now() - requestStart;
    const sleepTime = Math.max(0, intervalMs - elapsed);
    await sleep(sleepTime);
  }
  
  const totalTime = Date.now() - startTime;
  results.sort((a, b) => a - b);
  
  return {
    totalRequests: results.length + errors.length,
    successfulRequests: results.length,
    failedRequests: errors.length,
    successRate: results.length / (results.length + errors.length),
    averageResponseTime: results.reduce((a, b) => a + b, 0) / results.length,
    p50: results[Math.floor(results.length * 0.5)],
    p95: results[Math.floor(results.length * 0.95)],
    p99: results[Math.floor(results.length * 0.99)],
    throughput: (results.length / totalTime) * 1000
  };
}

export interface SpikeTestConfig {
  baselineRps: number;
  spikeRps: number;
  spikeDuration: number;
  totalDuration: number;
  scenario: () => Promise<any>;
}

export interface SpikeTestMetrics {
  baselineMetrics: LoadTestMetrics;
  spikeMetrics: LoadTestMetrics;
  errorsDuringSpike: number;
  recoveryTime: number;
}

export async function runSpikeTest(
  config: SpikeTestConfig
): Promise<SpikeTestMetrics> {
  // Run baseline
  const baselineMetrics = await runLoadTest({
    duration: (config.totalDuration - config.spikeDuration) / 2,
    rps: config.baselineRps,
    scenario: config.scenario
  });
  
  // Run spike
  const spikeStart = Date.now();
  const spikeMetrics = await runLoadTest({
    duration: config.spikeDuration,
    rps: config.spikeRps,
    scenario: config.scenario
  });
  
  // Measure recovery
  const recoveryStart = Date.now();
  let recovered = false;
  let recoveryTime = 0;
  
  while (!recovered && Date.now() - recoveryStart < 30000) {
    const testResult = await config.scenario();
    if (testResult) {
      recovered = true;
      recoveryTime = Date.now() - recoveryStart;
    }
    await sleep(1000);
  }
  
  return {
    baselineMetrics,
    spikeMetrics,
    errorsDuringSpike: spikeMetrics.failedRequests / spikeMetrics.totalRequests,
    recoveryTime
  };
}

// ==================== Utility Functions ====================

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function createAuthenticatedClient(
  user?: string
): Promise<MCPClient> {
  const apiKey = user ? `test-api-key-${user}` : 'test-api-key';
  return new MCPClient({ apiKey });
}

export async function createWebSocketClient(): Promise<MCPClient> {
  const client = new MCPClient({
    baseUrl: 'ws://localhost:3001'
  });
  
  // Simulate WebSocket connection
  await sleep(100);
  
  return client;
}

export function simulateWebSocketDisconnect(
  client: MCPClient
): Promise<void> {
  client.emit('disconnect');
  return sleep(100);
}

export async function waitForJobCompletion(
  jobId: string,
  timeout: number = 60000
): Promise<void> {
  const client = await createAuthenticatedClient();
  await pollUntilComplete(client, jobId, { timeout });
}

export function createLargeFile(
  filename: string,
  sizeInBytes: number
): string {
  // In a real implementation, this would create an actual file
  // For testing, we return a mock path
  return `/tmp/test-files/${filename}`;
}

export function getTestVideoPath(filename: string): string {
  return path.join(__dirname, '../../fixtures/mcp/videos', filename);
}

export function getTestImagePath(filename: string): string {
  return path.join(__dirname, '../../fixtures/mcp/images', filename);
}

export function getRandomTestImage(): string {
  const images = ['test1.jpg', 'test2.png', 'test3.gif'];
  return getTestImagePath(images[Math.floor(Math.random() * images.length)]);
}

// ==================== Custom Matchers ====================

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const S3_URL_REGEX = /^https?:\/\/.*\.s3[.-].*\.amazonaws\.com\/.*/;
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

// ==================== Error Classes ====================

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnsupportedFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}