/**
 * API Client for Voice Description API
 * Handles all API interactions with proper error handling and retry logic
 */

import { QueryClient } from '@tanstack/react-query';

export interface UploadResponse {
  success: boolean;
  jobId: string;
  message?: string;
  error?: string;
}

export interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
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
  results?: {
    textUrl?: string;
    audioUrl?: string;
    metadata?: any;
  };
}

export interface ProcessingOptions {
  title?: string;
  description?: string;
  language?: string;
  context?: string;
  detailLevel?: 'basic' | 'detailed' | 'comprehensive';
  generateAudio?: boolean;
  voiceId?: string;
  webhookUrl?: string;
}

export interface APIError {
  error: boolean;
  message: string;
  details?: string;
  jobId?: string;
  timestamp?: string;
}

class APIClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Upload a file for processing
   */
  async uploadFile(
    file: File,
    type: 'video' | 'image',
    options: ProcessingOptions = {}
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    // Add processing options
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    try {
      const response = await fetch(`${this.baseUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      return data;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  /**
   * Process an image directly
   */
  async processImage(
    file: File,
    options: ProcessingOptions = {}
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    try {
      const response = await fetch(`${this.baseUrl}/api/process-image`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      return data;
    } catch (error) {
      console.error('Image processing error:', error);
      throw error;
    }
  }

  /**
   * Process multiple images in batch
   */
  async processBatchImages(
    files: File[],
    options: ProcessingOptions = {}
  ): Promise<UploadResponse[]> {
    const formData = new FormData();
    
    files.forEach((file, index) => {
      formData.append(`files`, file);
    });
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    try {
      const response = await fetch(`${this.baseUrl}/api/process-images-batch`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Batch processing failed');
      }

      return data.jobs || [];
    } catch (error) {
      console.error('Batch processing error:', error);
      throw error;
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(
    jobId: string,
    type: 'video' | 'image' = 'video'
  ): Promise<JobStatus> {
    const endpoint = type === 'image' 
      ? `/api/status/image/${jobId}`
      : `/api/status/${jobId}`;

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get status');
      }

      return data.data || data;
    } catch (error) {
      console.error('Status fetch error:', error);
      throw error;
    }
  }

  /**
   * Download text results
   */
  async downloadText(
    jobId: string,
    type: 'video' | 'image' = 'video'
  ): Promise<Blob> {
    const endpoint = type === 'image'
      ? `/api/results/image/${jobId}/text`
      : `/api/results/${jobId}/text`;

    const response = await fetch(`${this.baseUrl}${endpoint}`);
    
    if (!response.ok) {
      throw new Error('Failed to download text');
    }

    return response.blob();
  }

  /**
   * Download audio results
   */
  async downloadAudio(
    jobId: string,
    type: 'video' | 'image' = 'video'
  ): Promise<Blob> {
    const endpoint = type === 'image'
      ? `/api/results/image/${jobId}/audio`
      : `/api/results/${jobId}/audio`;

    const response = await fetch(`${this.baseUrl}${endpoint}`);
    
    if (!response.ok) {
      throw new Error('Failed to download audio');
    }

    return response.blob();
  }

  /**
   * Get AWS service status
   */
  async getAWSStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/aws-status`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('AWS status fetch error:', error);
      return null;
    }
  }

  /**
   * Get API health status
   */
  async getHealthStatus(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Health check error:', error);
      return null;
    }
  }

  /**
   * Get API documentation samples
   */
  async getAPISamples(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/docs/samples`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Samples fetch error:', error);
      return null;
    }
  }

  /**
   * Poll job status until completion
   */
  async pollJobStatus(
    jobId: string,
    type: 'video' | 'image' = 'video',
    onProgress?: (status: JobStatus) => void,
    interval: number = 2000,
    maxAttempts: number = 300 // 10 minutes with 2s interval
  ): Promise<JobStatus> {
    let attempts = 0;

    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        attempts++;

        try {
          const status = await this.getJobStatus(jobId, type);
          
          if (onProgress) {
            onProgress(status);
          }

          if (status.status === 'completed') {
            clearInterval(pollInterval);
            resolve(status);
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            reject(new Error(status.message || 'Processing failed'));
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            reject(new Error('Processing timeout'));
          }
        } catch (error) {
          clearInterval(pollInterval);
          reject(error);
        }
      }, interval);
    });
  }

  /**
   * Upload with progress tracking
   */
  async uploadWithProgress(
    file: File,
    type: 'video' | 'image',
    options: ProcessingOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      
      formData.append('file', file);
      formData.append('type', type);
      
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, String(value));
        }
      });

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(Math.round(percentComplete));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', `${this.baseUrl}/api/upload`);
      xhr.send(formData);
    });
  }
}

// Create React Query client with optimized settings
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 2,
    },
  },
});

// Export singleton instance
export const apiClient = new APIClient();

// Export hooks for React Query
export const useJobStatus = (jobId: string | null, type: 'video' | 'image' = 'video') => {
  return {
    queryKey: ['jobStatus', jobId, type],
    queryFn: () => jobId ? apiClient.getJobStatus(jobId, type) : null,
    enabled: !!jobId,
    refetchInterval: (data: any) => {
      if (!data) return false;
      const status = data?.status;
      return status === 'processing' || status === 'pending' ? 2000 : false;
    },
  };
};

export const useAWSStatus = () => {
  return {
    queryKey: ['awsStatus'],
    queryFn: () => apiClient.getAWSStatus(),
    refetchInterval: 30000, // Refresh every 30 seconds
  };
};

export default apiClient;