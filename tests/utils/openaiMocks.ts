/**
 * OpenAI Service Mocking Utilities
 * Provides comprehensive mocking for OpenAI API calls used in the dual-pipeline architecture
 */

import { jest } from '@jest/globals';

// Mock OpenAI response types
export interface MockOpenAIResponse {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MockVisionResponse extends MockOpenAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
      vision_details?: {
        objects_detected: string[];
        scene_type: string;
        confidence: number;
      };
    };
    finish_reason: string;
  }>;
}

// Sample responses for different scenarios
export const MOCK_OPENAI_RESPONSES = {
  imageAnalysis: {
    landscape: {
      id: 'chatcmpl-test-landscape',
      model: 'gpt-4-vision-preview',
      created: Date.now(),
      choices: [{
        message: {
          role: 'assistant',
          content: 'A serene mountain landscape with snow-capped peaks in the background. The foreground shows a crystal-clear lake reflecting the mountains, surrounded by pine trees. The lighting suggests early morning with soft golden hour illumination.',
          vision_details: {
            objects_detected: ['mountains', 'lake', 'trees', 'snow'],
            scene_type: 'landscape',
            confidence: 0.95
          }
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 285,
        completion_tokens: 67,
        total_tokens: 352
      }
    },
    portrait: {
      id: 'chatcmpl-test-portrait',
      model: 'gpt-4-vision-preview',
      created: Date.now(),
      choices: [{
        message: {
          role: 'assistant',
          content: 'A professional portrait of a person wearing business attire. The subject is centered in the frame with a neutral background. Natural lighting emphasizes facial features with soft shadows.',
          vision_details: {
            objects_detected: ['person', 'clothing', 'background'],
            scene_type: 'portrait',
            confidence: 0.92
          }
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 250,
        completion_tokens: 45,
        total_tokens: 295
      }
    },
    complex_scene: {
      id: 'chatcmpl-test-complex',
      model: 'gpt-4-vision-preview',
      created: Date.now(),
      choices: [{
        message: {
          role: 'assistant',
          content: 'A busy urban street scene with multiple elements: pedestrians crossing at an intersection, various vehicles including cars and buses, storefronts with illuminated signs, and tall buildings in the background. The scene captures the dynamic energy of city life during rush hour.',
          vision_details: {
            objects_detected: ['people', 'vehicles', 'buildings', 'signs', 'crosswalk'],
            scene_type: 'urban',
            confidence: 0.88
          }
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 320,
        completion_tokens: 89,
        total_tokens: 409
      }
    }
  },
  videoAnalysis: {
    action_sequence: {
      id: 'chatcmpl-test-video-action',
      model: 'gpt-4-vision-preview',
      created: Date.now(),
      choices: [{
        message: {
          role: 'assistant',
          content: 'The video shows a person performing a series of athletic movements. Beginning with a running start, they execute a jump over an obstacle, followed by a roll and quick recovery to standing position. The sequence demonstrates agility and coordination.',
          vision_details: {
            objects_detected: ['person', 'obstacle', 'ground'],
            scene_type: 'action',
            confidence: 0.91
          }
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 450,
        completion_tokens: 78,
        total_tokens: 528
      }
    },
    dialogue_scene: {
      id: 'chatcmpl-test-video-dialogue',
      model: 'gpt-4-vision-preview',
      created: Date.now(),
      choices: [{
        message: {
          role: 'assistant',
          content: 'Two people engaged in conversation in an office setting. They are seated across from each other at a desk, with documents visible. Body language suggests a professional discussion with occasional gestures for emphasis.',
          vision_details: {
            objects_detected: ['people', 'desk', 'documents', 'office'],
            scene_type: 'dialogue',
            confidence: 0.94
          }
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 380,
        completion_tokens: 56,
        total_tokens: 436
      }
    }
  },
  synthesis: {
    combined_description: {
      id: 'chatcmpl-test-synthesis',
      model: 'gpt-4',
      created: Date.now(),
      choices: [{
        message: {
          role: 'assistant',
          content: 'The complete scene unfolds across multiple moments: Initially, we see an establishing shot of the location, followed by the introduction of main subjects. The narrative progresses through key actions and interactions, building towards a conclusion that ties together all visual elements presented throughout the sequence.'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 520,
        completion_tokens: 95,
        total_tokens: 615
      }
    }
  }
};

// Mock error responses
export const MOCK_OPENAI_ERRORS = {
  rate_limit: {
    error: {
      message: 'Rate limit reached for requests',
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded'
    }
  },
  invalid_request: {
    error: {
      message: 'Invalid request: Image too large',
      type: 'invalid_request_error',
      code: 'invalid_image_size'
    }
  },
  api_error: {
    error: {
      message: 'The server had an error processing your request',
      type: 'api_error',
      code: 'internal_error'
    }
  },
  timeout: {
    error: {
      message: 'Request timeout',
      type: 'timeout_error',
      code: 'request_timeout'
    }
  }
};

/**
 * Mock OpenAI client
 */
export class MockOpenAIClient {
  private responseQueue: any[] = [];
  private errorQueue: any[] = [];
  private requestCount = 0;
  private requestLog: any[] = [];
  private rateLimitConfig = {
    enabled: false,
    limit: 60,
    window: 60000,
    requests: []
  };

  constructor() {
    this.reset();
  }

  // Queue a successful response
  queueResponse(response: any): void {
    this.responseQueue.push(response);
  }

  // Queue an error response
  queueError(error: any): void {
    this.errorQueue.push(error);
  }

  // Enable rate limiting simulation
  enableRateLimit(limit: number = 60, windowMs: number = 60000): void {
    this.rateLimitConfig = {
      enabled: true,
      limit,
      window: windowMs,
      requests: []
    };
  }

  // Check rate limit
  private checkRateLimit(): void {
    if (!this.rateLimitConfig.enabled) return;

    const now = Date.now();
    this.rateLimitConfig.requests = this.rateLimitConfig.requests.filter(
      time => now - time < this.rateLimitConfig.window
    );

    if (this.rateLimitConfig.requests.length >= this.rateLimitConfig.limit) {
      throw MOCK_OPENAI_ERRORS.rate_limit;
    }

    this.rateLimitConfig.requests.push(now);
  }

  // Mock chat completions
  chat = {
    completions: {
      create: jest.fn(async (params: any) => {
        this.requestCount++;
        this.requestLog.push({ ...params, timestamp: Date.now() });

        // Check rate limit
        this.checkRateLimit();

        // Return error if queued
        if (this.errorQueue.length > 0) {
          throw this.errorQueue.shift();
        }

        // Return response if queued
        if (this.responseQueue.length > 0) {
          return this.responseQueue.shift();
        }

        // Default response based on content
        if (params.messages?.some((m: any) => m.content?.some?.((c: any) => c.type === 'image_url'))) {
          return MOCK_OPENAI_RESPONSES.imageAnalysis.landscape;
        }

        return MOCK_OPENAI_RESPONSES.synthesis.combined_description;
      })
    }
  };

  // Get request statistics
  getStats() {
    return {
      requestCount: this.requestCount,
      requestLog: this.requestLog,
      queuedResponses: this.responseQueue.length,
      queuedErrors: this.errorQueue.length
    };
  }

  // Reset mock state
  reset(): void {
    this.responseQueue = [];
    this.errorQueue = [];
    this.requestCount = 0;
    this.requestLog = [];
    this.rateLimitConfig.requests = [];
    this.chat.completions.create.mockClear();
  }
}

/**
 * Mock helper for simulating streaming responses
 */
export class StreamingMockHelper {
  private chunks: string[];
  private delay: number;

  constructor(chunks: string[] = [], delay: number = 50) {
    this.chunks = chunks;
    this.delay = delay;
  }

  async *stream(): AsyncGenerator<any> {
    for (const chunk of this.chunks) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
      yield {
        choices: [{
          delta: {
            content: chunk
          }
        }]
      };
    }
  }

  setChunks(chunks: string[]): void {
    this.chunks = chunks;
  }

  setDelay(delay: number): void {
    this.delay = delay;
  }
}

/**
 * Cost calculation mock helper
 */
export class CostCalculationMockHelper {
  private costs = {
    'gpt-4-vision-preview': {
      input: 0.01,  // per 1K tokens
      output: 0.03   // per 1K tokens
    },
    'gpt-4': {
      input: 0.03,
      output: 0.06
    },
    'gpt-3.5-turbo': {
      input: 0.001,
      output: 0.002
    }
  };

  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const modelCost = this.costs[model] || this.costs['gpt-4'];
    const inputCost = (inputTokens / 1000) * modelCost.input;
    const outputCost = (outputTokens / 1000) * modelCost.output;
    return parseFloat((inputCost + outputCost).toFixed(4));
  }

  getTotalCost(requests: any[]): number {
    return requests.reduce((total, req) => {
      return total + this.calculateCost(
        req.model,
        req.usage?.prompt_tokens || 0,
        req.usage?.completion_tokens || 0
      );
    }, 0);
  }
}

/**
 * Cache simulation helper
 */
export class CacheMockHelper {
  private cache = new Map<string, any>();
  private hits = 0;
  private misses = 0;
  private ttl: number;

  constructor(ttlMs: number = 3600000) { // 1 hour default
    this.ttl = ttlMs;
  }

  set(key: string, value: any): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl
    });
  }

  get(key: string): any {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value;
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
      size: this.cache.size
    };
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

/**
 * Pipeline selection mock helper
 */
export class PipelineSelectorMockHelper {
  private selectionHistory: any[] = [];
  private forcedPipeline: string | null = null;

  selectPipeline(criteria: any): string {
    if (this.forcedPipeline) {
      return this.forcedPipeline;
    }

    let pipeline = 'openai-image'; // default

    // Logic based on criteria
    if (criteria.fileType === 'video' && criteria.duration > 30) {
      pipeline = 'openai-video';
    } else if (criteria.requiresHighAccuracy) {
      pipeline = 'aws-bedrock';
    } else if (criteria.budget === 'low') {
      pipeline = 'openai-image';
    }

    this.selectionHistory.push({
      criteria,
      pipeline,
      timestamp: Date.now()
    });

    return pipeline;
  }

  forcePipeline(pipeline: string | null): void {
    this.forcedPipeline = pipeline;
  }

  getHistory(): any[] {
    return this.selectionHistory;
  }

  reset(): void {
    this.selectionHistory = [];
    this.forcedPipeline = null;
  }
}

/**
 * Quality scoring mock helper
 */
export class QualityScoringMockHelper {
  calculateScore(description: string, criteria: any = {}): number {
    let score = 0;
    
    // Length score (0-25 points)
    const wordCount = description.split(' ').length;
    if (wordCount >= 20 && wordCount <= 100) {
      score += 25;
    } else if (wordCount >= 10) {
      score += 15;
    }

    // Detail score (0-25 points)
    const hasDetails = ['color', 'shape', 'size', 'position', 'action']
      .some(keyword => description.toLowerCase().includes(keyword));
    if (hasDetails) score += 25;

    // Clarity score (0-25 points)
    const hasClearStructure = description.includes('.') && description.includes(',');
    if (hasClearStructure) score += 25;

    // Accessibility score (0-25 points)
    const hasAccessibilityTerms = ['appears', 'shows', 'displays', 'visible']
      .some(term => description.toLowerCase().includes(term));
    if (hasAccessibilityTerms) score += 25;

    // Apply criteria modifiers
    if (criteria.requiresTechnicalAccuracy) {
      score *= 0.9; // Slightly lower for technical content
    }

    return Math.min(100, Math.max(0, score));
  }

  compareDescriptions(desc1: string, desc2: string): number {
    const score1 = this.calculateScore(desc1);
    const score2 = this.calculateScore(desc2);
    return score1 - score2;
  }
}

// Create singleton instances
export const mockOpenAIClient = new MockOpenAIClient();
export const streamingMockHelper = new StreamingMockHelper();
export const costCalculationHelper = new CostCalculationMockHelper();
export const cacheMockHelper = new CacheMockHelper();
export const pipelineSelectorHelper = new PipelineSelectorMockHelper();
export const qualityScoringHelper = new QualityScoringMockHelper();

// Export default mock setup function
export function setupOpenAIMocks(scenario: 'success' | 'error' | 'rateLimit' = 'success'): void {
  mockOpenAIClient.reset();
  
  switch (scenario) {
    case 'success':
      mockOpenAIClient.queueResponse(MOCK_OPENAI_RESPONSES.imageAnalysis.landscape);
      mockOpenAIClient.queueResponse(MOCK_OPENAI_RESPONSES.videoAnalysis.action_sequence);
      break;
    case 'error':
      mockOpenAIClient.queueError(MOCK_OPENAI_ERRORS.api_error);
      break;
    case 'rateLimit':
      mockOpenAIClient.enableRateLimit(1, 1000); // 1 request per second
      break;
  }
}

// Export all utilities
export default {
  MockOpenAIClient,
  StreamingMockHelper,
  CostCalculationMockHelper,
  CacheMockHelper,
  PipelineSelectorMockHelper,
  QualityScoringMockHelper,
  mockOpenAIClient,
  streamingMockHelper,
  costCalculationHelper,
  cacheMockHelper,
  pipelineSelectorHelper,
  qualityScoringHelper,
  setupOpenAIMocks,
  MOCK_OPENAI_RESPONSES,
  MOCK_OPENAI_ERRORS
};