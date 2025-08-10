import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const simpleSpec = {
    openapi: '3.0.3',
    info: {
      title: 'Voice Description API',
      version: '2.1.0',
      description: 'Automated Audio Description System for Videos and Images',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    paths: {
      '/api/upload': {
        post: {
          summary: 'Upload and process video',
          description: 'Upload a video file for processing with AI-generated audio descriptions',
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    video: {
                      type: 'string',
                      format: 'binary',
                      description: 'Video file to process',
                    },
                    title: {
                      type: 'string',
                      description: 'Optional title for the video',
                    },
                    language: {
                      type: 'string',
                      default: 'en',
                      description: 'Language for audio narration',
                    },
                  },
                  required: ['video'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Processing started successfully',
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
                          s3Uri: { type: 'string' },
                          statusUrl: { type: 'string' },
                        },
                      },
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
          description: 'Generate accessibility descriptions for a single image',
          requestBody: {
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
                    },
                    generateAudio: {
                      type: 'boolean',
                      default: true,
                    },
                  },
                  required: ['image'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Image processed successfully',
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
                          results: {
                            type: 'object',
                            properties: {
                              altText: { type: 'string' },
                              detailedDescription: { type: 'string' },
                              audioFile: { type: 'string' },
                            },
                          },
                        },
                      },
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
          summary: 'System health check',
          description: 'Check the health status of the API and AWS services',
          responses: {
            '200': {
              description: 'System health status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      services: {
                        type: 'object',
                        properties: {
                          video: { type: 'object' },
                          image: { type: 'object' },
                          aws: { type: 'object' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const { format, ui } = req.query;

  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Return Swagger UI HTML if requested
  if (ui === 'true' || ui === '1') {
    const swaggerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Voice Description API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                url: '/api/docs-simple',
                dom_id: '#swagger-ui',
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.presets.standalone
                ]
            });
        };
    </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    return res.send(swaggerHTML);
  }

  // Return JSON spec
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(simpleSpec);
}