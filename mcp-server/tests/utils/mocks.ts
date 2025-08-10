import { jest } from '@jest/globals';

/**
 * Mock implementations for testing MCP server components
 */

// Mock API Client
export const createMockAPIClient = () => ({
  upload: jest.fn(),
  processVideo: jest.fn(),
  processImage: jest.fn(),
  batchProcessImages: jest.fn(),
  checkStatus: jest.fn(),
  getTextResults: jest.fn(),
  getAudioResults: jest.fn(),
  checkHealth: jest.fn(),
  checkAWSStatus: jest.fn(),
  setAuthToken: jest.fn(),
  setRateLimit: jest.fn(),
  request: jest.fn(),
});

// Mock File Handler
export const createMockFileHandler = () => ({
  validateFile: jest.fn(),
  readFileAsBuffer: jest.fn(),
  readFileAsStream: jest.fn(),
  createMultipartUpload: jest.fn(),
  saveTemporaryFile: jest.fn(),
  cleanupTemporaryFile: jest.fn(),
  getFileMetadata: jest.fn(),
  validateFileSize: jest.fn(),
  validateFileType: jest.fn(),
  createFormData: jest.fn(),
});

// Mock Job Poller
export const createMockJobPoller = () => ({
  pollUntilComplete: jest.fn(),
  pollWithTimeout: jest.fn(),
  checkStatus: jest.fn(),
  setPollingInterval: jest.fn(),
  setMaxAttempts: jest.fn(),
  cancel: jest.fn(),
});

// Mock Logger
export const createMockLogger = () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn(() => createMockLogger()),
});

// Mock Tool Registry
export const createMockToolRegistry = () => ({
  register: jest.fn(),
  get: jest.fn(),
  list: jest.fn(),
  execute: jest.fn(),
  validate: jest.fn(),
  getSchema: jest.fn(),
});

// Mock MCP Server
export const createMockMCPServer = () => ({
  setRequestHandler: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendNotification: jest.fn(),
  onRequest: jest.fn(),
  onNotification: jest.fn(),
});

// Mock WebSocket Connection
export const createMockWebSocket = () => ({
  readyState: 1, // OPEN
  send: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  removeListener: jest.fn(),
  emit: jest.fn(),
});

// Mock Express Request
export const createMockRequest = (overrides: any = {}) => ({
  body: {},
  query: {},
  params: {},
  headers: {},
  method: 'GET',
  url: '/',
  file: null,
  files: [],
  ...overrides,
});

// Mock Express Response
export const createMockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  };
  return res;
};

// Mock Stream
export const createMockStream = (data: string | Buffer) => ({
  pipe: jest.fn(),
  on: jest.fn((event, callback) => {
    if (event === 'data') {
      callback(data);
    }
    if (event === 'end') {
      setTimeout(() => callback(), 10);
    }
  }),
  once: jest.fn(),
  destroy: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
});

// Mock FormData
export const createMockFormData = () => ({
  append: jest.fn(),
  getHeaders: jest.fn(() => ({
    'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary',
  })),
  getLength: jest.fn((callback: (err: any, length: number) => void) => {
    callback(null, 1024);
  }),
  pipe: jest.fn(),
});

// Mock Cache
export const createMockCache = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  flush: jest.fn(),
  keys: jest.fn(),
  has: jest.fn(),
  ttl: jest.fn(),
});

// Mock Queue
export const createMockQueue = () => ({
  add: jest.fn(),
  addAll: jest.fn(),
  size: 0,
  pending: 0,
  isPaused: false,
  pause: jest.fn(),
  start: jest.fn(),
  clear: jest.fn(),
  onEmpty: jest.fn(),
  onIdle: jest.fn(),
});

// Mock Configuration
export const createMockConfig = () => ({
  api: {
    baseUrl: 'http://localhost:3000',
    timeout: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  mcp: {
    transport: 'stdio',
    port: 3001,
    host: 'localhost',
  },
  aws: {
    region: 'us-east-1',
    s3Bucket: 'test-bucket',
  },
  features: {
    enableCache: true,
    enableMetrics: true,
    enableRateLimit: true,
  },
  limits: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxBatchSize: 10,
    maxConcurrentJobs: 5,
  },
});

// Mock Metrics Collector
export const createMockMetrics = () => ({
  increment: jest.fn(),
  decrement: jest.fn(),
  histogram: jest.fn(),
  gauge: jest.fn(),
  summary: jest.fn(),
  startTimer: jest.fn(() => jest.fn()),
  reset: jest.fn(),
  getMetrics: jest.fn(),
});

// Mock Rate Limiter
export const createMockRateLimiter = () => ({
  consume: jest.fn(),
  reset: jest.fn(),
  block: jest.fn(),
  isBlocked: jest.fn(),
  getRemainingPoints: jest.fn(),
});

// Mock Auth Handler
export const createMockAuthHandler = () => ({
  authenticate: jest.fn(),
  authorize: jest.fn(),
  validateToken: jest.fn(),
  refreshToken: jest.fn(),
  revokeToken: jest.fn(),
  getUser: jest.fn(),
});

// Mock Error Handler
export const createMockErrorHandler = () => ({
  handle: jest.fn(),
  isRetryable: jest.fn(),
  getErrorCode: jest.fn(),
  formatError: jest.fn(),
  logError: jest.fn(),
});

// Mock Event Emitter
export const createMockEventEmitter = () => ({
  on: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  off: jest.fn(),
  removeAllListeners: jest.fn(),
  listenerCount: jest.fn(),
});

// Mock Database Connection
export const createMockDatabase = () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  query: jest.fn(),
  transaction: jest.fn(),
  health: jest.fn(),
});

// Mock S3 Client
export const createMockS3Client = () => ({
  putObject: jest.fn(),
  getObject: jest.fn(),
  deleteObject: jest.fn(),
  headObject: jest.fn(),
  listObjects: jest.fn(),
  createMultipartUpload: jest.fn(),
  uploadPart: jest.fn(),
  completeMultipartUpload: jest.fn(),
  abortMultipartUpload: jest.fn(),
});

// Mock Rekognition Client
export const createMockRekognitionClient = () => ({
  startSegmentDetection: jest.fn(),
  getSegmentDetection: jest.fn(),
  startLabelDetection: jest.fn(),
  getLabelDetection: jest.fn(),
  detectFaces: jest.fn(),
  detectText: jest.fn(),
});

// Mock Bedrock Client
export const createMockBedrockClient = () => ({
  invokeModel: jest.fn(),
  invokeModelWithResponseStream: jest.fn(),
  listFoundationModels: jest.fn(),
});

// Mock Polly Client
export const createMockPollyClient = () => ({
  synthesizeSpeech: jest.fn(),
  describeVoices: jest.fn(),
  getSpeechSynthesisTask: jest.fn(),
  startSpeechSynthesisTask: jest.fn(),
});

// Mock Tool Context
export const createMockToolContext = () => ({
  apiClient: createMockAPIClient(),
  fileHandler: createMockFileHandler(),
  jobPoller: createMockJobPoller(),
  logger: createMockLogger(),
  cache: createMockCache(),
  metrics: createMockMetrics(),
  config: createMockConfig(),
});

// Mock Tool Input
export const createMockToolInput = (args: any = {}) => ({
  method: 'tools/call',
  params: {
    name: 'test_tool',
    arguments: args,
  },
});

// Mock Tool Output
export const createMockToolOutput = (content: any = {}) => ({
  content: [
    {
      type: 'text',
      text: JSON.stringify(content, null, 2),
    },
  ],
});

// Utility to reset all mocks
export function resetAllMocks(...mocks: any[]) {
  mocks.forEach(mock => {
    if (mock && typeof mock === 'object') {
      Object.values(mock).forEach(value => {
        if (typeof value === 'function' && 'mockReset' in value) {
          (value as any).mockReset();
        }
      });
    }
  });
}

// Utility to create a mock with spy
export function createSpyMock<T>(implementation: T): T & { calls: any[] } {
  const calls: any[] = [];
  const proxy = new Proxy(implementation as any, {
    get(target, prop) {
      const original = target[prop];
      if (typeof original === 'function') {
        return (...args: any[]) => {
          calls.push({ method: prop, args });
          return original.apply(target, args);
        };
      }
      return original;
    },
  });
  (proxy as any).calls = calls;
  return proxy;
}

// Export all mocks
export default {
  createMockAPIClient,
  createMockFileHandler,
  createMockJobPoller,
  createMockLogger,
  createMockToolRegistry,
  createMockMCPServer,
  createMockWebSocket,
  createMockRequest,
  createMockResponse,
  createMockStream,
  createMockFormData,
  createMockCache,
  createMockQueue,
  createMockConfig,
  createMockMetrics,
  createMockRateLimiter,
  createMockAuthHandler,
  createMockErrorHandler,
  createMockEventEmitter,
  createMockDatabase,
  createMockS3Client,
  createMockRekognitionClient,
  createMockBedrockClient,
  createMockPollyClient,
  createMockToolContext,
  createMockToolInput,
  createMockToolOutput,
  resetAllMocks,
  createSpyMock,
};