/**
 * Monitoring Configuration for Voice Description API
 * Integrates Sentry, CloudWatch, and custom metrics
 */

import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import winston from 'winston';
import CloudWatchTransport from 'winston-cloudwatch';
import { StatsD } from 'node-statsd';

// Environment variables
const {
  NODE_ENV,
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  SENTRY_SAMPLE_RATE,
  CLOUDWATCH_LOG_GROUP,
  CLOUDWATCH_LOG_STREAM,
  AWS_REGION,
  DATADOG_API_KEY,
  NEW_RELIC_LICENSE_KEY,
  LOG_LEVEL,
  ENABLE_PERFORMANCE_MONITORING,
  ENABLE_DEBUG_LOGS
} = process.env;

/**
 * Sentry Configuration for Error Tracking
 */
export const initSentry = (app) => {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT || NODE_ENV || 'development',
    integrations: [
      // HTTP request tracking
      new Sentry.Integrations.Http({ tracing: true }),
      // Express middleware tracking
      new Sentry.Integrations.Express({ app }),
      // Performance profiling
      new ProfilingIntegration(),
      // AWS SDK tracking
      new Sentry.Integrations.AWSLambda({
        timeoutWarningLimit: 25000,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: parseFloat(SENTRY_SAMPLE_RATE) || 0.1,
    profilesSampleRate: ENABLE_PERFORMANCE_MONITORING === 'true' ? 0.1 : 0,
    
    // Release tracking
    release: process.env.RENDER_GIT_COMMIT || 'unknown',
    
    // Environment filtering
    beforeSend(event, hint) {
      // Filter out non-critical errors in production
      if (NODE_ENV === 'production') {
        // Don't send 4xx errors except 429 (rate limit)
        if (hint.statusCode && hint.statusCode >= 400 && hint.statusCode < 500 && hint.statusCode !== 429) {
          return null;
        }
      }
      
      // Sanitize sensitive data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.authorization;
        delete event.request.headers?.['x-api-key'];
      }
      
      return event;
    },
    
    // Breadcrumbs configuration
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      return breadcrumb;
    }
  });

  // Attach Sentry handlers to Express
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
  
  console.log('Sentry error tracking initialized');
};

/**
 * Winston Logger Configuration
 */
export const createLogger = () => {
  const transports = [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
      level: LOG_LEVEL || 'info',
      silent: NODE_ENV === 'test'
    }),
    
    // File transport for production
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ];

  // Add CloudWatch transport if configured
  if (CLOUDWATCH_LOG_GROUP && AWS_REGION) {
    transports.push(
      new CloudWatchTransport({
        logGroupName: CLOUDWATCH_LOG_GROUP,
        logStreamName: CLOUDWATCH_LOG_STREAM || `${NODE_ENV}-${new Date().toISOString().split('T')[0]}`,
        awsRegion: AWS_REGION,
        messageFormatter: ({ level, message, meta }) => {
          return JSON.stringify({ level, message, ...meta });
        },
        retentionInDays: 30,
        uploadRate: 2000, // 2 seconds
        errorHandler: (err) => {
          console.error('CloudWatch logging error:', err);
        }
      })
    );
  }

  const logger = winston.createLogger({
    level: LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: {
      service: 'voice-description-api',
      environment: NODE_ENV,
      instance: process.env.RENDER_INSTANCE_ID
    },
    transports,
    exceptionHandlers: [
      new winston.transports.File({ filename: 'logs/exceptions.log' })
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: 'logs/rejections.log' })
    ]
  });

  return logger;
};

/**
 * Custom Metrics Collection
 */
export class MetricsCollector {
  constructor() {
    this.statsd = null;
    this.metrics = {
      requests: 0,
      errors: 0,
      videoProcessed: 0,
      imageProcessed: 0,
      processingTime: [],
      apiCallDurations: {},
      awsCosts: {
        rekognition: 0,
        bedrock: 0,
        polly: 0,
        s3: 0
      }
    };

    // Initialize StatsD if DataDog is configured
    if (DATADOG_API_KEY) {
      this.statsd = new StatsD({
        host: 'localhost',
        port: 8125,
        prefix: 'voice_description.',
        globalTags: {
          env: NODE_ENV,
          service: 'api'
        }
      });
    }
  }

  // Track API request
  trackRequest(endpoint, method, statusCode, duration) {
    this.metrics.requests++;
    
    if (statusCode >= 500) {
      this.metrics.errors++;
    }

    if (this.statsd) {
      this.statsd.increment(`api.request`, 1, [`endpoint:${endpoint}`, `method:${method}`, `status:${statusCode}`]);
      this.statsd.timing(`api.request.duration`, duration, [`endpoint:${endpoint}`]);
    }

    // Log to CloudWatch metrics
    this.publishCloudWatchMetric('APIRequests', 1, 'Count', { Endpoint: endpoint, StatusCode: statusCode });
    this.publishCloudWatchMetric('APIRequestDuration', duration, 'Milliseconds', { Endpoint: endpoint });
  }

  // Track processing job
  trackProcessingJob(type, duration, success) {
    if (type === 'video') {
      this.metrics.videoProcessed++;
    } else if (type === 'image') {
      this.metrics.imageProcessed++;
    }

    this.metrics.processingTime.push(duration);

    if (this.statsd) {
      this.statsd.increment(`processing.${type}`, 1, [`success:${success}`]);
      this.statsd.timing(`processing.${type}.duration`, duration);
    }

    this.publishCloudWatchMetric('ProcessingJobs', 1, 'Count', { Type: type, Success: success });
    this.publishCloudWatchMetric('ProcessingDuration', duration, 'Seconds', { Type: type });
  }

  // Track AWS service usage
  trackAWSUsage(service, operation, cost) {
    if (this.metrics.awsCosts[service]) {
      this.metrics.awsCosts[service] += cost;
    }

    if (this.statsd) {
      this.statsd.increment(`aws.${service}.${operation}`);
      this.statsd.gauge(`aws.${service}.cost`, cost);
    }

    this.publishCloudWatchMetric('AWSUsage', 1, 'Count', { Service: service, Operation: operation });
    this.publishCloudWatchMetric('AWSCost', cost, 'USD', { Service: service });
  }

  // Track memory usage
  trackMemoryUsage() {
    const used = process.memoryUsage();
    
    if (this.statsd) {
      this.statsd.gauge('memory.rss', used.rss);
      this.statsd.gauge('memory.heap_total', used.heapTotal);
      this.statsd.gauge('memory.heap_used', used.heapUsed);
      this.statsd.gauge('memory.external', used.external);
    }

    this.publishCloudWatchMetric('MemoryUsage', used.heapUsed / 1024 / 1024, 'Megabytes');
  }

  // Publish metric to CloudWatch
  async publishCloudWatchMetric(metricName, value, unit, dimensions = {}) {
    if (!AWS_REGION) return;

    try {
      const CloudWatch = await import('@aws-sdk/client-cloudwatch');
      const client = new CloudWatch.CloudWatchClient({ region: AWS_REGION });
      
      const params = {
        Namespace: 'VoiceDescriptionAPI',
        MetricData: [
          {
            MetricName: metricName,
            Value: value,
            Unit: unit,
            Timestamp: new Date(),
            Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value: String(Value) }))
          }
        ]
      };

      await client.send(new CloudWatch.PutMetricDataCommand(params));
    } catch (error) {
      console.error('Failed to publish CloudWatch metric:', error);
    }
  }

  // Get metrics summary
  getMetricsSummary() {
    const avgProcessingTime = this.metrics.processingTime.length > 0
      ? this.metrics.processingTime.reduce((a, b) => a + b, 0) / this.metrics.processingTime.length
      : 0;

    return {
      totalRequests: this.metrics.requests,
      errorRate: this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests) * 100 : 0,
      videosProcessed: this.metrics.videoProcessed,
      imagesProcessed: this.metrics.imageProcessed,
      avgProcessingTime,
      totalAWSCost: Object.values(this.metrics.awsCosts).reduce((a, b) => a + b, 0),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }
}

/**
 * Health Check Monitoring
 */
export class HealthMonitor {
  constructor(logger, metrics) {
    this.logger = logger;
    this.metrics = metrics;
    this.checks = new Map();
  }

  // Register a health check
  registerCheck(name, checkFn, critical = false) {
    this.checks.set(name, { checkFn, critical, lastStatus: null, lastCheck: null });
  }

  // Run all health checks
  async runChecks() {
    const results = {};
    let overallHealth = 'healthy';

    for (const [name, check] of this.checks) {
      try {
        const startTime = Date.now();
        const result = await check.checkFn();
        const duration = Date.now() - startTime;

        results[name] = {
          status: result.success ? 'healthy' : 'unhealthy',
          message: result.message,
          duration,
          timestamp: new Date().toISOString()
        };

        check.lastStatus = result.success;
        check.lastCheck = new Date();

        if (!result.success && check.critical) {
          overallHealth = 'unhealthy';
        } else if (!result.success && overallHealth === 'healthy') {
          overallHealth = 'degraded';
        }

        // Log unhealthy checks
        if (!result.success) {
          this.logger.warn(`Health check failed: ${name}`, result);
        }

      } catch (error) {
        results[name] = {
          status: 'error',
          message: error.message,
          timestamp: new Date().toISOString()
        };

        if (check.critical) {
          overallHealth = 'unhealthy';
        }

        this.logger.error(`Health check error: ${name}`, error);
      }
    }

    return {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      checks: results,
      metrics: this.metrics.getMetricsSummary()
    };
  }
}

/**
 * Performance Monitoring Middleware
 */
export const performanceMiddleware = (metrics) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Track response
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - startTime;
      metrics.trackRequest(req.path, req.method, res.statusCode, duration);
      
      // Add performance headers
      res.setHeader('X-Response-Time', `${duration}ms`);
      res.setHeader('X-Request-Id', req.id || 'unknown');
      
      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Error Tracking Middleware
 */
export const errorMiddleware = (logger) => {
  return (err, req, res, next) => {
    // Log the error
    logger.error('Request error', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    // Send to Sentry
    if (Sentry.getCurrentHub) {
      Sentry.captureException(err, {
        contexts: {
          request: {
            url: req.url,
            method: req.method,
            headers: req.headers,
            query: req.query,
            body: req.body
          }
        }
      });
    }

    // Send error response
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: true,
      message: NODE_ENV === 'production' ? 'Internal server error' : err.message,
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  };
};

/**
 * Initialize all monitoring services
 */
export const initializeMonitoring = (app) => {
  const logger = createLogger();
  const metrics = new MetricsCollector();
  const healthMonitor = new HealthMonitor(logger, metrics);

  // Initialize Sentry
  initSentry(app);

  // Add monitoring middleware
  app.use(performanceMiddleware(metrics));

  // Register health checks
  healthMonitor.registerCheck('database', async () => {
    // Check database connection
    try {
      // Your database health check logic
      return { success: true, message: 'Database connected' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, true);

  healthMonitor.registerCheck('aws', async () => {
    // Check AWS services
    try {
      const S3Client = await import('@aws-sdk/client-s3');
      const client = new S3Client.S3Client({ region: AWS_REGION });
      await client.send(new S3Client.ListBucketsCommand({}));
      return { success: true, message: 'AWS services accessible' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }, true);

  healthMonitor.registerCheck('memory', async () => {
    const used = process.memoryUsage();
    const limit = 1024 * 1024 * 1024; // 1GB
    
    if (used.heapUsed > limit) {
      return { success: false, message: `Memory usage high: ${Math.round(used.heapUsed / 1024 / 1024)}MB` };
    }
    return { success: true, message: `Memory usage normal: ${Math.round(used.heapUsed / 1024 / 1024)}MB` };
  });

  // Schedule periodic tasks
  setInterval(() => metrics.trackMemoryUsage(), 60000); // Every minute
  setInterval(async () => {
    const health = await healthMonitor.runChecks();
    if (health.status !== 'healthy') {
      logger.warn('Health check degraded', health);
    }
  }, 300000); // Every 5 minutes

  // Add error handler middleware (must be last)
  app.use(errorMiddleware(logger));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    Sentry.captureException(error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    Sentry.captureException(reason);
  });

  return {
    logger,
    metrics,
    healthMonitor
  };
};

export default initializeMonitoring;