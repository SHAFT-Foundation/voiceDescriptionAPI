# MCP Tools Quick Reference

## Overview

This document provides a quick reference for all MCP tools exposed by the Voice Description API server. Each tool includes its purpose, parameters, and example usage.

## Available Tools

### 1. voice_description_upload_video

**Purpose:** Upload and process video files for audio description generation

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| file_path | string | ✅ | - | Path to video file |
| title | string | ❌ | - | Video title |
| description | string | ❌ | - | Additional context |
| language | enum | ❌ | "en" | Target language (en/es/fr/de/ja/zh) |
| voice_id | string | ❌ | "Joanna" | AWS Polly voice ID |
| detail_level | enum | ❌ | "detailed" | Detail level (basic/detailed/comprehensive) |
| wait_for_completion | boolean | ❌ | false | Wait for processing to complete |

**Example Request:**
```json
{
  "tool": "voice_description_upload_video",
  "arguments": {
    "file_path": "/path/to/video.mp4",
    "title": "Product Demo Video",
    "language": "en",
    "detail_level": "comprehensive",
    "wait_for_completion": true
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "job_id": "550e8400-e29b-41d4-a716",
  "status": "processing",
  "estimated_time": 300,
  "status_url": "/api/status/550e8400-e29b-41d4-a716",
  "message": "Video uploaded successfully, processing started"
}
```

---

### 2. voice_description_process_image

**Purpose:** Process a single image for accessibility description

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| image_path | string | ✅ | - | Path to image file |
| detail_level | enum | ❌ | "comprehensive" | Level of detail (basic/comprehensive/technical) |
| generate_audio | boolean | ❌ | true | Generate audio narration |
| include_alt_text | boolean | ❌ | true | Include HTML alt text |
| context | string | ❌ | - | Additional context about image usage |
| voice_id | string | ❌ | "Joanna" | AWS Polly voice ID |

**Example Request:**
```json
{
  "tool": "voice_description_process_image",
  "arguments": {
    "image_path": "/path/to/image.jpg",
    "detail_level": "comprehensive",
    "generate_audio": true,
    "context": "Product photo for e-commerce listing"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "job_id": "img-550e8400",
  "status": "completed",
  "processing_time": 2500,
  "results": {
    "description": "A professional product photograph showing...",
    "alt_text": "White ceramic coffee mug with blue handle",
    "visual_elements": ["mug", "ceramic", "handle", "shadow"],
    "colors": ["white", "blue", "gray"],
    "composition": "Centered product on white background",
    "confidence": 0.95,
    "audio": {
      "url": "https://cdn.example.com/audio/img-550e8400.mp3",
      "duration": 8.5,
      "format": "mp3"
    },
    "html_metadata": {
      "altAttribute": "White ceramic coffee mug with blue handle",
      "ariaLabel": "Product image: White ceramic coffee mug"
    }
  }
}
```

---

### 3. voice_description_batch_images

**Purpose:** Process multiple images in batch

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| images | array | ✅ | - | Array of image configurations (1-50 items) |
| images[].path | string | ✅ | - | Path to image file |
| images[].id | string | ❌ | - | Custom ID for tracking |
| images[].context | string | ❌ | - | Context for this image |
| options | object | ❌ | - | Processing options |
| options.detail_level | enum | ❌ | - | Detail level |
| options.generate_audio | boolean | ❌ | true | Generate audio |
| options.voice_id | string | ❌ | "Joanna" | Voice ID |
| parallel | boolean | ❌ | true | Process in parallel |
| max_concurrent | number | ❌ | 3 | Max concurrent (1-10) |

**Example Request:**
```json
{
  "tool": "voice_description_batch_images",
  "arguments": {
    "images": [
      {
        "path": "/images/product1.jpg",
        "id": "prod-001",
        "context": "Main product image"
      },
      {
        "path": "/images/product2.jpg",
        "id": "prod-002",
        "context": "Alternative angle"
      }
    ],
    "options": {
      "detail_level": "basic",
      "generate_audio": false
    },
    "parallel": true,
    "max_concurrent": 5
  }
}
```

---

### 4. voice_description_check_status

**Purpose:** Check processing status of a job

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| job_id | string | ✅ | - | Job ID to check |
| job_type | enum | ✅ | - | Type of job (video/image/batch) |
| wait_for_completion | boolean | ❌ | false | Poll until complete |
| timeout | number | ❌ | 300 | Timeout in seconds |

**Example Request:**
```json
{
  "tool": "voice_description_check_status",
  "arguments": {
    "job_id": "550e8400-e29b-41d4-a716",
    "job_type": "video",
    "wait_for_completion": true,
    "timeout": 600
  }
}
```

**Example Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716",
  "status": "processing",
  "step": "analysis",
  "progress": 65,
  "message": "Analyzing scene 13 of 20",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

---

### 5. voice_description_download_results

**Purpose:** Download processing results

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| job_id | string | ✅ | - | Job ID |
| format | enum | ❌ | "all" | Format (text/audio/json/all) |
| save_to | string | ❌ | - | Directory to save results |

**Example Request:**
```json
{
  "tool": "voice_description_download_results",
  "arguments": {
    "job_id": "550e8400-e29b-41d4-a716",
    "format": "all",
    "save_to": "/output/results"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "files": {
    "text": "/output/results/550e8400-description.txt",
    "audio": "/output/results/550e8400-narration.mp3",
    "json": "/output/results/550e8400-metadata.json"
  },
  "sizes": {
    "text": 15240,
    "audio": 2456320,
    "json": 4896
  }
}
```

---

### 6. voice_description_health_check

**Purpose:** Check API health and system status

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| include_details | boolean | ❌ | false | Include detailed status |

**Example Request:**
```json
{
  "tool": "voice_description_health_check",
  "arguments": {
    "include_details": true
  }
}
```

**Example Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "response_time": "15ms",
  "checks": {
    "server": "healthy",
    "aws_services": "healthy",
    "job_manager": {
      "status": "healthy",
      "active_jobs": 5,
      "completed_jobs": 150
    }
  }
}
```

---

### 7. voice_description_aws_status

**Purpose:** Check AWS service status and quotas

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| services | array | ❌ | ["all"] | Services to check (s3/rekognition/bedrock/polly/all) |

**Example Request:**
```json
{
  "tool": "voice_description_aws_status",
  "arguments": {
    "services": ["rekognition", "polly"]
  }
}
```

---

### 8. voice_description_process_video_url

**Purpose:** Process a video from an S3 URL

**Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| s3_uri | string | ✅ | - | S3 URI (s3://bucket/key) |
| options | object | ❌ | - | Processing options |

**Example Request:**
```json
{
  "tool": "voice_description_process_video_url",
  "arguments": {
    "s3_uri": "s3://my-bucket/videos/demo.mp4",
    "options": {
      "title": "Demo Video",
      "language": "en",
      "voice_id": "Matthew"
    }
  }
}
```

## Common Workflows

### Complete Video Processing Workflow

```python
# 1. Upload video
response = call_tool("voice_description_upload_video", {
    "file_path": "/videos/demo.mp4",
    "title": "Product Demo",
    "detail_level": "comprehensive"
})
job_id = response["job_id"]

# 2. Check status
status = call_tool("voice_description_check_status", {
    "job_id": job_id,
    "job_type": "video",
    "wait_for_completion": True,
    "timeout": 600
})

# 3. Download results
results = call_tool("voice_description_download_results", {
    "job_id": job_id,
    "format": "all",
    "save_to": "/output"
})
```

### Batch Image Processing Workflow

```python
# 1. Process multiple images
response = call_tool("voice_description_batch_images", {
    "images": [
        {"path": f"/images/img{i}.jpg", "id": f"img-{i:03d}"}
        for i in range(1, 11)
    ],
    "options": {
        "detail_level": "basic",
        "generate_audio": True
    },
    "parallel": True,
    "max_concurrent": 5
})

# 2. Get results
for result in response["results"]:
    print(f"{result['image_id']}: {result['description']}")
```

### Health Monitoring Workflow

```python
# Check system health
health = call_tool("voice_description_health_check", {
    "include_details": True
})

if health["status"] != "healthy":
    # Check AWS services
    aws_status = call_tool("voice_description_aws_status", {
        "services": ["all"]
    })
    
    # Log issues
    for service, status in aws_status.items():
        if status != "available":
            print(f"Service {service} is {status}")
```

## Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| INVALID_PARAMETERS | Invalid input parameters | ❌ |
| FILE_TOO_LARGE | File exceeds size limit | ❌ |
| UNSUPPORTED_FORMAT | File format not supported | ❌ |
| API_UNAVAILABLE | API service unavailable | ✅ |
| API_RATE_LIMITED | Rate limit exceeded | ✅ |
| JOB_FAILED | Processing job failed | ❌ |
| JOB_TIMEOUT | Job exceeded timeout | ❌ |
| JOB_NOT_FOUND | Job ID not found | ❌ |

## Rate Limits

- **Video Upload:** 10 requests per minute
- **Image Processing:** 100 requests per minute
- **Batch Processing:** 20 batches per minute
- **Status Checks:** 300 requests per minute
- **Download Results:** 60 requests per minute

## Best Practices

1. **Use Batch Processing** for multiple images instead of individual requests
2. **Enable Polling** with `wait_for_completion` for long-running jobs
3. **Handle Rate Limits** with exponential backoff
4. **Validate File Paths** before sending requests
5. **Use Appropriate Detail Levels** to optimize processing time
6. **Cache Results** when possible to avoid redundant processing
7. **Monitor Health** regularly to detect issues early
8. **Clean Up Temporary Files** after downloading results

## Supported File Formats

### Video Formats
- MP4 (.mp4)
- MPEG (.mpeg, .mpg)
- QuickTime (.mov)
- AVI (.avi)
- WebM (.webm)

### Image Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- GIF (.gif)
- BMP (.bmp)

## Voice Options (AWS Polly)

### English Voices
- Joanna (Female, Neural)
- Matthew (Male, Neural)
- Salli (Female, Standard)
- Joey (Male, Standard)

### Other Languages
- Spanish: Lucia, Enrique
- French: Lea, Mathieu
- German: Vicki, Hans
- Japanese: Mizuki, Takumi
- Chinese: Zhiyu

## Support

For issues or questions about the MCP tools:
- Documentation: `/docs/mcp-tools`
- API Status: `voice_description_health_check`
- AWS Status: `voice_description_aws_status`