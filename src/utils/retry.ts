import { RetryConfig } from '../types';
import { logger } from './logger';

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  exponentialBase: 2,
};

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  operationName = 'operation'
): Promise<T> {
  const finalConfig: RetryConfig = { ...defaultRetryConfig, ...config };
  
  for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        logger.info(`${operationName} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      const isLastAttempt = attempt === finalConfig.maxRetries;
      
      logger.warn(`${operationName} failed on attempt ${attempt}/${finalConfig.maxRetries}`, {
        error: error instanceof Error ? error.message : String(error),
        attempt,
        maxRetries: finalConfig.maxRetries,
      });

      if (isLastAttempt) {
        logger.error(`${operationName} failed after ${finalConfig.maxRetries} attempts`, error);
        throw error;
      }

      const delay = Math.min(
        finalConfig.baseDelay * Math.pow(finalConfig.exponentialBase, attempt - 1),
        finalConfig.maxDelay
      );

      logger.debug(`Retrying ${operationName} in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Retry logic failed unexpectedly for ${operationName}`);
}

export function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  // AWS SDK error codes that are retryable
  const retryableErrorCodes = [
    'NetworkingError',
    'TimeoutError',
    'ThrottlingException',
    'ServiceUnavailable',
    'InternalServerError',
    'RequestTimeout',
    'TooManyRequestsException',
  ];

  const errorCode = error.code || error.name;
  const statusCode = error.$metadata?.httpStatusCode || error.statusCode;
  
  // Check for retryable error codes
  if (retryableErrorCodes.includes(errorCode)) {
    return true;
  }
  
  // Check for retryable HTTP status codes
  if (statusCode >= 500 || statusCode === 429) {
    return true;
  }
  
  return false;
}