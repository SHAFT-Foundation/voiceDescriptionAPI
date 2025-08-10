# Voice Description MCP Server - Developer Guide

## Architecture Overview

The Voice Description MCP Server is built with a modular, extensible architecture that separates concerns and enables easy maintenance and testing.

## Table of Contents

- [Architecture](#architecture)
- [Code Structure](#code-structure)
- [Development Setup](#development-setup)
- [Adding New Tools](#adding-new-tools)
- [Testing Strategy](#testing-strategy)
- [Debugging](#debugging)
- [Performance Optimization](#performance-optimization)
- [Security Considerations](#security-considerations)
- [Contributing](#contributing)
- [Release Process](#release-process)

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────┐
│                    MCP Server Core                       │
├─────────────────────────────────────────────────────────┤
│  Protocol Layer                                          │
│  ├── MCP Message Handler                                 │
│  ├── WebSocket/STDIO Transport                          │
│  └── Request/Response Manager                           │
├─────────────────────────────────────────────────────────┤
│  Tool Registry                                          │
│  ├── Tool Registration                                  │
│  ├── Schema Validation (Zod)                           │
│  └── Tool Execution Engine                             │
├─────────────────────────────────────────────────────────┤
│  Tools Layer                                            │
│  ├── Video Tools       ├── Image Tools                  │
│  ├── Upload Video      ├── Process Image                │
│  └── Process URL       └── Batch Process                │
│                                                         │
│  ├── Result Tools      ├── System Tools                │
│  ├── Check Status      ├── Health Check                 │
│  └── Download Results  └── AWS Status                   │
├─────────────────────────────────────────────────────────┤
│  Adapters Layer                                         │
│  ├── API Client (HTTP/REST)                            │
│  ├── File Handler (FS/Streaming)                       │
│  └── Job Poller (Async/Polling)                        │
├─────────────────────────────────────────────────────────┤
│  Core Services                                          │
│  ├── Configuration Management                           │
│  ├── Logging (Winston)                                  │
│  ├── Error Handling                                     │
│  └── Retry Logic                                        │
└─────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Protocol Layer
- Handles MCP protocol communication
- Manages WebSocket and STDIO transports
- Routes messages to appropriate handlers

#### Tool Registry
- Maintains registry of available tools
- Validates tool parameters using Zod schemas
- Executes tools and manages lifecycle

#### Tools Layer
- Individual tool implementations
- Business logic for each operation
- Parameter processing and response formatting

#### Adapters Layer
- External service communication
- File system operations
- Asynchronous job management

#### Core Services
- Cross-cutting concerns
- Configuration management
- Logging and monitoring
- Error handling and recovery

## Code Structure

### Directory Layout

```
mcp-server/
├── src/
│   ├── index.ts                 # Entry point
│   ├── protocol/                # MCP protocol implementation
│   │   ├── server.ts           # MCP server class
│   │   ├── transport.ts        # Transport implementations
│   │   └── handlers.ts         # Message handlers
│   ├── tools/                   # Tool implementations
│   │   ├── registry.ts         # Tool registry
│   │   ├── base.ts             # Base tool class
│   │   ├── video/              # Video processing tools
│   │   ├── image/              # Image processing tools
│   │   ├── results/            # Result management tools
│   │   └── system/             # System monitoring tools
│   ├── adapters/                # External service adapters
│   │   ├── api-client.ts       # API communication
│   │   ├── file-handler.ts     # File operations
│   │   └── job-poller.ts       # Job monitoring
│   ├── config/                  # Configuration
│   │   ├── index.ts            # Config loader
│   │   ├── defaults.ts         # Default values
│   │   └── validation.ts       # Config validation
│   ├── types/                   # TypeScript types
│   │   ├── index.ts            # Main type exports
│   │   ├── tools.ts            # Tool interfaces
│   │   ├── protocol.ts         # Protocol types
│   │   └── api.ts              # API types
│   └── utils/                   # Utilities
│       ├── logger.ts           # Logging utility
│       ├── retry.ts            # Retry logic
│       ├── validation.ts       # Validation helpers
│       └── errors.ts           # Error classes
├── tests/                       # Test suite
├── scripts/                     # Build and deployment
└── docs/                        # Documentation
```

### Key Files

#### Entry Point (`src/index.ts`)

```typescript
import { MCPServer } from './protocol/server.js';
import { registerAllTools } from './tools/index.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    // Initialize MCP server
    const server = new MCPServer(config);
    
    // Register all tools
    const toolCount = await registerAllTools(server.registry);
    logger.info(`Registered ${toolCount} tools`);
    
    // Start server
    await server.start();
    logger.info('MCP Server started successfully');
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

main();
```

#### Base Tool Class (`src/tools/base.ts`)

```typescript
import { z } from 'zod';

export interface ToolContext {
  requestId: string;
  timestamp: string;
  user?: string;
}

export abstract class BaseTool<TInput = any, TOutput = any> {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: z.ZodSchema<TInput>;
  
  abstract execute(
    params: TInput,
    context: ToolContext
  ): Promise<TOutput>;
  
  validate(params: unknown): TInput {
    return this.inputSchema.parse(params);
  }
}
```

## Development Setup

### Prerequisites

1. **Node.js 18+**
   ```bash
   node --version  # Should be 18.0.0 or higher
   ```

2. **TypeScript 5+**
   ```bash
   npm install -g typescript
   tsc --version  # Should be 5.0.0 or higher
   ```

3. **Development Dependencies**
   ```bash
   cd mcp-server
   npm install
   ```

### Environment Setup

1. **Create Development Environment**
   ```bash
   cp .env.example .env.development
   ```

2. **Configure for Development**
   ```env
   NODE_ENV=development
   LOG_LEVEL=debug
   API_BASE_URL=http://localhost:3000
   API_KEY=dev-api-key
   
   # Development features
   ENABLE_DEBUG=true
   MOCK_AWS_SERVICES=true
   DISABLE_RATE_LIMITING=true
   ```

3. **Start Development Server**
   ```bash
   npm run dev  # Starts with hot reload
   ```

### Development Tools

#### Hot Reload

```json
// package.json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "dev:debug": "tsx watch --inspect src/index.ts"
  }
}
```

#### TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## Adding New Tools

### Step-by-Step Guide

#### 1. Define Tool Schema

```typescript
// src/tools/custom/my-tool.ts
import { z } from 'zod';

const myToolSchema = z.object({
  input_field: z.string().min(1),
  options: z.object({
    setting1: z.boolean().optional(),
    setting2: z.number().optional()
  }).optional()
});
```

#### 2. Implement Tool Class

```typescript
import { Tool, ToolContext, MCPToolError } from '../../types/index.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('my-tool');

export class MyCustomTool implements Tool {
  name = 'voice_description_my_custom_tool';
  description = 'Description of what this tool does';
  inputSchema = myToolSchema;
  
  async execute(
    params: z.infer<typeof myToolSchema>,
    context: ToolContext
  ) {
    logger.info('Executing custom tool', {
      params,
      requestId: context.requestId
    });
    
    try {
      // Tool implementation
      const result = await this.processCustomLogic(params);
      
      return {
        success: true,
        result: result
      };
      
    } catch (error) {
      logger.error('Tool execution failed', error);
      
      throw new MCPToolError(
        'PROCESSING_FAILED',
        'Failed to execute custom tool',
        { originalError: error }
      );
    }
  }
  
  private async processCustomLogic(params: any) {
    // Implementation details
    return {};
  }
}
```

#### 3. Register Tool

```typescript
// src/tools/index.ts
import { MyCustomTool } from './custom/my-tool.js';

export async function registerAllTools(registry: ToolRegistry) {
  const tools = [
    // ... existing tools
    new MyCustomTool(),
  ];
  
  // Registration logic
}
```

#### 4. Add Tests

```typescript
// tests/unit/tools/custom/my-tool.test.ts
import { MyCustomTool } from '../../../../src/tools/custom/my-tool';

describe('MyCustomTool', () => {
  let tool: MyCustomTool;
  
  beforeEach(() => {
    tool = new MyCustomTool();
  });
  
  describe('execute', () => {
    it('should process input successfully', async () => {
      const result = await tool.execute(
        { input_field: 'test' },
        { requestId: 'test-123', timestamp: new Date().toISOString() }
      );
      
      expect(result.success).toBe(true);
    });
    
    it('should validate input parameters', () => {
      expect(() => {
        tool.validate({ invalid: 'params' });
      }).toThrow();
    });
  });
});
```

## Testing Strategy

### Test Structure

```
tests/
├── unit/                 # Unit tests
│   ├── tools/           # Tool tests
│   ├── adapters/        # Adapter tests
│   └── utils/           # Utility tests
├── integration/          # Integration tests
│   ├── api/            # API integration
│   └── e2e/            # End-to-end workflows
├── performance/          # Performance tests
│   ├── load/           # Load testing
│   └── stress/         # Stress testing
├── fixtures/            # Test data
└── utils/               # Test utilities
```

### Unit Testing

#### Testing Tools

```typescript
// tests/unit/tools/image/process-image.test.ts
import { ProcessImageTool } from '../../../../src/tools/image/process-image';
import { mockAPIClient } from '../../../utils/mocks';

describe('ProcessImageTool', () => {
  let tool: ProcessImageTool;
  let apiClient: jest.Mocked<APIClient>;
  
  beforeEach(() => {
    apiClient = mockAPIClient();
    tool = new ProcessImageTool();
    tool['apiClient'] = apiClient;
  });
  
  it('should process image with comprehensive detail', async () => {
    // Arrange
    apiClient.processImage.mockResolvedValue({
      jobId: 'test-123',
      status: 'completed',
      results: {
        description: 'Test description',
        altText: 'Test alt text',
        confidence: 0.95
      }
    });
    
    // Act
    const result = await tool.execute({
      image_path: '/test/image.jpg',
      detail_level: 'comprehensive'
    }, mockContext());
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.results.description).toBe('Test description');
    expect(apiClient.processImage).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          detailLevel: 'comprehensive'
        })
      })
    );
  });
});
```

### Integration Testing

```typescript
// tests/integration/e2e-workflows.test.ts
describe('E2E Workflows', () => {
  let server: MCPServer;
  
  beforeAll(async () => {
    server = await startTestServer();
  });
  
  afterAll(async () => {
    await server.stop();
  });
  
  it('should complete image processing workflow', async () => {
    // Upload image
    const uploadResult = await server.executeTool({
      name: 'voice_description_process_image',
      arguments: {
        image_path: fixtures.testImage
      }
    });
    
    expect(uploadResult.success).toBe(true);
    expect(uploadResult.job_id).toBeDefined();
    
    // Check results
    const results = await server.executeTool({
      name: 'voice_description_download_results',
      arguments: {
        job_id: uploadResult.job_id
      }
    });
    
    expect(results.text).toBeDefined();
    expect(results.audio).toBeDefined();
  });
});
```

### Performance Testing

```typescript
// tests/performance/load-tests.test.ts
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  it('should handle concurrent image processing', async () => {
    const concurrentRequests = 10;
    const startTime = performance.now();
    
    const promises = Array(concurrentRequests).fill(0).map(() =>
      processImage('/test/image.jpg')
    );
    
    const results = await Promise.all(promises);
    const endTime = performance.now();
    
    const duration = endTime - startTime;
    const avgTime = duration / concurrentRequests;
    
    expect(avgTime).toBeLessThan(2000); // < 2s per image
    expect(results.every(r => r.success)).toBe(true);
  });
});
```

### Test Coverage

```bash
# Run tests with coverage
npm run test:coverage

# Coverage requirements
# - Statements: > 90%
# - Branches: > 85%
# - Functions: > 90%
# - Lines: > 90%
```

## Debugging

### Debug Configuration

#### VS Code Launch Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug MCP Server",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/index.ts",
      "preLaunchTask": "tsc: build",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "env": {
        "LOG_LEVEL": "debug",
        "NODE_ENV": "development"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Current Test",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--runInBand",
        "--no-coverage",
        "${relativeFile}"
      ],
      "console": "integratedTerminal"
    }
  ]
}
```

### Logging

#### Structured Logging

```typescript
// src/utils/logger.ts
import winston from 'winston';

export function createLogger(component: string) {
  return winston.createLogger({
    defaultMeta: { component },
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ]
  });
}

// Usage
const logger = createLogger('my-component');

logger.info('Processing started', {
  jobId: '123',
  params: { /* ... */ }
});

logger.error('Processing failed', {
  error: error.message,
  stack: error.stack,
  jobId: '123'
});
```

### Debug Tools

#### Request Tracing

```typescript
// src/middleware/tracing.ts
export function traceRequest(req: Request, res: Response, next: Next) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Add to context
  req.context = { requestId, startTime };
  
  // Log request
  logger.debug('Request received', {
    requestId,
    method: req.method,
    path: req.path,
    params: req.params
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.debug('Request completed', {
      requestId,
      status: res.statusCode,
      duration
    });
  });
  
  next();
}
```

## Performance Optimization

### Optimization Strategies

#### 1. Connection Pooling

```typescript
// src/adapters/api-client.ts
import axios from 'axios';
import http from 'http';
import https from 'https';

const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 10
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10
});

export const apiClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 30000
});
```

#### 2. Caching

```typescript
// src/utils/cache.ts
import NodeCache from 'node-cache';

export class Cache {
  private cache: NodeCache;
  
  constructor(ttl: number = 300) {
    this.cache = new NodeCache({
      stdTTL: ttl,
      checkperiod: ttl * 0.2
    });
  }
  
  async get<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.cache.get<T>(key);
    if (cached) return cached;
    
    const value = await factory();
    this.cache.set(key, value);
    return value;
  }
}

// Usage
const cache = new Cache(300); // 5 minute TTL

const result = await cache.get(`job:${jobId}`, async () => {
  return await apiClient.getJobStatus(jobId);
});
```

#### 3. Stream Processing

```typescript
// src/adapters/file-handler.ts
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export async function processLargeFile(inputPath: string, outputPath: string) {
  const readStream = createReadStream(inputPath);
  const writeStream = createWriteStream(outputPath);
  
  const transformStream = new Transform({
    transform(chunk, encoding, callback) {
      // Process chunk
      const processed = processChunk(chunk);
      callback(null, processed);
    }
  });
  
  await pipeline(readStream, transformStream, writeStream);
}
```

### Performance Monitoring

```typescript
// src/utils/metrics.ts
import { performance } from 'perf_hooks';

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    try {
      return fn();
    } finally {
      const duration = performance.now() - start;
      this.record(name, duration);
    }
  }
  
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.record(name, duration);
    }
  }
  
  private record(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
  }
  
  getStats(name: string) {
    const values = this.metrics.get(name) || [];
    if (values.length === 0) return null;
    
    const sorted = values.sort((a, b) => a - b);
    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      p50: sorted[Math.floor(values.length * 0.5)],
      p95: sorted[Math.floor(values.length * 0.95)],
      p99: sorted[Math.floor(values.length * 0.99)]
    };
  }
}
```

## Security Considerations

### Input Validation

```typescript
// src/utils/validation.ts
import { z } from 'zod';
import path from 'path';

export function validateFilePath(filePath: string): string {
  // Prevent path traversal
  const normalized = path.normalize(filePath);
  const resolved = path.resolve(filePath);
  
  if (normalized.includes('..')) {
    throw new Error('Path traversal detected');
  }
  
  if (!resolved.startsWith('/allowed/path')) {
    throw new Error('Path outside allowed directory');
  }
  
  return resolved;
}

export function sanitizeInput(input: string): string {
  // Remove potential injection characters
  return input
    .replace(/[<>]/g, '')
    .replace(/[{}]/g, '')
    .replace(/[;|&]/g, '')
    .trim();
}
```

### Authentication

```typescript
// src/middleware/auth.ts
export async function authenticate(req: Request): Promise<void> {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    throw new AuthError('API key required');
  }
  
  const isValid = await validateApiKey(apiKey);
  if (!isValid) {
    throw new AuthError('Invalid API key');
  }
  
  // Add user context
  req.context.user = await getUserFromApiKey(apiKey);
}
```

### Rate Limiting

```typescript
// src/middleware/rate-limit.ts
import { RateLimiter } from 'limiter';

const limiters = new Map<string, RateLimiter>();

export function rateLimit(key: string, limit: number, window: number) {
  if (!limiters.has(key)) {
    limiters.set(key, new RateLimiter({
      tokensPerInterval: limit,
      interval: window
    }));
  }
  
  const limiter = limiters.get(key)!;
  
  if (!limiter.tryRemoveTokens(1)) {
    throw new RateLimitError('Rate limit exceeded');
  }
}
```

## Contributing

### Development Workflow

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/voice-description-mcp.git
   cd voice-description-mcp
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature
   ```

3. **Develop and Test**
   ```bash
   npm run dev       # Development server
   npm test          # Run tests
   npm run lint      # Check code style
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature
   # Create pull request on GitHub
   ```

### Code Style

#### ESLint Configuration

```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "indent": ["error", 2],
    "quotes": ["error", "single"],
    "semi": ["error", "always"],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error"],
    "@typescript-eslint/explicit-function-return-type": "warn"
  }
}
```

#### Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Commit Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style
- `refactor:` Refactoring
- `test:` Tests
- `chore:` Maintenance

## Release Process

### Version Management

```bash
# Patch release (1.0.0 -> 1.0.1)
npm version patch

# Minor release (1.0.0 -> 1.1.0)
npm version minor

# Major release (1.0.0 -> 2.0.0)
npm version major
```

### Release Checklist

1. **Update Version**
   ```bash
   npm version minor
   ```

2. **Update Changelog**
   ```markdown
   ## [1.1.0] - 2024-01-15
   ### Added
   - New feature X
   ### Fixed
   - Bug Y
   ```

3. **Run Tests**
   ```bash
   npm test
   npm run test:integration
   npm run test:performance
   ```

4. **Build**
   ```bash
   npm run build
   ```

5. **Tag and Push**
   ```bash
   git push origin main --tags
   ```

6. **Create GitHub Release**
   - Use tag as release version
   - Copy changelog entries
   - Attach built artifacts

7. **Deploy**
   ```bash
   npm run deploy:production
   ```

### CI/CD Pipeline

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm test
      - run: npm run build
      
      - name: Create Release
        uses: actions/create-release@v1
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          
      - name: Deploy
        run: npm run deploy:production
        env:
          API_KEY: ${{ secrets.API_KEY }}
```

---

This developer guide provides comprehensive information for contributing to and extending the Voice Description MCP Server.