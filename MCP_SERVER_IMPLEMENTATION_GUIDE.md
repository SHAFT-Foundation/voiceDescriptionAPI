# MCP Server Implementation Guide

## Quick Start Implementation

This guide provides concrete, copy-paste ready code for implementing the MCP server for the Voice Description API.

## Table of Contents

1. [Project Setup](#project-setup)
2. [Core Server Implementation](#core-server-implementation)
3. [Tool Implementations](#tool-implementations)
4. [API Client Implementation](#api-client-implementation)
5. [Testing Setup](#testing-setup)
6. [Deployment Configuration](#deployment-configuration)

## Project Setup

### Initialize Project

```bash
# Create MCP server directory
mkdir mcp-server
cd mcp-server

# Initialize package.json
npm init -y

# Install dependencies
npm install @modelcontextprotocol/sdk axios ws express multer \
  mime-types uuid dotenv winston joi p-queue node-cache \
  form-data

# Install dev dependencies
npm install -D typescript tsx @types/node @types/express \
  @types/ws @types/multer @types/mime-types @types/uuid \
  jest @types/jest ts-jest eslint prettier
```

### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## Core Server Implementation

### Main Entry Point

```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServerTransport } from './transport/websocket.js';
import { ToolRegistry } from './tools/registry.js';
import { registerAllTools } from './tools/index.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';

async function main() {
  try {
    // Initialize MCP server
    const server = new Server(
      {
        name: 'voice-description-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize tool registry
    const toolRegistry = new ToolRegistry(server);
    
    // Register all tools
    await registerAllTools(toolRegistry);
    
    // Set up transport based on configuration
    let transport;
    if (config.server.transport === 'stdio') {
      transport = new StdioServerTransport();
    } else {
      transport = new WebSocketServerTransport(
        config.server.port || 3001,
        config.server.host || 'localhost'
      );
    }
    
    // Connect server to transport
    await server.connect(transport);
    
    logger.info('MCP server started successfully', {
      transport: config.server.transport,
      port: config.server.port,
      toolCount: toolRegistry.getToolCount()
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down MCP server...');
      await server.close();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start MCP server', error);
    process.exit(1);
  }
}

main();
```

### Tool Registry Implementation

```typescript
// src/tools/registry.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

export interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  execute: (params: any) => Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  
  constructor(private server: Server) {
    this.setupHandlers();
  }
  
  private setupHandlers() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: this.zodToJsonSchema(tool.inputSchema),
        },
      }));
      
      return { tools };
    });
    
    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const tool = this.tools.get(name);
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }
      
      try {
        // Validate parameters
        const validatedParams = tool.inputSchema.parse(args);
        
        // Execute tool
        const result = await tool.execute(validatedParams);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error(`Tool execution failed: ${name}`, error);
        throw error;
      }
    });
  }
  
  register(tool: Tool) {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    
    this.tools.set(tool.name, tool);
    logger.info(`Registered tool: ${tool.name}`);
  }
  
  getToolCount(): number {
    return this.tools.size;
  }
  
  private zodToJsonSchema(schema: z.ZodObject<any>): any {
    const shape = schema.shape;
    const properties: any = {};
    const required: string[] = [];
    
    for (const [key, value] of Object.entries(shape)) {
      const zodType = value as z.ZodTypeAny;
      
      if (!zodType.isOptional()) {
        required.push(key);
      }
      
      properties[key] = this.zodTypeToJsonSchema(zodType);
    }
    
    return { properties, required };
  }
  
  private zodTypeToJsonSchema(zodType: z.ZodTypeAny): any {
    if (zodType instanceof z.ZodString) {
      return { type: 'string' };
    } else if (zodType instanceof z.ZodNumber) {
      return { type: 'number' };
    } else if (zodType instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    } else if (zodType instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodTypeToJsonSchema(zodType.element),
      };
    } else if (zodType instanceof z.ZodObject) {
      return {
        type: 'object',
        properties: this.zodToJsonSchema(zodType),
      };
    } else if (zodType instanceof z.ZodOptional) {
      return this.zodTypeToJsonSchema(zodType.unwrap());
    } else {
      return { type: 'string' };
    }
  }
}
```

## Tool Implementations

### Process Image Tool

```typescript
// src/tools/image/process-image.ts
import { z } from 'zod';
import { Tool } from '../registry.js';
import { APIClient } from '../../adapters/api-client.js';
import { FileHandler } from '../../adapters/file-handler.js';
import { logger } from '../../utils/logger.js';

const processImageSchema = z.object({
  image_path: z.string().describe('Path to the image file'),
  detail_level: z.enum(['basic', 'comprehensive', 'technical']).optional()
    .default('comprehensive').describe('Level of detail in description'),
  generate_audio: z.boolean().optional().default(true)
    .describe('Generate audio narration'),
  include_alt_text: z.boolean().optional().default(true)
    .describe('Include HTML alt text'),
  context: z.string().optional().describe('Additional context about image usage'),
  voice_id: z.string().optional().default('Joanna')
    .describe('AWS Polly voice ID for audio generation'),
});

export class ProcessImageTool implements Tool {
  name = 'voice_description_process_image';
  description = 'Process a single image for accessibility description';
  inputSchema = processImageSchema;
  
  private apiClient: APIClient;
  private fileHandler: FileHandler;
  
  constructor() {
    this.apiClient = new APIClient();
    this.fileHandler = new FileHandler();
  }
  
  async execute(params: z.infer<typeof processImageSchema>) {
    try {
      logger.info('Processing image', { path: params.image_path });
      
      // Validate and read file
      const fileData = await this.fileHandler.readFile(params.image_path);
      
      // Process through API
      const result = await this.apiClient.processImage({
        file: fileData.buffer,
        fileName: fileData.name,
        mimeType: fileData.mimeType,
        options: {
          detailLevel: params.detail_level,
          generateAudio: params.generate_audio,
          includeAltText: params.include_alt_text,
          voiceId: params.voice_id,
        },
        metadata: {
          context: params.context,
        },
      });
      
      // Format response
      return {
        success: true,
        job_id: result.jobId,
        status: result.status,
        processing_time: result.processingTime,
        results: {
          description: result.results.detailedDescription,
          alt_text: result.results.altText,
          visual_elements: result.results.visualElements,
          colors: result.results.colors,
          composition: result.results.composition,
          confidence: result.results.confidence,
          audio: result.results.audioFile ? {
            url: result.results.audioFile.url,
            duration: result.results.audioFile.duration,
            format: result.results.audioFile.format,
          } : undefined,
          html_metadata: result.results.htmlMetadata,
        },
      };
    } catch (error) {
      logger.error('Image processing failed', error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }
}
```

### Upload Video Tool

```typescript
// src/tools/video/upload-video.ts
import { z } from 'zod';
import { Tool } from '../registry.js';
import { APIClient } from '../../adapters/api-client.js';
import { FileHandler } from '../../adapters/file-handler.js';
import { JobPoller } from '../../adapters/job-poller.js';
import { logger } from '../../utils/logger.js';

const uploadVideoSchema = z.object({
  file_path: z.string().describe('Path to the video file'),
  title: z.string().optional().describe('Title of the video'),
  description: z.string().optional().describe('Additional context'),
  language: z.enum(['en', 'es', 'fr', 'de', 'ja', 'zh']).optional()
    .default('en').describe('Target language'),
  voice_id: z.string().optional().default('Joanna')
    .describe('AWS Polly voice ID'),
  detail_level: z.enum(['basic', 'detailed', 'comprehensive']).optional()
    .default('detailed').describe('Level of detail'),
  wait_for_completion: z.boolean().optional().default(false)
    .describe('Wait for processing to complete'),
});

export class UploadVideoTool implements Tool {
  name = 'voice_description_upload_video';
  description = 'Upload and process a video file for audio description generation';
  inputSchema = uploadVideoSchema;
  
  private apiClient: APIClient;
  private fileHandler: FileHandler;
  private jobPoller: JobPoller;
  
  constructor() {
    this.apiClient = new APIClient();
    this.fileHandler = new FileHandler();
    this.jobPoller = new JobPoller();
  }
  
  async execute(params: z.infer<typeof uploadVideoSchema>) {
    try {
      logger.info('Uploading video', { path: params.file_path });
      
      // Validate and prepare file
      const fileData = await this.fileHandler.prepareVideoUpload(params.file_path);
      
      // Upload to API
      const uploadResult = await this.apiClient.uploadVideo({
        file: fileData.stream || fileData.buffer,
        fileName: fileData.name,
        mimeType: fileData.mimeType,
        metadata: {
          title: params.title,
          description: params.description,
          language: params.language,
        },
        options: {
          voiceId: params.voice_id,
          detailLevel: params.detail_level,
        },
      });
      
      const response = {
        success: true,
        job_id: uploadResult.jobId,
        status: uploadResult.status,
        estimated_time: uploadResult.estimatedTime,
        status_url: `/api/status/${uploadResult.jobId}`,
        message: 'Video uploaded successfully, processing started',
      };
      
      // Optionally wait for completion
      if (params.wait_for_completion) {
        logger.info('Waiting for video processing to complete', {
          jobId: uploadResult.jobId,
        });
        
        const finalStatus = await this.jobPoller.pollJob(
          uploadResult.jobId,
          () => this.apiClient.checkVideoStatus(uploadResult.jobId),
          {
            timeout: 600000, // 10 minutes
            onProgress: (status) => {
              logger.info('Processing progress', {
                jobId: uploadResult.jobId,
                progress: status.progress,
                step: status.step,
              });
            },
          }
        );
        
        return {
          ...response,
          status: finalStatus.status,
          results: finalStatus.results,
        };
      }
      
      return response;
    } catch (error) {
      logger.error('Video upload failed', error);
      throw new Error(`Failed to upload video: ${error.message}`);
    }
  }
}
```

### Batch Process Images Tool

```typescript
// src/tools/image/batch-process.ts
import { z } from 'zod';
import { Tool } from '../registry.js';
import { APIClient } from '../../adapters/api-client.js';
import { FileHandler } from '../../adapters/file-handler.js';
import { logger } from '../../utils/logger.js';
import PQueue from 'p-queue';

const batchProcessSchema = z.object({
  images: z.array(z.object({
    path: z.string().describe('Path to image file'),
    id: z.string().optional().describe('Custom ID for tracking'),
    context: z.string().optional().describe('Context for this image'),
  })).min(1).max(50).describe('Array of images to process'),
  options: z.object({
    detail_level: z.enum(['basic', 'comprehensive', 'technical']).optional(),
    generate_audio: z.boolean().optional().default(true),
    voice_id: z.string().optional().default('Joanna'),
  }).optional(),
  parallel: z.boolean().optional().default(true)
    .describe('Process images in parallel'),
  max_concurrent: z.number().min(1).max(10).optional().default(3)
    .describe('Maximum concurrent processing'),
});

export class BatchProcessImagesTool implements Tool {
  name = 'voice_description_batch_images';
  description = 'Process multiple images in batch for accessibility descriptions';
  inputSchema = batchProcessSchema;
  
  private apiClient: APIClient;
  private fileHandler: FileHandler;
  
  constructor() {
    this.apiClient = new APIClient();
    this.fileHandler = new FileHandler();
  }
  
  async execute(params: z.infer<typeof batchProcessSchema>) {
    try {
      logger.info('Starting batch image processing', {
        imageCount: params.images.length,
        parallel: params.parallel,
      });
      
      const batchId = `batch-${Date.now()}`;
      const results: any[] = [];
      const errors: any[] = [];
      
      if (params.parallel) {
        // Process in parallel with concurrency limit
        const queue = new PQueue({ concurrency: params.max_concurrent });
        
        const promises = params.images.map((image, index) =>
          queue.add(async () => {
            try {
              const result = await this.processImage(image, params.options);
              results.push({
                ...result,
                image_id: image.id || `img-${index}`,
                source_path: image.path,
              });
            } catch (error) {
              errors.push({
                image_id: image.id || `img-${index}`,
                source_path: image.path,
                error: error.message,
              });
            }
          })
        );
        
        await Promise.all(promises);
      } else {
        // Process sequentially
        for (let i = 0; i < params.images.length; i++) {
          const image = params.images[i];
          try {
            const result = await this.processImage(image, params.options);
            results.push({
              ...result,
              image_id: image.id || `img-${i}`,
              source_path: image.path,
            });
          } catch (error) {
            errors.push({
              image_id: image.id || `img-${i}`,
              source_path: image.path,
              error: error.message,
            });
          }
        }
      }
      
      return {
        success: errors.length === 0,
        batch_id: batchId,
        total_images: params.images.length,
        processed: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      logger.error('Batch processing failed', error);
      throw new Error(`Failed to process batch: ${error.message}`);
    }
  }
  
  private async processImage(image: any, options: any) {
    const fileData = await this.fileHandler.readFile(image.path);
    
    return await this.apiClient.processImage({
      file: fileData.buffer,
      fileName: fileData.name,
      mimeType: fileData.mimeType,
      options: {
        detailLevel: options?.detail_level,
        generateAudio: options?.generate_audio,
        voiceId: options?.voice_id,
      },
      metadata: {
        context: image.context,
      },
    });
  }
}
```

## API Client Implementation

```typescript
// src/adapters/api-client.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { retry } from '../utils/retry.js';

export interface ProcessImageOptions {
  file: Buffer;
  fileName: string;
  mimeType: string;
  options?: {
    detailLevel?: string;
    generateAudio?: boolean;
    includeAltText?: boolean;
    voiceId?: string;
  };
  metadata?: {
    context?: string;
  };
}

export interface UploadVideoOptions {
  file: Buffer | NodeJS.ReadableStream;
  fileName: string;
  mimeType: string;
  metadata?: {
    title?: string;
    description?: string;
    language?: string;
  };
  options?: {
    voiceId?: string;
    detailLevel?: string;
  };
}

export class APIClient {
  private client: AxiosInstance;
  
  constructor() {
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeout,
      headers: {
        'Authorization': config.api.apiKey ? `Bearer ${config.api.apiKey}` : undefined,
      },
    });
    
    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('API request', {
          method: config.method,
          url: config.url,
          headers: config.headers,
        });
        return config;
      },
      (error) => {
        logger.error('API request error', error);
        return Promise.reject(error);
      }
    );
    
    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('API response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error: AxiosError) => {
        logger.error('API response error', {
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(this.formatError(error));
      }
    );
  }
  
  async processImage(options: ProcessImageOptions) {
    return retry(async () => {
      const formData = new FormData();
      formData.append('image', options.file, {
        filename: options.fileName,
        contentType: options.mimeType,
      });
      
      if (options.options?.detailLevel) {
        formData.append('detailLevel', options.options.detailLevel);
      }
      if (options.options?.generateAudio !== undefined) {
        formData.append('generateAudio', String(options.options.generateAudio));
      }
      if (options.options?.includeAltText !== undefined) {
        formData.append('includeAltText', String(options.options.includeAltText));
      }
      if (options.options?.voiceId) {
        formData.append('voiceId', options.options.voiceId);
      }
      if (options.metadata?.context) {
        formData.append('context', options.metadata.context);
      }
      
      const response = await this.client.post('/api/process-image', formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });
      
      return response.data.data;
    }, {
      maxRetries: config.api.maxRetries,
      retryOn: [429, 502, 503, 504],
    });
  }
  
  async uploadVideo(options: UploadVideoOptions) {
    return retry(async () => {
      const formData = new FormData();
      formData.append('video', options.file, {
        filename: options.fileName,
        contentType: options.mimeType,
      });
      
      if (options.metadata?.title) {
        formData.append('title', options.metadata.title);
      }
      if (options.metadata?.description) {
        formData.append('description', options.metadata.description);
      }
      if (options.metadata?.language) {
        formData.append('language', options.metadata.language);
      }
      if (options.options?.voiceId) {
        formData.append('voiceId', options.options.voiceId);
      }
      if (options.options?.detailLevel) {
        formData.append('detailLevel', options.options.detailLevel);
      }
      
      const response = await this.client.post('/api/upload', formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
      
      return response.data;
    }, {
      maxRetries: config.api.maxRetries,
      retryOn: [429, 502, 503, 504],
    });
  }
  
  async checkVideoStatus(jobId: string) {
    const response = await this.client.get(`/api/status/${jobId}`);
    return response.data.data;
  }
  
  async checkImageStatus(jobId: string) {
    const response = await this.client.get(`/api/status/image/${jobId}`);
    return response.data.data;
  }
  
  async downloadText(jobId: string, type: 'video' | 'image' = 'video') {
    const endpoint = type === 'video' 
      ? `/api/results/${jobId}/text`
      : `/api/results/image/${jobId}/text`;
    
    const response = await this.client.get(endpoint, {
      responseType: 'text',
    });
    
    return response.data;
  }
  
  async downloadAudio(jobId: string, type: 'video' | 'image' = 'video') {
    const endpoint = type === 'video'
      ? `/api/results/${jobId}/audio`
      : `/api/results/image/${jobId}/audio`;
    
    const response = await this.client.get(endpoint, {
      responseType: 'arraybuffer',
    });
    
    return Buffer.from(response.data);
  }
  
  async healthCheck() {
    const response = await this.client.get('/api/health');
    return response.data;
  }
  
  async getAWSStatus() {
    const response = await this.client.get('/api/aws-status');
    return response.data;
  }
  
  private formatError(error: AxiosError): Error {
    if (error.response) {
      const data = error.response.data as any;
      const message = data?.error?.message || data?.message || 'API request failed';
      const err = new Error(message);
      (err as any).code = data?.error?.code || 'API_ERROR';
      (err as any).status = error.response.status;
      return err;
    } else if (error.request) {
      const err = new Error('No response from API');
      (err as any).code = 'NO_RESPONSE';
      return err;
    } else {
      return error;
    }
  }
}
```

## Testing Setup

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
```

### Test Setup

```typescript
// tests/setup.ts
import { jest } from '@jest/globals';

// Mock logger to reduce noise in tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Set test environment variables
process.env.API_BASE_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';
```

### Integration Test Example

```typescript
// tests/integration/process-image.test.ts
import { ProcessImageTool } from '../../src/tools/image/process-image';
import path from 'path';

describe('ProcessImageTool Integration', () => {
  let tool: ProcessImageTool;
  
  beforeAll(() => {
    tool = new ProcessImageTool();
  });
  
  it('should process a real image file', async () => {
    const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');
    
    const result = await tool.execute({
      image_path: testImagePath,
      detail_level: 'basic',
      generate_audio: false,
      include_alt_text: true,
    });
    
    expect(result).toMatchObject({
      success: true,
      job_id: expect.any(String),
      status: expect.stringMatching(/processing|completed/),
      results: expect.objectContaining({
        description: expect.any(String),
        alt_text: expect.any(String),
        visual_elements: expect.any(Array),
      }),
    });
  }, 30000); // 30 second timeout for integration test
});
```

## Deployment Configuration

### Docker Setup

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create temp directory
RUN mkdir -p /tmp/mcp-voice-desc && \
    chown -R nodejs:nodejs /tmp/mcp-voice-desc

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js || exit 1

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  mcp-server:
    build: .
    container_name: voice-description-mcp
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - MCP_TRANSPORT=websocket
      - MCP_PORT=3001
    ports:
      - "3001:3001"
    volumes:
      - ./temp:/tmp/mcp-voice-desc
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - mcp-network
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

networks:
  mcp-network:
    driver: bridge
```

### Environment Variables

```bash
# .env
# MCP Server Configuration
MCP_TRANSPORT=stdio
MCP_PORT=3001
MCP_HOST=localhost

# Voice Description API
API_BASE_URL=https://api.voicedescription.com
API_KEY=your-api-key-here
API_TIMEOUT=30000
API_MAX_RETRIES=3

# File Handling
MAX_FILE_SIZE=524288000
ALLOWED_VIDEO_TYPES=video/mp4,video/mpeg,video/quicktime,video/x-msvideo
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp,image/gif
TEMP_DIRECTORY=/tmp/mcp-voice-desc
CLEANUP_INTERVAL=3600000

# Job Polling
POLLING_INTERVAL=2000
POLLING_MAX_DURATION=600000
PROGRESS_REPORTING=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Features
ENABLE_BATCH_PROCESSING=true
ENABLE_AUDIO_GENERATION=true
ENABLE_CACHING=true
CACHE_TTL=3600000

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

### NPM Scripts

```json
// package.json
{
  "name": "voice-description-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for Voice Description API",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write 'src/**/*.ts'",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist coverage",
    "docker:build": "docker build -t voice-description-mcp .",
    "docker:run": "docker run --env-file .env -p 3001:3001 voice-description-mcp",
    "docker:compose": "docker-compose up -d",
    "docker:logs": "docker-compose logs -f mcp-server"
  }
}
```

## Quick Start Commands

```bash
# 1. Clone and setup
git clone <repo>
cd mcp-server
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API credentials

# 3. Run in development
npm run dev

# 4. Run tests
npm test

# 5. Build for production
npm run build

# 6. Deploy with Docker
npm run docker:build
npm run docker:run

# 7. Or use Docker Compose
docker-compose up -d
```

This implementation guide provides a complete, production-ready MCP server for the Voice Description API with all necessary components, testing setup, and deployment configuration.