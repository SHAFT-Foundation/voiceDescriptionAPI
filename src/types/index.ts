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

// Pipeline Selection Types
export type PipelineType = 'openai' | 'aws' | 'hybrid';

export interface PipelineSelectionCriteria {
  fileSize?: number;
  duration?: number;
  language?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface PipelineConfig {
  provider: string;
  maxFileSize: number;
  maxDuration: number;
  supportedFormats: string[];
  features: Record<string, boolean>;
  rateLimits: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
    concurrentJobs?: number;
  };
}

// OpenAI Image Analysis Types
export interface OpenAIImageAnalysisOptions {
  detail?: 'low' | 'high' | 'auto';
  customPrompt?: {
    altText?: string;
    detailed?: string;
    seo?: string;
  };
  maxTokens?: number;
}

export interface OpenAIImageAnalysisResult {
  altText: string;
  detailedDescription: string;
  seoDescription: string;
  visualElements: string[];
  colors: string[];
  composition: string;
  context: string;
  imageType: 'photo' | 'illustration' | 'chart' | 'diagram' | 'text' | 'other';
  confidence: number;
  metadata: {
    model: string;
    tokensUsed: number;
    processingTime: number;
    customPromptUsed: boolean;
  };
}

// Video Chunking Types
export interface VideoChunk {
  chunkId: string;
  index: number;
  s3Uri: string;
  startTime: number;
  endTime: number;
  duration: number;
  size: number;
}

export interface VideoChunkingOptions {
  targetChunkSize?: number;
  maxChunkDuration?: number;
  overlap?: number;
  keyframeAlign?: boolean;
  sceneDetection?: boolean;
}

export interface VideoChunkingResult {
  jobId: string;
  originalUri: string;
  chunks: VideoChunk[];
  metadata: {
    originalDuration: number;
    originalSize: number;
    totalChunks: number;
    chunkDuration: number;
    processingTime: number;
    sceneBasedChunking?: boolean;
  };
}

// OpenAI Video Analysis Types
export interface OpenAIChunkAnalysis {
  chunkId: string;
  startTime: number;
  endTime: number;
  description: string;
  visualElements: string[];
  actions: string[];
  context: string;
  confidence: number;
  tokensUsed: number;
}

export interface OpenAIVideoAnalysisResult {
  jobId: string;
  chunkAnalyses: OpenAIChunkAnalysis[];
  contextualSummary?: string;
  metadata: {
    totalChunks: number;
    successfulAnalyses: number;
    failedAnalyses: number;
    averageConfidence: number;
    totalTokensUsed: number;
    processingTime: number;
    model: string;
  };
}

// Description Synthesis Types
export interface SynthesizedDescription {
  narrative: string;
  timestamped: string;
  technical: string;
  accessibility: string;
  keyMoments: Array<{
    timestamp: number;
    description: string;
    importance: 'high' | 'medium' | 'low';
  }>;
  highlights: string[];
  chapters: Array<{
    timestamp: number;
    title: string;
    description: string;
  }>;
  metadata: {
    wordCount: number;
    sentenceCount: number;
    averageConfidence: number;
    totalTokensUsed: number;
    uniqueVisualElements: number;
    uniqueActions: number;
    synthesisMethod: 'ai-enhanced' | 'rule-based';
    totalDuration: number;
  };
}

export interface DescriptionSynthesisOptions {
  targetLength?: number;
  maxSegmentLength?: number;
  minChapterDuration?: number;
  includeTimestamps?: boolean;
  format?: 'narrative' | 'technical' | 'accessibility' | 'all';
}

// Enhanced Processing Request Types
export interface EnhancedUploadRequest extends UploadRequest {
  pipeline?: PipelineType;
  openaiOptions?: OpenAIImageAnalysisOptions;
  chunkingOptions?: VideoChunkingOptions;
  synthesisOptions?: DescriptionSynthesisOptions;
}

export interface EnhancedImageProcessRequest extends ImageProcessRequest {
  pipeline?: PipelineType;
  openaiOptions?: OpenAIImageAnalysisOptions;
}

// Pipeline Processing Results
export interface PipelineProcessingResult {
  pipeline: PipelineType;
  jobId: string;
  status: 'completed' | 'failed' | 'partial';
  results?: {
    openai?: OpenAIVideoAnalysisResult | OpenAIImageAnalysisResult;
    aws?: ProcessingJob | ImageProcessingJob;
    synthesized?: SynthesizedDescription;
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  metadata: {
    processingTime: number;
    pipelineConfig: PipelineConfig;
    costsEstimate?: {
      openaiTokens?: number;
      awsServices?: Record<string, number>;
    };
  };
}