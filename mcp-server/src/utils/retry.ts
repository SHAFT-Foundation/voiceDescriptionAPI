import { RetryOptions } from '../types/index.js';
import { logger } from './logger.js';

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2,
    retryOn = [429, 502, 503, 504]
  } = options;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await operation();
      
      // Log successful retry
      if (attempt > 1) {
        logger.info('Operation succeeded after retry', {
          attempt,
          totalAttempts: attempt
        });
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry based on error type
      const shouldRetry = shouldRetryError(error, retryOn);
      
      // Don't retry on last attempt or if error is not retryable
      if (attempt === maxRetries + 1 || !shouldRetry) {
        logger.error('Operation failed after all retries', {
          attempt,
          maxRetries,
          error: lastError.message,
          retryable: shouldRetry
        });
        throw lastError;
      }
      
      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt - 1),
        maxDelay
      );
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * baseDelay;
      const delay = Math.floor(baseDelay + jitter);
      
      logger.warn('Operation failed, retrying', {
        attempt,
        maxRetries,
        delay: `${delay}ms`,
        error: lastError.message
      });
      
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Retry with custom condition
 */
export async function retryWithCondition<T>(
  operation: () => Promise<T>,
  condition: (error: Error) => boolean,
  options: Omit<RetryOptions, 'retryOn'> = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2
  } = options;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 1) {
        logger.info('Operation succeeded after retry', {
          attempt,
          totalAttempts: attempt
        });
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Check custom condition
      const shouldRetry = condition(lastError);
      
      if (attempt === maxRetries + 1 || !shouldRetry) {
        logger.error('Operation failed after all retries', {
          attempt,
          maxRetries,
          error: lastError.message,
          retryable: shouldRetry
        });
        throw lastError;
      }
      
      const baseDelay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt - 1),
        maxDelay
      );
      
      const jitter = Math.random() * 0.1 * baseDelay;
      const delay = Math.floor(baseDelay + jitter);
      
      logger.warn('Operation failed, retrying', {
        attempt,
        maxRetries,
        delay: `${delay}ms`,
        error: lastError.message
      });
      
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

/**
 * Retry with timeout
 */
export async function retryWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  options: RetryOptions = {}
): Promise<T> {
  const startTime = Date.now();
  
  return retry(async () => {
    // Check if we've exceeded the timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Operation timed out after ${timeoutMs}ms`);
    }
    
    return await withTimeout(operation(), timeoutMs - (Date.now() - startTime));
  }, options);
}

/**
 * Add timeout to a promise
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error should be retried based on error type and status codes
 */
function shouldRetryError(error: any, retryOn: number[]): boolean {
  // Handle HTTP errors with status codes
  if (error.response && error.response.status) {
    return retryOn.includes(error.response.status);
  }
  
  // Handle specific error codes
  if (error.code) {
    const retryableCodes = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEOUT',
      'ENOTFOUND',
      'EHOSTUNREACH',
      'ENETUNREACH'
    ];
    
    return retryableCodes.includes(error.code);
  }
  
  // Handle known error messages
  const retryableMessages = [
    'timeout',
    'network error',
    'connection refused',
    'rate limit',
    'too many requests'
  ];
  
  const errorMessage = error.message?.toLowerCase() || '';
  return retryableMessages.some(msg => errorMessage.includes(msg));
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold: number = 5,
    private timeoutMs: number = 60000,
    private resetTimeoutMs: number = 30000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'half-open';
        logger.info('Circuit breaker entering half-open state');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await withTimeout(operation(), this.timeoutMs);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
    if (this.state !== 'closed') {
      logger.info('Circuit breaker closed - service recovered');
    }
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.error('Circuit breaker opened', {
        failures: this.failures,
        threshold: this.threshold
      });
    }
  }
  
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
  
  getFailures(): number {
    return this.failures;
  }
}

/**
 * Rate limiter with token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private capacity: number,
    private refillRate: number,
    private refillIntervalMs: number = 1000
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  
  async acquire(tokensRequested: number = 1): Promise<boolean> {
    this.refillTokens();
    
    if (this.tokens >= tokensRequested) {
      this.tokens -= tokensRequested;
      return true;
    }
    
    return false;
  }
  
  async waitForTokens(tokensRequested: number = 1, maxWaitMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      if (await this.acquire(tokensRequested)) {
        return;
      }
      
      await sleep(100); // Wait 100ms before checking again
    }
    
    throw new Error('Rate limit exceeded - timeout waiting for tokens');
  }
  
  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    
    if (timePassed >= this.refillIntervalMs) {
      const tokensToAdd = Math.floor(timePassed / this.refillIntervalMs) * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
  
  getRemainingTokens(): number {
    this.refillTokens();
    return this.tokens;
  }
}