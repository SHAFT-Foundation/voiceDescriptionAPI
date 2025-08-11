# SDK Examples: OpenAI Pipeline Integration

## Table of Contents
- [JavaScript/TypeScript](#javascripttypescript)
- [Python](#python)
- [React](#react)
- [Node.js Express](#nodejs-express)
- [Next.js](#nextjs)
- [CLI Tools](#cli-tools)
- [Mobile SDKs](#mobile-sdks)

## JavaScript/TypeScript

### Complete TypeScript SDK

```typescript
// voice-description-sdk.ts
import axios, { AxiosInstance } from 'axios';

export interface ProcessingOptions {
  pipeline?: 'openai' | 'aws' | 'auto' | 'hybrid';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  openaiOptions?: OpenAIOptions;
  awsOptions?: AWSOptions;
}

export interface OpenAIOptions {
  detail?: 'low' | 'high' | 'auto';
  contextualAnalysis?: boolean;
  customPrompt?: {
    altText?: string;
    detailed?: string;
    seo?: string;
  };
  chunkingOptions?: {
    targetChunkSize?: number;
    maxChunkDuration?: number;
    sceneDetection?: boolean;
  };
}

export interface AWSOptions {
  segmentationType?: 'TECHNICAL_CUE' | 'SHOT';
  minConfidence?: number;
}

export class VoiceDescriptionSDK {
  private client: AxiosInstance;
  private defaultPipeline: string;

  constructor(config: { apiKey: string; baseURL?: string; defaultPipeline?: string }) {
    this.client = axios.create({
      baseURL: config.baseURL || 'https://api.voicedescription.ai',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    this.defaultPipeline = config.defaultPipeline || 'auto';
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[VoiceDescriptionAPI] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          // Rate limit - implement exponential backoff
          const retryAfter = error.response.headers['retry-after'] || 1;
          console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return this.client(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  // Process video with OpenAI pipeline
  async processVideoWithOpenAI(
    file: File | string,
    options?: OpenAIOptions
  ): Promise<ProcessingResult> {
    const formData = new FormData();
    
    if (typeof file === 'string') {
      formData.append('s3Uri', file);
    } else {
      formData.append('file', file);
    }
    
    formData.append('pipeline', 'openai');
    formData.append('options', JSON.stringify(options));

    const response = await this.client.post('/api/process-video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return this.pollForCompletion(response.data.jobId);
  }

  // Process image with OpenAI pipeline
  async processImageWithOpenAI(
    image: File | string,
    options?: OpenAIOptions
  ): Promise<ImageResult> {
    const formData = new FormData();
    
    if (typeof image === 'string') {
      formData.append('s3Uri', image);
    } else {
      formData.append('image', image);
    }
    
    formData.append('pipeline', 'openai');
    formData.append('options', JSON.stringify(options));

    const response = await this.client.post('/api/process-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return response.data;
  }

  // Batch process images
  async batchProcessImages(
    images: Array<{ source: string; id?: string; metadata?: any }>,
    options?: ProcessingOptions
  ): Promise<BatchResult> {
    const response = await this.client.post('/api/process-images-batch', {
      images,
      pipeline: options?.pipeline || this.defaultPipeline,
      options
    });

    return this.pollBatchCompletion(response.data.batchId);
  }

  // Smart pipeline selection
  async processWithAutoSelection(
    file: File | string,
    requirements: {
      maxProcessingTime?: number;
      maxCost?: number;
      minQuality?: number;
    }
  ): Promise<ProcessingResult> {
    // Get pipeline recommendation
    const recommendation = await this.getPipelineRecommendation(file, requirements);
    
    console.log(`Auto-selected pipeline: ${recommendation.pipeline}`);
    console.log(`Reason: ${recommendation.reason}`);

    // Process with selected pipeline
    return this.process(file, {
      pipeline: recommendation.pipeline,
      ...recommendation.options
    });
  }

  // Get cost estimate before processing
  async estimateCost(
    file: { size: number; duration?: number; type: 'video' | 'image' },
    options?: ProcessingOptions
  ): Promise<CostEstimate> {
    const response = await this.client.post('/api/estimate-cost', {
      file,
      pipeline: options?.pipeline || 'auto',
      options
    });

    return response.data.estimates;
  }

  // Monitor token usage (OpenAI)
  async getTokenUsage(period?: string): Promise<TokenUsage> {
    const response = await this.client.get('/api/usage/tokens', {
      params: { period }
    });

    return response.data;
  }

  // Poll for job completion
  private async pollForCompletion(
    jobId: string,
    maxAttempts = 60,
    interval = 5000
  ): Promise<ProcessingResult> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await this.client.get(`/api/status/${jobId}`);
      const status = response.data;

      if (status.status === 'completed') {
        return status.results;
      }

      if (status.status === 'failed') {
        throw new Error(`Processing failed: ${status.error?.message}`);
      }

      console.log(`Processing... ${status.progress}%`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Processing timeout');
  }

  // Poll for batch completion
  private async pollBatchCompletion(
    batchId: string,
    maxAttempts = 120,
    interval = 5000
  ): Promise<BatchResult> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await this.client.get(`/api/batch-status/${batchId}`);
      const status = response.data;

      if (status.status === 'completed' || status.status === 'partial') {
        return status;
      }

      console.log(`Batch processing... ${status.processed}/${status.total}`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Batch processing timeout');
  }
}

// Types
interface ProcessingResult {
  description: string;
  audioUrl?: string;
  chapters?: Chapter[];
  keyMoments?: KeyMoment[];
  metadata: {
    pipeline: string;
    processingTime: number;
    confidence: number;
    tokensUsed?: number;
  };
}

interface ImageResult {
  altText: string;
  detailedDescription: string;
  seoDescription: string;
  visualElements: string[];
  audioUrl?: string;
}

interface BatchResult {
  batchId: string;
  status: string;
  results: Array<{
    id: string;
    status: string;
    result?: ImageResult;
    error?: any;
  }>;
}

interface CostEstimate {
  openai: { cost: number; processingTime: number; confidence: number };
  aws: { cost: number; processingTime: number; confidence: number };
  recommended: string;
  reason: string;
}

interface TokenUsage {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  remaining: number;
}

interface Chapter {
  timestamp: number;
  title: string;
  description: string;
}

interface KeyMoment {
  timestamp: number;
  description: string;
  importance: 'high' | 'medium' | 'low';
}
```

### Usage Examples

```typescript
// Initialize SDK
const sdk = new VoiceDescriptionSDK({
  apiKey: 'your-api-key',
  defaultPipeline: 'openai'
});

// Example 1: Process video with OpenAI
async function processVideoExample() {
  const videoFile = document.getElementById('videoInput').files[0];
  
  try {
    const result = await sdk.processVideoWithOpenAI(videoFile, {
      detail: 'high',
      contextualAnalysis: true,
      customPrompt: {
        detailed: 'Focus on educational content and key concepts'
      },
      chunkingOptions: {
        maxChunkDuration: 30,
        sceneDetection: true
      }
    });
    
    console.log('Description:', result.description);
    console.log('Chapters:', result.chapters);
    console.log('Audio URL:', result.audioUrl);
    console.log('Tokens used:', result.metadata.tokensUsed);
  } catch (error) {
    console.error('Processing failed:', error);
  }
}

// Example 2: Batch process product images
async function batchProcessProducts() {
  const productImages = [
    { source: 's3://products/shoe1.jpg', id: 'SKU001' },
    { source: 's3://products/shoe2.jpg', id: 'SKU002' },
    { source: 's3://products/shoe3.jpg', id: 'SKU003' }
  ];
  
  const results = await sdk.batchProcessImages(productImages, {
    pipeline: 'openai',
    openaiOptions: {
      detail: 'high',
      customPrompt: {
        altText: 'Product name, color, style',
        seo: 'Include brand, material, and key features'
      }
    }
  });
  
  results.results.forEach(result => {
    if (result.status === 'completed') {
      console.log(`${result.id}: ${result.result.seoDescription}`);
    }
  });
}

// Example 3: Smart cost-optimized processing
async function costOptimizedProcessing() {
  const file = document.getElementById('fileInput').files[0];
  
  // Check cost first
  const estimate = await sdk.estimateCost({
    size: file.size,
    duration: 300, // 5 minutes
    type: 'video'
  });
  
  console.log('Cost estimates:', estimate);
  
  // Process with cheapest option under $1
  if (estimate.openai.cost < 1 && estimate.openai.cost < estimate.aws.cost) {
    return await sdk.processVideoWithOpenAI(file);
  } else {
    return await sdk.process(file, { pipeline: 'aws' });
  }
}

// Example 4: Monitor token usage
async function monitorUsage() {
  const usage = await sdk.getTokenUsage('2024-01-15');
  
  console.log(`Tokens used today: ${usage.totalTokens}`);
  console.log(`Cost: $${usage.cost}`);
  console.log(`Remaining: ${usage.remaining}`);
  
  if (usage.remaining < 100000) {
    console.warn('Low token balance - switching to AWS pipeline');
    sdk.defaultPipeline = 'aws';
  }
}
```

## Python

### Complete Python SDK

```python
# voice_description_sdk.py
import asyncio
import aiohttp
import base64
import json
import time
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from enum import Enum
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Pipeline(Enum):
    OPENAI = "openai"
    AWS = "aws"
    AUTO = "auto"
    HYBRID = "hybrid"


class DetailLevel(Enum):
    LOW = "low"
    HIGH = "high"
    AUTO = "auto"


@dataclass
class OpenAIOptions:
    detail: DetailLevel = DetailLevel.AUTO
    contextual_analysis: bool = True
    custom_prompt: Optional[Dict[str, str]] = None
    chunking_options: Optional[Dict[str, Any]] = None


@dataclass
class ProcessingResult:
    description: str
    audio_url: Optional[str]
    chapters: Optional[List[Dict]]
    key_moments: Optional[List[Dict]]
    metadata: Dict[str, Any]


class VoiceDescriptionSDK:
    """Python SDK for Voice Description API with OpenAI pipeline support"""
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.voicedescription.ai",
        default_pipeline: Pipeline = Pipeline.AUTO
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.default_pipeline = default_pipeline
        self.session = None
        
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession(
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    async def process_video_openai(
        self,
        file_path: str,
        options: Optional[OpenAIOptions] = None
    ) -> ProcessingResult:
        """Process video using OpenAI pipeline"""
        
        # Prepare multipart form data
        data = aiohttp.FormData()
        
        if file_path.startswith("s3://"):
            data.add_field("s3Uri", file_path)
        else:
            with open(file_path, 'rb') as f:
                data.add_field(
                    'file',
                    f,
                    filename=file_path.split('/')[-1],
                    content_type='video/mp4'
                )
        
        data.add_field("pipeline", "openai")
        
        if options:
            options_dict = {
                "detail": options.detail.value,
                "contextualAnalysis": options.contextual_analysis,
            }
            if options.custom_prompt:
                options_dict["customPrompt"] = options.custom_prompt
            if options.chunking_options:
                options_dict["chunkingOptions"] = options.chunking_options
            
            data.add_field("options", json.dumps(options_dict))
        
        # Submit for processing
        async with self.session.post(
            f"{self.base_url}/api/process-video",
            data=data
        ) as response:
            result = await response.json()
            
            if not result.get("success"):
                raise Exception(f"Processing failed: {result.get('error')}")
            
            job_id = result["data"]["jobId"]
        
        # Poll for completion
        return await self._poll_for_completion(job_id)
    
    async def process_image_openai(
        self,
        image_path: str,
        options: Optional[OpenAIOptions] = None
    ) -> Dict[str, Any]:
        """Process image using OpenAI pipeline"""
        
        data = aiohttp.FormData()
        
        if image_path.startswith("s3://"):
            data.add_field("s3Uri", image_path)
        else:
            with open(image_path, 'rb') as f:
                data.add_field(
                    'image',
                    f,
                    filename=image_path.split('/')[-1],
                    content_type='image/jpeg'
                )
        
        data.add_field("pipeline", "openai")
        
        if options:
            data.add_field("options", json.dumps({
                "detail": options.detail.value,
                "customPrompt": options.custom_prompt
            }))
        
        async with self.session.post(
            f"{self.base_url}/api/process-image",
            data=data
        ) as response:
            result = await response.json()
            
            if not result.get("success"):
                raise Exception(f"Processing failed: {result.get('error')}")
            
            return result["data"]
    
    async def batch_process_images(
        self,
        images: List[Dict[str, str]],
        pipeline: Pipeline = Pipeline.OPENAI,
        options: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Batch process multiple images"""
        
        payload = {
            "images": images,
            "pipeline": pipeline.value,
            "options": options or {}
        }
        
        async with self.session.post(
            f"{self.base_url}/api/process-images-batch",
            json=payload
        ) as response:
            result = await response.json()
            
            if not result.get("success"):
                raise Exception(f"Batch processing failed: {result.get('error')}")
            
            batch_id = result["data"]["batchId"]
        
        # Poll for batch completion
        return await self._poll_batch_completion(batch_id)
    
    async def estimate_cost(
        self,
        file_info: Dict[str, Any],
        pipeline: Pipeline = Pipeline.AUTO
    ) -> Dict[str, Any]:
        """Estimate processing cost before execution"""
        
        payload = {
            "file": file_info,
            "pipeline": pipeline.value
        }
        
        async with self.session.post(
            f"{self.base_url}/api/estimate-cost",
            json=payload
        ) as response:
            result = await response.json()
            return result["estimates"]
    
    async def get_token_usage(self, period: Optional[str] = None) -> Dict[str, Any]:
        """Get OpenAI token usage statistics"""
        
        params = {"period": period} if period else {}
        
        async with self.session.get(
            f"{self.base_url}/api/usage/tokens",
            params=params
        ) as response:
            return await response.json()
    
    async def _poll_for_completion(
        self,
        job_id: str,
        max_attempts: int = 60,
        interval: int = 5
    ) -> ProcessingResult:
        """Poll for job completion"""
        
        for attempt in range(max_attempts):
            async with self.session.get(
                f"{self.base_url}/api/status/{job_id}"
            ) as response:
                status = await response.json()
            
            if status["status"] == "completed":
                return ProcessingResult(
                    description=status["results"]["description"],
                    audio_url=status["results"].get("audioUrl"),
                    chapters=status["results"].get("chapters"),
                    key_moments=status["results"].get("keyMoments"),
                    metadata=status["results"].get("metadata", {})
                )
            
            if status["status"] == "failed":
                raise Exception(f"Processing failed: {status.get('error')}")
            
            logger.info(f"Processing... {status.get('progress', 0)}%")
            await asyncio.sleep(interval)
        
        raise TimeoutError("Processing timeout")
    
    async def _poll_batch_completion(
        self,
        batch_id: str,
        max_attempts: int = 120,
        interval: int = 5
    ) -> Dict[str, Any]:
        """Poll for batch completion"""
        
        for attempt in range(max_attempts):
            async with self.session.get(
                f"{self.base_url}/api/batch-status/{batch_id}"
            ) as response:
                status = await response.json()
            
            if status["status"] in ["completed", "partial"]:
                return status
            
            logger.info(
                f"Batch processing... {status.get('processed', 0)}/{status.get('total', 0)}"
            )
            await asyncio.sleep(interval)
        
        raise TimeoutError("Batch processing timeout")


# Usage examples
async def main():
    """Example usage of the SDK"""
    
    async with VoiceDescriptionSDK(
        api_key="your-api-key",
        default_pipeline=Pipeline.OPENAI
    ) as sdk:
        
        # Example 1: Process video with custom prompt
        video_result = await sdk.process_video_openai(
            "path/to/video.mp4",
            options=OpenAIOptions(
                detail=DetailLevel.HIGH,
                contextual_analysis=True,
                custom_prompt={
                    "detailed": "Focus on educational content and demonstrations"
                },
                chunking_options={
                    "maxChunkDuration": 30,
                    "sceneDetection": True
                }
            )
        )
        
        print(f"Description: {video_result.description}")
        print(f"Chapters: {video_result.chapters}")
        print(f"Audio URL: {video_result.audio_url}")
        
        # Example 2: Batch process images
        images = [
            {"source": "s3://bucket/image1.jpg", "id": "img001"},
            {"source": "s3://bucket/image2.jpg", "id": "img002"},
        ]
        
        batch_result = await sdk.batch_process_images(
            images,
            pipeline=Pipeline.OPENAI,
            options={
                "detail": "high",
                "customPrompt": {
                    "altText": "E-commerce product description",
                    "seo": "Include brand and key features"
                }
            }
        )
        
        for result in batch_result["results"]:
            if result["status"] == "completed":
                print(f"{result['id']}: {result['result']['altText']}")
        
        # Example 3: Cost estimation
        estimate = await sdk.estimate_cost(
            file_info={
                "size": 52428800,  # 50MB
                "duration": 300,    # 5 minutes
                "type": "video"
            },
            pipeline=Pipeline.AUTO
        )
        
        print(f"OpenAI cost: ${estimate['openai']['cost']}")
        print(f"AWS cost: ${estimate['aws']['cost']}")
        print(f"Recommended: {estimate['recommended']}")
        
        # Example 4: Monitor token usage
        usage = await sdk.get_token_usage("2024-01-15")
        
        print(f"Tokens used: {usage['totalTokens']}")
        print(f"Cost: ${usage['cost']}")
        print(f"Remaining: {usage['remaining']}")


if __name__ == "__main__":
    asyncio.run(main())
```

## React

### React Hook for Video Processing

```tsx
// useVoiceDescription.tsx
import { useState, useCallback, useEffect } from 'react';
import { VoiceDescriptionSDK } from './voice-description-sdk';

interface UseVoiceDescriptionOptions {
  apiKey: string;
  defaultPipeline?: 'openai' | 'aws' | 'auto';
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  result: any | null;
  error: Error | null;
  pipeline: string | null;
  estimatedTime: number | null;
  cost: number | null;
}

export function useVoiceDescription(options: UseVoiceDescriptionOptions) {
  const [sdk] = useState(() => new VoiceDescriptionSDK({
    apiKey: options.apiKey,
    defaultPipeline: options.defaultPipeline || 'auto'
  }));

  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    progress: 0,
    result: null,
    error: null,
    pipeline: null,
    estimatedTime: null,
    cost: null
  });

  const processVideo = useCallback(async (
    file: File,
    pipeline: 'openai' | 'aws' | 'auto' = 'auto',
    customOptions?: any
  ) => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: 0,
      error: null,
      pipeline
    }));

    try {
      // Estimate cost first
      const estimate = await sdk.estimateCost({
        size: file.size,
        duration: await getVideoDuration(file),
        type: 'video'
      });

      setState(prev => ({
        ...prev,
        cost: estimate[pipeline === 'auto' ? estimate.recommended : pipeline].cost,
        estimatedTime: estimate[pipeline === 'auto' ? estimate.recommended : pipeline].processingTime
      }));

      // Process video
      const result = await sdk.processVideoWithOpenAI(file, customOptions);

      setState(prev => ({
        ...prev,
        isProcessing: false,
        progress: 100,
        result
      }));

      return result;
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: err
      }));
      
      if (options.onError) {
        options.onError(err);
      }
      
      throw err;
    }
  }, [sdk, options]);

  const processImage = useCallback(async (
    file: File,
    pipeline: 'openai' | 'aws' | 'auto' = 'openai',
    customOptions?: any
  ) => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      progress: 0,
      error: null,
      pipeline
    }));

    try {
      const result = await sdk.processImageWithOpenAI(file, customOptions);

      setState(prev => ({
        ...prev,
        isProcessing: false,
        progress: 100,
        result
      }));

      return result;
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: err
      }));
      
      throw err;
    }
  }, [sdk]);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      progress: 0,
      result: null,
      error: null,
      pipeline: null,
      estimatedTime: null,
      cost: null
    });
  }, []);

  return {
    processVideo,
    processImage,
    reset,
    ...state
  };
}

// Helper function to get video duration
async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    
    video.src = URL.createObjectURL(file);
  });
}
```

### React Component Example

```tsx
// VideoProcessor.tsx
import React, { useState } from 'react';
import { useVoiceDescription } from './useVoiceDescription';

export function VideoProcessor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pipeline, setPipeline] = useState<'openai' | 'aws' | 'auto'>('auto');
  const [customPrompt, setCustomPrompt] = useState('');
  
  const {
    processVideo,
    isProcessing,
    progress,
    result,
    error,
    estimatedTime,
    cost,
    reset
  } = useVoiceDescription({
    apiKey: process.env.REACT_APP_API_KEY!,
    defaultPipeline: 'openai',
    onProgress: (prog) => console.log(`Progress: ${prog}%`),
    onError: (err) => console.error('Processing error:', err)
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      reset();
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;

    try {
      await processVideo(selectedFile, pipeline, {
        detail: 'high',
        contextualAnalysis: true,
        customPrompt: customPrompt ? { detailed: customPrompt } : undefined
      });
    } catch (err) {
      console.error('Failed to process video:', err);
    }
  };

  return (
    <div className="video-processor">
      <h2>Voice Description API - OpenAI Pipeline Demo</h2>
      
      {/* File Input */}
      <div className="file-input">
        <input
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          disabled={isProcessing}
        />
      </div>

      {/* Pipeline Selection */}
      <div className="pipeline-selection">
        <label>Pipeline:</label>
        <select 
          value={pipeline} 
          onChange={(e) => setPipeline(e.target.value as any)}
          disabled={isProcessing}
        >
          <option value="auto">Auto (Recommended)</option>
          <option value="openai">OpenAI (Fast)</option>
          <option value="aws">AWS (Detailed)</option>
        </select>
      </div>

      {/* Custom Prompt */}
      <div className="custom-prompt">
        <label>Custom Prompt (Optional):</label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="e.g., Focus on educational content and key concepts"
          disabled={isProcessing}
        />
      </div>

      {/* Process Button */}
      <button 
        onClick={handleProcess}
        disabled={!selectedFile || isProcessing}
      >
        {isProcessing ? `Processing... ${progress}%` : 'Process Video'}
      </button>

      {/* Cost & Time Estimates */}
      {estimatedTime && cost && (
        <div className="estimates">
          <p>Estimated Time: {estimatedTime} seconds</p>
          <p>Estimated Cost: ${cost.toFixed(2)}</p>
        </div>
      )}

      {/* Progress Bar */}
      {isProcessing && (
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error">
          <h3>Error:</h3>
          <p>{error.message}</p>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="results">
          <h3>Processing Complete!</h3>
          
          <div className="description">
            <h4>Description:</h4>
            <p>{result.description}</p>
          </div>

          {result.chapters && (
            <div className="chapters">
              <h4>Chapters:</h4>
              <ul>
                {result.chapters.map((chapter: any, index: number) => (
                  <li key={index}>
                    {formatTime(chapter.timestamp)} - {chapter.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.audioUrl && (
            <div className="audio">
              <h4>Audio Narration:</h4>
              <audio controls src={result.audioUrl} />
            </div>
          )}

          <div className="metadata">
            <h4>Processing Details:</h4>
            <p>Pipeline: {result.metadata.pipeline}</p>
            <p>Processing Time: {result.metadata.processingTime}s</p>
            <p>Confidence: {(result.metadata.confidence * 100).toFixed(1)}%</p>
            {result.metadata.tokensUsed && (
              <p>Tokens Used: {result.metadata.tokensUsed}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to format timestamp
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
```

## CLI Tools

### Command-Line Interface

```bash
#!/usr/bin/env node
// voice-describe-cli.js

const { program } = require('commander');
const { VoiceDescriptionSDK } = require('./voice-description-sdk');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');

// Load configuration
const config = {
  apiKey: process.env.VOICE_DESC_API_KEY || '',
  baseUrl: process.env.VOICE_DESC_API_URL || 'https://api.voicedescription.ai'
};

const sdk = new VoiceDescriptionSDK(config);

// Process video command
program
  .command('process-video <file>')
  .description('Process a video file for accessibility')
  .option('-p, --pipeline <type>', 'Pipeline to use (openai, aws, auto)', 'auto')
  .option('-d, --detail <level>', 'Detail level (low, high, auto)', 'auto')
  .option('-c, --custom-prompt <prompt>', 'Custom prompt for processing')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('--chapters', 'Generate chapters', false)
  .option('--estimate-only', 'Only show cost estimate', false)
  .action(async (file, options) => {
    const spinner = ora('Processing video...').start();
    
    try {
      // Check if file exists
      await fs.access(file);
      const stats = await fs.stat(file);
      
      // Estimate cost first
      if (options.estimateOnly) {
        spinner.text = 'Estimating cost...';
        const estimate = await sdk.estimateCost({
          size: stats.size,
          type: 'video'
        });
        
        spinner.stop();
        
        const table = new Table({
          head: ['Pipeline', 'Cost', 'Time', 'Quality'],
          colWidths: [15, 15, 15, 15]
        });
        
        table.push(
          ['OpenAI', `$${estimate.openai.cost}`, `${estimate.openai.processingTime}s`, '94%'],
          ['AWS', `$${estimate.aws.cost}`, `${estimate.aws.processingTime}s`, '89%']
        );
        
        console.log(table.toString());
        console.log(chalk.green(`Recommended: ${estimate.recommended}`));
        return;
      }
      
      // Process video
      spinner.text = `Processing with ${options.pipeline} pipeline...`;
      
      const result = await sdk.processVideo(file, {
        pipeline: options.pipeline,
        openaiOptions: {
          detail: options.detail,
          customPrompt: options.customPrompt ? {
            detailed: options.customPrompt
          } : undefined,
          generateChapters: options.chapters
        }
      });
      
      spinner.succeed('Processing complete!');
      
      // Save results
      const outputDir = path.resolve(options.output);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Save description
      const descFile = path.join(outputDir, 'description.txt');
      await fs.writeFile(descFile, result.description);
      console.log(chalk.green(`✓ Description saved to ${descFile}`));
      
      // Save chapters if available
      if (result.chapters) {
        const chaptersFile = path.join(outputDir, 'chapters.json');
        await fs.writeFile(chaptersFile, JSON.stringify(result.chapters, null, 2));
        console.log(chalk.green(`✓ Chapters saved to ${chaptersFile}`));
      }
      
      // Display summary
      console.log('\n' + chalk.bold('Summary:'));
      console.log(`Pipeline used: ${result.metadata.pipeline}`);
      console.log(`Processing time: ${result.metadata.processingTime}s`);
      console.log(`Confidence: ${(result.metadata.confidence * 100).toFixed(1)}%`);
      
      if (result.metadata.tokensUsed) {
        console.log(`Tokens used: ${result.metadata.tokensUsed}`);
      }
      
    } catch (error) {
      spinner.fail('Processing failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Batch process images command
program
  .command('batch-images <pattern>')
  .description('Batch process images matching a pattern')
  .option('-p, --pipeline <type>', 'Pipeline to use', 'openai')
  .option('--alt-text <prompt>', 'Custom prompt for alt text')
  .option('--seo <prompt>', 'Custom prompt for SEO')
  .option('-o, --output <file>', 'Output CSV file', 'results.csv')
  .action(async (pattern, options) => {
    const spinner = ora('Finding images...').start();
    
    try {
      // Find matching files
      const glob = require('glob');
      const files = glob.sync(pattern);
      
      if (files.length === 0) {
        spinner.fail('No files found matching pattern');
        return;
      }
      
      spinner.text = `Processing ${files.length} images...`;
      
      // Prepare batch
      const images = files.map((file, index) => ({
        source: file,
        id: `img-${index}`
      }));
      
      // Process batch
      const results = await sdk.batchProcessImages(images, {
        pipeline: options.pipeline,
        openaiOptions: {
          customPrompt: {
            altText: options.altText,
            seo: options.seo
          }
        }
      });
      
      spinner.succeed(`Processed ${results.results.length} images`);
      
      // Save to CSV
      const csv = [
        'File,Alt Text,SEO Description,Status',
        ...results.results.map(r => 
          `"${files[parseInt(r.id.split('-')[1])]}","${r.result?.altText || ''}","${r.result?.seoDescription || ''}","${r.status}"`
        )
      ].join('\n');
      
      await fs.writeFile(options.output, csv);
      console.log(chalk.green(`✓ Results saved to ${options.output}`));
      
    } catch (error) {
      spinner.fail('Batch processing failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Monitor usage command
program
  .command('usage')
  .description('Show token usage and costs')
  .option('-p, --period <date>', 'Period to check (YYYY-MM-DD)')
  .action(async (options) => {
    const spinner = ora('Fetching usage data...').start();
    
    try {
      const usage = await sdk.getTokenUsage(options.period);
      spinner.stop();
      
      const table = new Table({
        head: ['Metric', 'Value'],
        colWidths: [30, 30]
      });
      
      table.push(
        ['Total Tokens', usage.totalTokens.toLocaleString()],
        ['Input Tokens', usage.inputTokens.toLocaleString()],
        ['Output Tokens', usage.outputTokens.toLocaleString()],
        ['Cost', `$${usage.cost.toFixed(2)}`],
        ['Requests', usage.requests],
        ['Average per Request', usage.averagePerRequest],
        ['Remaining Today', usage.remaining.toLocaleString()]
      );
      
      console.log(table.toString());
      
      // Show warning if low balance
      if (usage.remaining < 100000) {
        console.log(chalk.yellow('⚠ Warning: Low token balance'));
      }
      
    } catch (error) {
      spinner.fail('Failed to fetch usage data');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse(process.argv);
```

## Support & Resources

For more examples and support:

- **GitHub**: [github.com/voicedescription/sdk-examples](https://github.com/voicedescription/sdk-examples)
- **API Reference**: [docs.voicedescription.ai/api](https://docs.voicedescription.ai/api)
- **Support**: sdk-support@voicedescription.ai
- **Discord**: [discord.gg/voicedesc](https://discord.gg/voicedesc)

---

**Need a custom SDK?** Contact us at sdk@voicedescription.ai for SDK development in other languages or frameworks.