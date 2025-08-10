import { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Load OpenAPI specification from YAML file
const loadOpenAPISpec = () => {
  try {
    const specPath = path.join(process.cwd(), 'docs', 'openapi.yaml');
    const fileContents = fs.readFileSync(specPath, 'utf8');
    return yaml.load(fileContents);
  } catch (error) {
    console.error('Error loading OpenAPI spec:', error);
    // Fallback to inline spec if file not found
    return getInlineSpec();
  }
};

const getInlineSpec = () => ({
  openapi: '3.0.3',
  info: {
    title: 'Voice Description API',
    version: '2.1.0',
    description: `Automated Audio Description System for Videos and Images

The Voice Description API provides comprehensive accessibility features for visual content by automatically generating descriptive audio narration tracks using advanced AWS AI services.

## Features
- **Video Processing**: Automatic scene detection, AI analysis, and audio generation
- **Image Processing**: Single and batch processing with multiple detail levels
- **Multiple Formats**: Support for various video (MP4, MOV, AVI) and image (JPEG, PNG, WebP) formats
- **Accessibility Focus**: Alt text, long descriptions, and WCAG compliance
- **Real-time Processing**: Fast turnaround with status tracking
- **Scalable Architecture**: Built on AWS for reliability and performance`,
    contact: {
      name: 'API Support Team',
      email: 'api-support@voicedescription.ai',
      url: 'https://voicedescription.ai/support',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: process.env.NODE_ENV === 'production' 
        ? 'https://api.voicedescription.ai/v2'
        : 'http://localhost:3000',
      description: process.env.NODE_ENV === 'production' 
        ? 'Production server' 
        : 'Development server',
    },
  ],
  security: [
    { ApiKeyAuth: [] },
    { BearerAuth: [] },
  ],
  paths: {
    '/api/upload': {
      post: {
        summary: 'Upload and process video',
        description: `Upload a video file or provide an S3 URI to start automated audio description generation.
        
**Processing Pipeline:**
1. Video validation and upload to S3
2. Scene segmentation using Amazon Rekognition
3. Individual scene extraction with FFmpeg
4. AI-powered scene analysis with Bedrock Nova Pro
5. Description compilation and formatting
6. Audio synthesis using Amazon Polly

**Supported Formats:** MP4, MOV, AVI, MKV, WebM
**Max File Size:** 500MB
**Max Duration:** 60 minutes`,
        tags: ['Video Processing'],
        operationId: 'uploadVideo',
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  video: {
                    type: 'string',
                    format: 'binary',
                    description: 'Video file to upload (max 500MB)',
                  },
                  s3Uri: {
                    type: 'string',
                    description: 'S3 URI of existing video (alternative to file upload)',
                    example: 's3://bucket-name/video.mp4',
                  },
                  title: {
                    type: 'string',
                    description: 'Video title',
                    example: 'My Video Title',
                  },
                  description: {
                    type: 'string',
                    description: 'Video description',
                    example: 'Description of the video content',
                  },
                  language: {
                    type: 'string',
                    description: 'Audio language code',
                    default: 'en',
                    example: 'en',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Upload successful, processing started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        jobId: { type: 'string', example: 'uuid-job-id' },
                        s3Uri: { type: 'string', example: 's3://bucket/video.mp4' },
                        message: { type: 'string', example: 'Video uploaded successfully, processing started' },
                        statusUrl: { type: 'string', example: '/api/status/uuid-job-id' },
                      },
                    },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Bad request - missing file or invalid parameters',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          500: {
            description: 'Server error during upload or processing initialization',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/status/{jobId}': {
      get: {
        summary: 'Get job processing status',
        description: 'Check the current status of video processing job',
        tags: ['Video Processing'],
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            description: 'Job ID returned from upload endpoint',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Job status retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', example: 'uuid-job-id' },
                        status: { 
                          type: 'string', 
                          enum: ['processing', 'completed', 'failed'],
                          example: 'processing'
                        },
                        step: { 
                          type: 'string', 
                          enum: ['segmentation', 'analysis', 'synthesis', 'completed'],
                          example: 'analysis'
                        },
                        progress: { type: 'integer', minimum: 0, maximum: 100, example: 65 },
                        message: { type: 'string', example: 'Analyzing scene 3 of 5' },
                        s3Uri: { type: 'string', example: 's3://bucket/video.mp4' },
                        metadata: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            description: { type: 'string' },
                            language: { type: 'string' },
                          },
                        },
                        segmentCount: { type: 'integer', example: 142 },
                        descriptions: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              startTime: { type: 'number', example: 0.033 },
                              endTime: { type: 'number', example: 10.5 },
                              text: { type: 'string', example: 'A person in a dark suit speaks passionately...' },
                            },
                          },
                        },
                        audioUrl: { type: 'string', example: 's3://output-bucket/job-id/audio.mp3' },
                        textUrl: { type: 'string', example: 's3://output-bucket/job-id/description.txt' },
                        error: { type: 'string', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        completedAt: { type: 'string', format: 'date-time', nullable: true },
                      },
                    },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          404: {
            description: 'Job not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/results/{jobId}/text': {
      get: {
        summary: 'Download text description file',
        description: 'Download the generated text description file for completed job',
        tags: ['Results'],
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            description: 'Job ID of completed processing job',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Text description file',
            content: {
              'text/plain': {
                schema: { type: 'string' },
                example: 'At 0 seconds: Scene 1: A person in a dark suit speaks... At 10 seconds: Scene 2: The camera pans to show...',
              },
            },
          },
          404: {
            description: 'Job not found or text not available',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/results/{jobId}/audio': {
      get: {
        summary: 'Download audio description file',
        description: 'Download the generated audio MP3 file for completed job',
        tags: ['Results'],
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            description: 'Job ID of completed processing job',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Audio description MP3 file',
            content: {
              'audio/mpeg': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          404: {
            description: 'Job not found or audio not available',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/aws-status': {
      get: {
        summary: 'Check AWS service connectivity',
        description: 'Verify connectivity to required AWS services (S3, Rekognition, Bedrock, Polly)',
        tags: ['System Health'],
        responses: {
          200: {
            description: 'AWS services status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        s3: { type: 'boolean', example: true },
                        rekognition: { type: 'boolean', example: true },
                        bedrock: { type: 'boolean', example: true },
                        polly: { type: 'boolean', example: true },
                        region: { type: 'string', example: 'us-east-1' },
                      },
                    },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/process-image': {
      post: {
        summary: 'Process single image',
        description: `Analyze and generate comprehensive descriptions for a single image.
        
**Features:**
- Multiple detail levels (basic, comprehensive, technical)
- Alt text generation for HTML compliance
- Optional audio description synthesis
- Accessibility metadata generation
- Color and composition analysis

**Supported Formats:** JPEG, PNG, WebP, GIF
**Max File Size:** 50MB`,
        tags: ['Image Processing'],
        operationId: 'processSingleImage',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Image file to process',
                  },
                  detailLevel: {
                    type: 'string',
                    enum: ['basic', 'comprehensive', 'technical'],
                    default: 'comprehensive',
                    description: 'Level of detail for description',
                  },
                  generateAudio: {
                    type: 'boolean',
                    default: false,
                    description: 'Generate audio narration',
                  },
                  includeAltText: {
                    type: 'boolean',
                    default: true,
                    description: 'Include alt text for HTML',
                  },
                  voiceId: {
                    type: 'string',
                    default: 'Joanna',
                    description: 'Polly voice ID for audio',
                  },
                  language: {
                    type: 'string',
                    default: 'en-US',
                    description: 'Language for descriptions',
                  },
                  title: {
                    type: 'string',
                    description: 'Image title or identifier',
                  },
                  context: {
                    type: 'string',
                    description: 'Additional context for better analysis',
                  },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  s3Uri: {
                    type: 'string',
                    description: 'S3 URI of the image',
                    example: 's3://bucket/image.jpg',
                  },
                  image: {
                    type: 'string',
                    description: 'Base64 encoded image data',
                  },
                  options: {
                    type: 'object',
                    properties: {
                      detailLevel: {
                        type: 'string',
                        enum: ['basic', 'comprehensive', 'technical'],
                      },
                      generateAudio: { type: 'boolean' },
                      includeAltText: { type: 'boolean' },
                      voiceId: { type: 'string' },
                      language: { type: 'string' },
                    },
                  },
                  metadata: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      context: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Image processed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        jobId: { type: 'string', example: 'img-550e8400' },
                        status: { type: 'string', example: 'completed' },
                        processingTime: { type: 'number', example: 2.5 },
                        results: {
                          type: 'object',
                          properties: {
                            detailedDescription: { type: 'string' },
                            altText: { type: 'string' },
                            visualElements: {
                              type: 'array',
                              items: { type: 'string' },
                            },
                            colors: {
                              type: 'array',
                              items: { type: 'string' },
                            },
                            composition: { type: 'string' },
                            context: { type: 'string' },
                            confidence: { type: 'number' },
                            audioFile: {
                              type: 'object',
                              properties: {
                                url: { type: 'string' },
                                duration: { type: 'number' },
                                format: { type: 'string' },
                              },
                            },
                            htmlMetadata: {
                              type: 'object',
                              properties: {
                                altAttribute: { type: 'string' },
                                longDescId: { type: 'string' },
                                ariaLabel: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                    },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          500: {
            description: 'Server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/process-images-batch': {
      post: {
        summary: 'Process multiple images',
        description: `Process multiple images in a single batch request for efficiency.
        
**Features:**
- Process up to 100 images per batch
- Parallel processing for faster results
- Individual success/failure tracking
- Bulk options application

**Use Cases:**
- E-commerce product catalogs
- Photo galleries and albums
- Document accessibility compliance
- Social media content batches`,
        tags: ['Image Processing', 'Batch Operations'],
        operationId: 'processBatchImages',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['images'],
                properties: {
                  images: {
                    type: 'array',
                    maxItems: 100,
                    minItems: 1,
                    description: 'Array of images to process',
                    items: {
                      type: 'object',
                      required: ['source'],
                      properties: {
                        source: {
                          type: 'string',
                          description: 'S3 URI or base64 data URI',
                        },
                        id: {
                          type: 'string',
                          description: 'Optional identifier for tracking',
                        },
                        metadata: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            description: { type: 'string' },
                            context: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                  options: {
                    type: 'object',
                    description: 'Options to apply to all images',
                    properties: {
                      detailLevel: {
                        type: 'string',
                        enum: ['basic', 'comprehensive', 'technical'],
                      },
                      generateAudio: { type: 'boolean' },
                      includeAltText: { type: 'boolean' },
                      voiceId: { type: 'string' },
                      language: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Batch processing completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        batchId: { type: 'string' },
                        totalImages: { type: 'number' },
                        status: {
                          type: 'string',
                          enum: ['processing', 'completed', 'partial', 'failed'],
                        },
                        results: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              jobId: { type: 'string' },
                              status: {
                                type: 'string',
                                enum: ['completed', 'failed'],
                              },
                              result: { type: 'object' },
                              error: { type: 'object' },
                            },
                          },
                        },
                      },
                    },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/status/image/{jobId}': {
      get: {
        summary: 'Get image job status',
        description: 'Check the processing status of an image job',
        tags: ['Image Processing', 'Job Management'],
        operationId: 'getImageJobStatus',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            description: 'Image job ID',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Job status retrieved',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        jobId: { type: 'string' },
                        status: {
                          type: 'string',
                          enum: ['pending', 'processing', 'completed', 'failed'],
                        },
                        step: {
                          type: 'string',
                          enum: ['upload', 'analysis', 'compilation', 'synthesis', 'completed'],
                        },
                        progress: { type: 'number' },
                        message: { type: 'string' },
                        results: { type: 'object' },
                        error: { type: 'object' },
                        createdAt: { type: 'string', format: 'date-time' },
                        completedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          404: {
            description: 'Job not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/results/image/{jobId}/text': {
      get: {
        summary: 'Download image description text',
        description: 'Download the generated text descriptions for a completed image job',
        tags: ['Image Processing', 'Results'],
        operationId: 'getImageDescriptionText',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            description: 'Image job ID',
            schema: { type: 'string' },
          },
          {
            name: 'format',
            in: 'query',
            description: 'Output format',
            schema: {
              type: 'string',
              enum: ['plain', 'json', 'html'],
              default: 'plain',
            },
          },
        ],
        responses: {
          200: {
            description: 'Text description',
            content: {
              'text/plain': {
                schema: { type: 'string' },
              },
              'application/json': {
                schema: { type: 'object' },
              },
              'text/html': {
                schema: { type: 'string' },
              },
            },
          },
          404: {
            description: 'Job not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/results/image/{jobId}/audio': {
      get: {
        summary: 'Download image description audio',
        description: 'Download the generated audio narration for a completed image job',
        tags: ['Image Processing', 'Results'],
        operationId: 'getImageDescriptionAudio',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            description: 'Image job ID',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Audio file',
            content: {
              'audio/mpeg': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          404: {
            description: 'Job not found or audio not generated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/health': {
      get: {
        summary: 'Health check',
        description: 'Basic health check endpoint for monitoring and load balancer health checks',
        tags: ['System Health'],
        security: [],
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime: { type: 'number', example: 3600 },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication. Get your key from the dashboard.',
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT Bearer token for OAuth 2.0 authentication',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error', 'timestamp'],
        properties: {
          success: { 
            type: 'boolean', 
            example: false,
            description: 'Always false for error responses',
          },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { 
                type: 'string', 
                example: 'INVALID_REQUEST',
                description: 'Error code for programmatic handling',
                enum: [
                  'INVALID_REQUEST',
                  'UNAUTHORIZED',
                  'FORBIDDEN',
                  'NOT_FOUND',
                  'RATE_LIMITED',
                  'PAYLOAD_TOO_LARGE',
                  'INTERNAL_ERROR',
                  'SERVICE_UNAVAILABLE',
                ],
              },
              message: { 
                type: 'string', 
                example: 'User-friendly error message',
                description: 'Human-readable error message',
              },
              details: { 
                type: 'string', 
                example: 'Technical error details',
                description: 'Additional technical details for debugging',
              },
              retryAfter: {
                type: 'integer',
                example: 60,
                description: 'Seconds to wait before retrying (for rate limits)',
              },
            },
          },
          timestamp: { 
            type: 'string', 
            format: 'date-time',
            description: 'ISO 8601 timestamp of the error',
          },
        },
      },
      HealthStatus: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['healthy', 'degraded', 'unhealthy'],
            example: 'healthy',
          },
          version: {
            type: 'string',
            example: '2.1.0',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
          },
          uptime: {
            type: 'number',
            example: 3600,
            description: 'Uptime in seconds',
          },
          environment: {
            type: 'string',
            example: 'production',
          },
        },
      },
      AWSStatus: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              s3: { 
                type: 'boolean',
                description: 'S3 connectivity status',
              },
              rekognition: { 
                type: 'boolean',
                description: 'Rekognition connectivity status',
              },
              bedrock: { 
                type: 'boolean',
                description: 'Bedrock Nova Pro connectivity status',
              },
              polly: { 
                type: 'boolean',
                description: 'Polly connectivity status',
              },
              region: { 
                type: 'string',
                example: 'us-east-1',
                description: 'AWS region',
              },
              allHealthy: {
                type: 'boolean',
                description: 'Overall AWS services health',
              },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
    examples: {
      VideoUploadExample: {
        summary: 'Video upload example',
        value: {
          video: '(binary file)',
          title: 'Corporate Training Video',
          description: 'Annual compliance training for employees',
          language: 'en-US',
        },
      },
      ImageProcessExample: {
        summary: 'Image processing example',
        value: {
          s3Uri: 's3://my-bucket/images/product.jpg',
          options: {
            detailLevel: 'comprehensive',
            generateAudio: true,
            includeAltText: true,
          },
          metadata: {
            title: 'Product Hero Image',
            context: 'E-commerce product page',
          },
        },
      },
      BatchImageExample: {
        summary: 'Batch image processing',
        value: {
          images: [
            {
              source: 's3://bucket/image1.jpg',
              id: 'IMG001',
              metadata: { title: 'Product 1' },
            },
            {
              source: 's3://bucket/image2.jpg',
              id: 'IMG002',
              metadata: { title: 'Product 2' },
            },
          ],
          options: {
            detailLevel: 'comprehensive',
            generateAudio: false,
            includeAltText: true,
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Video Processing',
      description: 'Core video processing endpoints for automated audio description generation. Handles video upload, scene segmentation, AI analysis, and audio synthesis.',
      externalDocs: {
        description: 'Video Processing Documentation',
        url: 'https://docs.voicedescription.ai/video-processing',
      },
    },
    {
      name: 'Image Processing',
      description: 'Image analysis and accessibility description endpoints. Supports single and batch processing with multiple detail levels.',
      externalDocs: {
        description: 'Image Processing Documentation',
        url: 'https://docs.voicedescription.ai/image-processing',
      },
    },
    {
      name: 'Job Management',
      description: 'Track processing job status and retrieve results. Supports both video and image processing jobs.',
    },
    {
      name: 'Batch Operations',
      description: 'Efficient batch processing endpoints for handling multiple items in a single request.',
    },
    {
      name: 'Results',
      description: 'Download generated text descriptions and audio files in various formats.',
    },
    {
      name: 'System Health',
      description: 'System health monitoring and AWS service connectivity checks for operational visibility.',
    },
  ],
  externalDocs: {
    description: 'Full API Documentation',
    url: 'https://docs.voicedescription.ai',
  },
});

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS for Swagger UI
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET method allowed',
      },
    });
  }

  // Check for query parameters to determine response type
  const { format, ui } = req.query;

  // Load the OpenAPI specification
  const swaggerDocument = loadOpenAPISpec();

  // Serve Swagger UI HTML if requested
  if (ui === 'true' || ui === '1') {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(getSwaggerUIHTML());
  }

  // Return YAML format if requested
  if (format === 'yaml') {
    res.setHeader('Content-Type', 'text/yaml');
    try {
      const yamlString = yaml.dump(swaggerDocument);
      return res.status(200).send(yamlString);
    } catch (error) {
      console.error('Error converting to YAML:', error);
    }
  }

  // Default to JSON
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(swaggerDocument);
}

// Generate Swagger UI HTML page
function getSwaggerUIHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voice Description API Documentation</title>
    <meta name="description" content="Comprehensive API documentation for Voice Description API - Automated audio description generation for videos and images using AWS AI services.">
    <link rel="icon" type="image/png" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/swagger-ui.css">
    <style>
      :root {
        --primary-color: #667eea;
        --secondary-color: #764ba2;
        --success-color: #49cc90;
        --info-color: #61affe;
        --warning-color: #fca130;
        --danger-color: #f93e3e;
      }
      
      * {
        box-sizing: border-box;
      }
      
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background: #f5f7fa;
      }
      
      .topbar {
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
        padding: 1.5rem 0;
        color: white;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        position: sticky;
        top: 0;
        z-index: 1000;
      }
      
      .topbar-content {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 2rem;
      }
      
      .topbar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
      }
      
      .topbar-title {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      
      .topbar h1 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      .topbar .version-badge {
        background: rgba(255,255,255,0.2);
        padding: 0.25rem 0.75rem;
        border-radius: 1rem;
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      .topbar p {
        margin: 0.5rem 0 0 0;
        opacity: 0.95;
        font-size: 1rem;
        line-height: 1.5;
      }
      
      .topbar-nav {
        display: flex;
        gap: 1rem;
        align-items: center;
      }
      
      .topbar-nav a {
        color: white;
        text-decoration: none;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        background: rgba(255,255,255,0.1);
        transition: background 0.2s;
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      .topbar-nav a:hover {
        background: rgba(255,255,255,0.2);
      }
      
      .api-key-section {
        margin-top: 1.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid rgba(255,255,255,0.2);
      }
      
      .api-key-form {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        flex-wrap: wrap;
      }
      
      .api-key-input {
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        border: 1px solid rgba(255,255,255,0.3);
        background: rgba(255,255,255,0.1);
        color: white;
        min-width: 300px;
        font-size: 0.875rem;
      }
      
      .api-key-input::placeholder {
        color: rgba(255,255,255,0.7);
      }
      
      .api-key-input:focus {
        outline: none;
        background: rgba(255,255,255,0.15);
        border-color: rgba(255,255,255,0.5);
      }
      
      .btn {
        padding: 0.5rem 1.25rem;
        border-radius: 0.375rem;
        border: none;
        background: rgba(255,255,255,0.2);
        color: white;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        transition: all 0.2s;
      }
      
      .btn:hover {
        background: rgba(255,255,255,0.3);
        transform: translateY(-1px);
      }
      
      .btn:active {
        transform: translateY(0);
      }
      
      .quick-links {
        margin-top: 1rem;
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }
      
      .quick-link {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        color: rgba(255,255,255,0.9);
        text-decoration: none;
        font-size: 0.875rem;
        transition: color 0.2s;
      }
      
      .quick-link:hover {
        color: white;
      }
      
      #swagger-ui {
        max-width: 1400px;
        margin: 2rem auto;
        padding: 0 2rem;
      }
      
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 50px 0; }
      .swagger-ui .info hgroup.main { margin: 0 0 2rem 0; }
      .swagger-ui .info .title { font-size: 2.5rem; }
      
      .swagger-ui .scheme-container { 
        background: white;
        padding: 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        margin-bottom: 2rem;
      }
      
      .swagger-ui .btn.authorize { 
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: white;
        border-radius: 0.375rem;
        font-weight: 500;
      }
      
      .swagger-ui .btn.authorize:hover { 
        background: var(--secondary-color);
        border-color: var(--secondary-color);
      }
      
      .swagger-ui .btn.authorize svg { fill: white; }
      
      .swagger-ui .opblock.opblock-post .opblock-summary { border-color: var(--success-color); }
      .swagger-ui .opblock.opblock-get .opblock-summary { border-color: var(--info-color); }
      .swagger-ui .opblock.opblock-delete .opblock-summary { border-color: var(--danger-color); }
      .swagger-ui .opblock.opblock-put .opblock-summary { border-color: var(--warning-color); }
      .swagger-ui .opblock.opblock-patch .opblock-summary { border-color: var(--warning-color); }
      
      .swagger-ui .opblock .opblock-summary {
        border-radius: 0.375rem;
        transition: all 0.2s;
      }
      
      .swagger-ui .opblock.is-open .opblock-summary {
        border-radius: 0.375rem 0.375rem 0 0;
      }
      
      .swagger-ui .opblock .opblock-section-header {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 0.375rem;
        margin-bottom: 1rem;
      }
      
      .swagger-ui .responses-inner {
        padding: 1rem;
      }
      
      .swagger-ui select {
        border-radius: 0.375rem;
        padding: 0.5rem;
      }
      
      .swagger-ui .btn.execute {
        background: var(--primary-color);
        border-color: var(--primary-color);
        border-radius: 0.375rem;
        font-weight: 500;
      }
      
      .swagger-ui .btn.execute:hover {
        background: var(--secondary-color);
        border-color: var(--secondary-color);
      }
      
      .swagger-ui .btn.btn-clear {
        border-radius: 0.375rem;
      }
      
      .swagger-ui .model-box {
        border-radius: 0.375rem;
        background: white;
        border: 1px solid #e1e4e8;
      }
      
      .swagger-ui table.model tbody tr td {
        border-bottom: 1px solid #f0f0f0;
      }
      
      .swagger-ui .parameter__name {
        font-weight: 600;
        color: #2d3748;
      }
      
      .swagger-ui .parameter__type {
        color: var(--primary-color);
        font-family: 'Courier New', monospace;
        font-size: 0.875rem;
      }
      
      .swagger-ui .response-col_status {
        font-weight: 600;
      }
      
      .swagger-ui .response-col_status .response-undocumented {
        font-weight: 400;
        color: #999;
      }
      
      @media (max-width: 768px) {
        .topbar-header {
          flex-direction: column;
          align-items: flex-start;
        }
        
        .topbar h1 {
          font-size: 1.5rem;
        }
        
        .api-key-input {
          min-width: 100%;
        }
        
        #swagger-ui {
          padding: 0 1rem;
        }
      }
      
      /* Custom scrollbar */
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      
      ::-webkit-scrollbar-track {
        background: #f1f1f1;
      }
      
      ::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      
      /* Loading animation */
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
      
      .loading {
        animation: pulse 2s infinite;
      }
    </style>
</head>
<body>
    <div class="topbar">
        <div class="topbar-content">
            <div class="topbar-header">
                <div class="topbar-title">
                    <h1>
                        <span>🎙️ Voice Description API</span>
                        <span class="version-badge">v2.1.0</span>
                    </h1>
                </div>
                <nav class="topbar-nav">
                    <a href="/api/docs/samples" target="_blank">📚 Code Samples</a>
                    <a href="https://github.com/voicedesc/api-client" target="_blank">🔧 SDKs</a>
                    <a href="https://voicedescription.ai/support" target="_blank">💬 Support</a>
                    <a href="https://voicedescription.ai/dashboard" target="_blank">🚀 Dashboard</a>
                </nav>
            </div>
            <p>Automated audio description generation for videos and images using AWS AI services. Generate accessible content with advanced AI-powered scene analysis.</p>
            
            <div class="api-key-section">
                <div class="api-key-form">
                    <input 
                        type="password" 
                        id="apiKeyInput" 
                        class="api-key-input"
                        placeholder="Enter your API key to enable Try It Out" 
                        value=""
                    />
                    <button onclick="saveApiKey()" class="btn">
                        💾 Save API Key
                    </button>
                    <button onclick="clearApiKey()" class="btn">
                        🗑️ Clear
                    </button>
                </div>
                <div class="quick-links">
                    <a href="#tag/Video-Processing" class="quick-link">📹 Video Processing</a>
                    <a href="#tag/Image-Processing" class="quick-link">🖼️ Image Processing</a>
                    <a href="#tag/Batch-Operations" class="quick-link">📦 Batch Operations</a>
                    <a href="#tag/System-Health" class="quick-link">💚 Health Check</a>
                </div>
            </div>
        </div>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/api/docs',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: 'StandaloneLayout',
                tryItOutEnabled: true,
                docExpansion: 'none',
                filter: true,
                showCommonExtensions: true,
                onComplete: function() {
                    // Add custom behavior after UI loads
                    console.log('Swagger UI loaded successfully');
                },
                requestInterceptor: function(request) {
                    // Add API key from localStorage if available
                    const apiKey = localStorage.getItem('api_key');
                    if (apiKey && !request.headers['X-API-Key']) {
                        request.headers['X-API-Key'] = apiKey;
                    }
                    return request;
                },
                responseInterceptor: function(response) {
                    // Log responses for debugging
                    if (response.status >= 400) {
                        console.error('API Error:', response);
                    }
                    return response;
                }
            });
            
            window.ui = ui;

            // Add API key management
            const topbar = document.querySelector('.topbar > div');
            if (topbar) {
                const keyInput = document.createElement('div');
                keyInput.style.marginTop = '1rem';
                keyInput.innerHTML = `
                    <input type="password" id="apiKeyInput" placeholder="Enter your API key" 
                           style="padding: 5px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); 
                                  background: rgba(255,255,255,0.1); color: white; margin-right: 10px;"
                           value="${localStorage.getItem('api_key') || ''}">
                    <button onclick="saveApiKey()" 
                            style="padding: 5px 15px; border-radius: 4px; border: none; 
                                   background: rgba(255,255,255,0.2); color: white; cursor: pointer;">
                        Save API Key
                    </button>
                `;
                topbar.appendChild(keyInput);
            }
        };

        // Load API key on page load
        document.addEventListener('DOMContentLoaded', function() {
            const savedKey = localStorage.getItem('api_key');
            if (savedKey) {
                document.getElementById('apiKeyInput').value = savedKey;
            }
        });
        
        function saveApiKey() {
            const apiKey = document.getElementById('apiKeyInput').value;
            if (apiKey) {
                localStorage.setItem('api_key', apiKey);
                showNotification('✅ API Key saved successfully!', 'success');
                // Reload Swagger UI to apply the key
                if (window.ui) {
                    window.ui.preauthorizeApiKey('ApiKeyAuth', apiKey);
                }
            } else {
                showNotification('⚠️ Please enter an API key', 'warning');
            }
        }
        
        function clearApiKey() {
            localStorage.removeItem('api_key');
            document.getElementById('apiKeyInput').value = '';
            showNotification('🗑️ API Key cleared', 'info');
        }
        
        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 100px;
                right: 20px;
                padding: 1rem 1.5rem;
                background: ${type === 'success' ? '#49cc90' : type === 'warning' ? '#fca130' : '#61affe'};
                color: white;
                border-radius: 0.5rem;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
                font-weight: 500;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
        
        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    </script>
</body>
</html>
  `;
}