# OpenAI Pipeline Architecture Documentation

## Overview

The Voice Description API now supports a complete OpenAI processing pipeline as an alternative to the AWS pipeline. This architecture provides superior quality for smaller files, faster processing times, and advanced AI capabilities through OpenAI's Vision API.

## Architecture Components

### 1. Pipeline Selector (`src/orchestrator/pipelineSelector.ts`)

Intelligent routing system that automatically selects the optimal pipeline based on:
- File size and duration
- Content type (video/image)
- User preferences
- Cost/quality requirements

**Key Features:**
- Auto-selection algorithm
- Manual override support
- Validation and recommendations
- Cost/time estimates

### 2. OpenAI Image Analysis Module (`src/modules/openaiImageAnalysis.ts`)

Direct integration with OpenAI Vision API for image processing:

**Capabilities:**
- **Multiple Description Formats:**
  - Alt text (accessibility, 125 chars)
  - Detailed description (comprehensive)
  - SEO description (search optimized)
  
- **Batch Processing:**
  - Parallel API calls with rate limiting
  - Automatic retry with exponential backoff
  - Token usage tracking

- **Advanced Analysis:**
  - Visual element detection
  - Color analysis
  - Composition assessment
  - Image type classification

### 3. Video Chunking Module (`src/modules/videoChunking.ts`)

Handles videos larger than OpenAI's 25MB limit:

**Features:**
- **Smart Chunking:**
  - Scene-based segmentation
  - Optimal chunk size calculation
  - Keyframe alignment
  - Overlap management

- **Processing Strategies:**
  - Fixed duration chunks
  - Scene-aware chunks
  - Adaptive chunking based on content

### 4. OpenAI Video Analysis Module (`src/modules/openaiVideoAnalysis.ts`)

Processes video chunks through Vision API:

**Capabilities:**
- Concurrent chunk analysis
- Frame extraction and analysis
- Contextual understanding
- Token optimization

### 5. Description Synthesis Module (`src/modules/descriptionSynthesis.ts`)

Combines multiple analyses into cohesive descriptions:

**Output Formats:**
- **Narrative:** Story-like flow
- **Timestamped:** Scene-by-scene breakdown
- **Technical:** Detailed analysis
- **Accessibility:** Screen reader optimized

**Additional Features:**
- Key moment extraction
- Chapter generation
- Highlight detection
- Metadata aggregation

### 6. Unified Pipeline Orchestrator (`src/orchestrator/unifiedPipelineOrchestrator.ts`)

Central coordinator for all pipelines:

**Responsibilities:**
- Pipeline execution management
- Job status tracking
- Error handling and recovery
- Cost tracking

## Pipeline Types

### 1. OpenAI Pipeline

**Best For:**
- Small videos (< 25MB)
- Short duration (< 3 minutes)
- High-priority content
- Quality-critical projects

**Process Flow:**
```
Upload → Chunking → OpenAI Analysis → Synthesis → TTS (Polly) → Output
```

### 2. AWS Pipeline

**Best For:**
- Large videos (> 25MB)
- Long-form content
- Batch processing
- Cost-sensitive projects

**Process Flow:**
```
Upload → Rekognition → Scene Extraction → Bedrock → Compilation → Polly → Output
```

### 3. Hybrid Pipeline

**Best For:**
- Medium-sized videos
- Mixed complexity content
- Balance of speed and cost
- Enterprise workloads

**Process Flow:**
```
Upload → AWS Segmentation → Smart Chunking → OpenAI Analysis → Synthesis → Polly → Output
```

## API Endpoints

### Enhanced Endpoints

#### 1. `/api/upload-enhanced`
```typescript
POST /api/upload-enhanced
Content-Type: multipart/form-data

Parameters:
- video: File
- pipeline?: 'openai' | 'aws' | 'hybrid'
- openaiOptions?: {
    customPrompt?: {
      altText?: string
      detailed?: string
      seo?: string
    }
    detail?: 'low' | 'high' | 'auto'
  }
- chunkingOptions?: {
    targetChunkSize?: number
    maxChunkDuration?: number
    sceneDetection?: boolean
  }
- synthesisOptions?: {
    targetLength?: number
    format?: 'narrative' | 'technical' | 'accessibility'
  }
```

#### 2. `/api/process-image-enhanced`
```typescript
POST /api/process-image-enhanced
Content-Type: multipart/form-data

Parameters:
- image: File
- pipeline?: 'openai' | 'aws'
- detailLevel?: 'basic' | 'comprehensive' | 'technical'
- openaiOptions?: OpenAIImageAnalysisOptions
```

#### 3. `/api/pipelines/compare`
```typescript
GET /api/pipelines/compare
// Returns pipeline statistics and recommendations

POST /api/pipelines/compare
{
  "fileSize": 10485760,  // bytes
  "duration": 120,        // seconds
  "fileType": "video/mp4",
  "priority": "high"
}
// Returns personalized pipeline recommendation
```

#### 4. `/api/status/enhanced/[jobId]`
```typescript
GET /api/status/enhanced/{jobId}
// Returns enhanced job status with pipeline details
```

## Configuration

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...
OPENAI_VISION_MODEL=gpt-4-vision-preview
OPENAI_MAX_VIDEO_SIZE_MB=25
OPENAI_MAX_DURATION_SECONDS=180
OPENAI_CHUNK_SIZE_MB=20
OPENAI_CHUNK_DURATION_SECONDS=30
OPENAI_CONCURRENT_ANALYSES=3
OPENAI_BATCH_SIZE=3
OPENAI_MAX_RETRIES=3
OPENAI_RPM=50  # Requests per minute
OPENAI_TPM=40000  # Tokens per minute

# Pipeline Configuration
DEFAULT_PIPELINE=aws
IMAGE_PROCESSING_TIMEOUT_MINUTES=5

# AWS Configuration (still required for storage and TTS)
AWS_REGION=us-east-1
INPUT_S3_BUCKET=voice-description-api-input
OUTPUT_S3_BUCKET=voice-description-api-output
POLLY_VOICE_ID=Joanna
```

## Cost Optimization

### Token Usage Optimization

1. **Smart Prompting:**
   - Concise, focused prompts
   - Reusable prompt templates
   - Context-aware prompt selection

2. **Chunking Strategy:**
   - Optimal chunk sizes to minimize API calls
   - Scene-based chunking to avoid redundancy
   - Keyframe extraction vs full video

3. **Caching:**
   - Cache frequently analyzed content
   - Store intermediate results
   - Reuse common descriptions

### Pipeline Selection Strategy

```javascript
// Automatic pipeline selection logic
if (fileSize < 10MB && duration < 60s) {
  // Use OpenAI for best quality
  return 'openai';
} else if (fileSize > 100MB || duration > 300s) {
  // Use AWS for large files
  return 'aws';
} else {
  // Use hybrid for balanced approach
  return 'hybrid';
}
```

## Error Handling

### Retry Logic

All OpenAI modules implement exponential backoff:

```typescript
const retryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  exponentialBase: 2,
};
```

### Fallback Strategies

1. **Pipeline Fallback:**
   - If OpenAI fails → fallback to AWS
   - If hybrid fails → fallback to AWS
   - Maintain job continuity

2. **Partial Processing:**
   - Continue with successful chunks
   - Mark failed segments
   - Provide partial results

## Performance Metrics

### Expected Processing Times

| Content Type | File Size | OpenAI | AWS | Hybrid |
|-------------|-----------|---------|-----|---------|
| Image | < 5MB | 5-10s | 10-15s | N/A |
| Video | < 25MB | 1-2 min | 3-5 min | 2-3 min |
| Video | 25-100MB | N/A | 5-10 min | 4-7 min |
| Video | > 100MB | N/A | 10-30 min | N/A |

### Token Usage Estimates

| Content Type | Tokens per Unit |
|-------------|----------------|
| Image Analysis | 500-1,500 |
| Video per Minute | 5,000-10,000 |
| Synthesis | 1,000-2,000 |

## Testing

### Unit Tests

```bash
# Test individual modules
npm test src/modules/openaiImageAnalysis.test.ts
npm test src/modules/videoChunking.test.ts
npm test src/orchestrator/pipelineSelector.test.ts
```

### Integration Tests

```bash
# Test pipeline end-to-end
npm test tests/integration/openai-pipeline.test.ts
npm test tests/integration/hybrid-pipeline.test.ts
```

### Load Testing

```bash
# Test concurrent processing
npm run test:load -- --pipeline=openai --concurrent=10
```

## Monitoring

### Key Metrics to Track

1. **Performance:**
   - Processing time per pipeline
   - Token usage per job
   - API response times
   - Error rates

2. **Cost:**
   - Tokens consumed
   - API calls made
   - Cost per minute of content
   - Pipeline cost comparison

3. **Quality:**
   - Confidence scores
   - User feedback
   - Description accuracy
   - Accessibility compliance

## Migration Guide

### Updating Existing Integrations

1. **Minimal Changes (Backward Compatible):**
   ```javascript
   // Existing code continues to work
   POST /api/upload
   ```

2. **Opt-in to New Features:**
   ```javascript
   // Add pipeline parameter
   POST /api/upload-enhanced
   {
     "pipeline": "openai",
     ...
   }
   ```

3. **Gradual Migration:**
   - Start with image processing
   - Test with small videos
   - Monitor costs and quality
   - Expand usage based on results

## Best Practices

### 1. Content-Based Selection
- Use OpenAI for marketing videos
- Use AWS for documentaries
- Use hybrid for varied content

### 2. Cost Management
- Set token budgets
- Monitor usage patterns
- Implement usage alerts
- Cache common analyses

### 3. Quality Assurance
- Review generated descriptions
- Validate accessibility compliance
- Test with screen readers
- Gather user feedback

### 4. Performance Optimization
- Pre-process large files
- Implement queueing for batch jobs
- Use webhooks for async processing
- Optimize chunk sizes

## Troubleshooting

### Common Issues

1. **OpenAI Rate Limiting:**
   - Solution: Adjust OPENAI_RPM and OPENAI_TPM
   - Implement request queuing
   - Use exponential backoff

2. **Large File Processing:**
   - Solution: Use chunking module
   - Consider hybrid pipeline
   - Implement progress tracking

3. **Token Budget Exceeded:**
   - Solution: Optimize prompts
   - Reduce detail level
   - Use AWS for large files

4. **Inconsistent Descriptions:**
   - Solution: Use temperature=0.3
   - Implement validation
   - Use synthesis module

## Future Enhancements

### Planned Features

1. **Advanced Caching:**
   - Redis integration
   - Smart cache invalidation
   - Cross-job deduplication

2. **Custom Models:**
   - Fine-tuned models for specific domains
   - Industry-specific prompts
   - Language-specific optimizations

3. **Real-time Processing:**
   - WebSocket support
   - Streaming responses
   - Progressive enhancement

4. **Analytics Dashboard:**
   - Usage statistics
   - Cost tracking
   - Quality metrics
   - Performance monitoring

## Support

For questions or issues with the OpenAI pipeline:

1. Check environment variables
2. Verify API key validity
3. Review error logs
4. Test with pipeline comparison endpoint
5. Contact support with job ID and error details