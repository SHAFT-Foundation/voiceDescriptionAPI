// Core types for the Voice Description API

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  step: 'upload' | 'segmentation' | 'extraction' | 'analysis' | 'compilation' | 'synthesis';
  progress: number;
  message: string;
  results?: {
    textUrl?: string;
    audioUrl?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoSegment {
  startTime: number;
  endTime: number;
  confidence: number;
  type: 'TECHNICAL_CUE' | 'SHOT';
}

export interface SceneAnalysis {
  segmentId: string;
  startTime: number;
  endTime: number;
  description: string;
  confidence: number;
  visualElements: string[];
  actions: string[];
  context: string;
}

export interface ProcessingConfig {
  maxVideoSizeMB: number;
  processingTimeoutMinutes: number;
  novaModelId: string;
  pollyVoiceId: string;
  ffmpegConcurrency: number;
}

export interface AWSConfig {
  region: string;
  inputBucket: string;
  outputBucket: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export interface UploadRequest {
  file?: File | Buffer;
  s3Uri?: string;
  metadata?: {
    title?: string;
    description?: string;
    language?: string;
  };
}

export interface ProcessingJob {
  jobId: string;
  inputUri: string;
  status: JobStatus;
  segments: VideoSegment[];
  analyses: SceneAnalysis[];
  compiledText?: string;
  audioUri?: string;
  config: ProcessingConfig;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  timestamp: Date;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface Logger {
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}