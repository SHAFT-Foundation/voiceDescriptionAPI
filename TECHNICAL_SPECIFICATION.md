# Voice Description API - Technical Specification

## Project Overview

An automated video audio description system that generates descriptive audio narration tracks for videos to improve accessibility for visually impaired audiences. The system leverages AWS AI services in a modular, test-driven architecture.

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

## System Architecture

```
[User Upload] → [S3 Storage] → [Rekognition Segmentation] → [Scene Extraction] 
    ↓
[Nova Pro Analysis] → [Description Compilation] → [Polly TTS] → [Audio Output]
```

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
- Real-time progress polling
- Result download interface

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

## API Endpoints

### Core Processing Endpoints
- `POST /api/upload` - Video file upload
- `POST /api/process` - Start processing with S3 URI
- `GET /api/status/:jobId` - Job status polling
- `GET /api/results/:jobId/text` - Download text description
- `GET /api/results/:jobId/audio` - Download audio file

### Status Response Format
```json
{
  "jobId": "uuid",
  "status": "processing|completed|failed",
  "step": "segmentation|analysis|synthesis",
  "progress": 65,
  "message": "Analyzing scene 3 of 5",
  "results": {
    "textUrl": "/api/results/uuid/text",
    "audioUrl": "/api/results/uuid/audio"
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