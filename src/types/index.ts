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

// Image Processing Types
export interface ImageJobStatus extends Omit<JobStatus, 'step'> {
  step: 'upload' | 'analysis' | 'compilation' | 'synthesis' | 'completed';
  imageType?: 'photo' | 'illustration' | 'chart' | 'diagram' | 'text' | 'other';
}

export interface ImageProcessRequest {
  image?: File | Buffer;
  s3Uri?: string;
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

export interface ImageProcessingResults {
  detailedDescription: string;
  altText: string;
  visualElements: string[];
  colors: string[];
  composition: string;
  context: string;
  confidence: number;
  audioFile?: {
    url: string;
    duration: number;
    format: string;
  };
  htmlMetadata: {
    altAttribute: string;
    longDescId?: string;
    ariaLabel?: string;
    schemaMarkup?: object;
  };
}

export interface ImageData {
  jobId: string;
  s3Uri: string;
  localPath?: string;
  metadata?: ImageMetadata;
  options: ImageProcessingOptions;
}

export interface ImageMetadata {
  title?: string;
  description?: string;
  context?: string;
}

export interface ImageProcessingOptions {
  detailLevel?: 'basic' | 'comprehensive' | 'technical';
  generateAudio?: boolean;
  includeAltText?: boolean;
  voiceId?: string;
  language?: string;
}

export interface ImageAnalysis extends Omit<SceneAnalysis, 'startTime' | 'endTime'> {
  colors: string[];
  composition: string;
  imageType: 'photo' | 'illustration' | 'chart' | 'diagram' | 'text' | 'other';
}

export interface CompiledImageDescription {
  altText: string;
  detailedDescription: string;
  technicalDescription?: string;
  htmlMetadata: HTMLAccessibilityMetadata;
  metadata: {
    confidence: number;
    wordCount: number;
    imageType: string;
    processingTime: number;
  };
}

export interface HTMLAccessibilityMetadata {
  altAttribute: string;
  longDescId?: string;
  ariaLabel?: string;
  schemaMarkup?: object;
}

export interface ImageProcessingJob {
  jobId: string;
  inputUri: string;
  status: ImageJobStatus;
  analysis?: ImageAnalysis;
  compiledDescription?: CompiledImageDescription;
  audioUri?: string;
  config: ProcessingConfig;
  options: ImageProcessingOptions;
  metadata?: ImageMetadata;
}

export interface BatchImageProcessRequest {
  images: Array<{
    source: string;
    id?: string;
    metadata?: ImageMetadata;
  }>;
  options?: ImageProcessingOptions;
}

export interface BatchImageProcessResponse {
  success: boolean;
  data?: {
    batchId: string;
    totalImages: number;
    status: 'processing' | 'completed' | 'partial' | 'failed';
    results: Array<{
      id?: string;
      jobId: string;
      status: 'completed' | 'failed';
      result?: ImageProcessingResults;
      error?: APIResponse['error'];
    }>;
  };
  error?: APIResponse['error'];
  timestamp: Date;
}

export interface ValidationResult {
  valid: boolean;
  format?: string;
  size?: number;
  width?: number;
  height?: number;
  error?: string;
}

export interface ImageUploadRequest {
  file?: File | Buffer;
  s3Uri?: string;
  jobId: string;
  metadata?: ImageMetadata;
}

export interface UploadResult {
  jobId: string;
  s3Uri: string;
  size: number;
  format: string;
}