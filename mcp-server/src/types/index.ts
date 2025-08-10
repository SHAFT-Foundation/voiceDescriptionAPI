import { z } from 'zod';

// MCP Protocol types
export interface MCPRequest {
  method: string;
  params: any;
  id?: string | number;
}

export interface MCPResponse {
  result?: any;
  error?: MCPError;
  id?: string | number;
}

export interface MCPError {
  code: string;
  message: string;
  details?: any;
}

// Tool types
export interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  execute: (params: any, context: ToolContext) => Promise<any>;
}

export interface ToolContext {
  requestId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// API Client types
export interface ProcessImageOptions {
  file: Buffer;
  fileName: string;
  mimeType: string;
  options?: {
    detailLevel?: 'basic' | 'comprehensive' | 'technical';
    generateAudio?: boolean;
    includeAltText?: boolean;
    voiceId?: string;
    language?: string;
  };
  metadata?: {
    title?: string;
    description?: string;
    context?: string;
  };
}

export interface UploadVideoOptions {
  file: Buffer | NodeJS.ReadableStream;
  fileName: string;
  mimeType: string;
  metadata?: {
    title?: string;
    description?: string;
    language?: string;
  };
  options?: {
    voiceId?: string;
    detailLevel?: 'basic' | 'detailed' | 'comprehensive';
  };
}

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  step?: string;
  progress?: number;
  message?: string;
  createdAt?: string;
  updatedAt?: string;
  estimatedTime?: number;
  results?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ImageResult {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  processingTime?: number;
  results: ImageProcessingResults;
}

export interface ImageProcessingResults {
  detailedDescription: string;
  altText: string;
  visualElements: string[];
  colors: string[];
  composition: string;
  confidence: number;
  audioFile?: {
    url: string;
    duration: number;
    format: string;
  };
  htmlMetadata: {
    altAttribute: string;
    ariaLabel: string;
  };
}

export interface BatchResult {
  batchId: string;
  totalImages: number;
  processed: number;
  failed: number;
  results: Array<{
    imageId: string;
    sourcePath: string;
    success: boolean;
    result?: ImageResult;
    error?: string;
  }>;
}

export interface VideoResult {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  estimatedTime?: number;
  results?: {
    textDescription: string;
    audioFile: string;
    segments: Array<{
      startTime: number;
      endTime: number;
      description: string;
    }>;
  };
}

// File handling types
export interface FileData {
  buffer?: Buffer;
  stream?: NodeJS.ReadableStream;
  name: string;
  mimeType: string;
  size: number;
}

export interface UploadData {
  buffer?: Buffer;
  stream?: NodeJS.ReadableStream;
  size: number;
  mimetype?: string;
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  responseTime: string;
  checks: {
    server: string;
    jobManager?: {
      status: string;
      activeJobs?: number;
      completedJobs?: number;
      failedJobs?: number;
    };
    awsServices?: {
      status: string;
      services: Record<string, string>;
    };
  };
}

export interface AWSStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    s3?: {
      status: 'available' | 'unavailable' | 'degraded';
      latency?: number;
    };
    rekognition?: {
      status: 'available' | 'unavailable' | 'degraded';
      quotas?: {
        remaining: number;
        limit: number;
      };
    };
    bedrock?: {
      status: 'available' | 'unavailable' | 'degraded';
      models?: string[];
    };
    polly?: {
      status: 'available' | 'unavailable' | 'degraded';
      voices?: number;
    };
  };
}

// Error types
export enum ErrorCode {
  // Input errors
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  
  // API errors
  API_UNAVAILABLE = 'API_UNAVAILABLE',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  API_AUTHENTICATION_FAILED = 'API_AUTHENTICATION_FAILED',
  API_REQUEST_FAILED = 'API_REQUEST_FAILED',
  
  // Processing errors
  JOB_FAILED = 'JOB_FAILED',
  JOB_TIMEOUT = 'JOB_TIMEOUT',
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR'
}

export class MCPToolError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public details?: any,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'MCPToolError';
  }

  toMCPError(): MCPError {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

// Validation types
export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: any;
}

// Retry types
export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryOn?: number[];
}

// Polling types
export interface PollOptions {
  interval?: number;
  timeout?: number;
  onProgress?: (status: JobStatus) => void;
}

// Cache types
export interface CacheEntry<T> {
  value: T;
  expiry: number;
}

// Rate limiting types
export interface RateLimitEntry {
  requests: number[];
  resetTime: number;
}