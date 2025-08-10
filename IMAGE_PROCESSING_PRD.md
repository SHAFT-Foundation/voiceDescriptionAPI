# Image Processing Feature - Product Requirements Document

**Version:** 1.0  
**Date:** 2024-01-10  
**Status:** Planning Phase  

## 1. Executive Summary

This PRD outlines the implementation of image processing capabilities for the Voice Description API, enabling automated accessibility descriptions for static images while preserving the existing video processing functionality. The feature will reuse existing AWS infrastructure and core modules where possible.

## 2. Current Architecture Analysis

### 2.1 Reusable Components ✅
- **SceneAnalysisModule**: Already handles image analysis via base64 encoding
- **TextToSpeechModule**: Converts descriptions to audio (format-agnostic)  
- **DescriptionCompilationModule**: Can format single image descriptions
- **AWS Infrastructure**: S3, Bedrock Nova Pro, Polly support images
- **Utility modules**: Logger, retry logic, error handling

### 2.2 Video-Specific Components (Bypass Required) ❌
- **VideoSegmentationModule**: Rekognition video analysis - not needed for images
- **SceneExtractionModule**: FFmpeg scene extraction - not needed for images
- **VideoInputModule**: Video-specific file validation

### 2.3 New Components Required 🆕
- **ImageInputModule**: Image upload, validation, format detection
- **ImageJobManager**: Simplified workflow orchestration
- **New API endpoints**: Image-specific processing routes

## 3. Feature Requirements

### 3.1 Functional Requirements

#### FR1: Image Input Support
- **FR1.1**: Accept image file uploads (.jpg, .jpeg, .png, .gif, .webp, .bmp)
- **FR1.2**: Accept direct S3 URI references to existing images
- **FR1.3**: Validate image formats and file sizes (max 50MB)
- **FR1.4**: Support batch processing of multiple images

#### FR2: Image Analysis
- **FR2.1**: Generate detailed accessibility descriptions using Bedrock Nova Pro
- **FR2.2**: Produce concise alt-text suitable for HTML alt attributes
- **FR2.3**: Support configurable detail levels (basic, comprehensive, technical)
- **FR2.4**: Extract visual elements, colors, composition details

#### FR3: Audio Generation
- **FR3.1**: Convert image descriptions to professional audio narration
- **FR3.2**: Support same voice options as video processing
- **FR3.3**: Generate audio for both detailed and alt-text descriptions

#### FR4: Output Delivery
- **FR4.1**: Provide structured JSON responses with multiple description formats
- **FR4.2**: Generate HTML-ready accessibility metadata
- **FR4.3**: Support download of audio files and text descriptions

### 3.2 Non-Functional Requirements

#### NFR1: Performance
- **NFR1.1**: Process single images within 15 seconds
- **NFR1.2**: Handle concurrent image processing (up to 10 parallel jobs)
- **NFR1.3**: Support batch processing with progress tracking

#### NFR2: Compatibility
- **NFR2.1**: Must not affect existing video processing functionality
- **NFR2.2**: Maintain backward compatibility with current API
- **NFR2.3**: Use existing AWS infrastructure and credentials

#### NFR3: Quality
- **NFR3.1**: Generate descriptions with >85% accuracy confidence
- **NFR3.2**: Produce natural, accessible language suitable for screen readers
- **NFR3.3**: Handle edge cases (abstract images, charts, technical diagrams)

## 4. API Specification

### 4.1 New Endpoints

#### 4.1.1 POST /api/process-image
Process a single image for accessibility descriptions.

**Request:**
```typescript
interface ImageProcessRequest {
  // File upload OR S3 URI (mutually exclusive)
  image?: File;                    // Multipart file upload
  s3Uri?: string;                  // Direct S3 reference
  
  // Processing options
  options?: {
    detailLevel?: 'basic' | 'comprehensive' | 'technical';
    generateAudio?: boolean;       // Default: true
    includeAltText?: boolean;      // Default: true
    voiceId?: string;              // Polly voice ID
    language?: string;             // Default: 'en'
  };
  
  // Metadata
  metadata?: {
    title?: string;
    description?: string;
    context?: string;              // Additional context for analysis
  };
}
```

**Response:**
```typescript
interface ImageProcessResponse {
  success: boolean;
  data?: {
    jobId: string;
    status: 'processing' | 'completed' | 'failed';
    processingTime?: number;       // seconds
    results?: ImageProcessingResults;
  };
  error?: APIError;
  timestamp: Date;
}

interface ImageProcessingResults {
  // Descriptions
  detailedDescription: string;     // Comprehensive description
  altText: string;                 // Concise alt text
  
  // Analysis details
  visualElements: string[];        // Key visual components
  colors: string[];               // Dominant colors
  composition: string;            // Layout/composition notes
  context: string;                // Inferred context/purpose
  confidence: number;             // Analysis confidence score
  
  // Generated assets
  audioFile?: {
    url: string;
    duration: number;
    format: string;
  };
  
  // HTML integration helpers
  htmlMetadata: {
    altAttribute: string;          // Ready-to-use alt text
    longDescId?: string;           // ID for detailed description
    ariaLabel?: string;            // ARIA label text
    schemaMarkup?: object;         // Schema.org structured data
  };
}
```

#### 4.1.2 POST /api/process-images-batch
Process multiple images in a single request.

**Request:**
```typescript
interface BatchImageProcessRequest {
  images: Array<{
    source: string;                // S3 URI or base64 data URI
    id?: string;                   // Optional client-provided ID
    metadata?: ImageMetadata;
  }>;
  options?: ImageProcessingOptions;
}
```

**Response:**
```typescript
interface BatchImageProcessResponse {
  success: boolean;
  data?: {
    batchId: string;
    totalImages: number;
    status: 'processing' | 'completed' | 'partial' | 'failed';
    results: Array<{
      id?: string;
      jobId: string;
      status: 'completed' | 'failed';
      result?: ImageProcessingResults;
      error?: APIError;
    }>;
  };
  error?: APIError;
  timestamp: Date;
}
```

#### 4.1.3 GET /api/status/image/:jobId
Get processing status for an image job.

**Response:**
```typescript
interface ImageJobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  step: 'upload' | 'analysis' | 'synthesis' | 'completed';
  progress: number;               // 0-100
  message: string;
  processingTime?: number;
  results?: ImageProcessingResults;
  error?: APIError;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.2 Modified Endpoints

#### 4.2.1 GET /api/health
Extended to include image processing capabilities:

```typescript
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    video: ServiceHealth;
    image: ServiceHealth;         // New
    aws: {
      s3: boolean;
      rekognition: boolean;
      bedrock: boolean;
      polly: boolean;
    };
  };
  stats: {
    activeVideoJobs: number;
    activeImageJobs: number;      // New
    totalProcessed: number;
  };
}
```

## 5. Technical Design

### 5.1 New Module: ImageInputModule

```typescript
class ImageInputModule {
  // File validation and upload
  async validateImage(file: File | Buffer): Promise<ValidationResult>
  async uploadImage(request: ImageUploadRequest): Promise<UploadResult>
  async validateS3ImageUri(s3Uri: string): Promise<ValidationResult>
  
  // Format detection and conversion
  private detectImageFormat(buffer: Buffer): string
  private validateImageSize(buffer: Buffer): boolean
}
```

**Supported Formats:**
- JPEG (.jpg, .jpeg) - Most common web format
- PNG (.png) - Transparency support, screenshots
- GIF (.gif) - Animations (first frame analyzed)
- WebP (.webp) - Modern web format
- BMP (.bmp) - Basic bitmap support

### 5.2 Enhanced SceneAnalysisModule

```typescript
class SceneAnalysisModule {
  // Existing method works for images too
  async analyzeSingleScene(scene: ExtractedScene): Promise<APIResponse<SceneAnalysis>>
  
  // New method optimized for images
  async analyzeImage(imageData: ImageData, jobId: string): Promise<APIResponse<ImageAnalysis>>
  
  private constructImageAnalysisPrompt(imageData: ImageData): string
}

interface ImageData {
  jobId: string;
  s3Uri: string;
  localPath?: string;
  metadata?: ImageMetadata;
  options: ImageProcessingOptions;
}

interface ImageAnalysis extends Omit<SceneAnalysis, 'startTime' | 'endTime'> {
  colors: string[];
  composition: string;
  imageType: 'photo' | 'illustration' | 'chart' | 'diagram' | 'text' | 'other';
}
```

### 5.3 Enhanced DescriptionCompilationModule

```typescript
class DescriptionCompilationModule {
  // New method for single image descriptions
  async compileImageDescription(
    analysis: ImageAnalysis, 
    options: ImageProcessingOptions
  ): Promise<APIResponse<CompiledImageDescription>>
  
  // Generate different description formats
  private generateAltText(analysis: ImageAnalysis): string
  private generateDetailedDescription(analysis: ImageAnalysis): string
  private generateTechnicalDescription(analysis: ImageAnalysis): string
}

interface CompiledImageDescription {
  altText: string;
  detailedDescription: string;
  technicalDescription?: string;
  htmlMetadata: HTMLAccessibilityMetadata;
  metadata: {
    confidence: number;
    wordCount: number;
    imageType: string;
    processingTime: number;
  };
}
```

### 5.4 New ImageJobManager

```typescript
class ImageJobManager {
  private imageInput: ImageInputModule;
  private sceneAnalysis: SceneAnalysisModule;
  private descriptionCompilation: DescriptionCompilationModule;
  private textToSpeech: TextToSpeechModule;
  
  async createImageJob(request: ImageProcessRequest): Promise<APIResponse<JobResult>>
  async processImageJob(jobId: string): Promise<APIResponse<JobResult>>
  async processBatchImages(request: BatchImageProcessRequest): Promise<APIResponse<BatchResult>>
  
  // Simplified workflow (no segmentation/extraction steps)
  private async performImageAnalysis(job: ImageProcessingJob): Promise<void>
  private async performDescriptionCompilation(job: ImageProcessingJob): Promise<void>  
  private async performTextToSpeech(job: ImageProcessingJob): Promise<void>
}
```

### 5.5 Unified JobManager Enhancement

```typescript
class JobManager {
  // Existing video processing methods unchanged
  
  // New image processing methods
  async createImageJob(request: ImageProcessRequest): Promise<APIResponse<JobResult>>
  async processImageJob(jobId: string): Promise<APIResponse<JobResult>>
  
  // Enhanced status tracking
  getJobStatus(jobId: string): JobStatus | ImageJobStatus | null
  
  // Type detection for unified job handling
  private determineJobType(jobId: string): 'video' | 'image'
}
```

## 6. Workflow Design

### 6.1 Image Processing Workflow

```
Image Upload/S3 URI
        ↓
   Image Validation
   - Format check
   - Size validation  
   - S3 accessibility
        ↓
   Image Analysis
   - Bedrock Nova Pro
   - Visual element detection
   - Context understanding
        ↓
   Description Compilation  
   - Alt text generation
   - Detailed description
   - HTML metadata
        ↓
   Text-to-Speech (Optional)
   - Audio generation
   - Multiple voice options
        ↓
   Results Delivery
   - JSON response
   - File downloads
   - HTML integration data
```

### 6.2 Comparison: Video vs Image Processing

| Step | Video Processing | Image Processing |
|------|------------------|------------------|
| **Input** | Video file upload | Image file upload |
| **Validation** | VideoInputModule | ImageInputModule |
| **Segmentation** | Rekognition video analysis | ❌ Skip |
| **Extraction** | FFmpeg scene cutting | ❌ Skip |
| **Analysis** | SceneAnalysisModule | SceneAnalysisModule (reused) |
| **Compilation** | DescriptionCompilationModule | DescriptionCompilationModule (enhanced) |
| **TTS** | TextToSpeechModule | TextToSpeechModule (reused) |
| **Output** | Video descriptions + audio | Image descriptions + audio |

## 7. Implementation Tasks

### 7.1 Phase 1: Core Infrastructure (Week 1-2)

#### P1.1: ImageInputModule Implementation
- **Task**: Create `src/modules/imageInput.ts`
- **Dependencies**: None
- **Effort**: 2-3 days
- **Acceptance Criteria**:
  - Validate image formats (.jpg, .png, .gif, .webp, .bmp)
  - File size validation (max 50MB)
  - S3 URI validation
  - Proper error handling and logging

```typescript
// Key methods to implement
class ImageInputModule {
  async uploadImage(request: ImageUploadRequest): Promise<APIResponse<UploadResult>>
  async validateS3ImageUri(s3Uri: string): Promise<APIResponse<ValidationResult>>
  private validateImageFile(file: File | Buffer): APIResponse<void>
  private detectImageFormat(buffer: Buffer): string
}
```

#### P1.2: SceneAnalysisModule Enhancement  
- **Task**: Extend existing module for image support
- **Dependencies**: P1.1 complete
- **Effort**: 2 days
- **Acceptance Criteria**:
  - New `analyzeImage()` method
  - Image-specific prompting for Bedrock
  - Handle various image types (photos, diagrams, charts)

```typescript
// New method to add
async analyzeImage(
  imageData: ImageData, 
  jobId: string
): Promise<APIResponse<ImageAnalysis>>
```

#### P1.3: DescriptionCompilationModule Enhancement
- **Task**: Add image-specific compilation methods
- **Dependencies**: P1.2 complete  
- **Effort**: 1-2 days
- **Acceptance Criteria**:
  - Generate alt text vs detailed descriptions
  - HTML metadata generation
  - Support different detail levels

### 7.2 Phase 2: Job Management (Week 2-3)

#### P2.1: ImageJobManager Creation
- **Task**: Create `src/orchestrator/imageJobManager.ts`
- **Dependencies**: Phase 1 complete
- **Effort**: 3 days
- **Acceptance Criteria**:
  - Simplified workflow (no segmentation/extraction)
  - Progress tracking and status updates
  - Error handling and recovery
  - Integration with existing job storage

#### P2.2: Unified JobManager Enhancement  
- **Task**: Enhance existing `jobManager.ts`
- **Dependencies**: P2.1 complete
- **Effort**: 1 day
- **Acceptance Criteria**:
  - Route jobs to appropriate processors
  - Unified status tracking
  - Backward compatibility maintained

### 7.3 Phase 3: API Endpoints (Week 3-4)

#### P3.1: Core Image Processing Endpoint
- **Task**: Create `pages/api/process-image.ts`
- **Dependencies**: Phase 2 complete
- **Effort**: 2 days
- **Acceptance Criteria**:
  - Handle multipart image uploads
  - Support S3 URI input
  - Proper request validation
  - Response formatting per spec

#### P3.2: Batch Processing Endpoint
- **Task**: Create `pages/api/process-images-batch.ts`  
- **Dependencies**: P3.1 complete
- **Effort**: 2 days
- **Acceptance Criteria**:
  - Process multiple images
  - Progress tracking per image
  - Partial success handling

#### P3.3: Image Status Endpoint
- **Task**: Create `pages/api/status/image/[jobId].ts`
- **Dependencies**: P3.1 complete  
- **Effort**: 1 day
- **Acceptance Criteria**:
  - Return image job status
  - Include processing progress
  - Error state handling

### 7.4 Phase 4: Results & Integration (Week 4-5)

#### P4.1: Results Delivery Endpoints
- **Task**: Create `pages/api/results/image/[jobId]/[type].ts`
- **Dependencies**: Phase 3 complete
- **Effort**: 2 days  
- **Acceptance Criteria**:
  - Download text descriptions
  - Download audio files
  - Serve HTML metadata

#### P4.2: Health Check Enhancement
- **Task**: Update `pages/api/health.ts`
- **Dependencies**: All phases
- **Effort**: 0.5 days
- **Acceptance Criteria**:
  - Include image processing status
  - Show image job statistics
  - Service health monitoring

### 7.5 Phase 5: Testing & Documentation (Week 5-6)

#### P5.1: Unit Tests
- **Task**: Comprehensive test coverage
- **Dependencies**: All implementation complete
- **Effort**: 3 days
- **Test Coverage**:
  - ImageInputModule: File validation, S3 operations
  - Enhanced SceneAnalysisModule: Image analysis
  - DescriptionCompilationModule: Image descriptions
  - API endpoints: Request/response validation
  - Error scenarios and edge cases

#### P5.2: Integration Tests  
- **Task**: End-to-end workflow testing
- **Dependencies**: P5.1 complete
- **Effort**: 2 days
- **Test Scenarios**:
  - Single image processing workflow
  - Batch processing workflow  
  - Mixed video/image job processing
  - Error handling and recovery

#### P5.3: Documentation Updates
- **Task**: Update README and API documentation
- **Dependencies**: All testing complete
- **Effort**: 1 day
- **Deliverables**:
  - Update README with image capabilities
  - API documentation for new endpoints
  - Integration examples and code samples

## 8. Risk Assessment & Mitigation

### 8.1 Technical Risks

#### R1: Bedrock Nova Pro Image Analysis Quality
- **Risk**: AI-generated image descriptions may not meet accessibility standards
- **Likelihood**: Medium
- **Impact**: High
- **Mitigation**: 
  - Extensive testing with diverse image types
  - Prompt engineering optimization
  - Confidence score thresholds
  - Fallback to generic descriptions for low confidence

#### R2: Performance with Large Images
- **Risk**: Large image files may cause timeouts or memory issues
- **Likelihood**: Medium  
- **Impact**: Medium
- **Mitigation**:
  - File size limits (50MB max)
  - Image compression before processing
  - Streaming upload/download
  - Resource monitoring and alerting

#### R3: Backward Compatibility
- **Risk**: Changes may break existing video processing
- **Likelihood**: Low
- **Impact**: Critical
- **Mitigation**:
  - Extensive regression testing
  - Gradual rollout strategy
  - Feature flags for new functionality
  - Rollback plan preparation

### 8.2 Business Risks

#### R4: AWS Cost Increase
- **Risk**: Image processing may significantly increase AWS usage costs
- **Likelihood**: Medium
- **Impact**: Medium  
- **Mitigation**:
  - Cost monitoring and alerting
  - Usage quotas and rate limiting
  - Pricing strategy adjustment
  - Efficiency optimizations

## 9. Success Metrics

### 9.1 Technical KPIs
- **Processing Speed**: <15 seconds for single image processing
- **Accuracy**: >85% confidence score on image analysis
- **Availability**: 99.9% uptime for image processing endpoints
- **Error Rate**: <1% processing failures

### 9.2 Quality Metrics  
- **Accessibility Compliance**: Descriptions meet WCAG 2.1 AA standards
- **User Satisfaction**: Positive feedback on description quality
- **Coverage**: Successfully handle 95% of submitted image types

### 9.3 Usage Metrics
- **Adoption Rate**: Track new image processing API usage
- **Mixed Usage**: Monitor video vs image processing ratio
- **Performance Impact**: No degradation to existing video processing

## 10. Testing Strategy

### 10.1 Test Image Dataset
Create diverse test image collection:

- **Photos**: People, objects, landscapes, indoor/outdoor scenes
- **Charts/Graphs**: Business charts, scientific plots, infographics  
- **Diagrams**: Technical diagrams, flowcharts, architectural plans
- **Screenshots**: UI screenshots, documentation images
- **Art**: Illustrations, paintings, abstract images
- **Text Images**: Documents, signs, handwritten text

### 10.2 Accessibility Validation
- **Screen Reader Testing**: Validate descriptions with actual screen readers
- **User Testing**: Feedback from vision-impaired users
- **Compliance Checking**: WCAG 2.1 AA standard validation
- **Comparative Analysis**: Compare with manual descriptions

### 10.3 Performance Testing
- **Load Testing**: Concurrent image processing (10+ parallel jobs)
- **Stress Testing**: Large batch processing scenarios
- **Memory Testing**: Large image file handling
- **Timeout Testing**: Processing time limits

## 11. Deployment Plan

### 11.1 Feature Flag Strategy
```typescript
// Feature flags for gradual rollout
interface FeatureFlags {
  imageProcessing: boolean;
  batchImageProcessing: boolean; 
  imageAudioGeneration: boolean;
}
```

### 11.2 Rollout Phases
1. **Internal Testing** (Week 6): Deploy to staging, internal validation
2. **Beta Release** (Week 7): Limited user group, feedback collection
3. **Soft Launch** (Week 8): 25% traffic, monitoring and optimization  
4. **Full Release** (Week 9): 100% availability, documentation complete

### 11.3 Monitoring & Alerting
- **Performance Monitoring**: Processing times, error rates
- **Cost Monitoring**: AWS service usage tracking  
- **Quality Monitoring**: Confidence scores, user feedback
- **System Health**: Service availability, resource utilization

## 12. Future Enhancements (Post-V1)

### 12.1 Advanced Image Analysis (V2.0)
- **OCR Integration**: Extract and describe text within images
- **Object Detection**: Identify specific objects and people
- **Scene Understanding**: Context-aware descriptions
- **Multi-language Support**: Generate descriptions in multiple languages

### 12.2 AI Enhancement (V2.1)  
- **Custom Models**: Train models for specific image types
- **Style Recognition**: Identify art styles, photography techniques
- **Emotion Detection**: Describe mood and emotional context
- **Brand Recognition**: Identify logos and branded content

### 12.3 Integration Features (V3.0)
- **CMS Integration**: WordPress, Drupal plugins
- **Social Media APIs**: Auto-describe uploaded images
- **Real-time Processing**: WebSocket-based live processing
- **Bulk Import**: Process entire image libraries

---

## Document Approval

**Product Manager**: [Signature Required]  
**Engineering Lead**: [Signature Required]  
**QA Lead**: [Signature Required]  
**DevOps Lead**: [Signature Required]

**Document Status**: Draft - Pending Review  
**Next Review Date**: [To be scheduled]