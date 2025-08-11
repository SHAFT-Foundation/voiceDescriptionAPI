# Voice Description API - Complete Documentation

## Table of Contents
- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Code Examples](#code-examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Testing Guide](#testing-guide)

## Overview

The Voice Description API provides automated video and image description services, generating accessible audio narration tracks for visual content. The API leverages AWS AI services including Rekognition, Bedrock Nova Pro, and Polly for comprehensive accessibility solutions.

### Key Features
- **Video Processing**: Automatic scene segmentation and description
- **Image Processing**: Single and batch image analysis
- **Audio Generation**: Text-to-speech synthesis with multiple voices
- **Real-time Status**: WebSocket and polling for job progress
- **Batch Operations**: Process multiple files efficiently
- **Multiple Formats**: Support for various video and image formats

## Base URL

```
Development: http://localhost:3000
Production: https://api.voicedescription.com
```

## Authentication

Currently, the API uses API key authentication (optional). Include your API key in the request headers:

```http
Authorization: Bearer YOUR_API_KEY
```

## Pipeline Selection

The API supports dual-pipeline processing with intelligent routing between OpenAI and AWS pipelines. You can specify a pipeline explicitly or let the API auto-select based on your content.

### Pipeline Options
- `openai` - Ultra-fast processing with GPT-4 Vision (30-60 seconds)
- `aws` - Detailed analysis with Rekognition + Bedrock (5-10 minutes)
- `auto` - Intelligent selection based on file size, priority, and requirements
- `hybrid` - Split processing across both pipelines for optimization

## API Endpoints

### 1. Health Check

Check API health and system status.

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "responseTime": "15ms",
  "checks": {
    "server": "healthy",
    "environment": {
      "status": "healthy",
      "buckets": {
        "input": "voice-desc-input",
        "output": "voice-desc-output"
      },
      "region": "us-east-1"
    },
    "jobManager": {
      "status": "healthy",
      "video": {
        "activeJobs": 2,
        "completedJobs": 150,
        "failedJobs": 3
      },
      "image": {
        "activeJobs": 5,
        "completedJobs": 320,
        "failedJobs": 8
      },
      "capabilities": {
        "videoProcessing": true,
        "imageProcessing": true,
        "batchProcessing": true,
        "audioGeneration": true
      }
    }
  }
}
```

### 2. Upload Video/Image

Upload a file for processing.

**Endpoint:** `POST /api/upload`

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Binary file data
  - `type`: "video" or "image"
  - `title`: (optional) Content title
  - `description`: (optional) Additional context
  - `language`: (optional) Output language (default: "en")
  - `voiceId`: (optional) AWS Polly voice ID
  - `detailLevel`: (optional) "basic", "detailed", or "comprehensive"

**Response:**
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Upload successful, processing started",
  "estimatedTime": 300
}
```

### 3. Process Image

Process a single image with immediate response.

**Endpoint:** `POST /api/process-image`

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `file`: Image file (JPEG, PNG, WebP)
  - `detailLevel`: (optional) "basic", "comprehensive", or "technical"
  - `generateAudio`: (optional) boolean
  - `includeAltText`: (optional) boolean
  - `voiceId`: (optional) AWS Polly voice ID

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "processingTime": 2500,
    "results": {
      "detailedDescription": "A serene landscape photograph showing...",
      "altText": "Mountain landscape with lake at sunset",
      "visualElements": ["mountains", "lake", "sunset", "pine trees"],
      "colors": ["blue", "orange", "green", "purple"],
      "composition": "Rule of thirds with mountain peak aligned to left third",
      "context": "Nature photography capturing golden hour lighting",
      "confidence": 0.95,
      "audioFile": {
        "url": "https://cdn.example.com/audio/550e8400.mp3",
        "duration": 15.5,
        "format": "mp3"
      },
      "htmlMetadata": {
        "altAttribute": "Mountain landscape with lake at sunset",
        "ariaLabel": "Scenic mountain view with reflective lake during sunset",
        "schemaMarkup": {
          "@type": "ImageObject",
          "description": "Mountain landscape photograph"
        }
      }
    }
  }
}
```

### 4. Process Video with Pipeline Selection

Process video with explicit pipeline selection for optimized performance.

**Endpoint:** `POST /api/process-video`

**Request:**
```json
{
  "file": "video.mp4",  // File upload or S3 URI
  "pipeline": "openai",  // "openai", "aws", "auto", or "hybrid"
  "options": {
    "priority": "high",
    "chunkingOptions": {
      "targetChunkSize": 20971520,  // 20MB
      "maxChunkDuration": 30,        // seconds
      "sceneDetection": true
    },
    "analysisOptions": {
      "detailLevel": "high",
      "contextualAnalysis": true,
      "customPrompt": "Focus on accessibility needs"
    },
    "synthesisOptions": {
      "format": "narrative",
      "includeTimestamps": true,
      "generateChapters": true
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "pipeline": "openai",
    "status": "processing",
    "progress": 0,
    "estimatedCompletion": "2024-01-15T10:31:00Z",
    "chunks": {
      "total": 10,
      "processed": 0
    }
  }
}
```

### 5. Batch Process Images

Process multiple images in a single request with pipeline selection.

**Endpoint:** `POST /api/process-images-batch`

**Request:**
```json
{
  "images": [
    {
      "source": "s3://bucket/image1.jpg",
      "id": "img-001",
      "metadata": {
        "title": "Product Photo 1",
        "context": "E-commerce product listing"
      }
    },
    {
      "source": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
      "id": "img-002"
    }
  ],
  "pipeline": "openai",  // "openai", "aws", or "auto"
  "options": {
    "detailLevel": "comprehensive",
    "generateAudio": true,
    "voiceId": "Joanna",
    "maxConcurrent": 5
  },
  "openaiOptions": {
    "detail": "high",
    "customPrompt": {
      "altText": "Generate e-commerce alt text",
      "detailed": "Include product features and materials",
      "seo": "Optimize for product search"
    }
  }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "batchId": "batch-550e8400",
    "totalImages": 2,
    "status": "processing",
    "results": [
      {
        "id": "img-001",
        "jobId": "job-001",
        "status": "completed",
        "result": {
          "detailedDescription": "...",
          "altText": "..."
        }
      },
      {
        "id": "img-002",
        "jobId": "job-002",
        "status": "processing"
      }
    ]
  }
}
```

### 5. Get Job Status

Check the status of a processing job.

**Endpoint:** `GET /api/status/{jobId}`

**Video Job Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "step": "analysis",
  "progress": 65,
  "message": "Analyzing scene 13 of 20",
  "segmentCount": 20,
  "currentSegment": 13,
  "startTime": "2024-01-15T10:00:00Z",
  "estimatedTimeRemaining": 120,
  "performance": {
    "cpuUsage": 45.2,
    "memoryUsage": 62.8,
    "throughput": "2.5 scenes/minute"
  }
}
```

**Image Job Endpoint:** `GET /api/status/image/{jobId}`

### 6. Download Results

#### Text Results
**Endpoint:** `GET /api/results/{jobId}/text`

**Response:** Plain text file with descriptions

#### Audio Results
**Endpoint:** `GET /api/results/{jobId}/audio`

**Response:** MP3 audio file

### 7. AWS Status

Check AWS service connectivity.

**Endpoint:** `GET /api/aws-status`

**Response:**
```json
{
  "s3": {
    "status": "connected",
    "inputBucket": "accessible",
    "outputBucket": "accessible"
  },
  "rekognition": {
    "status": "connected",
    "region": "us-east-1"
  },
  "bedrock": {
    "status": "connected",
    "modelAvailable": true
  },
  "polly": {
    "status": "connected",
    "voices": ["Joanna", "Matthew", "Ruth", "Stephen"]
  }
}
```

## Code Examples

### JavaScript/Node.js

#### Using Fetch API
```javascript
// Upload and process a video
async function processVideo(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'video');
  formData.append('title', 'My Video');
  formData.append('detailLevel', 'comprehensive');
  
  try {
    // Upload video
    const uploadResponse = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const { jobId } = await uploadResponse.json();
    console.log('Job started:', jobId);
    
    // Poll for status
    const status = await pollJobStatus(jobId);
    console.log('Processing complete:', status);
    
    // Download results
    const textResult = await downloadResults(jobId, 'text');
    const audioResult = await downloadResults(jobId, 'audio');
    
    return { text: textResult, audio: audioResult };
  } catch (error) {
    console.error('Processing failed:', error);
  }
}

// Poll job status with exponential backoff
async function pollJobStatus(jobId, maxAttempts = 60) {
  let attempts = 0;
  let delay = 2000; // Start with 2 seconds
  
  while (attempts < maxAttempts) {
    const response = await fetch(`http://localhost:3000/api/status/${jobId}`);
    const status = await response.json();
    
    if (status.status === 'completed') {
      return status;
    } else if (status.status === 'failed') {
      throw new Error(status.error?.message || 'Processing failed');
    }
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Exponential backoff with max delay of 30 seconds
    delay = Math.min(delay * 1.5, 30000);
    attempts++;
  }
  
  throw new Error('Processing timeout');
}

// Download results
async function downloadResults(jobId, type) {
  const endpoint = type === 'text' 
    ? `/api/results/${jobId}/text`
    : `/api/results/${jobId}/audio`;
    
  const response = await fetch(`http://localhost:3000${endpoint}`);
  
  if (type === 'text') {
    return await response.text();
  } else {
    return await response.blob();
  }
}

// Process multiple images
async function processBatchImages(imageFiles) {
  const images = [];
  
  // Convert files to base64
  for (const file of imageFiles) {
    const base64 = await fileToBase64(file);
    images.push({
      source: base64,
      id: file.name,
      metadata: {
        title: file.name
      }
    });
  }
  
  const response = await fetch('http://localhost:3000/api/process-images-batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      images,
      options: {
        detailLevel: 'comprehensive',
        generateAudio: true
      }
    })
  });
  
  return await response.json();
}

// Helper function to convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}
```

#### Using Axios
```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class VoiceDescriptionClient {
  constructor(baseURL = 'http://localhost:3000') {
    this.client = axios.create({
      baseURL,
      timeout: 30000
    });
  }
  
  async uploadVideo(filePath, options = {}) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('type', 'video');
    
    Object.entries(options).forEach(([key, value]) => {
      form.append(key, value);
    });
    
    const response = await this.client.post('/api/upload', form, {
      headers: form.getHeaders()
    });
    
    return response.data;
  }
  
  async processImage(imagePath, options = {}) {
    const form = new FormData();
    form.append('file', fs.createReadStream(imagePath));
    
    Object.entries(options).forEach(([key, value]) => {
      form.append(key, value);
    });
    
    const response = await this.client.post('/api/process-image', form, {
      headers: form.getHeaders()
    });
    
    return response.data;
  }
  
  async getStatus(jobId, type = 'video') {
    const endpoint = type === 'image' 
      ? `/api/status/image/${jobId}`
      : `/api/status/${jobId}`;
      
    const response = await this.client.get(endpoint);
    return response.data;
  }
  
  async waitForCompletion(jobId, type = 'video', options = {}) {
    const maxAttempts = options.maxAttempts || 60;
    const interval = options.interval || 2000;
    
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getStatus(jobId, type);
      
      if (status.status === 'completed') {
        return status;
      } else if (status.status === 'failed') {
        throw new Error(status.error?.message || 'Processing failed');
      }
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error('Processing timeout');
  }
  
  async downloadResults(jobId, resultType = 'text', type = 'video') {
    const endpoint = type === 'image'
      ? `/api/results/image/${jobId}/${resultType}`
      : `/api/results/${jobId}/${resultType}`;
      
    const response = await this.client.get(endpoint, {
      responseType: resultType === 'audio' ? 'stream' : 'text'
    });
    
    return response.data;
  }
}

// Usage example
async function main() {
  const client = new VoiceDescriptionClient();
  
  try {
    // Process a video
    const { jobId } = await client.uploadVideo('./sample-video.mp4', {
      title: 'Sample Video',
      detailLevel: 'comprehensive',
      voiceId: 'Joanna'
    });
    
    console.log('Job started:', jobId);
    
    // Wait for completion
    const result = await client.waitForCompletion(jobId);
    console.log('Processing complete:', result);
    
    // Download results
    const textDescription = await client.downloadResults(jobId, 'text');
    const audioFile = await client.downloadResults(jobId, 'audio');
    
    // Save audio to file
    audioFile.pipe(fs.createWriteStream('./output.mp3'));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
```

### Python

```python
import requests
import time
import base64
from pathlib import Path
from typing import Dict, Optional, Any
import json

class VoiceDescriptionAPI:
    """Python client for Voice Description API"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def upload_video(self, file_path: str, **options) -> Dict[str, Any]:
        """Upload a video file for processing"""
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'type': 'video', **options}
            
            response = self.session.post(
                f"{self.base_url}/api/upload",
                files=files,
                data=data
            )
            response.raise_for_status()
            return response.json()
    
    def process_image(self, image_path: str, **options) -> Dict[str, Any]:
        """Process a single image"""
        with open(image_path, 'rb') as f:
            files = {'file': f}
            data = options
            
            response = self.session.post(
                f"{self.base_url}/api/process-image",
                files=files,
                data=data
            )
            response.raise_for_status()
            return response.json()
    
    def process_batch_images(self, image_paths: list, **options) -> Dict[str, Any]:
        """Process multiple images in batch"""
        images = []
        
        for path in image_paths:
            with open(path, 'rb') as f:
                # Convert to base64 data URI
                file_content = f.read()
                base64_data = base64.b64encode(file_content).decode('utf-8')
                mime_type = self._get_mime_type(path)
                data_uri = f"data:{mime_type};base64,{base64_data}"
                
                images.append({
                    "source": data_uri,
                    "id": Path(path).name,
                    "metadata": {
                        "title": Path(path).stem
                    }
                })
        
        payload = {
            "images": images,
            "options": options
        }
        
        response = self.session.post(
            f"{self.base_url}/api/process-images-batch",
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    def get_status(self, job_id: str, job_type: str = "video") -> Dict[str, Any]:
        """Get job status"""
        endpoint = f"/api/status/image/{job_id}" if job_type == "image" else f"/api/status/{job_id}"
        response = self.session.get(f"{self.base_url}{endpoint}")
        response.raise_for_status()
        return response.json()
    
    def wait_for_completion(
        self, 
        job_id: str, 
        job_type: str = "video",
        max_attempts: int = 60,
        interval: float = 2.0
    ) -> Dict[str, Any]:
        """Wait for job completion with polling"""
        attempts = 0
        
        while attempts < max_attempts:
            status = self.get_status(job_id, job_type)
            
            if status['status'] == 'completed':
                return status
            elif status['status'] == 'failed':
                raise Exception(f"Job failed: {status.get('error', {}).get('message', 'Unknown error')}")
            
            print(f"Progress: {status.get('progress', 0)}% - {status.get('message', '')}")
            time.sleep(interval)
            attempts += 1
            
            # Implement exponential backoff
            interval = min(interval * 1.5, 30)
        
        raise TimeoutError("Job processing timeout")
    
    def download_results(
        self, 
        job_id: str, 
        result_type: str = "text",
        job_type: str = "video",
        output_path: Optional[str] = None
    ) -> Any:
        """Download processing results"""
        endpoint = (f"/api/results/image/{job_id}/{result_type}" 
                   if job_type == "image" 
                   else f"/api/results/{job_id}/{result_type}")
        
        response = self.session.get(f"{self.base_url}{endpoint}")
        response.raise_for_status()
        
        if output_path:
            with open(output_path, 'wb' if result_type == 'audio' else 'w') as f:
                f.write(response.content if result_type == 'audio' else response.text)
            return output_path
        
        return response.content if result_type == 'audio' else response.text
    
    def check_health(self) -> Dict[str, Any]:
        """Check API health status"""
        response = self.session.get(f"{self.base_url}/api/health")
        response.raise_for_status()
        return response.json()
    
    def _get_mime_type(self, file_path: str) -> str:
        """Get MIME type from file extension"""
        ext = Path(file_path).suffix.lower()
        mime_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.avi': 'video/avi',
            '.mov': 'video/quicktime'
        }
        return mime_types.get(ext, 'application/octet-stream')

# Example usage
def main():
    api = VoiceDescriptionAPI()
    
    # Check health
    health = api.check_health()
    print(f"API Status: {health['status']}")
    
    # Process a single image
    result = api.process_image(
        "sample-image.jpg",
        detailLevel="comprehensive",
        generateAudio="true",
        voiceId="Joanna"
    )
    
    if result['success']:
        print(f"Job ID: {result['data']['jobId']}")
        
        # Wait for completion
        final_status = api.wait_for_completion(
            result['data']['jobId'], 
            job_type="image"
        )
        
        # Download results
        text_result = api.download_results(
            result['data']['jobId'],
            result_type="text",
            job_type="image",
            output_path="description.txt"
        )
        
        print(f"Description saved to: {text_result}")
    
    # Process multiple images
    batch_result = api.process_batch_images(
        ["image1.jpg", "image2.png", "image3.webp"],
        detailLevel="basic",
        generateAudio=True
    )
    
    print(f"Batch processing: {batch_result['data']['totalImages']} images")

if __name__ == "__main__":
    main()
```

### cURL Examples

```bash
# Health check
curl -X GET http://localhost:3000/api/health

# Upload and process video
curl -X POST http://localhost:3000/api/upload \
  -F "file=@video.mp4" \
  -F "type=video" \
  -F "title=Sample Video" \
  -F "detailLevel=comprehensive" \
  -F "voiceId=Joanna"

# Process single image
curl -X POST http://localhost:3000/api/process-image \
  -F "file=@image.jpg" \
  -F "detailLevel=comprehensive" \
  -F "generateAudio=true" \
  -F "includeAltText=true"

# Batch process images (with JSON payload)
curl -X POST http://localhost:3000/api/process-images-batch \
  -H "Content-Type: application/json" \
  -d '{
    "images": [
      {
        "source": "s3://my-bucket/image1.jpg",
        "id": "img-001"
      },
      {
        "source": "s3://my-bucket/image2.jpg",
        "id": "img-002"
      }
    ],
    "options": {
      "detailLevel": "comprehensive",
      "generateAudio": true
    }
  }'

# Check job status
curl -X GET http://localhost:3000/api/status/550e8400-e29b-41d4-a716-446655440000

# Download text results
curl -X GET http://localhost:3000/api/results/550e8400-e29b-41d4-a716-446655440000/text \
  -o description.txt

# Download audio results
curl -X GET http://localhost:3000/api/results/550e8400-e29b-41d4-a716-446655440000/audio \
  -o description.mp3

# Check AWS service status
curl -X GET http://localhost:3000/api/aws-status

# With authentication header
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@video.mp4" \
  -F "type=video"
```

### React/TypeScript

```typescript
import React, { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

// Type definitions
interface UploadResponse {
  success: boolean;
  jobId: string;
  message?: string;
}

interface JobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  step: string;
  progress: number;
  message?: string;
  results?: {
    textUrl?: string;
    audioUrl?: string;
  };
}

interface ProcessingOptions {
  detailLevel?: 'basic' | 'detailed' | 'comprehensive';
  generateAudio?: boolean;
  voiceId?: string;
}

// API Client class
class VoiceDescriptionAPIClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  async uploadFile(
    file: File,
    type: 'video' | 'image',
    options: ProcessingOptions = {}
  ): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    const response = await fetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  }

  async getStatus(jobId: string, type: 'video' | 'image' = 'video'): Promise<JobStatus> {
    const endpoint = type === 'image' 
      ? `/api/status/image/${jobId}`
      : `/api/status/${jobId}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`);
    
    if (!response.ok) {
      throw new Error('Failed to get status');
    }

    return response.json();
  }

  async downloadResults(
    jobId: string,
    resultType: 'text' | 'audio',
    jobType: 'video' | 'image' = 'video'
  ): Promise<Blob> {
    const endpoint = jobType === 'image'
      ? `/api/results/image/${jobId}/${resultType}`
      : `/api/results/${jobId}/${resultType}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`);
    
    if (!response.ok) {
      throw new Error(`Failed to download ${resultType}`);
    }

    return response.blob();
  }
}

// React hooks for API operations
const apiClient = new VoiceDescriptionAPIClient();

export function useUploadFile() {
  return useMutation({
    mutationFn: ({
      file,
      type,
      options
    }: {
      file: File;
      type: 'video' | 'image';
      options?: ProcessingOptions;
    }) => apiClient.uploadFile(file, type, options),
  });
}

export function useJobStatus(
  jobId: string | null,
  type: 'video' | 'image' = 'video'
) {
  return useQuery({
    queryKey: ['jobStatus', jobId, type],
    queryFn: () => jobId ? apiClient.getStatus(jobId, type) : null,
    enabled: !!jobId,
    refetchInterval: (data) => {
      if (!data) return false;
      const status = data.status;
      return status === 'processing' || status === 'pending' ? 2000 : false;
    },
  });
}

// React Component Example
export function VideoUploader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrls, setDownloadUrls] = useState<{
    text?: string;
    audio?: string;
  }>({});

  const uploadMutation = useUploadFile();
  const { data: jobStatus } = useJobStatus(jobId);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    try {
      const result = await uploadMutation.mutateAsync({
        file: selectedFile,
        type: 'video',
        options: {
          detailLevel: 'comprehensive',
          generateAudio: true,
          voiceId: 'Joanna',
        },
      });

      if (result.success) {
        setJobId(result.jobId);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }, [selectedFile, uploadMutation]);

  const handleDownload = useCallback(async (type: 'text' | 'audio') => {
    if (!jobId) return;

    try {
      const blob = await apiClient.downloadResults(jobId, type);
      const url = URL.createObjectURL(blob);
      
      setDownloadUrls(prev => ({
        ...prev,
        [type]: url,
      }));

      // Trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'text' ? 'description.txt' : 'narration.mp3';
      a.click();
    } catch (error) {
      console.error(`Download ${type} failed:`, error);
    }
  }, [jobId]);

  return (
    <div className="video-uploader">
      <h2>Video Description Generator</h2>
      
      <div className="upload-section">
        <input
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
        />
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploadMutation.isPending}
        >
          {uploadMutation.isPending ? 'Uploading...' : 'Upload Video'}
        </button>
      </div>

      {jobStatus && (
        <div className="status-section">
          <h3>Processing Status</h3>
          <p>Status: {jobStatus.status}</p>
          <p>Step: {jobStatus.step}</p>
          <p>Progress: {jobStatus.progress}%</p>
          <p>{jobStatus.message}</p>
          
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${jobStatus.progress}%` }}
            />
          </div>

          {jobStatus.status === 'completed' && (
            <div className="download-section">
              <button onClick={() => handleDownload('text')}>
                Download Text Description
              </button>
              <button onClick={() => handleDownload('audio')}>
                Download Audio Narration
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Custom hook for file upload with progress
export function useUploadWithProgress() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const upload = useCallback(async (
    file: File,
    type: 'video' | 'image',
    options: ProcessingOptions = {}
  ): Promise<UploadResponse> => {
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
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(Math.round(percentComplete));
        }
      });

      xhr.addEventListener('load', () => {
        setIsUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid response'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        setIsUploading(false);
        reject(new Error('Upload failed'));
      });

      setIsUploading(true);
      setProgress(0);
      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  }, []);

  return { upload, progress, isUploading };
}
```

### Postman Collection

```json
{
  "info": {
    "name": "Voice Description API",
    "description": "API for generating audio descriptions for videos and images",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{api_key}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000",
      "type": "string"
    },
    {
      "key": "job_id",
      "value": "",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/api/health",
          "host": ["{{base_url}}"],
          "path": ["api", "health"]
        }
      }
    },
    {
      "name": "Upload Video",
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "const response = pm.response.json();",
              "if (response.success) {",
              "    pm.environment.set('job_id', response.jobId);",
              "    console.log('Job ID saved:', response.jobId);",
              "}",
              "",
              "pm.test('Upload successful', function () {",
              "    pm.response.to.have.status(200);",
              "    pm.expect(response.success).to.be.true;",
              "});"
            ]
          }
        }
      ],
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": "/path/to/video.mp4"
            },
            {
              "key": "type",
              "value": "video",
              "type": "text"
            },
            {
              "key": "title",
              "value": "Sample Video",
              "type": "text"
            },
            {
              "key": "detailLevel",
              "value": "comprehensive",
              "type": "text"
            },
            {
              "key": "voiceId",
              "value": "Joanna",
              "type": "text"
            }
          ]
        },
        "url": {
          "raw": "{{base_url}}/api/upload",
          "host": ["{{base_url}}"],
          "path": ["api", "upload"]
        }
      }
    },
    {
      "name": "Process Image",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": "/path/to/image.jpg"
            },
            {
              "key": "detailLevel",
              "value": "comprehensive",
              "type": "text"
            },
            {
              "key": "generateAudio",
              "value": "true",
              "type": "text"
            },
            {
              "key": "includeAltText",
              "value": "true",
              "type": "text"
            }
          ]
        },
        "url": {
          "raw": "{{base_url}}/api/process-image",
          "host": ["{{base_url}}"],
          "path": ["api", "process-image"]
        }
      }
    },
    {
      "name": "Batch Process Images",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"images\": [\n    {\n      \"source\": \"s3://bucket/image1.jpg\",\n      \"id\": \"img-001\",\n      \"metadata\": {\n        \"title\": \"Product Photo 1\"\n      }\n    },\n    {\n      \"source\": \"s3://bucket/image2.jpg\",\n      \"id\": \"img-002\"\n    }\n  ],\n  \"options\": {\n    \"detailLevel\": \"comprehensive\",\n    \"generateAudio\": true,\n    \"voiceId\": \"Joanna\"\n  }\n}"
        },
        "url": {
          "raw": "{{base_url}}/api/process-images-batch",
          "host": ["{{base_url}}"],
          "path": ["api", "process-images-batch"]
        }
      }
    },
    {
      "name": "Get Job Status",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/api/status/{{job_id}}",
          "host": ["{{base_url}}"],
          "path": ["api", "status", "{{job_id}}"]
        }
      }
    },
    {
      "name": "Download Text Results",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/api/results/{{job_id}}/text",
          "host": ["{{base_url}}"],
          "path": ["api", "results", "{{job_id}}", "text"]
        }
      }
    },
    {
      "name": "Download Audio Results",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/api/results/{{job_id}}/audio",
          "host": ["{{base_url}}"],
          "path": ["api", "results", "{{job_id}}", "audio"]
        }
      }
    },
    {
      "name": "AWS Status",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}/api/aws-status",
          "host": ["{{base_url}}"],
          "path": ["api", "aws-status"]
        }
      }
    }
  ]
}
```

## Error Handling

### Error Response Format

All API endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Technical details for debugging"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `METHOD_NOT_ALLOWED` | Invalid HTTP method | 405 |
| `NO_FILE_PROVIDED` | No file in upload request | 400 |
| `INVALID_FILE_TYPE` | Unsupported file format | 400 |
| `FILE_TOO_LARGE` | File exceeds size limit | 413 |
| `JOB_NOT_FOUND` | Job ID doesn't exist | 404 |
| `PROCESSING_FAILED` | Processing error occurred | 500 |
| `AWS_SERVICE_ERROR` | AWS service unavailable | 503 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `UNAUTHORIZED` | Invalid or missing API key | 401 |

### Retry Strategy

Implement exponential backoff for transient errors:

```javascript
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Best Practices

### 1. File Upload Optimization

- **Chunk large files**: For files > 50MB, use chunked upload
- **Compress before upload**: Reduce bandwidth usage
- **Validate client-side**: Check file type and size before upload
- **Show progress**: Implement upload progress indicators

### 2. Polling Strategy

- **Start with short intervals**: 2 seconds for initial polling
- **Implement backoff**: Increase interval as time passes
- **Set maximum attempts**: Prevent infinite polling
- **Handle failures gracefully**: Provide clear error messages

### 3. Concurrent Processing

- **Batch similar requests**: Use batch endpoints for multiple files
- **Limit concurrent requests**: Maximum 5 concurrent jobs recommended
- **Queue management**: Implement client-side job queue

### 4. Caching Strategy

```javascript
// Cache job results
const resultCache = new Map();

async function getCachedResults(jobId) {
  if (resultCache.has(jobId)) {
    return resultCache.get(jobId);
  }
  
  const results = await fetchResults(jobId);
  resultCache.set(jobId, results);
  
  // Clear cache after 1 hour
  setTimeout(() => resultCache.delete(jobId), 3600000);
  
  return results;
}
```

### 5. Error Recovery

```javascript
class APIClientWithRecovery {
  async processWithRecovery(file, options) {
    let jobId;
    
    try {
      // Attempt upload
      const uploadResult = await this.upload(file, options);
      jobId = uploadResult.jobId;
      
      // Save job ID for recovery
      localStorage.setItem('lastJobId', jobId);
      
      // Wait for completion
      return await this.waitForCompletion(jobId);
      
    } catch (error) {
      // Attempt recovery
      if (jobId || localStorage.getItem('lastJobId')) {
        const recoveryId = jobId || localStorage.getItem('lastJobId');
        const status = await this.getStatus(recoveryId);
        
        if (status.status !== 'failed') {
          return await this.waitForCompletion(recoveryId);
        }
      }
      
      throw error;
    }
  }
}
```

## OpenAI Pipeline Features

### Unique Capabilities

The OpenAI pipeline provides advanced features not available in the AWS pipeline:

#### 1. Custom Prompt Engineering

Customize the AI's focus for your specific use case:

```json
{
  "pipeline": "openai",
  "openaiOptions": {
    "customPrompt": {
      "altText": "Generate concise alt text for screen readers (max 125 chars)",
      "detailed": "Focus on medical details and clinical observations",
      "seo": "Include product keywords and brand names for SEO"
    }
  }
}
```

#### 2. Smart Video Chunking

Automatic intelligent video segmentation:

```json
{
  "chunkingOptions": {
    "targetChunkSize": 20971520,    // 20MB per chunk
    "maxChunkDuration": 30,          // 30 seconds max
    "overlap": 2,                    // 2 second overlap
    "keyframeAlign": true,           // Align to keyframes
    "sceneDetection": true           // Use AI scene detection
  }
}
```

#### 3. Contextual Analysis

Preserve context across video chunks:

```json
{
  "analysisOptions": {
    "contextualAnalysis": true,      // Enable cross-chunk context
    "detailLevel": "high",           // "low", "auto", or "high"
    "preserveNarrative": true,       // Maintain story flow
    "trackCharacters": true          // Track people/characters
  }
}
```

#### 4. Enhanced Description Synthesis

AI-powered description generation:

```json
{
  "synthesisOptions": {
    "format": "all",                 // "narrative", "technical", "accessibility", "all"
    "includeTimestamps": true,       // Add time markers
    "generateChapters": true,        // Auto-generate chapters
    "targetLength": 5000,            // Target word count
    "generateKeyMoments": true       // Highlight important scenes
  }
}
```

### OpenAI-Specific Endpoints

#### Get Pipeline Capabilities

Check available features for each pipeline:

**Endpoint:** `GET /api/pipelines/capabilities`

**Response:**
```json
{
  "openai": {
    "maxFileSize": 104857600,        // 100MB
    "maxDuration": 1800,              // 30 minutes
    "languages": 95,                  // Supported languages
    "features": {
      "customPrompts": true,
      "videoChunking": true,
      "contextualAnalysis": true,
      "multiLanguage": true,
      "realtimeProcessing": true
    },
    "performance": {
      "avgProcessingTime": 45,        // seconds
      "throughput": 120               // videos/hour
    }
  },
  "aws": {
    "maxFileSize": 524288000,        // 500MB
    "maxDuration": 7200,              // 2 hours
    "languages": 15,
    "features": {
      "customPrompts": false,
      "sceneSegmentation": true,
      "technicalCues": true,
      "frameAccuracy": true,
      "broadcastQuality": true
    },
    "performance": {
      "avgProcessingTime": 420,       // seconds
      "throughput": 20                // videos/hour
    }
  }
}
```

#### Estimate Processing Cost

Get cost estimates before processing:

**Endpoint:** `POST /api/estimate-cost`

**Request:**
```json
{
  "file": {
    "size": 52428800,                // 50MB
    "duration": 300,                  // 5 minutes
    "type": "video"
  },
  "pipeline": "auto",
  "options": {
    "detailLevel": "high",
    "generateAudio": true
  }
}
```

**Response:**
```json
{
  "estimates": {
    "openai": {
      "cost": 0.50,
      "processingTime": 45,
      "confidence": 0.95
    },
    "aws": {
      "cost": 0.30,
      "processingTime": 420,
      "confidence": 0.90
    },
    "recommended": "openai",
    "reason": "Faster processing with minimal cost difference"
  }
}
```

#### Monitor Token Usage

Track OpenAI token consumption:

**Endpoint:** `GET /api/usage/tokens`

**Response:**
```json
{
  "period": "2024-01-15",
  "usage": {
    "totalTokens": 1250000,
    "inputTokens": 750000,
    "outputTokens": 500000,
    "cost": 37.50,
    "requests": 500,
    "averagePerRequest": 2500
  },
  "limits": {
    "daily": 10000000,
    "remaining": 8750000,
    "resetAt": "2024-01-16T00:00:00Z"
  }
}
```

## Testing Guide

### Local Development Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Set environment variables**:
```bash
cp .env.example .env
# Edit .env with your AWS credentials
```

3. **Start development server**:
```bash
npm run dev
```

4. **Run tests**:
```bash
npm test
```

### Test Files

Sample test files are available:
- Video: `tests/fixtures/sample-video.mp4`
- Image: `tests/fixtures/sample-image.jpg`

### Integration Testing

```javascript
// integration-test.js
const assert = require('assert');
const VoiceDescriptionClient = require('./client');

async function runIntegrationTests() {
  const client = new VoiceDescriptionClient('http://localhost:3000');
  
  console.log('Testing health check...');
  const health = await client.checkHealth();
  assert(health.status === 'healthy', 'API should be healthy');
  
  console.log('Testing image processing...');
  const imageResult = await client.processImage('./test-image.jpg', {
    detailLevel: 'basic'
  });
  assert(imageResult.success, 'Image processing should succeed');
  
  console.log('Testing video upload...');
  const videoResult = await client.uploadVideo('./test-video.mp4', {
    title: 'Test Video'
  });
  assert(videoResult.jobId, 'Should return job ID');
  
  console.log('All tests passed!');
}

runIntegrationTests().catch(console.error);
```

### Performance Testing

```python
# performance_test.py
import asyncio
import aiohttp
import time
from concurrent.futures import ThreadPoolExecutor

async def test_concurrent_uploads(num_requests=10):
    """Test concurrent upload performance"""
    
    async with aiohttp.ClientSession() as session:
        tasks = []
        
        for i in range(num_requests):
            task = upload_file(session, f"test-{i}.jpg")
            tasks.append(task)
        
        start_time = time.time()
        results = await asyncio.gather(*tasks)
        end_time = time.time()
        
        successful = sum(1 for r in results if r['success'])
        
        print(f"Processed {successful}/{num_requests} requests")
        print(f"Total time: {end_time - start_time:.2f} seconds")
        print(f"Average time: {(end_time - start_time) / num_requests:.2f} seconds")

async def upload_file(session, filename):
    """Upload a single file"""
    
    with open('test-image.jpg', 'rb') as f:
        data = aiohttp.FormData()
        data.add_field('file', f, filename=filename)
        data.add_field('type', 'image')
        
        async with session.post(
            'http://localhost:3000/api/process-image',
            data=data
        ) as response:
            return await response.json()

if __name__ == "__main__":
    asyncio.run(test_concurrent_uploads())
```

## SDK Implementation Examples

### TypeScript SDK

```typescript
// voice-description-sdk.ts
export class VoiceDescriptionSDK {
  private apiClient: APIClient;
  private webhookUrl?: string;
  
  constructor(config: SDKConfig) {
    this.apiClient = new APIClient(config.baseUrl);
    this.webhookUrl = config.webhookUrl;
  }
  
  /**
   * Process media file with automatic type detection
   */
  async process(
    file: File | string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    // Detect file type
    const fileType = this.detectFileType(file);
    
    // Add webhook if configured
    if (this.webhookUrl) {
      options.webhookUrl = this.webhookUrl;
    }
    
    // Process based on type
    if (fileType === 'video') {
      return this.processVideo(file, options);
    } else {
      return this.processImage(file, options);
    }
  }
  
  /**
   * Process video with progress tracking
   */
  async processVideo(
    file: File | string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    // Upload
    const uploadResult = await this.apiClient.uploadFile(
      file,
      'video',
      options
    );
    
    // Track progress
    const progressTracker = new ProgressTracker(uploadResult.jobId);
    
    // Wait for completion
    const finalStatus = await this.apiClient.waitForCompletion(
      uploadResult.jobId,
      'video',
      (status) => progressTracker.update(status)
    );
    
    // Download results
    const [textBlob, audioBlob] = await Promise.all([
      this.apiClient.downloadResults(uploadResult.jobId, 'text'),
      this.apiClient.downloadResults(uploadResult.jobId, 'audio')
    ]);
    
    return {
      jobId: uploadResult.jobId,
      text: await textBlob.text(),
      audioUrl: URL.createObjectURL(audioBlob),
      metadata: finalStatus.results?.metadata
    };
  }
  
  /**
   * Batch process with parallel execution
   */
  async processBatch(
    files: File[],
    options: ProcessingOptions = {},
    concurrency: number = 3
  ): Promise<BatchResult[]> {
    const queue = [...files];
    const results: BatchResult[] = [];
    const processing = new Set<Promise<void>>();
    
    while (queue.length > 0 || processing.size > 0) {
      // Start new jobs up to concurrency limit
      while (processing.size < concurrency && queue.length > 0) {
        const file = queue.shift()!;
        const promise = this.process(file, options)
          .then(result => {
            results.push({ file: file.name, ...result });
          })
          .catch(error => {
            results.push({ 
              file: file.name, 
              error: error.message 
            });
          })
          .finally(() => {
            processing.delete(promise);
          });
        
        processing.add(promise);
      }
      
      // Wait for at least one to complete
      if (processing.size > 0) {
        await Promise.race(processing);
      }
    }
    
    return results;
  }
  
  private detectFileType(file: File | string): 'video' | 'image' {
    const filename = typeof file === 'string' ? file : file.name;
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    if (videoExtensions.includes(ext || '')) {
      return 'video';
    }
    return 'image';
  }
}

// Progress tracking utility
class ProgressTracker {
  private startTime: number;
  private lastUpdate: number;
  
  constructor(public jobId: string) {
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
  }
  
  update(status: JobStatus): void {
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000;
    const timeSinceUpdate = (now - this.lastUpdate) / 1000;
    
    console.log(`[${this.jobId}] Progress: ${status.progress}%`);
    console.log(`  Step: ${status.step}`);
    console.log(`  Message: ${status.message}`);
    console.log(`  Elapsed: ${elapsed.toFixed(1)}s`);
    
    if (status.estimatedTimeRemaining) {
      console.log(`  ETA: ${status.estimatedTimeRemaining}s`);
    }
    
    this.lastUpdate = now;
  }
}
```

## WebSocket Support (Future)

```javascript
// WebSocket connection for real-time updates
class WebSocketClient {
  constructor(url = 'ws://localhost:3000') {
    this.ws = new WebSocket(url);
    this.subscriptions = new Map();
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'job-update') {
        const callback = this.subscriptions.get(message.jobId);
        if (callback) {
          callback(message.data);
        }
      }
    };
  }
  
  subscribeToJob(jobId, callback) {
    this.subscriptions.set(jobId, callback);
    
    this.ws.send(JSON.stringify({
      type: 'subscribe',
      jobId
    }));
  }
  
  unsubscribeFromJob(jobId) {
    this.subscriptions.delete(jobId);
    
    this.ws.send(JSON.stringify({
      type: 'unsubscribe',
      jobId
    }));
  }
}

// Usage
const wsClient = new WebSocketClient();

wsClient.subscribeToJob(jobId, (status) => {
  console.log('Real-time update:', status);
  updateUI(status);
});
```

## Rate Limiting and Quotas

### Default Limits

| Resource | Limit | Period |
|----------|-------|--------|
| API Requests | 100 | Per minute |
| Concurrent Jobs | 10 | Per account |
| Max File Size | 500 MB | Per upload |
| Batch Size | 100 | Per request |
| Processing Time | 30 min | Per job |

### Handling Rate Limits

```javascript
class RateLimitedClient {
  constructor(maxRequestsPerMinute = 60) {
    this.requests = [];
    this.maxRequests = maxRequestsPerMinute;
  }
  
  async makeRequest(fn) {
    // Clean old requests
    const oneMinuteAgo = Date.now() - 60000;
    this.requests = this.requests.filter(t => t > oneMinuteAgo);
    
    // Check rate limit
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = 60000 - (Date.now() - oldestRequest);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.makeRequest(fn);
    }
    
    // Make request
    this.requests.push(Date.now());
    return fn();
  }
}
```

## Webhook Integration

Configure webhooks to receive job completion notifications:

```javascript
// Webhook payload format
{
  "event": "job.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "results": {
      "textUrl": "https://cdn.example.com/text/550e8400.txt",
      "audioUrl": "https://cdn.example.com/audio/550e8400.mp3"
    }
  }
}

// Webhook receiver example (Express.js)
app.post('/webhook/voice-description', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'job.completed') {
    console.log(`Job ${data.jobId} completed`);
    
    // Process results
    processCompletedJob(data);
  }
  
  res.status(200).send('OK');
});
```

## Monitoring and Logging

### Client-Side Monitoring

```javascript
class MonitoredAPIClient extends APIClient {
  constructor(baseUrl, monitor) {
    super(baseUrl);
    this.monitor = monitor;
  }
  
  async uploadFile(file, type, options) {
    const startTime = Date.now();
    
    try {
      const result = await super.uploadFile(file, type, options);
      
      this.monitor.recordSuccess('upload', {
        duration: Date.now() - startTime,
        fileSize: file.size,
        type
      });
      
      return result;
    } catch (error) {
      this.monitor.recordError('upload', {
        duration: Date.now() - startTime,
        error: error.message
      });
      
      throw error;
    }
  }
}

// Usage with monitoring
const monitor = new PerformanceMonitor();
const client = new MonitoredAPIClient('http://localhost:3000', monitor);

// Get metrics
const metrics = monitor.getMetrics();
console.log('Average upload time:', metrics.upload.avgDuration);
console.log('Success rate:', metrics.upload.successRate);
```

## Security Considerations

### Input Validation

Always validate file types and sizes client-side:

```javascript
function validateFile(file, type) {
  const maxSizes = {
    video: 500 * 1024 * 1024, // 500MB
    image: 50 * 1024 * 1024   // 50MB
  };
  
  const allowedTypes = {
    video: ['video/mp4', 'video/avi', 'video/quicktime'],
    image: ['image/jpeg', 'image/png', 'image/webp']
  };
  
  if (file.size > maxSizes[type]) {
    throw new Error(`File too large. Maximum size: ${maxSizes[type] / 1024 / 1024}MB`);
  }
  
  if (!allowedTypes[type].includes(file.type)) {
    throw new Error(`Invalid file type. Allowed: ${allowedTypes[type].join(', ')}`);
  }
  
  return true;
}
```

### Secure File Handling

```javascript
// Sanitize file names
function sanitizeFileName(filename) {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 255);
}

// Verify file integrity
async function verifyFileIntegrity(file, expectedHash) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex === expectedHash;
}
```

## Migration Guide

### Migrating from v1 to v2

```javascript
// v1 API (deprecated)
const result = await api.processVideo(file);

// v2 API (current)
const result = await api.uploadFile(file, 'video', {
  detailLevel: 'comprehensive'
});
```

### Breaking Changes

- `processVideo()` renamed to `uploadFile()` with type parameter
- Response format standardized across all endpoints
- Job IDs now use UUID v4 format
- Batch endpoints require JSON content type

## Support and Resources

- **API Status**: https://status.voicedescription.com
- **Documentation**: https://docs.voicedescription.com
- **Support Email**: support@voicedescription.com
- **GitHub**: https://github.com/voicedescription/api-client
- **Community Forum**: https://community.voicedescription.com

## Changelog

### Version 2.0.0 (Current)
- Added batch image processing
- Improved error handling
- WebSocket support for real-time updates
- Enhanced progress tracking
- Added webhook support

### Version 1.5.0
- Added image processing endpoints
- Improved job status reporting
- Added health check endpoint

### Version 1.0.0
- Initial release
- Video processing support
- Basic API endpoints