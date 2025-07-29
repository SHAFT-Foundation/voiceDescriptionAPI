import { NextApiRequest, NextApiResponse } from 'next';

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Voice Description API',
    version: '1.0.0',
    description: 'Automated video audio description system using AWS AI services (Rekognition, Nova Pro, Polly)',
    contact: {
      name: 'API Support',
      url: 'https://speechlab.ai',
    },
  },
  servers: [
    {
      url: '{protocol}://{host}',
      description: 'Dynamic server',
      variables: {
        protocol: {
          enum: ['http', 'https'],
          default: 'https',
        },
        host: {
          default: 'localhost:3000',
        },
      },
    },
  ],
  paths: {
    '/api/upload': {
      post: {
        summary: 'Upload video for processing',
        description: 'Upload video file or provide S3 URI to start audio description generation',
        tags: ['Video Processing'],
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
    '/api/health': {
      get: {
        summary: 'Health check endpoint',
        description: 'Basic health check for the API service',
        tags: ['System Health'],
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
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'INVALID_REQUEST' },
              message: { type: 'string', example: 'User-friendly error message' },
              details: { type: 'string', example: 'Technical error details' },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  tags: [
    {
      name: 'Video Processing',
      description: 'Core video processing endpoints for upload and status tracking',
    },
    {
      name: 'Results',
      description: 'Download generated text and audio description files',
    },
    {
      name: 'System Health',
      description: 'System health and AWS service connectivity checks',
    },
  ],
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET method allowed',
      },
    });
  }

  // Set proper headers for Swagger UI
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  return res.status(200).json(swaggerDocument);
}