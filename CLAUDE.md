# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Voice Description API - An automated video audio description system that generates descriptive audio narration tracks for videos to improve accessibility for visually impaired audiences. The system leverages AWS AI services (Rekognition, Bedrock Nova Pro, Polly) in a modular, test-driven Node.js architecture.

## Project Structure

```
voiceDescriptionAPI/
├── src/
│   ├── modules/           # Core processing modules
│   │   ├── videoInput.js          # S3 upload and file handling
│   │   ├── videoSegmentation.js   # Rekognition scene detection
│   │   ├── sceneExtraction.js     # FFmpeg video segmentation
│   │   ├── sceneAnalysis.js       # Bedrock Nova Pro analysis
│   │   ├── descriptionCompilation.js # Text aggregation
│   │   └── textToSpeech.js        # Polly TTS synthesis
│   ├── orchestrator/      # Workflow coordination
│   │   └── jobManager.js          # Job lifecycle management
│   └── utils/            # Shared utilities
├── pages/api/            # Next.js API routes
├── components/           # React UI components
├── tests/               # Jest test files
├── docs/                # Additional documentation
├── TECHNICAL_SPECIFICATION.md
├── AWS_SETUP_GUIDE.md
└── IMPLEMENTATION_PLAN.md
```

## Development Commands

```bash
# Project setup
npm install                 # Install dependencies
npm run build              # Build production bundle
npm run dev                # Start development server
npm run test               # Run test suite
npm run test:watch         # Run tests in watch mode
npm run lint               # Run ESLint
npm run typecheck          # Run TypeScript checks

# AWS deployment
./scripts/deploy.sh        # Deploy to production
./scripts/setup-aws.sh     # Configure AWS resources
```

## Architecture Overview

### Core AWS Services
- **Amazon S3**: Video storage (input/output buckets)
- **Amazon Rekognition**: Video scene/shot segmentation
- **Amazon Bedrock (Nova Pro)**: AI scene analysis and description
- **Amazon Polly**: Text-to-speech synthesis
- **CloudWatch**: Logging and monitoring

### Processing Pipeline
1. Video upload → S3 storage
2. Rekognition scene segmentation
3. FFmpeg scene extraction
4. Bedrock Nova Pro analysis per scene
5. Description compilation and formatting
6. Polly text-to-speech synthesis
7. Output delivery (text + audio)

### Modular Design Principles
- Each module is independently testable with AWS SDK mocking
- Test-Driven Development (TDD) approach throughout
- Comprehensive error handling and retry logic
- Progress tracking and status updates
- Resource cleanup and memory management

## Test-Driven Development Approach

### Testing Strategy
- **Unit Tests**: Mock AWS services for isolated module testing
- **Integration Tests**: End-to-end pipeline with small test videos
- **Coverage Target**: >90% code coverage across all modules

### Running Tests
```bash
npm run test              # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:coverage     # Coverage report
```

### Writing Tests (Follow TDD)
1. Write failing test first
2. Implement minimal code to pass
3. Refactor and optimize
4. Repeat for each feature

Example test structure:
```javascript
// tests/modules/videoInput.test.js
describe('Video Input Module', () => {
  beforeEach(() => {
    mockS3.mockClear();
  });
  
  test('should upload video to S3 with correct parameters', async () => {
    // Test implementation
  });
});
```

## AWS Configuration

### Required Environment Variables
```bash
AWS_REGION=us-east-1
INPUT_S3_BUCKET=voice-desc-input-bucket
OUTPUT_S3_BUCKET=voice-desc-output-bucket
NOVA_MODEL_ID=amazon.nova-pro-v1:0
POLLY_VOICE_ID=Joanna
MAX_VIDEO_SIZE_MB=500
PROCESSING_TIMEOUT_MINUTES=30
```

### IAM Permissions Required
- S3: GetObject, PutObject, DeleteObject
- Rekognition: StartSegmentDetection, GetSegmentDetection
- Bedrock: InvokeModel (Nova Pro access)
- Polly: SynthesizeSpeech
- CloudWatch: CreateLogGroup, PutLogEvents

## API Endpoints

### Core Processing
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
  "message": "Analyzing scene 3 of 5"
}
```

## Development Workflow

### Daily Development Cycle
1. **TDD Implementation**: Write tests first, then code
2. **Module Development**: Focus on one module at a time
3. **Integration Testing**: Test module interactions
4. **Documentation**: Update as you build

### Key Development Practices
- Always mock AWS services in unit tests
- Use comprehensive error handling
- Implement retry logic with exponential backoff
- Clean up temporary resources
- Log important events for debugging

## Module Implementation Guidelines

### Video Input Module (`src/modules/videoInput.js`)
- Handle multipart file uploads
- Stream large files to S3
- Validate file formats and sizes
- Support direct S3 URI input

### Video Segmentation Module (`src/modules/videoSegmentation.js`)
- Async Rekognition job management
- Polling with exponential backoff
- Segment result parsing and pagination
- Timeout and error handling

### Scene Extraction Module (`src/modules/sceneExtraction.js`)
- FFmpeg integration for video cutting
- Temporary file management
- Parallel processing with limits
- Resource cleanup on completion/failure

### Scene Analysis Module (`src/modules/sceneAnalysis.js`)
- Bedrock Nova Pro API integration
- Base64 video encoding
- Retry logic for rate limiting
- Response parsing and text cleanup

### Description Compilation Module (`src/modules/descriptionCompilation.js`)
- Scene description aggregation
- Timestamp formatting
- Text post-processing and cleanup
- Multiple output format generation

### Text-to-Speech Module (`src/modules/textToSpeech.js`)
- Polly API integration
- Text chunking for length limits
- Audio streaming and file generation
- Voice configuration management

## Deployment Strategy

### Docker Deployment
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

### Production Considerations
- Use IAM roles instead of access keys
- Enable CloudWatch monitoring
- Configure proper security groups
- Set up SSL/TLS termination
- Implement rate limiting

## Error Handling Patterns

### Retry Logic Template
```javascript
async function retryWithBackoff(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Error Response Format
```json
{
  "error": true,
  "message": "User-friendly error message",
  "details": "Technical error details",
  "jobId": "uuid",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Performance Optimization

### Memory Management
- Stream large files instead of loading into memory
- Clean up temporary files immediately after use
- Use connection pooling for AWS services
- Implement graceful degradation under load

### AWS Service Optimization
- Use appropriate instance types for FFmpeg processing
- Batch operations where possible
- Monitor service quotas and limits
- Implement circuit breakers for failing services

## Security Best Practices

### Input Validation
- Validate file types and sizes
- Sanitize user inputs
- Check S3 URI formats and permissions
- Implement rate limiting per IP/user

### AWS Security
- Use least-privilege IAM policies
- Never hardcode credentials
- Use VPC endpoints for service access
- Enable CloudTrail for audit logging

## Troubleshooting Guide

### Common Issues
- **FFmpeg not found**: Ensure FFmpeg is installed in container
- **AWS permissions**: Check IAM policies match required permissions
- **Bedrock access**: Verify Nova Pro model access is approved
- **S3 upload fails**: Check bucket policies and CORS configuration
- **Processing timeout**: Adjust timeout values for longer videos

### Debug Commands
```bash
# Check AWS connectivity
aws sts get-caller-identity

# Test S3 access
aws s3 ls s3://your-input-bucket

# Verify Bedrock access
aws bedrock list-foundation-models --region us-east-1

# Check application logs
docker logs container-name -f
```

## Important Notes

- Always follow TDD: write tests before implementation
- Mock all AWS services in unit tests to avoid costs
- Use the IMPLEMENTATION_PLAN.md for structured development
- Refer to TECHNICAL_SPECIFICATION.md for detailed architecture
- Follow AWS_SETUP_GUIDE.md for infrastructure setup
- Clean up AWS resources after testing to control costs
- Monitor CloudWatch for performance and error metrics

## Support Documentation

- **Technical Specification**: See `TECHNICAL_SPECIFICATION.md`
- **AWS Setup Guide**: See `AWS_SETUP_GUIDE.md`  
- **Implementation Plan**: See `IMPLEMENTATION_PLAN.md`
- **API Documentation**: Generated from code comments
- **AWS Service Documentation**: https://docs.aws.amazon.com/
