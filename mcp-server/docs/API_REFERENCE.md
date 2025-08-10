# Voice Description MCP Server API Reference

## Overview

The Voice Description MCP Server implements the Model Context Protocol (MCP) to provide AI assistants with powerful accessibility tools. This reference documents all available tools, their parameters, responses, and usage patterns.

## Table of Contents

- [Tool Categories](#tool-categories)
- [Video Processing Tools](#video-processing-tools)
- [Image Processing Tools](#image-processing-tools)
- [Job Management Tools](#job-management-tools)
- [System Tools](#system-tools)
- [Common Types](#common-types)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [WebSocket Protocol](#websocket-protocol)

## Tool Categories

The MCP server organizes tools into four main categories:

| Category | Purpose | Tools |
|----------|---------|-------|
| **Video** | Process videos for audio descriptions | `upload_video`, `process_video_url` |
| **Image** | Generate accessibility descriptions for images | `process_image`, `batch_images` |
| **Management** | Monitor and retrieve job results | `check_status`, `download_results` |
| **System** | Health checks and service monitoring | `health_check`, `aws_status` |

## Video Processing Tools

### voice_description_upload_video

Upload and process a video file for comprehensive audio description generation.

#### Request

```typescript
{
  tool: "voice_description_upload_video",
  arguments: {
    // Required
    file_path: string;           // Absolute path to video file
    
    // Optional
    title?: string;              // Video title for context
    description?: string;        // Additional context about video
    language?: "en" | "es" | "fr" | "de" | "ja" | "zh";  // Default: "en"
    voice_id?: string;           // AWS Polly voice ID (default: "Joanna")
    detail_level?: "basic" | "detailed" | "comprehensive";  // Default: "detailed"
    wait_for_completion?: boolean;  // Wait for processing (default: false)
    polling_timeout?: number;    // Max wait time in seconds (30-1800, default: 600)
  }
}
```

#### Response

```typescript
{
  success: true,
  job_id: string,                // Unique job identifier
  status: "pending" | "processing" | "completed" | "failed",
  estimated_time_seconds: number,
  estimated_time_human: string,  // "5m 30s"
  status_url: string,            // API endpoint for status
  message: string,
  
  upload_info: {
    file_name: string,
    file_size_bytes: number,
    file_size_human: string,     // "125.5 MB"
    mime_type: string,
    upload_duration_ms: number
  },
  
  processing_options: {
    language: string,
    voice_id: string,
    detail_level: string
  },
  
  // Only if wait_for_completion: true
  final_results?: {
    text_description: string,
    audio_narration: {
      url: string,
      duration_seconds: number,
      format: string
    },
    scenes_analyzed: number,
    processing_steps_completed: string
  },
  
  download_instructions?: {
    text_description: string,    // Tool command to download text
    audio_narration: string,      // Tool command to download audio
    complete_package: string      // Tool command to download all
  }
}
```

#### Example

```javascript
// Basic usage
{
  "tool": "voice_description_upload_video",
  "arguments": {
    "file_path": "/videos/presentation.mp4",
    "title": "Q4 Sales Presentation",
    "language": "en",
    "detail_level": "comprehensive"
  }
}

// With polling for completion
{
  "tool": "voice_description_upload_video",
  "arguments": {
    "file_path": "/videos/tutorial.mp4",
    "wait_for_completion": true,
    "polling_timeout": 900,
    "voice_id": "Matthew",
    "detail_level": "detailed"
  }
}
```

#### Supported Video Formats

- MP4 (`.mp4`)
- MPEG (`.mpeg`, `.mpg`)
- QuickTime (`.mov`)
- AVI (`.avi`)
- WebM (`.webm`)
- MKV (`.mkv`)

#### Processing Steps

1. **Upload** - Video uploaded to S3
2. **Segmentation** - AWS Rekognition detects scenes
3. **Extraction** - FFmpeg extracts individual scenes
4. **Analysis** - Bedrock Nova Pro analyzes each scene
5. **Compilation** - Descriptions compiled and formatted
6. **Synthesis** - AWS Polly generates audio narration

### voice_description_process_video_url

Process a video directly from an S3 URL without uploading.

#### Request

```typescript
{
  tool: "voice_description_process_video_url",
  arguments: {
    // Required
    video_url: string;           // S3 URL (s3:// or https://)
    
    // Optional
    title?: string;
    options?: {
      language?: string;
      voice_id?: string;
      detail_level?: string;
      scene_threshold?: number;  // Confidence threshold (0.5-1.0)
    },
    wait_for_completion?: boolean;
    polling_timeout?: number;
  }
}
```

#### Response

Same structure as `upload_video`, but without `upload_info`.

#### Example

```javascript
{
  "tool": "voice_description_process_video_url",
  "arguments": {
    "video_url": "s3://my-bucket/videos/product-demo.mp4",
    "title": "Product Demo Video",
    "options": {
      "language": "en",
      "detail_level": "comprehensive",
      "scene_threshold": 0.8
    }
  }
}
```

## Image Processing Tools

### voice_description_process_image

Process a single image for detailed accessibility description.

#### Request

```typescript
{
  tool: "voice_description_process_image",
  arguments: {
    // Required
    image_path: string;          // Absolute path to image
    
    // Optional
    detail_level?: "basic" | "comprehensive" | "technical";  // Default: "comprehensive"
    generate_audio?: boolean;    // Generate narration (default: true)
    include_alt_text?: boolean;  // Include alt text (default: true)
    context?: string;            // Usage context (e.g., "e-commerce product")
    voice_id?: string;           // AWS Polly voice
    language?: string;           // Target language
  }
}
```

#### Response

```typescript
{
  success: true,
  job_id: string,
  status: "completed",
  processing_time_ms: number,
  processing_time_human: string,
  
  results: {
    // Core descriptions
    description: string,         // Detailed description
    alt_text: string,           // Brief alt text for HTML
    
    // Visual analysis
    visual_elements: string[],  // ["person", "laptop", "desk"]
    colors: string[],           // ["blue", "white", "gray"]
    composition: {
      layout: string,           // "centered", "rule-of-thirds"
      focus: string,            // Main subject
      background: string        // Background description
    },
    
    // Quality metrics
    confidence: number,         // 0.0 - 1.0
    confidence_level: string,  // "very high", "high", "moderate"
    
    // Audio (if generated)
    audio?: {
      url: string,
      duration_seconds: number,
      duration_human: string,
      format: string,           // "mp3"
      voice_id: string,
      language: string
    },
    
    // Web metadata
    html_metadata: {
      alt_attribute: string,
      aria_label: string,
      title: string,
      longdesc?: string
    }
  },
  
  processing_info: {
    detail_level: string,
    audio_generated: boolean,
    alt_text_included: boolean,
    language: string,
    context_provided: boolean
  },
  
  source_info: {
    file_name: string,
    file_size_bytes: number,
    file_size_human: string,
    mime_type: string,
    file_extension: string
  },
  
  usage_recommendations: {
    web_accessibility: string[],
    content_management: string[],
    social_media: string[],
    documentation: string[]
  }
}
```

#### Example

```javascript
// E-commerce product image
{
  "tool": "voice_description_process_image",
  "arguments": {
    "image_path": "/images/products/laptop-01.jpg",
    "detail_level": "comprehensive",
    "generate_audio": true,
    "context": "E-commerce product photo for laptop listing"
  }
}

// Technical diagram
{
  "tool": "voice_description_process_image",
  "arguments": {
    "image_path": "/diagrams/architecture.png",
    "detail_level": "technical",
    "generate_audio": false,
    "context": "System architecture diagram for documentation"
  }
}
```

#### Detail Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `basic` | Brief, essential elements only | Quick alt text |
| `comprehensive` | Detailed description with context | General accessibility |
| `technical` | Includes technical details and measurements | Documentation |

### voice_description_batch_images

Process multiple images efficiently in batch.

#### Request

```typescript
{
  tool: "voice_description_batch_images",
  arguments: {
    // Required
    images: Array<{
      path: string;              // Absolute path to image
      id?: string;               // Optional identifier
      context?: string;          // Optional context per image
    }>,
    
    // Optional
    options?: {
      detail_level?: string;
      generate_audio?: boolean;
      include_alt_text?: boolean;
      voice_id?: string;
      language?: string;
    },
    
    processing?: {
      parallel?: boolean;        // Process in parallel (default: true)
      max_concurrent?: number;   // Max parallel jobs (1-10, default: 5)
      continue_on_error?: boolean;  // Continue if some fail (default: true)
    }
  }
}
```

#### Response

```typescript
{
  success: true,
  total_images: number,
  processed: number,
  failed: number,
  processing_time_ms: number,
  
  results: Array<{
    id: string,                 // Image ID or generated
    path: string,
    status: "completed" | "failed",
    
    // If completed
    result?: {
      description: string,
      alt_text: string,
      visual_elements: string[],
      confidence: number,
      audio?: {
        url: string,
        duration_seconds: number
      }
    },
    
    // If failed
    error?: {
      code: string,
      message: string
    }
  }>,
  
  summary: {
    average_confidence: number,
    total_audio_duration: number,
    common_elements: string[],  // Elements found across images
    processing_stats: {
      min_time_ms: number,
      max_time_ms: number,
      avg_time_ms: number
    }
  }
}
```

#### Example

```javascript
// E-commerce product batch
{
  "tool": "voice_description_batch_images",
  "arguments": {
    "images": [
      {"path": "/products/laptop-front.jpg", "id": "SKU-001-F"},
      {"path": "/products/laptop-side.jpg", "id": "SKU-001-S"},
      {"path": "/products/laptop-back.jpg", "id": "SKU-001-B"}
    ],
    "options": {
      "detail_level": "basic",
      "generate_audio": false,
      "include_alt_text": true
    },
    "processing": {
      "parallel": true,
      "max_concurrent": 3
    }
  }
}
```

## Job Management Tools

### voice_description_check_status

Check the processing status of any job.

#### Request

```typescript
{
  tool: "voice_description_check_status",
  arguments: {
    // Required
    job_id: string;              // Job identifier
    
    // Optional
    job_type?: "video" | "image";  // Hint for faster lookup
    wait_for_completion?: boolean;  // Poll until complete
    polling_timeout?: number;     // Max wait time (seconds)
    include_details?: boolean;    // Include detailed progress
  }
}
```

#### Response

```typescript
{
  success: true,
  job_id: string,
  status: "pending" | "processing" | "completed" | "failed",
  progress: number,              // 0-100 percentage
  
  // Current processing state
  step?: string,                 // "segmentation", "analysis", etc.
  message?: string,              // Human-readable status
  estimated_completion?: string,  // "2 minutes remaining"
  
  // If processing
  processing_details?: {
    current_scene?: number,
    total_scenes?: number,
    scenes_processed?: number,
    current_operation?: string,
    elapsed_time_ms?: number
  },
  
  // If completed
  results?: {
    text_available: boolean,
    audio_available: boolean,
    download_urls: {
      text?: string,
      audio?: string
    }
  },
  
  // If failed
  error?: {
    code: string,
    message: string,
    details?: any,
    failed_at_step?: string
  }
}
```

#### Example

```javascript
// Simple status check
{
  "tool": "voice_description_check_status",
  "arguments": {
    "job_id": "vid-550e8400",
    "job_type": "video"
  }
}

// With polling
{
  "tool": "voice_description_check_status",
  "arguments": {
    "job_id": "img-batch-7a8b9c",
    "wait_for_completion": true,
    "polling_timeout": 300,
    "include_details": true
  }
}
```

### voice_description_download_results

Download completed processing results.

#### Request

```typescript
{
  tool: "voice_description_download_results",
  arguments: {
    // Required
    job_id: string;
    
    // Optional
    format?: "text" | "audio" | "all";  // Default: "all"
    include_metadata?: boolean;   // Include processing metadata
    save_to?: string;             // Optional save path
  }
}
```

#### Response

```typescript
{
  success: true,
  job_id: string,
  format: string,
  
  // Text results
  text?: {
    content: string,             // Full text description
    format: "plain" | "markdown" | "html",
    encoding: string,            // "utf-8"
    size_bytes: number,
    line_count: number,
    word_count: number,
    
    // Structured sections
    sections?: {
      summary?: string,
      scenes?: Array<{
        timestamp: string,
        description: string
      }>,
      transcript?: string
    }
  },
  
  // Audio results
  audio?: {
    url: string,                 // Download URL
    format: string,              // "mp3"
    duration_seconds: number,
    duration_human: string,
    size_bytes: number,
    bitrate: number,
    sample_rate: number,
    voice_id: string,
    language: string
  },
  
  // Processing metadata
  metadata?: {
    processed_at: string,        // ISO timestamp
    processing_duration_ms: number,
    ai_model: string,
    confidence_scores: number[],
    options_used: any
  },
  
  // Save confirmation
  saved_to?: {
    text_path?: string,
    audio_path?: string
  }
}
```

#### Example

```javascript
// Download all results
{
  "tool": "voice_description_download_results",
  "arguments": {
    "job_id": "vid-550e8400",
    "format": "all",
    "include_metadata": true
  }
}

// Download and save audio only
{
  "tool": "voice_description_download_results",
  "arguments": {
    "job_id": "img-7a8b9c0d",
    "format": "audio",
    "save_to": "/output/narration.mp3"
  }
}
```

## System Tools

### voice_description_health_check

Check system health and API availability.

#### Request

```typescript
{
  tool: "voice_description_health_check",
  arguments: {
    // Optional
    include_details?: boolean;    // Include detailed diagnostics
    check_aws?: boolean;          // Check AWS service status
    check_dependencies?: boolean; // Check all dependencies
  }
}
```

#### Response

```typescript
{
  success: true,
  status: "healthy" | "degraded" | "unhealthy",
  timestamp: string,             // ISO timestamp
  uptime_seconds: number,
  version: string,
  
  // Basic health
  services: {
    api: {
      status: "up" | "down",
      response_time_ms: number
    },
    database: {
      status: "up" | "down",
      connections: number
    },
    storage: {
      status: "up" | "down",
      available_space_gb: number
    }
  },
  
  // If include_details: true
  details?: {
    system: {
      cpu_usage_percent: number,
      memory_usage_percent: number,
      disk_usage_percent: number,
      load_average: number[]
    },
    
    processing: {
      active_jobs: number,
      queued_jobs: number,
      completed_today: number,
      failed_today: number,
      average_processing_time_ms: number
    },
    
    rate_limits: {
      requests_per_minute: number,
      remaining: number,
      reset_at: string
    }
  },
  
  // If check_aws: true
  aws_services?: {
    s3: { status: string, region: string },
    rekognition: { status: string, quota_remaining: number },
    bedrock: { status: string, model_status: string },
    polly: { status: string, characters_remaining: number }
  }
}
```

#### Example

```javascript
// Basic health check
{
  "tool": "voice_description_health_check",
  "arguments": {}
}

// Comprehensive health check
{
  "tool": "voice_description_health_check",
  "arguments": {
    "include_details": true,
    "check_aws": true,
    "check_dependencies": true
  }
}
```

### voice_description_aws_status

Check AWS service status and quotas.

#### Request

```typescript
{
  tool: "voice_description_aws_status",
  arguments: {
    // Optional
    services?: string[];         // Specific services to check
    include_quotas?: boolean;    // Include quota information
    region?: string;             // AWS region (default: us-east-1)
  }
}
```

#### Response

```typescript
{
  success: true,
  region: string,
  timestamp: string,
  
  services: {
    s3: {
      status: "operational" | "degraded" | "outage",
      buckets_accessible: string[],
      operations_per_second: number,
      errors_last_hour: number
    },
    
    rekognition: {
      status: string,
      api_calls_today: number,
      quota_limit: number,
      quota_remaining: number,
      quota_reset: string,
      average_response_time_ms: number
    },
    
    bedrock: {
      status: string,
      model_id: string,
      model_status: "available" | "throttled",
      tokens_used_today: number,
      tokens_remaining: number,
      inference_latency_ms: number
    },
    
    polly: {
      status: string,
      characters_synthesized_today: number,
      characters_limit: number,
      characters_remaining: number,
      voices_available: string[],
      neural_voices_available: string[]
    }
  },
  
  // If include_quotas: true
  quotas?: {
    s3: {
      storage_used_gb: number,
      storage_limit_gb: number,
      bandwidth_used_gb: number,
      bandwidth_limit_gb: number
    },
    
    rekognition: {
      videos_processed_month: number,
      videos_limit_month: number,
      concurrent_jobs: number,
      concurrent_limit: number
    },
    
    bedrock: {
      requests_per_minute: number,
      tokens_per_minute: number,
      model_invocations_month: number
    },
    
    polly: {
      standard_requests_month: number,
      neural_requests_month: number,
      ssml_requests_month: number
    }
  },
  
  recommendations?: string[]    // Optimization recommendations
}
```

#### Example

```javascript
// Check specific services
{
  "tool": "voice_description_aws_status",
  "arguments": {
    "services": ["rekognition", "bedrock"],
    "include_quotas": true
  }
}

// Full AWS status
{
  "tool": "voice_description_aws_status",
  "arguments": {
    "include_quotas": true,
    "region": "us-west-2"
  }
}
```

## Common Types

### Language Codes

```typescript
type Language = "en" | "es" | "fr" | "de" | "ja" | "zh";
```

| Code | Language | Polly Voices |
|------|----------|--------------|
| `en` | English | Joanna, Matthew, Salli, Joey |
| `es` | Spanish | Lucia, Enrique, Conchita |
| `fr` | French | Celine, Mathieu, Lea |
| `de` | German | Vicki, Hans, Marlene |
| `ja` | Japanese | Mizuki, Takumi |
| `zh` | Chinese | Zhiyu |

### Detail Levels

```typescript
type DetailLevel = "basic" | "detailed" | "comprehensive" | "technical";
```

| Level | Description Length | Processing Time | Use Case |
|-------|-------------------|-----------------|----------|
| `basic` | 50-100 words | Fast | Alt text, summaries |
| `detailed` | 200-300 words | Moderate | Standard descriptions |
| `comprehensive` | 400-600 words | Slower | Full accessibility |
| `technical` | 500-800 words | Slowest | Documentation |

### Job Status

```typescript
type JobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";
```

| Status | Description | Next Action |
|--------|-------------|-------------|
| `pending` | Queued for processing | Wait or poll |
| `processing` | Currently being processed | Poll for updates |
| `completed` | Successfully completed | Download results |
| `failed` | Processing failed | Check error, retry |
| `cancelled` | Job was cancelled | Create new job |

## Error Handling

### Error Response Format

```typescript
{
  success: false,
  error: {
    code: string,                // Error code
    message: string,             // Human-readable message
    details?: any,               // Additional error details
    timestamp: string,           // When error occurred
    request_id?: string,         // Request tracking ID
    
    // For validation errors
    validation_errors?: Array<{
      field: string,
      message: string,
      received: any
    }>,
    
    // For API errors
    api_error?: {
      status_code: number,
      endpoint: string,
      response: any
    },
    
    // Retry information
    retry?: {
      should_retry: boolean,
      suggested_delay_ms: number,
      max_attempts: number
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| `FILE_NOT_FOUND` | 404 | Input file doesn't exist | Check file path |
| `FILE_TOO_LARGE` | 413 | File exceeds size limit | Reduce size or use URL |
| `UNSUPPORTED_FORMAT` | 415 | File format not supported | Convert to supported format |
| `INVALID_PARAMETERS` | 400 | Invalid input parameters | Check parameter requirements |
| `AUTHENTICATION_FAILED` | 401 | Invalid or missing API key | Check API credentials |
| `AUTHORIZATION_FAILED` | 403 | Insufficient permissions | Check account permissions |
| `RATE_LIMITED` | 429 | Rate limit exceeded | Wait and retry |
| `API_ERROR` | 502 | Upstream API error | Check API status |
| `PROCESSING_FAILED` | 500 | Processing error | Check logs, retry |
| `TIMEOUT` | 504 | Operation timed out | Increase timeout or retry |
| `QUOTA_EXCEEDED` | 429 | AWS quota exceeded | Wait or increase quotas |
| `INTERNAL_ERROR` | 500 | Server error | Contact support |

### Error Handling Best Practices

```javascript
// Example error handling
try {
  const result = await executeTool({
    tool: "voice_description_process_image",
    arguments: { image_path: "/path/to/image.jpg" }
  });
  
  if (!result.success) {
    // Handle error
    if (result.error.code === "RATE_LIMITED") {
      // Wait and retry
      await sleep(result.error.retry.suggested_delay_ms);
      return retry();
    } else if (result.error.code === "FILE_NOT_FOUND") {
      // Handle missing file
      console.error("File not found:", result.error.details);
    }
  }
} catch (error) {
  // Handle unexpected errors
  console.error("Unexpected error:", error);
}
```

## Rate Limiting

### Rate Limits

| Endpoint | Limit | Window | Burst |
|----------|-------|--------|-------|
| Image Processing | 100 | 1 minute | 10 |
| Video Processing | 10 | 1 minute | 2 |
| Batch Processing | 20 | 1 minute | 5 |
| Status Checks | 300 | 1 minute | 50 |
| Health Checks | 60 | 1 minute | 10 |

### Rate Limit Response Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642694400
X-RateLimit-Reset-After: 30
```

### Handling Rate Limits

```javascript
// Exponential backoff strategy
async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 'RATE_LIMITED' && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}
```

## WebSocket Protocol

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  console.log('Connected to MCP server');
});
```

### Message Format

#### Request

```typescript
{
  type: "tool_request",
  tool: string,                  // Tool name
  arguments: any,                // Tool arguments
  requestId: string,             // Unique request ID
  timestamp: string              // ISO timestamp
}
```

#### Response

```typescript
{
  type: "tool_response",
  requestId: string,             // Matching request ID
  success: boolean,
  result?: any,                  // Tool result if success
  error?: ErrorObject,           // Error if failed
  timestamp: string,
  processingTime: number         // Time in ms
}
```

#### Progress Updates

```typescript
{
  type: "progress",
  requestId: string,
  jobId: string,
  progress: number,              // 0-100
  step: string,
  message: string,
  timestamp: string
}
```

### WebSocket Events

```javascript
// Connection events
ws.on('open', () => {});
ws.on('close', (code, reason) => {});
ws.on('error', (error) => {});

// Message handling
ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  switch (message.type) {
    case 'tool_response':
      handleToolResponse(message);
      break;
    case 'progress':
      handleProgress(message);
      break;
    case 'error':
      handleError(message);
      break;
  }
});

// Heartbeat
ws.on('ping', () => {
  ws.pong();
});
```

### WebSocket Error Codes

| Code | Description | Action |
|------|-------------|--------|
| 1000 | Normal closure | Reconnect if needed |
| 1001 | Going away | Reconnect to new endpoint |
| 1002 | Protocol error | Check message format |
| 1003 | Unsupported data | Check data types |
| 1006 | Abnormal closure | Reconnect with backoff |
| 1011 | Server error | Check server logs |
| 4000 | Authentication required | Send auth token |
| 4001 | Invalid tool | Check tool name |
| 4002 | Invalid arguments | Check parameters |
| 4003 | Rate limited | Reduce request rate |

## Examples

### Complete Video Processing Workflow

```javascript
// 1. Upload video
const uploadResult = await executeTool({
  tool: "voice_description_upload_video",
  arguments: {
    file_path: "/videos/presentation.mp4",
    title: "Annual Report Presentation",
    language: "en",
    detail_level: "comprehensive"
  }
});

const jobId = uploadResult.job_id;

// 2. Poll for status
let status;
do {
  await sleep(5000); // Wait 5 seconds
  
  status = await executeTool({
    tool: "voice_description_check_status",
    arguments: {
      job_id: jobId,
      include_details: true
    }
  });
  
  console.log(`Progress: ${status.progress}% - ${status.message}`);
} while (status.status === 'processing');

// 3. Download results
if (status.status === 'completed') {
  const results = await executeTool({
    tool: "voice_description_download_results",
    arguments: {
      job_id: jobId,
      format: "all",
      include_metadata: true
    }
  });
  
  console.log("Text description:", results.text.content);
  console.log("Audio URL:", results.audio.url);
}
```

### Batch Image Processing with Error Handling

```javascript
const images = [
  { path: "/images/product1.jpg", id: "PROD-001" },
  { path: "/images/product2.jpg", id: "PROD-002" },
  { path: "/images/product3.jpg", id: "PROD-003" }
];

const batchResult = await executeTool({
  tool: "voice_description_batch_images",
  arguments: {
    images: images,
    options: {
      detail_level: "basic",
      generate_audio: false,
      include_alt_text: true
    },
    processing: {
      parallel: true,
      max_concurrent: 3,
      continue_on_error: true
    }
  }
});

// Process results
for (const result of batchResult.results) {
  if (result.status === 'completed') {
    console.log(`${result.id}: ${result.result.alt_text}`);
  } else {
    console.error(`${result.id} failed: ${result.error.message}`);
  }
}

// Summary
console.log(`Processed: ${batchResult.processed}/${batchResult.total_images}`);
console.log(`Average confidence: ${batchResult.summary.average_confidence}`);
```

### Health Monitoring Script

```javascript
async function monitorHealth() {
  const health = await executeTool({
    tool: "voice_description_health_check",
    arguments: {
      include_details: true,
      check_aws: true
    }
  });
  
  if (health.status !== 'healthy') {
    // Alert on degraded or unhealthy status
    sendAlert({
      status: health.status,
      services: health.services,
      details: health.details
    });
  }
  
  // Check AWS quotas
  const awsStatus = await executeTool({
    tool: "voice_description_aws_status",
    arguments: {
      include_quotas: true
    }
  });
  
  // Alert if quotas are low
  for (const [service, data] of Object.entries(awsStatus.services)) {
    if (data.quota_remaining / data.quota_limit < 0.2) {
      sendAlert({
        service: service,
        message: `Low quota: ${data.quota_remaining} remaining`
      });
    }
  }
}

// Run every 5 minutes
setInterval(monitorHealth, 5 * 60 * 1000);
```

## Performance Considerations

### Optimization Tips

1. **Batch Processing**
   - Use batch tools for multiple items
   - Set appropriate `max_concurrent` values
   - Enable `continue_on_error` for resilience

2. **Polling Strategy**
   - Use appropriate polling intervals
   - Implement exponential backoff
   - Set reasonable timeout values

3. **File Handling**
   - Use S3 URLs for large videos
   - Compress images before processing
   - Clean up temporary files

4. **Caching**
   - Cache frequently accessed results
   - Store job IDs for later retrieval
   - Implement client-side result caching

### Performance Benchmarks

| Operation | P50 | P95 | P99 |
|-----------|-----|-----|-----|
| Image Processing | 1.2s | 2.5s | 4s |
| Batch (10 images) | 8s | 15s | 20s |
| Video Upload (100MB) | 30s | 45s | 60s |
| Status Check | 50ms | 100ms | 200ms |
| Health Check | 20ms | 50ms | 100ms |

## Security

### Authentication

All requests must include authentication:

```javascript
// API Key authentication
{
  headers: {
    'X-API-Key': 'your-api-key'
  }
}

// Or via environment
env: {
  API_KEY: 'your-api-key'
}
```

### Input Validation

All inputs are validated against strict schemas:

- File paths must be absolute
- File sizes must be within limits
- File types must be supported
- Parameters must match expected types
- Strings are sanitized for injection attacks

### Data Privacy

- No personal data is logged
- Temporary files are deleted after processing
- Results are available for limited time
- GDPR compliant data handling
- Encrypted data transmission

## Versioning

### API Version

Current version: `1.0.0`

Version information in responses:
```json
{
  "api_version": "1.0.0",
  "mcp_version": "1.0",
  "server_version": "1.0.0"
}
```

### Breaking Changes Policy

- Major version for breaking changes
- Minor version for new features
- Patch version for bug fixes
- 6-month deprecation notice
- Migration guides provided

## Support

### Getting Help

- **Documentation**: This guide and README
- **Examples**: See `/examples` directory
- **Issues**: GitHub Issues
- **Community**: Discord/Slack channels
- **Support**: support@voicedescription.com

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
DEBUG=mcp:*
```

### Common Issues

See [Troubleshooting Guide](./TROUBLESHOOTING.md) for:
- Connection issues
- File processing errors
- API errors
- Performance problems
- Rate limiting

---

**Last Updated**: January 2024
**API Version**: 1.0.0