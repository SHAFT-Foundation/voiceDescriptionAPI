import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import FormData from 'form-data';
import { config, apiConfig } from '../config/index.js';
import { logger, logAPICall, logAPIResponse } from '../utils/logger.js';
import { retry, withTimeout } from '../utils/retry.js';
import {
  ProcessImageOptions,
  UploadVideoOptions,
  JobStatus,
  ImageResult,
  VideoResult,
  BatchResult,
  HealthStatus,
  AWSStatus,
  MCPToolError,
  ErrorCode
} from '../types/index.js';

export class APIClient {
  private client: AxiosInstance;
  private readonly baseURL: string;
  
  constructor() {
    this.baseURL = apiConfig.baseUrl;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: apiConfig.timeout,
      headers: {
        'User-Agent': 'voice-description-mcp-server/1.0.0',
        'Accept': 'application/json',
        ...(apiConfig.apiKey && { 'Authorization': `Bearer ${apiConfig.apiKey}` })
      },
      // Increase body size limits for file uploads
      maxBodyLength: config.files.maxSize,
      maxContentLength: config.files.maxSize,
    });
    
    this.setupInterceptors();
  }
  
  private setupInterceptors() {
    // Request interceptor for logging and timeout
    this.client.interceptors.request.use(
      (config) => {
        const startTime = Date.now();
        config.metadata = { startTime };
        
        logAPICall(config.method?.toUpperCase() || 'UNKNOWN', config.url || '');
        
        return config;
      },
      (error) => {
        logger.error('API request interceptor error', { error: error.message });
        return Promise.reject(error);
      }
    );
    
    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        
        logAPIResponse(
          response.config.method?.toUpperCase() || 'UNKNOWN',
          response.config.url || '',
          response.status,
          duration
        );
        
        return response;
      },
      (error: AxiosError) => {
        const duration = Date.now() - (error.config?.metadata?.startTime || 0);
        
        logAPIResponse(
          error.config?.method?.toUpperCase() || 'UNKNOWN',
          error.config?.url || '',
          error.response?.status || 0,
          duration,
          error
        );
        
        return Promise.reject(this.formatError(error));
      }
    );
  }
  
  /**
   * Process a single image
   */
  async processImage(options: ProcessImageOptions): Promise<ImageResult> {
    return retry(async () => {
      const formData = new FormData();
      
      // Add the image file
      formData.append('image', options.file, {
        filename: options.fileName,
        contentType: options.mimeType,
      });
      
      // Add processing options
      if (options.options?.detailLevel) {
        formData.append('detailLevel', options.options.detailLevel);
      }
      if (options.options?.generateAudio !== undefined) {
        formData.append('generateAudio', String(options.options.generateAudio));
      }
      if (options.options?.includeAltText !== undefined) {
        formData.append('includeAltText', String(options.options.includeAltText));
      }
      if (options.options?.voiceId) {
        formData.append('voiceId', options.options.voiceId);
      }
      if (options.options?.language) {
        formData.append('language', options.options.language);
      }
      
      // Add metadata
      if (options.metadata?.title) {
        formData.append('title', options.metadata.title);
      }
      if (options.metadata?.description) {
        formData.append('description', options.metadata.description);
      }
      if (options.metadata?.context) {
        formData.append('context', options.metadata.context);
      }
      
      const response = await this.client.post('/api/process-image', formData, {
        headers: formData.getHeaders(),
      });
      
      if (!response.data.success) {
        throw new MCPToolError(
          ErrorCode.API_REQUEST_FAILED,
          response.data.error?.message || 'Image processing failed',
          response.data.error
        );
      }
      
      return response.data.data;
    }, {
      maxRetries: apiConfig.maxRetries,
      retryOn: [429, 502, 503, 504],
    });
  }
  
  /**
   * Process multiple images in batch
   */
  async batchProcessImages(images: Array<{
    file: Buffer;
    fileName: string;
    mimeType: string;
    id?: string;
    context?: string;
  }>, options?: {
    detailLevel?: string;
    generateAudio?: boolean;
    voiceId?: string;
  }): Promise<BatchResult> {
    return retry(async () => {
      const formData = new FormData();
      
      // Add each image file
      images.forEach((image, index) => {
        formData.append(`images`, image.file, {
          filename: image.fileName,
          contentType: image.mimeType,
        });
        
        // Add metadata for each image
        if (image.id) {
          formData.append(`imageIds`, image.id);
        }
        if (image.context) {
          formData.append(`imageContexts`, image.context);
        }
      });
      
      // Add batch options
      if (options?.detailLevel) {
        formData.append('detailLevel', options.detailLevel);
      }
      if (options?.generateAudio !== undefined) {
        formData.append('generateAudio', String(options.generateAudio));
      }
      if (options?.voiceId) {
        formData.append('voiceId', options.voiceId);
      }
      
      const response = await this.client.post('/api/process-images-batch', formData, {
        headers: formData.getHeaders(),
        timeout: apiConfig.timeout * 2, // Double timeout for batch operations
      });
      
      if (!response.data.success) {
        throw new MCPToolError(
          ErrorCode.API_REQUEST_FAILED,
          response.data.error?.message || 'Batch processing failed',
          response.data.error
        );
      }
      
      return response.data.data;
    }, {
      maxRetries: apiConfig.maxRetries,
      retryOn: [429, 502, 503, 504],
    });
  }
  
  /**
   * Upload and process a video file
   */
  async uploadVideo(options: UploadVideoOptions): Promise<VideoResult> {
    return retry(async () => {
      const formData = new FormData();
      
      // Add the video file
      formData.append('video', options.file, {
        filename: options.fileName,
        contentType: options.mimeType,
      });
      
      // Add metadata
      if (options.metadata?.title) {
        formData.append('title', options.metadata.title);
      }
      if (options.metadata?.description) {
        formData.append('description', options.metadata.description);
      }
      if (options.metadata?.language) {
        formData.append('language', options.metadata.language);
      }
      
      // Add processing options
      if (options.options?.voiceId) {
        formData.append('voiceId', options.options.voiceId);
      }
      if (options.options?.detailLevel) {
        formData.append('detailLevel', options.options.detailLevel);
      }
      
      const response = await this.client.post('/api/upload', formData, {
        headers: formData.getHeaders(),
        timeout: apiConfig.timeout * 3, // Triple timeout for video uploads
      });
      
      if (!response.data.success) {
        throw new MCPToolError(
          ErrorCode.API_REQUEST_FAILED,
          response.data.error?.message || 'Video upload failed',
          response.data.error
        );
      }
      
      return response.data;
    }, {
      maxRetries: apiConfig.maxRetries,
      retryOn: [429, 502, 503, 504],
    });
  }
  
  /**
   * Process video from S3 URL
   */
  async processVideoFromS3(s3Uri: string, options?: {
    title?: string;
    language?: string;
    voiceId?: string;
    detailLevel?: string;
  }): Promise<VideoResult> {
    return retry(async () => {
      const response = await this.client.post('/api/process', {
        s3Uri,
        ...options
      });
      
      if (!response.data.success) {
        throw new MCPToolError(
          ErrorCode.API_REQUEST_FAILED,
          response.data.error?.message || 'Video processing failed',
          response.data.error
        );
      }
      
      return response.data;
    }, {
      maxRetries: apiConfig.maxRetries,
      retryOn: [429, 502, 503, 504],
    });
  }
  
  /**
   * Check job status
   */
  async checkJobStatus(jobId: string, jobType: 'video' | 'image' = 'video'): Promise<JobStatus> {
    const endpoint = jobType === 'image' 
      ? `/api/status/image/${jobId}`
      : `/api/status/${jobId}`;
    
    const response = await this.client.get(endpoint);
    
    if (!response.data.success && response.data.error?.code !== 'JOB_NOT_FOUND') {
      throw new MCPToolError(
        ErrorCode.API_REQUEST_FAILED,
        response.data.error?.message || 'Failed to check job status',
        response.data.error
      );
    }
    
    return response.data.data || response.data;
  }
  
  /**
   * Download text results
   */
  async downloadTextResults(jobId: string, jobType: 'video' | 'image' = 'video'): Promise<string> {
    const endpoint = jobType === 'image'
      ? `/api/results/image/${jobId}/text`
      : `/api/results/${jobId}/text`;
    
    const response = await this.client.get(endpoint, {
      responseType: 'text',
    });
    
    return response.data;
  }
  
  /**
   * Download audio results
   */
  async downloadAudioResults(jobId: string, jobType: 'video' | 'image' = 'video'): Promise<Buffer> {
    const endpoint = jobType === 'image'
      ? `/api/results/image/${jobId}/audio`
      : `/api/results/${jobId}/audio`;
    
    const response = await this.client.get(endpoint, {
      responseType: 'arraybuffer',
    });
    
    return Buffer.from(response.data);
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<HealthStatus> {
    const response = await this.client.get('/api/health');
    return response.data;
  }
  
  /**
   * Get AWS service status
   */
  async getAWSStatus(): Promise<AWSStatus> {
    const response = await this.client.get('/api/aws-status');
    return response.data;
  }
  
  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await withTimeout(
        this.client.get('/api/health'),
        5000 // 5 second timeout for connectivity test
      );
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.warn('API connectivity test failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  
  /**
   * Get API information
   */
  async getAPIInfo(): Promise<{
    version: string;
    capabilities: string[];
    limits: Record<string, any>;
  }> {
    try {
      const response = await this.client.get('/api/docs');
      return response.data;
    } catch (error) {
      // Fallback if docs endpoint doesn't exist
      return {
        version: 'unknown',
        capabilities: ['image-processing', 'video-processing', 'audio-generation'],
        limits: {
          maxFileSize: config.files.maxSize,
          supportedFormats: {
            images: config.files.allowedImageTypes,
            videos: config.files.allowedVideoTypes,
          }
        }
      };
    }
  }
  
  /**
   * Format API errors consistently
   */
  private formatError(error: AxiosError): MCPToolError {
    // Handle network/connection errors
    if (!error.response) {
      if (error.code === 'ECONNREFUSED') {
        return new MCPToolError(
          ErrorCode.API_UNAVAILABLE,
          `Voice Description API is unavailable at ${this.baseURL}`,
          { 
            originalError: error.message,
            endpoint: this.baseURL 
          },
          true // retryable
        );
      }
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return new MCPToolError(
          ErrorCode.TIMEOUT_ERROR,
          'Request timeout - API did not respond in time',
          { 
            timeout: apiConfig.timeout,
            originalError: error.message 
          },
          true // retryable
        );
      }
      
      return new MCPToolError(
        ErrorCode.NETWORK_ERROR,
        'Network error occurred while contacting API',
        { originalError: error.message },
        true // retryable
      );
    }
    
    const status = error.response.status;
    const data = error.response.data as any;
    
    // Handle specific HTTP status codes
    switch (status) {
      case 400:
        return new MCPToolError(
          ErrorCode.INVALID_PARAMETERS,
          data?.error?.message || 'Invalid request parameters',
          { 
            status,
            details: data?.error?.details || data 
          }
        );
      
      case 401:
        return new MCPToolError(
          ErrorCode.API_AUTHENTICATION_FAILED,
          'Authentication failed - invalid API key',
          { status }
        );
      
      case 403:
        return new MCPToolError(
          ErrorCode.API_AUTHENTICATION_FAILED,
          'Access forbidden - insufficient permissions',
          { status }
        );
      
      case 404:
        return new MCPToolError(
          ErrorCode.JOB_NOT_FOUND,
          data?.error?.message || 'Resource not found',
          { status }
        );
      
      case 413:
        return new MCPToolError(
          ErrorCode.FILE_TOO_LARGE,
          'File size exceeds API limits',
          { 
            status,
            maxSize: config.files.maxSize 
          }
        );
      
      case 415:
        return new MCPToolError(
          ErrorCode.UNSUPPORTED_FORMAT,
          'Unsupported file format',
          { 
            status,
            supportedFormats: {
              images: config.files.allowedImageTypes,
              videos: config.files.allowedVideoTypes,
            }
          }
        );
      
      case 429:
        return new MCPToolError(
          ErrorCode.API_RATE_LIMITED,
          'Rate limit exceeded',
          { 
            status,
            retryAfter: error.response.headers['retry-after']
          },
          true // retryable
        );
      
      case 500:
      case 502:
      case 503:
      case 504:
        return new MCPToolError(
          ErrorCode.API_UNAVAILABLE,
          data?.error?.message || 'API server error',
          { 
            status,
            details: data 
          },
          true // retryable
        );
      
      default:
        return new MCPToolError(
          ErrorCode.API_REQUEST_FAILED,
          data?.error?.message || `API request failed with status ${status}`,
          { 
            status,
            details: data 
          },
          status >= 500 // only retry on 5xx errors
        );
    }
  }
  
  /**
   * Get client configuration
   */
  getConfig(): {
    baseURL: string;
    timeout: number;
    maxRetries: number;
    hasApiKey: boolean;
  } {
    return {
      baseURL: this.baseURL,
      timeout: apiConfig.timeout,
      maxRetries: apiConfig.maxRetries,
      hasApiKey: !!apiConfig.apiKey
    };
  }
}