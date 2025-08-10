# MCP Server Architecture for Voice Description API

## Executive Summary

This document outlines the comprehensive architecture for implementing a Model Control Protocol (MCP) server that exposes the Voice Description API's capabilities to AI assistants and language models. The MCP server will provide structured tools for video and image processing, job management, and result retrieval through a standardized protocol.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Core Components](#core-components)
4. [Tool Definitions](#tool-definitions)
5. [Implementation Patterns](#implementation-patterns)
6. [Configuration Management](#configuration-management)
7. [Error Handling Strategy](#error-handling-strategy)
8. [Security Considerations](#security-considerations)
9. [Deployment Architecture](#deployment-architecture)
10. [Testing Strategy](#testing-strategy)

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Assistant / LLM                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ MCP Protocol
┌──────────────────────▼──────────────────────────────────────┐
│                      MCP Server                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │                 Protocol Handler                    │     │
│  │  • Request validation                              │     │
│  │  • Tool routing                                    │     │
│  │  • Response formatting                             │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │                  Tool Registry                      │     │
│  │  • Tool discovery                                  │     │
│  │  • Parameter validation                            │     │
│  │  • Execution management                            │     │
│  └────────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────┐     │
│  │               Service Adapters                      │     │
│  │  • API Client wrapper                              │     │
│  │  • File handling                                   │     │
│  │  • Job polling manager                             │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│              Voice Description API                           │
│  • Video processing endpoints                               │
│  • Image processing endpoints                               │
│  • Job management                                           │
│  • AWS service integration                                  │
└──────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
mcp-server/
├── package.json                    # MCP server dependencies
├── tsconfig.json                   # TypeScript configuration
├── .env.example                    # Environment variables template
├── README.md                       # MCP server documentation
│
├── src/
│   ├── index.ts                    # Main server entry point
│   ├── server.ts                   # MCP server implementation
│   │
│   ├── protocol/                   # MCP protocol handling
│   │   ├── handler.ts              # Main protocol handler
│   │   ├── transport.ts            # Transport layer (stdio/websocket)
│   │   ├── messages.ts             # Message type definitions
│   │   └── validation.ts           # Request/response validation
│   │
│   ├── tools/                      # Tool implementations
│   │   ├── registry.ts             # Tool registry and discovery
│   │   ├── base.ts                 # Base tool class
│   │   │
│   │   ├── video/                  # Video processing tools
│   │   │   ├── upload.ts           # Upload video tool
│   │   │   ├── process.ts          # Process video tool
│   │   │   └── status.ts           # Check video status tool
│   │   │
│   │   ├── image/                  # Image processing tools
│   │   │   ├── process.ts          # Process single image
│   │   │   ├── batch.ts            # Batch process images
│   │   │   └── status.ts           # Check image status
│   │   │
│   │   ├── results/                # Result retrieval tools
│   │   │   ├── download.ts         # Download results
│   │   │   ├── text.ts             # Get text description
│   │   │   └── audio.ts            # Get audio file
│   │   │
│   │   └── system/                 # System tools
│   │       ├── health.ts           # Health check tool
│   │       ├── aws-status.ts       # AWS service status
│   │       └── capabilities.ts     # List capabilities
│   │
│   ├── adapters/                   # Service adapters
│   │   ├── api-client.ts           # HTTP client for API
│   │   ├── file-handler.ts         # File upload/download
│   │   ├── job-poller.ts           # Job status polling
│   │   └── websocket-client.ts     # Real-time updates
│   │
│   ├── config/                     # Configuration
│   │   ├── index.ts                # Main config loader
│   │   ├── api.ts                  # API configuration
│   │   ├── auth.ts                 # Authentication config
│   │   └── logging.ts              # Logging configuration
│   │
│   ├── utils/                      # Utilities
│   │   ├── logger.ts               # Logging utility
│   │   ├── errors.ts               # Error handling
│   │   ├── retry.ts                # Retry logic
│   │   └── validators.ts           # Input validators
│   │
│   └── types/                      # TypeScript types
│       ├── mcp.ts                  # MCP protocol types
│       ├── tools.ts                # Tool type definitions
│       ├── api.ts                  # API response types
│       └── config.ts               # Configuration types
│
├── tests/                          # Test files
│   ├── unit/                       # Unit tests
│   ├── integration/                # Integration tests
│   └── fixtures/                   # Test fixtures
│
└── scripts/                        # Build and deployment
    ├── build.sh                    # Build script
    ├── deploy.sh                   # Deployment script
    └── generate-manifest.ts        # Generate MCP manifest
```

## Core Components

### 1. Protocol Handler (`src/protocol/handler.ts`)

```typescript
interface ProtocolHandler {
  // Handle incoming MCP requests
  handleRequest(request: MCPRequest): Promise<MCPResponse>;
  
  // Validate request format and parameters
  validateRequest(request: MCPRequest): ValidationResult;
  
  // Route to appropriate tool
  routeToTool(toolName: string, params: any): Promise<any>;
  
  // Format response according to MCP spec
  formatResponse(result: any, request: MCPRequest): MCPResponse;
  
  // Handle errors and format error responses
  handleError(error: Error, request: MCPRequest): MCPErrorResponse;
}
```

### 2. Tool Registry (`src/tools/registry.ts`)

```typescript
interface ToolRegistry {
  // Register a new tool
  register(tool: MCPTool): void;
  
  // Get tool by name
  getTool(name: string): MCPTool | undefined;
  
  // List all available tools
  listTools(): ToolDefinition[];
  
  // Execute tool with parameters
  executeTool(name: string, params: any): Promise<any>;
  
  // Validate tool parameters
  validateParams(tool: MCPTool, params: any): ValidationResult;
}
```

### 3. API Client Adapter (`src/adapters/api-client.ts`)

```typescript
interface APIClient {
  // Initialize with configuration
  constructor(config: APIConfig);
  
  // Video operations
  uploadVideo(file: Buffer, metadata: VideoMetadata): Promise<JobResponse>;
  processVideo(s3Uri: string, options: ProcessOptions): Promise<JobResponse>;
  
  // Image operations
  processImage(image: Buffer, options: ImageOptions): Promise<ImageResult>;
  batchProcessImages(images: ImageBatch[]): Promise<BatchResult>;
  
  // Job management
  checkStatus(jobId: string, type: 'video' | 'image'): Promise<JobStatus>;
  downloadResults(jobId: string, format: 'text' | 'audio'): Promise<Buffer>;
  
  // System operations
  healthCheck(): Promise<HealthStatus>;
  getAWSStatus(): Promise<AWSStatus>;
}
```

## Tool Definitions

### Video Processing Tools

#### 1. `voice_description_upload_video`

```typescript
{
  name: "voice_description_upload_video",
  description: "Upload and process a video file for audio description generation",
  parameters: {
    file_path: {
      type: "string",
      description: "Path to the video file to upload",
      required: true
    },
    title: {
      type: "string",
      description: "Title of the video content",
      required: false
    },
    description: {
      type: "string",
      description: "Additional context about the video",
      required: false
    },
    language: {
      type: "string",
      description: "Target language for descriptions (default: en)",
      required: false,
      enum: ["en", "es", "fr", "de", "ja", "zh"]
    },
    voice_id: {
      type: "string",
      description: "AWS Polly voice ID for audio generation",
      required: false,
      default: "Joanna"
    },
    detail_level: {
      type: "string",
      description: "Level of detail in descriptions",
      required: false,
      enum: ["basic", "detailed", "comprehensive"],
      default: "detailed"
    }
  },
  returns: {
    job_id: "string",
    status: "string",
    estimated_time: "number",
    status_url: "string"
  }
}
```

#### 2. `voice_description_process_video_url`

```typescript
{
  name: "voice_description_process_video_url",
  description: "Process a video from an S3 URL",
  parameters: {
    s3_uri: {
      type: "string",
      description: "S3 URI of the video file",
      required: true,
      pattern: "^s3://[a-z0-9.-]+/.*$"
    },
    options: {
      type: "object",
      description: "Processing options",
      properties: {
        title: "string",
        language: "string",
        voice_id: "string",
        detail_level: "string"
      }
    }
  }
}
```

### Image Processing Tools

#### 3. `voice_description_process_image`

```typescript
{
  name: "voice_description_process_image",
  description: "Process a single image for accessibility description",
  parameters: {
    image_path: {
      type: "string",
      description: "Path to the image file",
      required: true
    },
    detail_level: {
      type: "string",
      enum: ["basic", "comprehensive", "technical"],
      default: "comprehensive"
    },
    generate_audio: {
      type: "boolean",
      description: "Generate audio narration",
      default: true
    },
    include_alt_text: {
      type: "boolean",
      description: "Include HTML alt text",
      default: true
    },
    context: {
      type: "string",
      description: "Additional context about the image usage"
    }
  },
  returns: {
    description: "string",
    alt_text: "string",
    visual_elements: "array",
    audio_url: "string",
    html_metadata: "object"
  }
}
```

#### 4. `voice_description_batch_images`

```typescript
{
  name: "voice_description_batch_images",
  description: "Process multiple images in batch",
  parameters: {
    images: {
      type: "array",
      description: "Array of image configurations",
      items: {
        path: "string",
        id: "string",
        context: "string"
      },
      required: true,
      minItems: 1,
      maxItems: 50
    },
    options: {
      type: "object",
      properties: {
        detail_level: "string",
        generate_audio: "boolean",
        voice_id: "string"
      }
    }
  },
  returns: {
    batch_id: "string",
    total_images: "number",
    status: "string",
    results: "array"
  }
}
```

### Job Management Tools

#### 5. `voice_description_check_status`

```typescript
{
  name: "voice_description_check_status",
  description: "Check processing status of a job",
  parameters: {
    job_id: {
      type: "string",
      description: "Job ID to check",
      required: true
    },
    job_type: {
      type: "string",
      enum: ["video", "image", "batch"],
      description: "Type of job",
      required: true
    },
    wait_for_completion: {
      type: "boolean",
      description: "Poll until job completes",
      default: false
    },
    timeout: {
      type: "number",
      description: "Timeout in seconds for polling",
      default: 300
    }
  }
}
```

#### 6. `voice_description_download_results`

```typescript
{
  name: "voice_description_download_results",
  description: "Download processing results",
  parameters: {
    job_id: {
      type: "string",
      required: true
    },
    format: {
      type: "string",
      enum: ["text", "audio", "json", "all"],
      default: "all"
    },
    save_to: {
      type: "string",
      description: "Directory to save results",
      required: false
    }
  }
}
```

### System Tools

#### 7. `voice_description_health_check`

```typescript
{
  name: "voice_description_health_check",
  description: "Check API health and system status",
  parameters: {
    include_details: {
      type: "boolean",
      default: false
    }
  }
}
```

#### 8. `voice_description_aws_status`

```typescript
{
  name: "voice_description_aws_status",
  description: "Check AWS service status and quotas",
  parameters: {
    services: {
      type: "array",
      items: {
        type: "string",
        enum: ["s3", "rekognition", "bedrock", "polly", "all"]
      },
      default: ["all"]
    }
  }
}
```

## Implementation Patterns

### 1. Base Tool Class

```typescript
// src/tools/base.ts
export abstract class MCPTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: ParameterSchema;
  
  // Validate parameters before execution
  validateParams(params: any): ValidationResult {
    return validateAgainstSchema(params, this.parameters);
  }
  
  // Execute the tool
  abstract execute(params: any, context: ToolContext): Promise<any>;
  
  // Handle errors consistently
  protected handleError(error: Error): MCPToolError {
    return new MCPToolError(
      this.name,
      error.message,
      error.stack
    );
  }
  
  // Common retry logic
  protected async retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries || 3;
    const delay = options.initialDelay || 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await sleep(delay * Math.pow(2, attempt - 1));
      }
    }
    throw new Error('Retry failed');
  }
}
```

### 2. File Handling Pattern

```typescript
// src/adapters/file-handler.ts
export class FileHandler {
  private tempDir: string;
  
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'mcp-voice-desc');
    fs.mkdirSync(this.tempDir, { recursive: true });
  }
  
  // Handle file uploads with streaming
  async prepareFileUpload(filePath: string): Promise<UploadData> {
    const stats = await fs.promises.stat(filePath);
    
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE} bytes`);
    }
    
    // For large files, use streaming
    if (stats.size > STREAM_THRESHOLD) {
      return {
        stream: fs.createReadStream(filePath),
        size: stats.size,
        mimetype: mime.getType(filePath)
      };
    }
    
    // For smaller files, use buffer
    const buffer = await fs.promises.readFile(filePath);
    return {
      buffer,
      size: stats.size,
      mimetype: mime.getType(filePath)
    };
  }
  
  // Clean up temporary files
  async cleanup(fileId: string): Promise<void> {
    const pattern = path.join(this.tempDir, `${fileId}*`);
    const files = await glob(pattern);
    
    await Promise.all(
      files.map(file => fs.promises.unlink(file))
    );
  }
  
  // Download and save results
  async saveResults(data: Buffer, jobId: string, format: string): Promise<string> {
    const outputPath = path.join(this.tempDir, `${jobId}.${format}`);
    await fs.promises.writeFile(outputPath, data);
    return outputPath;
  }
}
```

### 3. Job Polling Pattern

```typescript
// src/adapters/job-poller.ts
export class JobPoller {
  private activePolls: Map<string, AbortController> = new Map();
  
  async pollJob(
    jobId: string,
    checkFn: () => Promise<JobStatus>,
    options: PollOptions = {}
  ): Promise<JobStatus> {
    const {
      interval = 2000,
      timeout = 300000,
      onProgress
    } = options;
    
    const abortController = new AbortController();
    this.activePolls.set(jobId, abortController);
    
    const startTime = Date.now();
    
    try {
      while (!abortController.signal.aborted) {
        const status = await checkFn();
        
        if (onProgress) {
          onProgress(status);
        }
        
        if (status.status === 'completed') {
          return status;
        }
        
        if (status.status === 'failed') {
          throw new Error(status.error?.message || 'Job failed');
        }
        
        if (Date.now() - startTime > timeout) {
          throw new Error('Job polling timeout');
        }
        
        await sleep(interval);
      }
      
      throw new Error('Job polling aborted');
    } finally {
      this.activePolls.delete(jobId);
    }
  }
  
  // Cancel active polling
  cancelPoll(jobId: string): void {
    const controller = this.activePolls.get(jobId);
    if (controller) {
      controller.abort();
      this.activePolls.delete(jobId);
    }
  }
  
  // Cancel all active polls
  cancelAll(): void {
    for (const controller of this.activePolls.values()) {
      controller.abort();
    }
    this.activePolls.clear();
  }
}
```

## Configuration Management

### Environment Configuration

```typescript
// src/config/index.ts
export interface MCPServerConfig {
  // Server configuration
  server: {
    transport: 'stdio' | 'websocket';
    port?: number;
    host?: string;
  };
  
  // API configuration
  api: {
    baseUrl: string;
    apiKey?: string;
    timeout: number;
    maxRetries: number;
  };
  
  // File handling
  files: {
    maxSize: number;
    allowedTypes: string[];
    tempDirectory: string;
    cleanupInterval: number;
  };
  
  // Job polling
  polling: {
    defaultInterval: number;
    maxDuration: number;
    progressReporting: boolean;
  };
  
  // Logging
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    destination: 'console' | 'file';
    filePath?: string;
  };
  
  // Feature flags
  features: {
    batchProcessing: boolean;
    audioGeneration: boolean;
    realtimeUpdates: boolean;
    caching: boolean;
  };
}
```

### Environment Variables

```bash
# .env.example

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
MAX_FILE_SIZE=524288000  # 500MB
ALLOWED_FILE_TYPES=video/mp4,video/mpeg,image/jpeg,image/png
TEMP_DIRECTORY=/tmp/mcp-voice-desc
CLEANUP_INTERVAL=3600000  # 1 hour

# Job Polling
POLLING_INTERVAL=2000
POLLING_MAX_DURATION=300000
PROGRESS_REPORTING=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_DESTINATION=console

# Feature Flags
ENABLE_BATCH_PROCESSING=true
ENABLE_AUDIO_GENERATION=true
ENABLE_REALTIME_UPDATES=false
ENABLE_CACHING=true

# AWS Configuration (optional, for direct S3 operations)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

## Error Handling Strategy

### Error Types and Handling

```typescript
// src/utils/errors.ts

export enum ErrorCode {
  // Input errors
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  
  // API errors
  API_UNAVAILABLE = 'API_UNAVAILABLE',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  API_AUTHENTICATION_FAILED = 'API_AUTHENTICATION_FAILED',
  
  // Processing errors
  JOB_FAILED = 'JOB_FAILED',
  JOB_TIMEOUT = 'JOB_TIMEOUT',
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  
  // System errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED'
}

export class MCPError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public details?: any,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'MCPError';
  }
  
  toMCPResponse(): MCPErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details
      }
    };
  }
}

export class ErrorHandler {
  static handle(error: any): MCPErrorResponse {
    // Known MCP errors
    if (error instanceof MCPError) {
      return error.toMCPResponse();
    }
    
    // API errors
    if (error.response) {
      return this.handleAPIError(error);
    }
    
    // Network errors
    if (error.code === 'ECONNREFUSED') {
      return new MCPError(
        ErrorCode.API_UNAVAILABLE,
        'Voice Description API is unavailable',
        { originalError: error.message },
        true
      ).toMCPResponse();
    }
    
    // Default error
    return new MCPError(
      ErrorCode.INTERNAL_ERROR,
      'An unexpected error occurred',
      { originalError: error.message }
    ).toMCPResponse();
  }
  
  private static handleAPIError(error: any): MCPErrorResponse {
    const status = error.response.status;
    const data = error.response.data;
    
    if (status === 429) {
      return new MCPError(
        ErrorCode.API_RATE_LIMITED,
        'Rate limit exceeded',
        { retryAfter: error.response.headers['retry-after'] },
        true
      ).toMCPResponse();
    }
    
    if (status === 401 || status === 403) {
      return new MCPError(
        ErrorCode.API_AUTHENTICATION_FAILED,
        'Authentication failed',
        { status }
      ).toMCPResponse();
    }
    
    return new MCPError(
      ErrorCode.API_UNAVAILABLE,
      data?.error?.message || 'API request failed',
      { status, data }
    ).toMCPResponse();
  }
}
```

## Security Considerations

### 1. Authentication and Authorization

```typescript
// src/config/auth.ts
export class AuthManager {
  private apiKey: string;
  private tokenCache: Map<string, CachedToken> = new Map();
  
  constructor(config: AuthConfig) {
    this.apiKey = config.apiKey || process.env.API_KEY || '';
    
    if (!this.apiKey && config.requireAuth) {
      throw new Error('API key is required but not configured');
    }
  }
  
  // Add authentication headers
  getAuthHeaders(): Record<string, string> {
    if (!this.apiKey) return {};
    
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-API-Version': '1.0'
    };
  }
  
  // Validate API key format
  validateApiKey(key: string): boolean {
    const pattern = /^[a-zA-Z0-9]{32,}$/;
    return pattern.test(key);
  }
  
  // Rotate API keys (if supported)
  async rotateKey(): Promise<string> {
    // Implementation for key rotation
    throw new Error('Key rotation not implemented');
  }
}
```

### 2. Input Validation

```typescript
// src/utils/validators.ts
export class InputValidator {
  // Validate file paths
  static validateFilePath(path: string): ValidationResult {
    // Prevent path traversal
    if (path.includes('../') || path.includes('..\\')) {
      return {
        valid: false,
        error: 'Path traversal detected'
      };
    }
    
    // Check file exists
    if (!fs.existsSync(path)) {
      return {
        valid: false,
        error: 'File does not exist'
      };
    }
    
    // Check file permissions
    try {
      fs.accessSync(path, fs.constants.R_OK);
    } catch {
      return {
        valid: false,
        error: 'File is not readable'
      };
    }
    
    return { valid: true };
  }
  
  // Validate S3 URIs
  static validateS3Uri(uri: string): ValidationResult {
    const pattern = /^s3:\/\/[a-z0-9][a-z0-9.-]*[a-z0-9]\/[\w\-._~:/?#[\]@!$&'()*+,;=.]+$/;
    
    if (!pattern.test(uri)) {
      return {
        valid: false,
        error: 'Invalid S3 URI format'
      };
    }
    
    return { valid: true };
  }
  
  // Sanitize user input
  static sanitize(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim();
  }
}
```

### 3. Rate Limiting

```typescript
// src/utils/rate-limiter.ts
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000
  ) {}
  
  check(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Clean old requests
    const validRequests = requests.filter(
      time => now - time < this.windowMs
    );
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }
  
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }
}
```

## Deployment Architecture

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Switch to non-root user
USER nodejs

# Expose port for WebSocket transport
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  mcp-server:
    build: .
    container_name: mcp-voice-description
    environment:
      - MCP_TRANSPORT=websocket
      - MCP_PORT=3001
      - API_BASE_URL=${API_BASE_URL}
      - API_KEY=${API_KEY}
      - LOG_LEVEL=info
    ports:
      - "3001:3001"
    volumes:
      - ./temp:/tmp/mcp-voice-desc
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "dist/health-check.js"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - mcp-network

networks:
  mcp-network:
    driver: bridge
```

## Testing Strategy

### Unit Test Example

```typescript
// tests/unit/tools/image-process.test.ts
import { ProcessImageTool } from '../../../src/tools/image/process';
import { APIClient } from '../../../src/adapters/api-client';

jest.mock('../../../src/adapters/api-client');

describe('ProcessImageTool', () => {
  let tool: ProcessImageTool;
  let mockClient: jest.Mocked<APIClient>;
  
  beforeEach(() => {
    mockClient = new APIClient({} as any) as jest.Mocked<APIClient>;
    tool = new ProcessImageTool(mockClient);
  });
  
  describe('execute', () => {
    it('should process image successfully', async () => {
      const params = {
        image_path: '/tmp/test.jpg',
        detail_level: 'comprehensive',
        generate_audio: true
      };
      
      const expectedResult = {
        description: 'A beautiful landscape',
        alt_text: 'Landscape photo',
        audio_url: 'https://example.com/audio.mp3'
      };
      
      mockClient.processImage.mockResolvedValue(expectedResult);
      
      const result = await tool.execute(params, {} as any);
      
      expect(result).toEqual(expectedResult);
      expect(mockClient.processImage).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          detailLevel: 'comprehensive',
          generateAudio: true
        })
      );
    });
    
    it('should handle file read errors', async () => {
      const params = {
        image_path: '/nonexistent/file.jpg'
      };
      
      await expect(tool.execute(params, {} as any))
        .rejects.toThrow('File does not exist');
    });
  });
});
```

### Integration Test Example

```typescript
// tests/integration/mcp-server.test.ts
import { MCPServer } from '../../src/server';
import { MCPClient } from '@modelcontextprotocol/sdk';

describe('MCP Server Integration', () => {
  let server: MCPServer;
  let client: MCPClient;
  
  beforeAll(async () => {
    server = new MCPServer({
      transport: 'websocket',
      port: 3002
    });
    await server.start();
    
    client = new MCPClient('ws://localhost:3002');
    await client.connect();
  });
  
  afterAll(async () => {
    await client.disconnect();
    await server.stop();
  });
  
  it('should list available tools', async () => {
    const tools = await client.listTools();
    
    expect(tools).toContainEqual(
      expect.objectContaining({
        name: 'voice_description_process_image'
      })
    );
  });
  
  it('should process image through MCP', async () => {
    const result = await client.callTool(
      'voice_description_process_image',
      {
        image_path: './fixtures/test-image.jpg',
        detail_level: 'basic'
      }
    );
    
    expect(result).toHaveProperty('description');
    expect(result).toHaveProperty('alt_text');
  });
});
```

## Tech Stack and Dependencies

### Core Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "axios": "^1.6.0",
    "express": "^4.18.0",
    "ws": "^8.14.0",
    "multer": "^1.4.5",
    "mime-types": "^2.1.35",
    "uuid": "^9.0.0",
    "dotenv": "^16.3.0",
    "winston": "^3.11.0",
    "joi": "^17.11.0",
    "p-queue": "^7.4.0",
    "node-cache": "^5.1.2"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/ws": "^8.5.0",
    "@types/multer": "^1.4.0",
    "@types/mime-types": "^2.1.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.2.0",
    "tsx": "^4.0.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "eslint": "^8.50.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "prettier": "^3.0.0"
  }
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write 'src/**/*.ts'",
    "generate-manifest": "tsx scripts/generate-manifest.ts",
    "docker:build": "docker build -t mcp-voice-description .",
    "docker:run": "docker run -p 3001:3001 mcp-voice-description"
  }
}
```

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1)
- [ ] Set up project structure and TypeScript configuration
- [ ] Implement MCP protocol handler
- [ ] Create tool registry system
- [ ] Set up logging and error handling
- [ ] Implement configuration management

### Phase 2: API Integration (Week 2)
- [ ] Implement API client adapter
- [ ] Create file handling utilities
- [ ] Implement job polling mechanism
- [ ] Add retry logic and rate limiting
- [ ] Set up authentication

### Phase 3: Tool Implementation (Week 3-4)
- [ ] Implement video processing tools
- [ ] Implement image processing tools
- [ ] Create job management tools
- [ ] Add system monitoring tools
- [ ] Implement result download tools

### Phase 4: Testing and Documentation (Week 5)
- [ ] Write unit tests for all components
- [ ] Create integration tests
- [ ] Add performance tests
- [ ] Write user documentation
- [ ] Create deployment guides

### Phase 5: Deployment and Optimization (Week 6)
- [ ] Docker containerization
- [ ] CI/CD pipeline setup
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Production deployment

## Conclusion

This MCP server architecture provides a robust, scalable, and maintainable solution for exposing the Voice Description API through the Model Control Protocol. The modular design allows for easy extension and modification, while the comprehensive error handling and security measures ensure reliable operation in production environments.

The implementation follows best practices for TypeScript development, includes comprehensive testing strategies, and provides clear deployment paths for both development and production environments.