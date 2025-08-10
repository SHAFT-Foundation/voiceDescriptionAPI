/**
 * Security Middleware Configuration
 * Implements comprehensive security measures for the Voice Description API
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import cors from 'cors';
import crypto from 'crypto';

/**
 * Configure Helmet for security headers
 */
export const configureHelmet = () => {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'", 'https://api.sentry.io', 'https://*.amazonaws.com'],
        mediaSrc: ["'self'", 'blob:', 'https://*.amazonaws.com'],
        objectSrc: ["'none'"],
        childSrc: ["'self'", 'blob:'],
        workerSrc: ["'self'", 'blob:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        blockAllMixedContent: process.env.NODE_ENV === 'production' ? [] : null
      }
    },
    
    // Strict Transport Security
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    
    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },
    
    // X-Content-Type-Options
    noSniff: true,
    
    // X-XSS-Protection
    xssFilter: true,
    
    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    
    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: false,
    
    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false
    },
    
    // IE No Open
    ieNoOpen: true,
    
    // Hide X-Powered-By
    hidePoweredBy: true
  });
};

/**
 * Configure CORS
 */
export const configureCORS = () => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000'];

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is allowed
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    exposedHeaders: ['X-Response-Time', 'X-Request-ID', 'X-Rate-Limit-Remaining'],
    maxAge: 86400 // 24 hours
  });
};

/**
 * API Rate Limiting
 */
export const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.API_RATE_LIMIT_PER_MINUTE) || 60,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: true,
        message: 'Rate limit exceeded',
        retryAfter: res.getHeader('Retry-After'),
        limit: res.getHeader('X-RateLimit-Limit'),
        remaining: res.getHeader('X-RateLimit-Remaining'),
        reset: res.getHeader('X-RateLimit-Reset')
      });
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/api/health' || req.path === '/api/ready';
    },
    keyGenerator: (req) => {
      // Use IP + User ID for authenticated requests
      const userId = req.user?.id || 'anonymous';
      return `${req.ip}:${userId}`;
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
};

/**
 * Specific rate limiters for different endpoints
 */
export const rateLimiters = {
  // Strict limit for authentication endpoints
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    skipSuccessfulRequests: true
  }),
  
  // Video processing endpoints
  videoProcessing: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: 'Video processing limit exceeded. Please try again later.'
  }),
  
  // Image processing endpoints
  imageProcessing: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100,
    message: 'Image processing limit exceeded. Please try again later.'
  }),
  
  // File upload endpoints
  upload: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: 'Upload limit exceeded. Please try again later.'
  }),
  
  // API endpoints
  api: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100
  })
};

/**
 * Speed limiter to slow down repeated requests
 */
export const createSpeedLimiter = () => {
  return slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 10, // Allow 10 requests per windowMs without delay
    delayMs: 500, // Add 500ms delay per request after delayAfter
    maxDelayMs: 20000, // Maximum delay of 20 seconds
    skipFailedRequests: false,
    skipSuccessfulRequests: false
  });
};

/**
 * Input sanitization middleware
 */
export const sanitizeInput = () => {
  return [
    // Remove MongoDB operators from request
    mongoSanitize({
      replaceWith: '_',
      allowDots: true
    }),
    
    // Clean user input from malicious HTML/JS
    xss(),
    
    // Prevent HTTP Parameter Pollution
    hpp({
      whitelist: ['sort', 'fields', 'page', 'limit']
    })
  ];
};

/**
 * File upload security
 */
export const fileUploadSecurity = (req, res, next) => {
  // Check file types
  const allowedMimeTypes = {
    video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
  };

  // Validate file size
  const maxSizes = {
    video: parseInt(process.env.MAX_VIDEO_SIZE_MB) * 1024 * 1024 || 500 * 1024 * 1024,
    image: parseInt(process.env.MAX_IMAGE_SIZE_MB) * 1024 * 1024 || 50 * 1024 * 1024
  };

  if (req.file) {
    const fileType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
    
    // Check MIME type
    if (!allowedMimeTypes[fileType].includes(req.file.mimetype)) {
      return res.status(400).json({
        error: true,
        message: `Invalid file type. Allowed types: ${allowedMimeTypes[fileType].join(', ')}`
      });
    }
    
    // Check file size
    if (req.file.size > maxSizes[fileType]) {
      return res.status(400).json({
        error: true,
        message: `File too large. Maximum size: ${maxSizes[fileType] / (1024 * 1024)}MB`
      });
    }
    
    // Generate secure filename
    const ext = req.file.originalname.split('.').pop();
    req.file.secureFilename = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  }
  
  next();
};

/**
 * API Key Authentication
 */
export const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({
      error: true,
      message: 'API key required'
    });
  }
  
  // Validate API key (implement your validation logic)
  const validApiKey = process.env.API_KEY;
  
  if (apiKey !== validApiKey) {
    return res.status(403).json({
      error: true,
      message: 'Invalid API key'
    });
  }
  
  next();
};

/**
 * Request ID middleware
 */
export const requestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
};

/**
 * Security headers for API responses
 */
export const apiSecurityHeaders = (req, res, next) => {
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  next();
};

/**
 * IP Whitelist/Blacklist
 */
export class IPFilter {
  constructor() {
    this.whitelist = process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : [];
    this.blacklist = process.env.IP_BLACKLIST ? process.env.IP_BLACKLIST.split(',') : [];
  }
  
  middleware() {
    return (req, res, next) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      
      // Check blacklist first
      if (this.blacklist.length > 0 && this.blacklist.includes(clientIP)) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
      
      // Check whitelist if configured
      if (this.whitelist.length > 0 && !this.whitelist.includes(clientIP)) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
      
      next();
    };
  }
  
  addToBlacklist(ip) {
    if (!this.blacklist.includes(ip)) {
      this.blacklist.push(ip);
    }
  }
  
  removeFromBlacklist(ip) {
    const index = this.blacklist.indexOf(ip);
    if (index > -1) {
      this.blacklist.splice(index, 1);
    }
  }
}

/**
 * Content Security Policy Report Handler
 */
export const cspReportHandler = (req, res) => {
  if (req.body) {
    console.warn('CSP Violation:', req.body);
    // Send to monitoring service
    if (global.logger) {
      global.logger.warn('CSP Violation', req.body);
    }
  }
  res.status(204).end();
};

/**
 * Security audit logging
 */
export const securityAudit = (req, res, next) => {
  const auditLog = {
    timestamp: new Date().toISOString(),
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    apiKey: req.headers['x-api-key'] ? 'present' : 'absent'
  };
  
  // Log security-relevant events
  if (req.method !== 'GET' || req.path.includes('admin')) {
    if (global.logger) {
      global.logger.info('Security audit', auditLog);
    }
  }
  
  next();
};

/**
 * Initialize all security middleware
 */
export const initializeSecurity = (app) => {
  // Request ID (should be first)
  app.use(requestId);
  
  // Security headers
  app.use(configureHelmet());
  
  // CORS
  app.use(configureCORS());
  
  // Body parsing security
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Input sanitization
  app.use(sanitizeInput());
  
  // IP filtering
  const ipFilter = new IPFilter();
  app.use(ipFilter.middleware());
  
  // Rate limiting
  app.use('/api/', rateLimiters.api);
  app.use('/api/auth/', rateLimiters.auth);
  app.use('/api/upload', rateLimiters.upload);
  app.use('/api/process', rateLimiters.videoProcessing);
  app.use('/api/process-image', rateLimiters.imageProcessing);
  
  // Speed limiting
  app.use(createSpeedLimiter());
  
  // API security headers
  app.use('/api/', apiSecurityHeaders);
  
  // Security audit logging
  app.use(securityAudit);
  
  // CSP violation reports
  app.post('/api/csp-report', express.json({ type: 'application/csp-report' }), cspReportHandler);
  
  console.log('Security middleware initialized');
  
  return { ipFilter };
};

export default initializeSecurity;