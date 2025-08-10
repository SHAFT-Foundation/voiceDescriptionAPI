/**
 * UI Type Definitions
 * Type safety for the enhanced React UI components
 */

// View modes for the application
export type ViewMode = 'landing' | 'upload' | 'processing' | 'results' | 'api-docs' | 'developer' | 'classic';

// File processing types
export type FileType = 'video' | 'image';
export type DetailLevel = 'basic' | 'detailed' | 'comprehensive';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

// File metadata for processing
export interface FileMetadata {
  title?: string;
  description?: string;
  language?: string;
  context?: string;
  detailLevel?: DetailLevel;
  generateAudio?: boolean;
  voiceId?: string;
  webhookUrl?: string;
}

// Processing job interface
export interface ProcessingJob {
  jobId: string;
  type: FileType;
  fileName: string;
  fileSize?: number;
  startTime: Date;
  endTime?: Date;
  status: ProcessingStatus;
  progress: number;
  error?: string;
  results?: ProcessingResults;
}

// Processing results
export interface ProcessingResults {
  textUrl?: string;
  audioUrl?: string;
  transcriptUrl?: string;
  metadata?: ResultMetadata;
}

// Result metadata
export interface ResultMetadata {
  processingTime: number;
  segmentCount?: number;
  confidence: number;
  language: string;
  voiceId?: string;
  awsResources: {
    rekognitionJobId?: string;
    pollyTaskId?: string;
    s3Keys: {
      input: string;
      output: string[];
    };
  };
}

// Pipeline step for visualization
export interface PipelineStep {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'pending' | 'active' | 'completed' | 'error';
  progress?: number;
  duration?: number;
  details?: string;
}

// AWS service status
export interface AWSServiceStatus {
  service: string;
  status: 'connected' | 'disconnected' | 'error';
  region?: string;
  message?: string;
}

// Overall AWS status
export interface AWSStatus {
  overall: {
    status: 'all_connected' | 'partial' | 'disconnected';
    connectedServices: string;
  };
  services: {
    [key: string]: AWSServiceStatus;
  };
  region: string;
  timestamp: string;
}

// API health status
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  checks: {
    database: boolean;
    aws: boolean;
    storage: boolean;
  };
  metrics?: {
    responseTime: number;
    requestsPerMinute: number;
    errorRate: number;
  };
}

// Upload response
export interface UploadResponse {
  success: boolean;
  jobId: string;
  message?: string;
  error?: string;
  estimatedTime?: number;
}

// Job status from API
export interface JobStatus {
  jobId: string;
  status: ProcessingStatus;
  step: string;
  progress: number;
  message?: string;
  startTime?: string;
  endTime?: string;
  estimatedTimeRemaining?: number;
  segmentCount?: number;
  currentSegment?: number;
  rekognitionJobId?: string;
  performance?: {
    cpuUsage?: number;
    memoryUsage?: number;
    throughput?: string;
  };
  results?: ProcessingResults;
}

// Batch processing response
export interface BatchProcessingResponse {
  success: boolean;
  jobs: UploadResponse[];
  message?: string;
  error?: string;
}

// Transcript segment for video results
export interface TranscriptSegment {
  timestamp: string;
  endTime?: string;
  text: string;
  confidence?: number;
  sceneNumber?: number;
}

// Image analysis result
export interface ImageAnalysisResult {
  altText: string;
  detailedDescription: string;
  objects: string[];
  colors: string[];
  confidence: number;
  metadata?: {
    width: number;
    height: number;
    format: string;
  };
}

// Video analysis result
export interface VideoAnalysisResult {
  summary: string;
  scenes: VideoScene[];
  totalDuration: number;
  frameRate: number;
  resolution: {
    width: number;
    height: number;
  };
}

// Video scene
export interface VideoScene {
  sceneNumber: number;
  startTime: string;
  endTime: string;
  description: string;
  confidence: number;
  objects?: string[];
  actions?: string[];
  emotions?: string[];
}

// Developer console log entry
export interface ConsoleLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
  source?: string;
}

// Network activity entry
export interface NetworkActivity {
  id: string;
  timestamp: Date;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  size?: number;
}

// Performance metrics
export interface PerformanceMetrics {
  apiLatency: number;
  uploadSpeed: number;
  processingTime: number;
  downloadSpeed: number;
  totalTime: number;
}

// Export format options
export type ExportFormat = 'json' | 'csv' | 'txt' | 'srt' | 'vtt' | 'xml';

// Download options
export interface DownloadOptions {
  format: ExportFormat;
  includeMetadata: boolean;
  includeTimestamps: boolean;
  includeConfidence: boolean;
}

// Sample file info
export interface SampleFile {
  id: string;
  name: string;
  type: FileType;
  size: number;
  duration?: number;
  description: string;
  url: string;
}

// API code example
export interface CodeExample {
  id: string;
  title: string;
  language: 'javascript' | 'typescript' | 'python' | 'java' | 'csharp' | 'go' | 'ruby' | 'php';
  code: string;
  description?: string;
}

// Feature showcase item
export interface Feature {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  color: string;
  stats?: string;
}

// Use case item
export interface UseCase {
  title: string;
  description: string;
  image?: string;
  benefits: string[];
}

// Testimonial item
export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  rating: number;
  avatar?: string;
}

// Processing options for API
export interface ProcessingOptions {
  title?: string;
  description?: string;
  language?: string;
  context?: string;
  detailLevel?: DetailLevel;
  generateAudio?: boolean;
  voiceId?: string;
  webhookUrl?: string;
  priority?: 'low' | 'normal' | 'high';
  outputFormats?: ExportFormat[];
}

// User preferences
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  defaultDetailLevel: DetailLevel;
  defaultVoiceId: string;
  autoDownload: boolean;
  showDevTools: boolean;
  enableAnimations: boolean;
}

// Notification
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: Date;
  duration?: number;
  action?: {
    label: string;
    handler: () => void;
  };
}

// Form validation errors
export interface ValidationError {
  field: string;
  message: string;
  type: 'required' | 'format' | 'size' | 'type' | 'custom';
}

// API error response
export interface APIError {
  error: boolean;
  message: string;
  details?: string;
  code?: string;
  jobId?: string;
  timestamp?: string;
  stack?: string;
}