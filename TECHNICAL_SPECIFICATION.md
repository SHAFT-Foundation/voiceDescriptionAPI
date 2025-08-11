# Voice Description API - Technical Specification

## Project Overview

An automated video audio description system that generates descriptive audio narration tracks for videos to improve accessibility for visually impaired audiences. The system offers **two processing approaches**:

1. **AWS Pipeline**: Detailed scene-by-scene analysis using Rekognition + Bedrock Nova Pro
2. **OpenAI Pipeline**: Fast holistic video analysis using OpenAI Vision API + AWS Polly TTS

Both approaches use a modular, test-driven architecture with the same API interface.

## Core AWS Services Architecture

### Primary Services
- **Amazon S3**: Video storage (input/output buckets) and static file hosting
- **Amazon Rekognition**: Video scene/shot segmentation and boundary detection
- **Amazon Bedrock (Nova Pro)**: Multimodal AI scene analysis and description generation
- **Amazon Polly**: Text-to-speech synthesis for audio narration

### Supporting Services
- **AWS IAM**: Service permissions and access control
- **AWS CloudWatch**: Logging and monitoring
- **AWS SDK for JavaScript**: Service integration

## Processing Pipeline Architectures

### Option 1: AWS Pipeline (Scene-by-Scene Analysis)
```
[User Upload] → [S3 Storage] → [Rekognition Segmentation] → [Scene Extraction] 
    ↓
[Nova Pro Analysis] → [Description Compilation] → [Polly TTS] → [Audio Output]
```

### Option 2: OpenAI Pipeline (Holistic Analysis)
```
[User Upload] → [Video Chunking (25MB)] → [OpenAI Vision API] → [AWS Polly TTS] → [Audio Output]
```

## Processing Approach Comparison

### Video Processing

| Feature | AWS Pipeline | OpenAI Pipeline |
|---------|-------------|----------------|
| **Speed** | 5-10 minutes | **⚡ 30-60 seconds** |
| **Analysis Detail** | **Scene-by-scene granular** | Holistic video understanding |
| **File Size Limit** | 500MB+ | **25MB chunks (auto-handled)** |
| **Architecture Complexity** | Complex multi-step | **Simple single API call** |
| **Cost per Video** | $0.50-1.00 | $2.00-5.00 |
| **Dependencies** | FFmpeg + 4 AWS services | **OpenAI + Polly only** |
| **Best For** | Long videos, detailed analysis | **Quick turnaround, speed priority** |

### Image Processing

| Feature | AWS Pipeline | OpenAI Pipeline |
|---------|-------------|----------------|
| **Speed** | 10-30 seconds per image | **⚡ 2-5 seconds per image** |
| **Batch Speed** | 1,000 images/hour | **⚡ 5,000+ images/hour** |
| **Analysis Quality** | Rekognition + Bedrock | **GPT-4 Vision (superior context)** |
| **File Size Limit** | 15MB per image | **No chunking needed** |
| **Cost per Image** | $0.10-0.25 | $0.25-0.50 |
| **Context Understanding** | Good | **⭐ Exceptional** |
| **Best For** | Cost optimization | **Speed + quality priority** |

## Recommended Usage Strategy
- **OpenAI Pipeline**: 
  - **Videos**: <5 minutes, urgent delivery, content marketing
  - **Images**: All use cases where speed matters, superior context understanding
- **AWS Pipeline**: 
  - **Videos**: >5 minutes, detailed analysis, cost optimization  
  - **Images**: High-volume cost-sensitive processing

## Technical Stack

- **Backend**: Node.js with Express/Next.js API routes
- **Frontend**: React with Next.js
- **Video Processing**: FFmpeg (via fluent-ffmpeg)
- **Testing**: Jest with AWS SDK mocking
- **Deployment**: Docker container on single VM

## Module Architecture

### 1. Video Input & Storage Module
**Purpose**: Handle video uploads and S3 storage
**Key Components**:
- File upload handling (multipart/form-data)
- S3 upload with streaming for large files
- Direct S3 URI input support
- Upload validation and error handling

**AWS Services**: S3 (PutObject, upload streams)

### 2. Video Segmentation Module  
**Purpose**: Detect scene boundaries using Rekognition
**Key Components**:
- StartSegmentDetection API integration
- Asynchronous job polling with GetSegmentDetection
- Segment result parsing and pagination handling
- Job status tracking and timeout management

**AWS Services**: Rekognition Video (StartSegmentDetection, GetSegmentDetection)

### 3. Scene Extraction Module
**Purpose**: Extract video segments based on timestamps
**Key Components**:
- FFmpeg integration for precise video cutting
- Temporary file management and cleanup
- Parallel processing capability (configurable)
- Error handling for invalid timestamps

**Dependencies**: FFmpeg, fluent-ffmpeg library

### 4. Scene Analysis Module
**Purpose**: Generate scene descriptions using Nova Pro
**Key Components**:
- Base64 video encoding for Bedrock API
- Nova Pro model invocation (amazon.nova-pro-v1:0)
- Retry logic with exponential backoff
- Response parsing and text cleanup

**AWS Services**: Bedrock (InvokeModel with Nova Pro)

### 5. Description Compilation Module
**Purpose**: Aggregate scene descriptions into coherent text
**Key Components**:
- Timestamp-ordered compilation
- Text formatting and cleanup
- Removal of repetitive AI-generated phrases
- Multiple output formats (timestamped/clean)

### 6. Text-to-Speech Synthesis Module
**Purpose**: Convert text to audio using Polly
**Key Components**:
- Voice selection and configuration
- Large text chunking (3000 char limit handling)
- Audio streaming and MP3 generation
- Retry logic for rate limiting

**AWS Services**: Polly (SynthesizeSpeech)

### 7. Backend Orchestration Module
**Purpose**: Coordinate all modules in processing pipeline
**Key Components**:
- Job ID generation and tracking
- Progress status updates
- Asynchronous processing workflow
- Error recovery and cleanup

### 8. Frontend UI Module
**Purpose**: User interface for video upload and result download
**Key Components**:
- File upload form with validation
- S3 URI input option
- Processing pipeline selection (AWS vs OpenAI)
- Real-time progress polling
- Result download interface

## OpenAI Pipeline Modules

### 9. Video Chunking Module
**Purpose**: Split large videos into 25MB chunks for OpenAI API
**Key Components**:
- FFmpeg-based video segmentation by file size
- Temporal chunk management (maintains video continuity)
- Metadata preservation across chunks
- Parallel chunk processing capability

**Dependencies**: FFmpeg, file-size calculation

### 10. OpenAI Vision Analysis Module
**Purpose**: Generate video descriptions using OpenAI Vision API
**Key Components**:
- OpenAI API integration with video support
- Base64 video encoding for API submission
- Retry logic with exponential backoff
- Response aggregation from multiple chunks
- Context preservation across video segments

**External Services**: OpenAI Vision API (GPT-4 Vision or similar)

### 11. Description Synthesis Module
**Purpose**: Combine multi-chunk OpenAI responses into coherent description
**Key Components**:
- Chronological response ordering
- Context bridging between chunks
- Duplicate content removal
- Narrative flow optimization
- Single coherent description output

### 12. OpenAI Image Analysis Module  
**Purpose**: Ultra-fast image description using OpenAI Vision API
**Key Components**:
- Direct image upload to OpenAI Vision API (no chunking needed)
- Context-aware image understanding (product, medical, educational)
- Multiple description formats (alt-text, detailed, SEO-optimized)
- Batch processing with parallel API calls
- Custom prompt engineering for different use cases

**External Services**: OpenAI Vision API (GPT-4 Vision)

### 13. Image Batch Coordinator Module
**Purpose**: Manage high-volume image processing with both pipelines
**Key Components**:
- Pipeline selection per image (OpenAI vs AWS)
- Parallel processing with rate limiting
- Progress tracking across thousands of images
- Error handling and retry logic
- Result aggregation and formatting

## AWS IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::your-input-bucket/*",
        "arn:aws:s3:::your-output-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "rekognition:StartSegmentDetection",
        "rekognition:GetSegmentDetection"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0"
    },
    {
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech"
      ],
      "Resource": "*"
    }
  ]
}
```

## Environment Configuration

### Required Environment Variables

#### AWS Pipeline Configuration
```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_DEFAULT_REGION=us-east-1
INPUT_S3_BUCKET=your-input-bucket
OUTPUT_S3_BUCKET=your-output-bucket
NOVA_MODEL_ID=amazon.nova-pro-v1:0
POLLY_VOICE_ID=Joanna
MAX_VIDEO_SIZE_MB=500
PROCESSING_TIMEOUT_MINUTES=30
```

#### OpenAI Pipeline Configuration
```bash
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-vision-preview
OPENAI_MAX_TOKENS=4000
CHUNK_SIZE_MB=25
CHUNK_OVERLAP_SECONDS=2
OPENAI_TIMEOUT_MINUTES=5
```

#### Processing Pipeline Selection
```bash
DEFAULT_PIPELINE=aws          # Options: 'aws' or 'openai'
ENABLE_PIPELINE_SELECTION=true
AUTO_PIPELINE_SELECTION=true  # Auto-select based on video size/duration
```

## API Endpoints

### Core Processing Endpoints
- `POST /api/upload` - Video file upload with optional pipeline selection
- `POST /api/process` - Start processing with S3 URI and pipeline choice
- `GET /api/status/:jobId` - Job status polling
- `GET /api/results/:jobId/text` - Download text description
- `GET /api/results/:jobId/audio` - Download audio file

### New Pipeline Selection Parameters
```json
// POST /api/upload or /api/process
{
  "pipeline": "aws|openai|auto",     // Processing pipeline choice
  "chunkSize": 25,                   // MB per chunk (OpenAI pipeline only)
  "fastMode": true                   // Prefer speed over detail
}
```

### Updated Status Response Format
```json
{
  "jobId": "uuid",
  "status": "processing|completed|failed",
  "pipeline": "aws|openai",
  "step": "segmentation|analysis|synthesis|chunking|vision_analysis",
  "progress": 65,
  "message": "Analyzing chunk 2 of 4 with OpenAI Vision",
  "processingTime": 45,              // seconds elapsed
  "estimatedTimeRemaining": 30,      // seconds (OpenAI pipeline)
  "results": {
    "textUrl": "/api/results/uuid/text",
    "audioUrl": "/api/results/uuid/audio",
    "pipeline": "openai",
    "chunks": 4                       // for OpenAI pipeline
  }
}
```

## Test-Driven Development Approach

### Unit Test Coverage
- **Video Input**: S3 upload mocking, file validation
- **Segmentation**: Rekognition API mocking, polling logic
- **Extraction**: FFmpeg mocking, file operations
- **Analysis**: Bedrock mocking, retry mechanisms
- **Compilation**: Text processing, formatting
- **Synthesis**: Polly mocking, chunking logic
- **Orchestration**: Module coordination, status tracking

### Integration Testing
- End-to-end pipeline with small test video
- AWS service connectivity verification
- Error handling and recovery scenarios

## Deployment Architecture

### Docker Configuration
```dockerfile
FROM node:18-bullseye
RUN apt-get update && apt-get install -y ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### VM Requirements
- **OS**: Ubuntu 20.04 LTS or similar
- **CPU**: 2+ cores (for FFmpeg processing)
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 20GB+ (for temporary video files)
- **Network**: Stable internet for AWS API calls

## Security Considerations

### AWS Credentials
- Use IAM roles when possible (EC2 instance roles)
- Minimum required permissions only
- No hardcoded credentials in code
- Environment variable injection at runtime

### Data Handling
- Temporary file cleanup after processing
- Input validation and file size limits
- No persistent storage of user videos (optional retention)
- HTTPS in production deployment

## Performance Optimization

### Processing Efficiency
- Parallel scene extraction (configurable concurrency)
- Streaming file operations to minimize memory usage
- Retry mechanisms with exponential backoff
- Cleanup of temporary resources

### Scalability Considerations
- Horizontal scaling with load balancer
- Queue-based processing for high volume
- S3 for persistent storage across instances
- CloudWatch monitoring for performance metrics

## Error Handling Strategy

### Graceful Degradation
- Scene-level failure handling (skip bad segments)
- Partial results delivery when possible
- Detailed error logging and user feedback
- Automatic retry with backoff for transient failures

### Common Error Scenarios
- Video format not supported by Rekognition
- Bedrock model rate limiting or availability
- S3 access permissions issues
- FFmpeg processing failures
- Network connectivity problems

## Monitoring and Logging

### CloudWatch Integration
- API request/response metrics
- Processing time and success rates
- Error rate monitoring
- Resource utilization tracking

### Application Logging
- Job processing lifecycle events
- AWS API call successes/failures
- Performance bottleneck identification
- User activity tracking (anonymous)