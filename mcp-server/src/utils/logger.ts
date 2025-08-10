import winston from 'winston';
import { loggingConfig } from '../config/index.js';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
};

// Add colors to winston
winston.addColors(logColors);

// Create formatters
const jsonFormatter = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const simpleFormatter = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    const metaKeys = Object.keys(meta);
    if (metaKeys.length > 0) {
      const metaStr = JSON.stringify(meta, null, 2);
      logMessage += `\n${metaStr}`;
    }
    
    return logMessage;
  })
);

// Create transports
const transports: winston.transport[] = [];

if (loggingConfig.destination === 'console') {
  transports.push(
    new winston.transports.Console({
      format: loggingConfig.format === 'json' ? jsonFormatter : simpleFormatter
    })
  );
} else if (loggingConfig.destination === 'file' && loggingConfig.filePath) {
  transports.push(
    new winston.transports.File({
      filename: loggingConfig.filePath,
      format: jsonFormatter // Always use JSON for file logging
    })
  );
  
  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    transports.push(
      new winston.transports.Console({
        format: simpleFormatter
      })
    );
  }
}

// Create logger instance
export const logger = winston.createLogger({
  level: loggingConfig.level,
  levels: logLevels,
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    })
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      )
    })
  ]
});

// Create structured logging helpers
export const createLogger = (context: string) => ({
  debug: (message: string, meta?: any) => logger.debug(message, { context, ...meta }),
  info: (message: string, meta?: any) => logger.info(message, { context, ...meta }),
  warn: (message: string, meta?: any) => logger.warn(message, { context, ...meta }),
  error: (message: string, meta?: any) => logger.error(message, { context, ...meta })
});

// Performance logging
export const logPerformance = (operation: string, startTime: number, meta?: any) => {
  const duration = Date.now() - startTime;
  logger.info(`Performance: ${operation}`, {
    operation,
    duration: `${duration}ms`,
    ...meta
  });
};

// Request logging middleware
export const logRequest = (requestId: string, method: string, params?: any) => {
  logger.info('MCP request received', {
    requestId,
    method,
    params: params ? JSON.stringify(params) : undefined
  });
};

export const logResponse = (requestId: string, method: string, success: boolean, duration: number, error?: any) => {
  if (success) {
    logger.info('MCP request completed', {
      requestId,
      method,
      duration: `${duration}ms`,
      success: true
    });
  } else {
    logger.error('MCP request failed', {
      requestId,
      method,
      duration: `${duration}ms`,
      success: false,
      error: error?.message || error
    });
  }
};

// Tool execution logging
export const logToolExecution = (toolName: string, params: any, requestId?: string) => {
  logger.info('Tool execution started', {
    tool: toolName,
    requestId,
    params: JSON.stringify(params)
  });
};

export const logToolResult = (toolName: string, success: boolean, duration: number, requestId?: string, error?: any) => {
  if (success) {
    logger.info('Tool execution completed', {
      tool: toolName,
      requestId,
      duration: `${duration}ms`,
      success: true
    });
  } else {
    logger.error('Tool execution failed', {
      tool: toolName,
      requestId,
      duration: `${duration}ms`,
      success: false,
      error: error?.message || error
    });
  }
};

// API call logging
export const logAPICall = (method: string, url: string, params?: any) => {
  logger.debug('API call started', {
    method,
    url,
    params: params ? JSON.stringify(params) : undefined
  });
};

export const logAPIResponse = (method: string, url: string, statusCode: number, duration: number, error?: any) => {
  if (statusCode >= 200 && statusCode < 400) {
    logger.debug('API call completed', {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      success: true
    });
  } else {
    logger.warn('API call failed', {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      success: false,
      error: error?.message || error
    });
  }
};

// System health logging
export const logHealthCheck = (component: string, status: 'healthy' | 'degraded' | 'unhealthy', details?: any) => {
  const level = status === 'healthy' ? 'info' : status === 'degraded' ? 'warn' : 'error';
  logger.log(level, `Health check: ${component}`, {
    component,
    status,
    ...details
  });
};

// Job management logging
export const logJobCreated = (jobId: string, type: string, details?: any) => {
  logger.info('Job created', {
    jobId,
    type,
    ...details
  });
};

export const logJobProgress = (jobId: string, step: string, progress?: number, message?: string) => {
  logger.info('Job progress', {
    jobId,
    step,
    progress: progress ? `${progress}%` : undefined,
    message
  });
};

export const logJobCompleted = (jobId: string, duration: number, success: boolean, error?: any) => {
  if (success) {
    logger.info('Job completed', {
      jobId,
      duration: `${duration}ms`,
      success: true
    });
  } else {
    logger.error('Job failed', {
      jobId,
      duration: `${duration}ms`,
      success: false,
      error: error?.message || error
    });
  }
};

export default logger;