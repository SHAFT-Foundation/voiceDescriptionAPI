# Voice Description API Documentation

## Overview

The Voice Description API provides comprehensive accessibility features for visual content by automatically generating descriptive audio narration tracks. This system leverages AWS AI services including Amazon Rekognition for video scene segmentation, Amazon Bedrock Nova Pro for intelligent content analysis, and Amazon Polly for natural text-to-speech synthesis.

**Base URLs:**
- Production: `https://api.voicedescription.ai/v2`
- Staging: `https://staging-api.voicedescription.ai/v2`
- Development: `http://localhost:3000`

**Version:** 2.1.0

---

## Authentication & Setup

### API Key Authentication

All API endpoints (except health checks) require authentication via API key in the request headers.

**Header Format:**
```
X-API-Key: your-api-key-here
```

### Bearer Token Authentication (Alternative)

JWT Bearer tokens are also supported for authentication.

**Header Format:**
```
Authorization: Bearer your-jwt-token-here
```

### Quick Setup Examples

<details>
<summary><b>cURL Setup</b></summary>

```bash
# Set your API key as an environment variable
export API_KEY="your-api-key-here"

# Make authenticated requests
curl -H "X-API-Key: $API_KEY" \
     https://api.voicedescription.ai/v2/api/health
```

</details>

<details>
<summary><b>JavaScript Setup</b></summary>

```javascript
// Using fetch API
const API_KEY = 'your-api-key-here';
const BASE_URL = 'https://api.voicedescription.ai/v2';

const apiClient = {
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  },
  
  async get(endpoint) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: this.headers
    });
    return response.json();
  },
  
  async post(endpoint, data) {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    return response.json();
  }
};
```

</details>

<details>
<summary><b>Python Setup</b></summary>

```python
import requests

class VoiceDescriptionAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.voicedescription.ai/v2'
        self.headers = {
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        }
    
    def get(self, endpoint):
        response = requests.get(
            f"{self.base_url}{endpoint}",
            headers=self.headers
        )
        return response.json()
    
    def post(self, endpoint, data):
        response = requests.post(
            f"{self.base_url}{endpoint}",
            headers=self.headers,
            json=data
        )
        return response.json()

# Initialize client
api = VoiceDescriptionAPI('your-api-key-here')
```

</details>

---

## Video Processing Endpoints

### Upload and Process Video

**POST** `/api/upload`

Upload a video file or provide an S3 URI to start automated audio description generation.

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| video | binary | Yes* | Video file to upload (max 500MB) |
| s3Uri | string | Yes* | S3 URI of the video (alternative to file upload) |
| title | string | No | Video title |
| language | string | No | Target language (en, es, fr, de) - default: en |

*Either `video` file or `s3Uri` is required

#### Request Examples

<details>
<summary><b>File Upload Example</b></summary>

**cURL:**
```bash
curl -X POST https://api.voicedescription.ai/v2/api/upload \
  -H "X-API-Key: $API_KEY" \
  -F "video=@/path/to/video.mp4" \
  -F "title=Product Demo Video" \
  -F "language=en"
```

**JavaScript:**
```javascript
const formData = new FormData();
formData.append('video', fileInput.files[0]);
formData.append('title', 'Product Demo Video');
formData.append('language', 'en');

const response = await fetch(`${BASE_URL}/api/upload`, {
  method: 'POST',
  headers: { 'X-API-Key': API_KEY },
  body: formData
});
const result = await response.json();
```

**Python:**
```python
import requests

files = {'video': open('video.mp4', 'rb')}
data = {
    'title': 'Product Demo Video',
    'language': 'en'
}

response = requests.post(
    f"{base_url}/api/upload",
    headers={'X-API-Key': api_key},
    files=files,
    data=data
)
```

</details>

<details>
<summary><b>S3 URI Reference Example</b></summary>

**cURL:**
```bash
curl -X POST https://api.voicedescription.ai/v2/api/upload \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "s3Uri": "s3://my-bucket/videos/presentation.mp4",
    "metadata": {
      "title": "Annual Report Presentation",
      "language": "en"
    }
  }'
```

**JavaScript:**
```javascript
const response = await fetch(`${BASE_URL}/api/upload`, {
  method: 'POST',
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    s3Uri: 's3://my-bucket/videos/presentation.mp4',
    metadata: {
      title: 'Annual Report Presentation',
      language: 'en'
    }
  })
});
```

**Python:**
```python
response = requests.post(
    f"{base_url}/api/upload",
    headers=headers,
    json={
        's3Uri': 's3://my-bucket/videos/presentation.mp4',
        'metadata': {
            'title': 'Annual Report Presentation',
            'language': 'en'
        }
    }
)
```

</details>

#### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "s3Uri": "s3://input-bucket/550e8400-e29b-41d4-a716-446655440000/video.mp4",
    "statusUrl": "/api/status/550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Get Video Job Status

**GET** `/api/status/{jobId}`

Check the current status and progress of a video processing job with real-time pipeline updates.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| jobId | uuid | Yes | Unique job identifier |

#### Request Examples

<details>
<summary><b>Status Check Examples</b></summary>

**cURL:**
```bash
curl -X GET https://api.voicedescription.ai/v2/api/status/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-API-Key: $API_KEY"
```

**JavaScript:**
```javascript
const jobId = '550e8400-e29b-41d4-a716-446655440000';
const response = await fetch(`${BASE_URL}/api/status/${jobId}`, {
  headers: { 'X-API-Key': API_KEY }
});
const status = await response.json();
```

**Python:**
```python
job_id = '550e8400-e29b-41d4-a716-446655440000'
response = requests.get(
    f"{base_url}/api/status/{job_id}",
    headers=headers
)
status = response.json()
```

</details>

#### Response Examples

**Processing (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "step": "analysis",
    "progress": 65,
    "message": "Analyzing scene 13 of 20"
  }
}
```

**Completed (200):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "step": "synthesis",
    "progress": 100,
    "message": "Processing completed successfully",
    "descriptions": [
      {
        "startTime": 0.0,
        "endTime": 5.5,
        "text": "The video opens with a wide shot of a modern office building..."
      }
    ],
    "audioUrl": "s3://output-bucket/550e8400/audio.mp3",
    "textUrl": "s3://output-bucket/550e8400/description.txt"
  }
}
```

### Download Video Description Text

**GET** `/api/results/{jobId}/text`

Download the generated text description file for a completed video job.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| format | string | No | Output format (plain, srt, vtt, json) - default: plain |

#### Request Examples

<details>
<summary><b>Download Text Examples</b></summary>

**cURL (Plain Text):**
```bash
curl -X GET "https://api.voicedescription.ai/v2/api/results/550e8400-e29b-41d4-a716-446655440000/text?format=plain" \
  -H "X-API-Key: $API_KEY" \
  -o description.txt
```

**JavaScript (JSON Format):**
```javascript
const response = await fetch(
  `${BASE_URL}/api/results/${jobId}/text?format=json`,
  { headers: { 'X-API-Key': API_KEY } }
);
const descriptions = await response.json();
```

**Python (SRT Format):**
```python
response = requests.get(
    f"{base_url}/api/results/{job_id}/text",
    params={'format': 'srt'},
    headers=headers
)
# Save SRT file
with open('subtitles.srt', 'w') as f:
    f.write(response.text)
```

</details>

#### Response Examples

**Plain Text Format:**
```text
At 0:00 - Scene 1: The video opens with a wide shot of a modern office building...
At 0:05 - Scene 2: Inside, employees are gathered around a conference table...
```

**JSON Format:**
```json
{
  "title": "Product Demo",
  "totalDuration": 120.5,
  "scenes": [
    {
      "startTime": 0.0,
      "endTime": 5.5,
      "text": "The video opens with a wide shot..."
    }
  ]
}
```

### Download Video Description Audio

**GET** `/api/results/{jobId}/audio`

Download the generated audio MP3 file for a completed video job.

#### Request Examples

<details>
<summary><b>Download Audio Examples</b></summary>

**cURL:**
```bash
curl -X GET https://api.voicedescription.ai/v2/api/results/550e8400-e29b-41d4-a716-446655440000/audio \
  -H "X-API-Key: $API_KEY" \
  -o description.mp3
```

**JavaScript:**
```javascript
const response = await fetch(
  `${BASE_URL}/api/results/${jobId}/audio`,
  { headers: { 'X-API-Key': API_KEY } }
);
const blob = await response.blob();
// Create download link
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'description.mp3';
a.click();
```

**Python:**
```python
response = requests.get(
    f"{base_url}/api/results/{job_id}/audio",
    headers=headers,
    stream=True
)
with open('description.mp3', 'wb') as f:
    for chunk in response.iter_content(chunk_size=8192):
        f.write(chunk)
```

</details>

---

## Image Processing Endpoints

### Process Single Image

**POST** `/api/process-image`

Analyze and generate descriptions for a single image with immediate results.

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| image | binary | Yes* | Image file to process (max 50MB) |
| s3Uri | string | Yes* | S3 URI of the image |
| base64 | string | Yes* | Base64 encoded image data |
| detailLevel | string | No | Level of detail (basic, comprehensive, technical) - default: comprehensive |
| generateAudio | boolean | No | Generate audio description - default: false |
| includeAltText | boolean | No | Generate HTML alt text - default: true |
| voiceId | string | No | Polly voice ID - default: Joanna |
| language | string | No | Target language - default: en |

*One of `image`, `s3Uri`, or `base64` is required

#### Request Examples

<details>
<summary><b>Single Image Processing Examples</b></summary>

**cURL (File Upload):**
```bash
curl -X POST https://api.voicedescription.ai/v2/api/process-image \
  -H "X-API-Key: $API_KEY" \
  -F "image=@/path/to/image.jpg" \
  -F "detailLevel=comprehensive" \
  -F "generateAudio=true" \
  -F "includeAltText=true"
```

**JavaScript (S3 URI):**
```javascript
const response = await fetch(`${BASE_URL}/api/process-image`, {
  method: 'POST',
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    s3Uri: 's3://my-bucket/images/product.jpg',
    detailLevel: 'comprehensive',
    generateAudio: true,
    includeAltText: true
  })
});
```

**Python (Base64):**
```python
import base64

with open('image.jpg', 'rb') as f:
    image_data = base64.b64encode(f.read()).decode()

response = requests.post(
    f"{base_url}/api/process-image",
    headers=headers,
    json={
        'base64': image_data,
        'detailLevel': 'technical',
        'generateAudio': True
    }
)
```

</details>

#### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "jobId": "img-550e8400-e29b-41d4",
    "status": "completed",
    "processingTime": 2.5,
    "descriptions": {
      "detailed": "A professional product photograph showing a sleek silver laptop computer positioned at a three-quarter angle on a white seamless background. The laptop display shows a vibrant desktop with productivity applications...",
      "alt": "Silver laptop computer on white background"
    },
    "audioUrl": "s3://output-bucket/img-550e8400/audio.mp3"
  }
}
```

### Process Multiple Images (Batch)

**POST** `/api/process-images-batch`

Process multiple images in a single request for efficiency (max 100 images).

#### Request Body

```json
{
  "images": [
    {
      "source": "s3://bucket/image1.jpg",
      "id": "product-001",
      "metadata": {
        "title": "Product Image 1"
      }
    }
  ],
  "options": {
    "detailLevel": "comprehensive",
    "generateAudio": true,
    "includeAltText": true
  }
}
```

#### Request Examples

<details>
<summary><b>Batch Processing Examples</b></summary>

**cURL:**
```bash
curl -X POST https://api.voicedescription.ai/v2/api/process-images-batch \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "images": [
      {"source": "s3://bucket/image1.jpg", "id": "product-001"},
      {"source": "s3://bucket/image2.jpg", "id": "product-002"},
      {"source": "s3://bucket/image3.jpg", "id": "product-003"}
    ],
    "options": {
      "detailLevel": "comprehensive",
      "generateAudio": true
    }
  }'
```

**JavaScript:**
```javascript
const batchRequest = {
  images: [
    { source: 's3://bucket/image1.jpg', id: 'product-001' },
    { source: 's3://bucket/image2.jpg', id: 'product-002' },
    { source: 's3://bucket/image3.jpg', id: 'product-003' }
  ],
  options: {
    detailLevel: 'comprehensive',
    generateAudio: true,
    includeAltText: true
  }
};

const response = await fetch(`${BASE_URL}/api/process-images-batch`, {
  method: 'POST',
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(batchRequest)
});
```

**Python:**
```python
batch_request = {
    'images': [
        {'source': f's3://bucket/image{i}.jpg', 'id': f'product-{i:03d}'}
        for i in range(1, 11)
    ],
    'options': {
        'detailLevel': 'comprehensive',
        'generateAudio': False,
        'includeAltText': True
    }
}

response = requests.post(
    f"{base_url}/api/process-images-batch",
    headers=headers,
    json=batch_request
)
```

</details>

#### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "batchId": "batch-550e8400-e29b-41d4",
    "status": "processing",
    "totalImages": 3,
    "processedCount": 0
  }
}
```

---

## Job Management Endpoints

### Get Image Job Status

**GET** `/api/status/image/{jobId}`

Check the status of an image processing job.

#### Request Example

```bash
curl -X GET https://api.voicedescription.ai/v2/api/status/image/img-550e8400-e29b-41d4 \
  -H "X-API-Key: $API_KEY"
```

#### Response

```json
{
  "success": true,
  "data": {
    "jobId": "img-550e8400-e29b-41d4",
    "status": "completed",
    "step": "synthesis"
  }
}
```

### Download Image Description Text

**GET** `/api/results/image/{jobId}/text`

Get the text description for a processed image.

#### Response Examples

**Plain Text:**
```text
A professional product photograph showing a sleek silver laptop computer...
```

**JSON Format:**
```json
{
  "title": "Product Image",
  "description": {
    "detailed": "A professional product photograph...",
    "alt": "Silver laptop computer on white background"
  }
}
```

### Download Image Description Audio

**GET** `/api/results/image/{jobId}/audio`

Get the audio description for a processed image.

```bash
curl -X GET https://api.voicedescription.ai/v2/api/results/image/img-550e8400/audio \
  -H "X-API-Key: $API_KEY" \
  -o image-description.mp3
```

---

## System Health Endpoints

### Health Check

**GET** `/api/health`

Basic health check endpoint for monitoring (no authentication required).

#### Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "uptime": 86400,
  "version": "2.1.0"
}
```

### AWS Services Status

**GET** `/api/aws-status`

Check connectivity and status of AWS services.

#### Response

```json
{
  "success": true,
  "data": {
    "s3": true,
    "rekognition": true,
    "bedrock": true,
    "polly": true,
    "region": "us-east-1"
  },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

---

## Error Handling

All API errors follow a consistent format for easy handling in your applications.

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error details",
    "retryAfter": 60  // For rate limiting errors
  },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### Common Error Codes

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 400 | INVALID_REQUEST | Invalid request parameters |
| 401 | UNAUTHORIZED | Missing or invalid API key |
| 404 | NOT_FOUND | Resource not found |
| 413 | PAYLOAD_TOO_LARGE | File size exceeds limit |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

### Error Handling Examples

<details>
<summary><b>JavaScript Error Handling</b></summary>

```javascript
async function processVideo(videoFile) {
  try {
    const formData = new FormData();
    formData.append('video', videoFile);
    
    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY },
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      
      switch (error.error.code) {
        case 'RATE_LIMITED':
          console.log(`Rate limited. Retry after ${error.error.retryAfter} seconds`);
          // Implement exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, error.error.retryAfter * 1000)
          );
          return processVideo(videoFile); // Retry
          
        case 'PAYLOAD_TOO_LARGE':
          throw new Error('Video file is too large. Maximum size is 500MB');
          
        case 'UNAUTHORIZED':
          throw new Error('Invalid API key. Please check your credentials');
          
        default:
          throw new Error(error.error.message);
      }
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Error processing video:', error);
    throw error;
  }
}
```

</details>

<details>
<summary><b>Python Error Handling</b></summary>

```python
import time
from typing import Dict, Any

def handle_api_error(response: requests.Response) -> None:
    """Handle API errors with appropriate actions"""
    if response.status_code == 200:
        return
    
    try:
        error_data = response.json()
        error = error_data.get('error', {})
        
        if error.get('code') == 'RATE_LIMITED':
            retry_after = error.get('retryAfter', 60)
            print(f"Rate limited. Waiting {retry_after} seconds...")
            time.sleep(retry_after)
            # Caller should retry the request
            raise RateLimitError(retry_after)
            
        elif error.get('code') == 'PAYLOAD_TOO_LARGE':
            raise ValueError('File size exceeds maximum limit of 500MB')
            
        elif error.get('code') == 'UNAUTHORIZED':
            raise AuthenticationError('Invalid API key')
            
        else:
            raise APIError(error.get('message', 'Unknown error'))
            
    except (KeyError, ValueError):
        raise APIError(f"HTTP {response.status_code}: {response.text}")

# Usage example
def upload_video_with_retry(file_path: str, max_retries: int = 3) -> Dict[str, Any]:
    """Upload video with automatic retry on rate limiting"""
    
    for attempt in range(max_retries):
        try:
            with open(file_path, 'rb') as f:
                files = {'video': f}
                response = requests.post(
                    f"{base_url}/api/upload",
                    headers={'X-API-Key': api_key},
                    files=files
                )
            
            handle_api_error(response)
            return response.json()
            
        except RateLimitError:
            if attempt == max_retries - 1:
                raise
            continue
            
        except Exception as e:
            print(f"Error on attempt {attempt + 1}: {e}")
            if attempt == max_retries - 1:
                raise
```

</details>

---

## Rate Limits & Best Practices

### Rate Limiting

The API implements rate limiting to ensure fair usage and system stability.

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| Video Upload | 10 requests | per minute |
| Image Processing | 100 requests | per minute |
| Batch Processing | 5 requests | per minute |
| Status Checks | 300 requests | per minute |
| Result Downloads | 60 requests | per minute |

### Best Practices

#### 1. Implement Exponential Backoff

When encountering rate limits or transient errors, implement exponential backoff:

```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

#### 2. Use Batch Processing for Multiple Images

Instead of processing images individually, use the batch endpoint:

```javascript
// Good: Single batch request
const response = await api.processBatchImages(imageArray);

// Avoid: Multiple individual requests
for (const image of imageArray) {
  await api.processImage(image); // Don't do this!
}
```

#### 3. Poll Status Efficiently

Use progressive delays when polling for job status:

```javascript
async function pollJobStatus(jobId) {
  const delays = [2000, 5000, 10000, 20000]; // Progressive delays
  let delayIndex = 0;
  
  while (true) {
    const status = await api.getJobStatus(jobId);
    
    if (status.data.status === 'completed' || status.data.status === 'failed') {
      return status;
    }
    
    const delay = delays[Math.min(delayIndex++, delays.length - 1)];
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}
```

#### 4. Cache Results

Cache completed job results to avoid unnecessary API calls:

```javascript
const resultCache = new Map();

async function getCachedResult(jobId) {
  if (resultCache.has(jobId)) {
    return resultCache.get(jobId);
  }
  
  const result = await api.getResult(jobId);
  resultCache.set(jobId, result);
  return result;
}
```

#### 5. Handle Large Files Properly

For large video files, consider:
- Uploading to S3 directly and using S3 URI references
- Implementing chunked uploads for better reliability
- Compressing videos before upload when possible

#### 6. Use Webhooks for Long-Running Jobs

Instead of polling, register webhooks to be notified when jobs complete:

```json
{
  "s3Uri": "s3://bucket/video.mp4",
  "webhookUrl": "https://your-app.com/webhook/job-complete"
}
```

---

## SDK & Client Libraries

### Official SDKs

- **Node.js/JavaScript**: `npm install @voicedescription/sdk`
- **Python**: `pip install voicedescription`
- **Go**: `go get github.com/voicedescription/go-sdk`

### Community Libraries

- **Ruby**: `gem install voice_description_api`
- **PHP**: `composer require voicedescription/php-sdk`
- **Java**: Maven package available

---

## Support & Resources

- **API Status**: https://status.voicedescription.ai
- **Support Email**: api-support@voicedescription.ai
- **Documentation**: https://docs.voicedescription.ai
- **GitHub Examples**: https://github.com/voicedescription/api-examples

---

## Changelog

### Version 2.1.0 (Current)
- Added batch image processing endpoint
- Improved error handling and retry logic
- Added support for multiple output formats (SRT, VTT)
- Enhanced webhook notifications

### Version 2.0.0
- Complete API redesign with RESTful architecture
- Added comprehensive image processing capabilities
- Introduced job-based async processing
- Added multiple language support

### Version 1.0.0
- Initial release with video processing
- Basic text and audio generation
- S3 integration support