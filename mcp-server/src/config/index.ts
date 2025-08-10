import dotenv from 'dotenv';
import Joi from 'joi';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
    allowedVideoTypes: string[];
    allowedImageTypes: string[];
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
    format: 'json' | 'simple';
    destination: 'console' | 'file';
    filePath?: string;
  };
  
  // Feature flags
  features: {
    batchProcessing: boolean;
    audioGeneration: boolean;
    caching: boolean;
    cacheTTL: number;
  };
  
  // Rate limiting
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  
  // Health checks
  healthCheck: {
    interval: number;
    timeout: number;
  };
}

// Configuration schema
const configSchema = Joi.object({
  server: Joi.object({
    transport: Joi.string().valid('stdio', 'websocket').default('stdio'),
    port: Joi.number().port().when('transport', {
      is: 'websocket',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    host: Joi.string().when('transport', {
      is: 'websocket', 
      then: Joi.default('localhost'),
      otherwise: Joi.optional()
    })
  }).required(),
  
  api: Joi.object({
    baseUrl: Joi.string().uri().required(),
    apiKey: Joi.string().optional(),
    timeout: Joi.number().positive().default(30000),
    maxRetries: Joi.number().integer().min(0).max(10).default(3)
  }).required(),
  
  files: Joi.object({
    maxSize: Joi.number().positive().default(524288000), // 500MB
    allowedVideoTypes: Joi.array().items(Joi.string()).default([
      'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'
    ]),
    allowedImageTypes: Joi.array().items(Joi.string()).default([
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'
    ]),
    tempDirectory: Joi.string().default('/tmp/mcp-voice-desc'),
    cleanupInterval: Joi.number().positive().default(3600000) // 1 hour
  }).required(),
  
  polling: Joi.object({
    defaultInterval: Joi.number().positive().default(2000),
    maxDuration: Joi.number().positive().default(600000), // 10 minutes
    progressReporting: Joi.boolean().default(true)
  }).required(),
  
  logging: Joi.object({
    level: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),
    format: Joi.string().valid('json', 'simple').default('json'),
    destination: Joi.string().valid('console', 'file').default('console'),
    filePath: Joi.string().when('destination', {
      is: 'file',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  }).required(),
  
  features: Joi.object({
    batchProcessing: Joi.boolean().default(true),
    audioGeneration: Joi.boolean().default(true),
    caching: Joi.boolean().default(true),
    cacheTTL: Joi.number().positive().default(3600000) // 1 hour
  }).required(),
  
  rateLimit: Joi.object({
    maxRequests: Joi.number().positive().default(100),
    windowMs: Joi.number().positive().default(60000) // 1 minute
  }).required(),
  
  healthCheck: Joi.object({
    interval: Joi.number().positive().default(30000),
    timeout: Joi.number().positive().default(5000)
  }).required()
});

// Load and validate configuration
function loadConfig(): MCPServerConfig {
  const rawConfig = {
    server: {
      transport: process.env.MCP_TRANSPORT as 'stdio' | 'websocket' || 'stdio',
      port: process.env.MCP_PORT ? parseInt(process.env.MCP_PORT) : undefined,
      host: process.env.MCP_HOST
    },
    api: {
      baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
      apiKey: process.env.API_KEY,
      timeout: process.env.API_TIMEOUT ? parseInt(process.env.API_TIMEOUT) : 30000,
      maxRetries: process.env.API_MAX_RETRIES ? parseInt(process.env.API_MAX_RETRIES) : 3
    },
    files: {
      maxSize: process.env.MAX_FILE_SIZE ? parseInt(process.env.MAX_FILE_SIZE) : 524288000,
      allowedVideoTypes: process.env.ALLOWED_VIDEO_TYPES?.split(',') || [
        'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'
      ],
      allowedImageTypes: process.env.ALLOWED_IMAGE_TYPES?.split(',') || [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'
      ],
      tempDirectory: process.env.TEMP_DIRECTORY || '/tmp/mcp-voice-desc',
      cleanupInterval: process.env.CLEANUP_INTERVAL ? parseInt(process.env.CLEANUP_INTERVAL) : 3600000
    },
    polling: {
      defaultInterval: process.env.POLLING_INTERVAL ? parseInt(process.env.POLLING_INTERVAL) : 2000,
      maxDuration: process.env.POLLING_MAX_DURATION ? parseInt(process.env.POLLING_MAX_DURATION) : 600000,
      progressReporting: process.env.PROGRESS_REPORTING !== 'false'
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
      format: (process.env.LOG_FORMAT as any) || 'json',
      destination: (process.env.LOG_DESTINATION as any) || 'console',
      filePath: process.env.LOG_FILE_PATH
    },
    features: {
      batchProcessing: process.env.ENABLE_BATCH_PROCESSING !== 'false',
      audioGeneration: process.env.ENABLE_AUDIO_GENERATION !== 'false',
      caching: process.env.ENABLE_CACHING !== 'false',
      cacheTTL: process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL) : 3600000
    },
    rateLimit: {
      maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) : 100,
      windowMs: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : 60000
    },
    healthCheck: {
      interval: process.env.HEALTH_CHECK_INTERVAL ? parseInt(process.env.HEALTH_CHECK_INTERVAL) : 30000,
      timeout: process.env.HEALTH_CHECK_TIMEOUT ? parseInt(process.env.HEALTH_CHECK_TIMEOUT) : 5000
    }
  };

  const { error, value } = configSchema.validate(rawConfig, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const details = error.details.map(d => d.message).join(', ');
    throw new Error(`Configuration validation failed: ${details}`);
  }

  return value as MCPServerConfig;
}

export const config = loadConfig();

// Export individual config sections for convenience
export const serverConfig = config.server;
export const apiConfig = config.api;
export const filesConfig = config.files;
export const pollingConfig = config.polling;
export const loggingConfig = config.logging;
export const featuresConfig = config.features;
export const rateLimitConfig = config.rateLimit;
export const healthCheckConfig = config.healthCheck;