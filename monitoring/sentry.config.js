// Sentry Configuration for Application Monitoring
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// Common Sentry configuration
const sentryConfig = {
  dsn: SENTRY_DSN,
  environment: ENVIRONMENT,
  
  // Performance Monitoring
  tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
  profilesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
  
  // Release tracking
  release: process.env.NEXT_PUBLIC_RELEASE_VERSION || 'unknown',
  
  // Session tracking
  autoSessionTracking: true,
  
  // Integrations
  integrations: [
    // HTTP integration for tracking API calls
    new Sentry.Integrations.Http({
      tracing: true,
      breadcrumbs: true,
    }),
    
    // Capture console errors
    new Sentry.Integrations.CaptureConsole({
      levels: ['error', 'warn'],
    }),
  ],
  
  // Before send hook for filtering
  beforeSend(event, hint) {
    // Filter out non-critical errors in development
    if (ENVIRONMENT === 'development') {
      const error = hint.originalException;
      
      // Ignore specific development errors
      if (error?.message?.includes('NEXT_NOT_FOUND')) {
        return null;
      }
    }
    
    // Filter sensitive data
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
      }
      
      // Remove sensitive query params
      if (event.request.query_string) {
        event.request.query_string = event.request.query_string.replace(
          /api_key=[^&]*/g,
          'api_key=REDACTED'
        );
      }
    }
    
    // Add custom context
    event.contexts = {
      ...event.contexts,
      app: {
        app_name: 'Voice Description API',
        app_version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      },
      aws: {
        region: process.env.AWS_REGION || 'unknown',
        input_bucket: process.env.INPUT_S3_BUCKET || 'unknown',
        output_bucket: process.env.OUTPUT_S3_BUCKET || 'unknown',
      },
    };
    
    return event;
  },
  
  // Breadcrumb filtering
  beforeBreadcrumb(breadcrumb, hint) {
    // Filter out non-relevant breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }
    
    // Add custom breadcrumbs for AWS operations
    if (breadcrumb.category === 'aws') {
      breadcrumb.data = {
        ...breadcrumb.data,
        timestamp: new Date().toISOString(),
      };
    }
    
    return breadcrumb;
  },
  
  // Error filtering
  ignoreErrors: [
    // Browser errors
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    
    // Network errors
    'NetworkError',
    'Failed to fetch',
    
    // Next.js specific
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
  ],
  
  // Allowed URLs for error reporting
  allowUrls: [
    /https:\/\/voice-description-api\.onrender\.com/,
    /http:\/\/localhost:3000/,
  ],
};

// Initialize Sentry
export function initSentry() {
  if (SENTRY_DSN) {
    Sentry.init(sentryConfig);
    
    // Set initial user context if available
    if (typeof window !== 'undefined') {
      const userId = localStorage.getItem('userId');
      if (userId) {
        Sentry.setUser({ id: userId });
      }
    }
    
    console.log(`Sentry initialized for ${ENVIRONMENT} environment`);
  } else {
    console.warn('Sentry DSN not configured, monitoring disabled');
  }
}

// Custom error boundary for React components
export class SentryErrorBoundary extends Sentry.ErrorBoundary {
  constructor(props) {
    super(props);
  }
  
  componentDidCatch(error, errorInfo) {
    // Log to Sentry
    Sentry.withScope((scope) => {
      scope.setContext('errorBoundary', {
        ...errorInfo,
        component: this.props.componentName || 'Unknown',
      });
      Sentry.captureException(error);
    });
    
    // Call parent
    super.componentDidCatch(error, errorInfo);
  }
}

// Performance monitoring helpers
export const performance = {
  // Start a transaction
  startTransaction(name, op = 'navigation') {
    return Sentry.startTransaction({
      name,
      op,
    });
  },
  
  // Measure API call performance
  measureApiCall(endpoint, method = 'GET') {
    const transaction = Sentry.getCurrentHub().getScope().getTransaction();
    if (transaction) {
      return transaction.startChild({
        op: 'http.client',
        description: `${method} ${endpoint}`,
      });
    }
    return null;
  },
  
  // Measure AWS SDK operations
  measureAwsOperation(service, operation) {
    const transaction = Sentry.getCurrentHub().getScope().getTransaction();
    if (transaction) {
      return transaction.startChild({
        op: 'aws',
        description: `${service}.${operation}`,
        data: {
          service,
          operation,
          region: process.env.AWS_REGION,
        },
      });
    }
    return null;
  },
  
  // Measure video processing
  measureVideoProcessing(videoId, step) {
    const transaction = Sentry.getCurrentHub().getScope().getTransaction();
    if (transaction) {
      return transaction.startChild({
        op: 'video.processing',
        description: `Processing ${step} for video ${videoId}`,
        data: {
          videoId,
          step,
        },
      });
    }
    return null;
  },
};

// Custom logging with Sentry integration
export const logger = {
  info(message, extra = {}) {
    console.log(message, extra);
    Sentry.addBreadcrumb({
      message,
      level: 'info',
      category: 'app',
      data: extra,
    });
  },
  
  warn(message, extra = {}) {
    console.warn(message, extra);
    Sentry.captureMessage(message, 'warning');
  },
  
  error(message, error, extra = {}) {
    console.error(message, error, extra);
    Sentry.captureException(error, {
      contexts: {
        extra: {
          message,
          ...extra,
        },
      },
    });
  },
  
  // Log AWS operations
  awsOperation(service, operation, data = {}) {
    Sentry.addBreadcrumb({
      category: 'aws',
      message: `${service}.${operation}`,
      level: 'info',
      data: {
        service,
        operation,
        ...data,
      },
    });
  },
  
  // Log job status changes
  jobStatus(jobId, status, details = {}) {
    Sentry.addBreadcrumb({
      category: 'job',
      message: `Job ${jobId} status: ${status}`,
      level: 'info',
      data: {
        jobId,
        status,
        ...details,
      },
    });
  },
};

// Export configured Sentry instance
export default Sentry;