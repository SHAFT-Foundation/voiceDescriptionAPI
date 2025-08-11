/**
 * Cost Optimization Module for OpenAI API
 * Implements intelligent caching, token management, and cost tracking
 */

import { LRUCache } from 'lru-cache';
import crypto from 'crypto';
import { logger } from '../../utils/logger';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  timestamp: Date;
}

export interface CostEstimate {
  tokenCost: number;
  apiCalls: number;
  estimatedCost: number;
  savings: number;
  optimizationRate: number;
}

export interface CacheEntry {
  key: string;
  value: any;
  tokens: number;
  timestamp: Date;
  hits: number;
  lastAccessed: Date;
  contentHash: string;
}

export interface ModelPricing {
  model: string;
  inputCostPer1K: number;
  outputCostPer1K: number;
  contextWindow: number;
  rateLimit: number;
}

export class CostOptimizationModule {
  private readonly responseCache: LRUCache<string, CacheEntry>;
  private readonly embeddingCache: LRUCache<string, Float32Array>;
  private readonly dynamoClient: DynamoDBDocument;
  private tokenUsageHistory: TokenUsage[] = [];
  private readonly modelPricing: Map<string, ModelPricing>;
  private readonly similarityThreshold = 0.95;

  constructor() {
    // Initialize LRU cache for responses (500MB max)
    this.responseCache = new LRUCache<string, CacheEntry>({
      max: 500,
      maxSize: 500 * 1024 * 1024, // 500MB
      sizeCalculation: (entry) => JSON.stringify(entry).length,
      ttl: 1000 * 60 * 60 * 24, // 24 hours
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    // Initialize embedding cache for semantic similarity
    this.embeddingCache = new LRUCache<string, Float32Array>({
      max: 10000,
      ttl: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    // Initialize DynamoDB for persistent cache
    const ddbClient = new DynamoDB({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    this.dynamoClient = DynamoDBDocument.from(ddbClient);

    // Initialize model pricing
    this.modelPricing = new Map([
      ['gpt-4-vision-preview', {
        model: 'gpt-4-vision-preview',
        inputCostPer1K: 0.01,
        outputCostPer1K: 0.03,
        contextWindow: 128000,
        rateLimit: 500, // requests per minute
      }],
      ['gpt-4-turbo-preview', {
        model: 'gpt-4-turbo-preview',
        inputCostPer1K: 0.01,
        outputCostPer1K: 0.03,
        contextWindow: 128000,
        rateLimit: 500,
      }],
      ['gpt-4o', {
        model: 'gpt-4o',
        inputCostPer1K: 0.005,
        outputCostPer1K: 0.015,
        contextWindow: 128000,
        rateLimit: 1000,
      }],
      ['gpt-4o-mini', {
        model: 'gpt-4o-mini',
        inputCostPer1K: 0.00015,
        outputCostPer1K: 0.0006,
        contextWindow: 128000,
        rateLimit: 2000,
      }],
    ]);
  }

  /**
   * Check cache for existing response
   */
  async checkCache(
    prompt: string,
    imageHash: string,
    options?: {
      useSemantic?: boolean;
      threshold?: number;
    }
  ): Promise<CacheEntry | null> {
    const cacheKey = this.generateCacheKey(prompt, imageHash);
    
    // Check memory cache first
    const memoryHit = this.responseCache.get(cacheKey);
    if (memoryHit) {
      memoryHit.hits++;
      memoryHit.lastAccessed = new Date();
      logger.debug('Cache hit (memory)', { key: cacheKey, hits: memoryHit.hits });
      return memoryHit;
    }

    // Check persistent cache
    const persistentHit = await this.checkPersistentCache(cacheKey);
    if (persistentHit) {
      // Restore to memory cache
      this.responseCache.set(cacheKey, persistentHit);
      logger.debug('Cache hit (persistent)', { key: cacheKey });
      return persistentHit;
    }

    // Check semantic similarity if enabled
    if (options?.useSemantic) {
      const semanticHit = await this.checkSemanticCache(
        prompt, 
        imageHash,
        options.threshold || this.similarityThreshold
      );
      if (semanticHit) {
        logger.debug('Cache hit (semantic)', { 
          key: cacheKey,
          similarity: semanticHit.similarity 
        });
        return semanticHit.entry;
      }
    }

    return null;
  }

  /**
   * Store response in cache
   */
  async storeCache(
    prompt: string,
    imageHash: string,
    response: any,
    tokens: number
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(prompt, imageHash);
    
    const entry: CacheEntry = {
      key: cacheKey,
      value: response,
      tokens,
      timestamp: new Date(),
      hits: 0,
      lastAccessed: new Date(),
      contentHash: this.hashContent(response),
    };

    // Store in memory cache
    this.responseCache.set(cacheKey, entry);

    // Store in persistent cache for high-value responses
    if (tokens > 500) {
      await this.storePersistentCache(cacheKey, entry);
    }

    // Generate and store embedding for semantic search
    if (prompt.length > 50) {
      const embedding = await this.generateEmbedding(prompt);
      this.embeddingCache.set(cacheKey, embedding);
    }

    logger.debug('Cached response', { key: cacheKey, tokens });
  }

  /**
   * Track token usage for cost analysis
   */
  trackTokenUsage(usage: TokenUsage): void {
    this.tokenUsageHistory.push(usage);
    
    // Keep only last 1000 entries
    if (this.tokenUsageHistory.length > 1000) {
      this.tokenUsageHistory = this.tokenUsageHistory.slice(-1000);
    }

    // Log high token usage
    if (usage.totalTokens > 1000) {
      logger.warn('High token usage detected', {
        tokens: usage.totalTokens,
        model: usage.model,
        timestamp: usage.timestamp,
      });
    }
  }

  /**
   * Estimate cost for a request
   */
  estimateCost(
    promptTokens: number,
    expectedCompletionTokens: number,
    model: string
  ): CostEstimate {
    const pricing = this.modelPricing.get(model);
    if (!pricing) {
      logger.warn('Unknown model for cost estimation', { model });
      return {
        tokenCost: 0,
        apiCalls: 1,
        estimatedCost: 0,
        savings: 0,
        optimizationRate: 0,
      };
    }

    const inputCost = (promptTokens / 1000) * pricing.inputCostPer1K;
    const outputCost = (expectedCompletionTokens / 1000) * pricing.outputCostPer1K;
    const totalCost = inputCost + outputCost;

    // Calculate potential savings from cache
    const cacheHitRate = this.getCacheHitRate();
    const savings = totalCost * cacheHitRate;

    return {
      tokenCost: promptTokens + expectedCompletionTokens,
      apiCalls: 1,
      estimatedCost: totalCost,
      savings,
      optimizationRate: cacheHitRate,
    };
  }

  /**
   * Optimize request for cost efficiency
   */
  async optimizeRequest(
    prompt: string,
    model: string,
    options?: {
      maxTokens?: number;
      allowDowngrade?: boolean;
      compressionLevel?: 'low' | 'medium' | 'high';
    }
  ): Promise<{
    optimizedPrompt: string;
    recommendedModel: string;
    estimatedSavings: number;
  }> {
    let optimizedPrompt = prompt;
    let recommendedModel = model;
    let estimatedSavings = 0;

    // Compress prompt if needed
    if (options?.compressionLevel) {
      optimizedPrompt = this.compressPrompt(prompt, options.compressionLevel);
      const originalTokens = this.estimateTokens(prompt);
      const compressedTokens = this.estimateTokens(optimizedPrompt);
      const pricing = this.modelPricing.get(model);
      if (pricing) {
        estimatedSavings += ((originalTokens - compressedTokens) / 1000) * pricing.inputCostPer1K;
      }
    }

    // Consider model downgrade for simple requests
    if (options?.allowDowngrade) {
      const complexity = this.analyzePromptComplexity(optimizedPrompt);
      if (complexity < 0.5 && model === 'gpt-4-vision-preview') {
        recommendedModel = 'gpt-4o-mini';
        const originalPricing = this.modelPricing.get(model)!;
        const newPricing = this.modelPricing.get(recommendedModel)!;
        const tokens = this.estimateTokens(optimizedPrompt);
        estimatedSavings += ((tokens / 1000) * (originalPricing.inputCostPer1K - newPricing.inputCostPer1K));
      }
    }

    // Apply token limit if specified
    if (options?.maxTokens) {
      optimizedPrompt = this.truncateToTokenLimit(optimizedPrompt, options.maxTokens);
    }

    return {
      optimizedPrompt,
      recommendedModel,
      estimatedSavings,
    };
  }

  /**
   * Batch requests for efficiency
   */
  async batchRequests<T>(
    requests: Array<{
      id: string;
      prompt: string;
      imageHash: string;
    }>,
    processor: (batch: typeof requests) => Promise<T[]>,
    options?: {
      batchSize?: number;
      delayMs?: number;
      maxConcurrent?: number;
    }
  ): Promise<Map<string, T>> {
    const batchSize = options?.batchSize || 5;
    const delayMs = options?.delayMs || 1000;
    const maxConcurrent = options?.maxConcurrent || 3;
    
    const results = new Map<string, T>();
    const uncachedRequests: typeof requests = [];

    // Check cache for each request
    for (const request of requests) {
      const cached = await this.checkCache(request.prompt, request.imageHash);
      if (cached) {
        results.set(request.id, cached.value as T);
      } else {
        uncachedRequests.push(request);
      }
    }

    // Process uncached requests in batches
    const batches: Array<typeof requests> = [];
    for (let i = 0; i < uncachedRequests.length; i += batchSize) {
      batches.push(uncachedRequests.slice(i, i + batchSize));
    }

    // Process batches with concurrency control
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const concurrentBatches = batches.slice(i, i + maxConcurrent);
      
      const batchPromises = concurrentBatches.map(async (batch) => {
        const batchResults = await processor(batch);
        return batch.map((req, idx) => ({
          id: req.id,
          result: batchResults[idx],
        }));
      });

      const batchResults = await Promise.all(batchPromises);
      
      // Store results
      for (const batch of batchResults) {
        for (const item of batch) {
          results.set(item.id, item.result);
        }
      }

      // Rate limiting delay
      if (i + maxConcurrent < batches.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    logger.info('Batch processing completed', {
      total: requests.length,
      cached: requests.length - uncachedRequests.length,
      processed: uncachedRequests.length,
      savings: ((requests.length - uncachedRequests.length) / requests.length * 100).toFixed(2) + '%',
    });

    return results;
  }

  /**
   * Get cost analytics
   */
  getCostAnalytics(
    timeRange?: { start: Date; end: Date }
  ): {
    totalTokens: number;
    totalCost: number;
    averageTokensPerRequest: number;
    cacheHitRate: number;
    estimatedSavings: number;
    topModels: Array<{ model: string; usage: number; cost: number }>;
  } {
    const relevantUsage = timeRange
      ? this.tokenUsageHistory.filter(u => 
          u.timestamp >= timeRange.start && u.timestamp <= timeRange.end
        )
      : this.tokenUsageHistory;

    const totalTokens = relevantUsage.reduce((sum, u) => sum + u.totalTokens, 0);
    
    // Calculate cost per model
    const modelCosts = new Map<string, { usage: number; cost: number }>();
    
    for (const usage of relevantUsage) {
      const pricing = this.modelPricing.get(usage.model);
      if (pricing) {
        const cost = (usage.promptTokens / 1000) * pricing.inputCostPer1K +
                    (usage.completionTokens / 1000) * pricing.outputCostPer1K;
        
        const existing = modelCosts.get(usage.model) || { usage: 0, cost: 0 };
        modelCosts.set(usage.model, {
          usage: existing.usage + usage.totalTokens,
          cost: existing.cost + cost,
        });
      }
    }

    const totalCost = Array.from(modelCosts.values())
      .reduce((sum, m) => sum + m.cost, 0);

    const cacheHitRate = this.getCacheHitRate();
    const estimatedSavings = totalCost * cacheHitRate;

    return {
      totalTokens,
      totalCost,
      averageTokensPerRequest: relevantUsage.length > 0 
        ? totalTokens / relevantUsage.length 
        : 0,
      cacheHitRate,
      estimatedSavings,
      topModels: Array.from(modelCosts.entries())
        .map(([model, data]) => ({ model, ...data }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5),
    };
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(prompt: string, imageHash: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(prompt);
    hash.update(imageHash);
    return hash.digest('hex');
  }

  /**
   * Hash content for verification
   */
  private hashContent(content: any): string {
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(content));
    return hash.digest('hex');
  }

  /**
   * Check persistent cache in DynamoDB
   */
  private async checkPersistentCache(key: string): Promise<CacheEntry | null> {
    try {
      const response = await this.dynamoClient.get({
        TableName: 'openai-cache',
        Key: { cacheKey: key },
      });

      if (response.Item) {
        return response.Item as CacheEntry;
      }
    } catch (error) {
      logger.error('Failed to check persistent cache', { error, key });
    }
    
    return null;
  }

  /**
   * Store in persistent cache
   */
  private async storePersistentCache(key: string, entry: CacheEntry): Promise<void> {
    try {
      await this.dynamoClient.put({
        TableName: 'openai-cache',
        Item: {
          cacheKey: key,
          ...entry,
          ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days TTL
        },
      });
    } catch (error) {
      logger.error('Failed to store in persistent cache', { error, key });
    }
  }

  /**
   * Check semantic cache using embeddings
   */
  private async checkSemanticCache(
    prompt: string,
    imageHash: string,
    threshold: number
  ): Promise<{ entry: CacheEntry; similarity: number } | null> {
    const queryEmbedding = await this.generateEmbedding(prompt);
    let bestMatch: { entry: CacheEntry; similarity: number } | null = null;
    let highestSimilarity = 0;

    // Search through embeddings
    for (const [key, embedding] of this.embeddingCache.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      
      if (similarity > threshold && similarity > highestSimilarity) {
        const cacheEntry = this.responseCache.get(key);
        if (cacheEntry) {
          highestSimilarity = similarity;
          bestMatch = { entry: cacheEntry, similarity };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Generate embedding for semantic similarity
   */
  private async generateEmbedding(text: string): Promise<Float32Array> {
    // Simplified embedding generation
    // In production, use OpenAI embeddings API
    const hash = crypto.createHash('sha256').update(text).digest();
    const embedding = new Float32Array(1536); // OpenAI embedding dimension
    
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = (hash[i % hash.length] / 255.0) - 0.5;
    }
    
    return embedding;
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Compress prompt to reduce tokens
   */
  private compressPrompt(prompt: string, level: 'low' | 'medium' | 'high'): string {
    let compressed = prompt;
    
    switch (level) {
      case 'low':
        // Remove extra whitespace
        compressed = compressed.replace(/\s+/g, ' ').trim();
        break;
        
      case 'medium':
        // Remove redundancies and simplify
        compressed = compressed
          .replace(/\s+/g, ' ')
          .replace(/\b(\w+)\s+\1\b/gi, '$1') // Remove duplicate words
          .replace(/\s*[,;]\s*/g, ', ') // Normalize punctuation
          .trim();
        break;
        
      case 'high':
        // Aggressive compression
        compressed = compressed
          .replace(/\s+/g, ' ')
          .replace(/\b(the|a|an|is|are|was|were|been|be|have|has|had|do|does|did)\b/gi, '')
          .replace(/\b(\w+)\s+\1\b/gi, '$1')
          .replace(/[^\w\s.!?]/g, '') // Remove special characters
          .replace(/\s+/g, ' ')
          .trim();
        break;
    }
    
    return compressed;
  }

  /**
   * Analyze prompt complexity
   */
  private analyzePromptComplexity(prompt: string): number {
    const factors = {
      length: Math.min(prompt.length / 1000, 1),
      uniqueWords: new Set(prompt.toLowerCase().split(/\s+/)).size / 100,
      technicalTerms: (prompt.match(/\b[A-Z][a-z]+[A-Z]\w*\b/g) || []).length / 10,
      numbers: (prompt.match(/\d+/g) || []).length / 20,
      punctuation: (prompt.match(/[.!?;:]/g) || []).length / 50,
    };
    
    return Object.values(factors).reduce((sum, val) => sum + val, 0) / Object.keys(factors).length;
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate to token limit
   */
  private truncateToTokenLimit(text: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(text);
    
    if (estimatedTokens <= maxTokens) {
      return text;
    }
    
    const targetLength = maxTokens * 4;
    let truncated = text.substring(0, targetLength);
    
    // Find last complete sentence
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > targetLength * 0.8) {
      truncated = truncated.substring(0, lastPeriod + 1);
    }
    
    return truncated;
  }

  /**
   * Get cache hit rate
   */
  private getCacheHitRate(): number {
    let totalHits = 0;
    let totalRequests = 0;
    
    for (const entry of this.responseCache.values()) {
      totalHits += entry.hits;
      totalRequests += entry.hits + 1; // +1 for initial miss
    }
    
    return totalRequests > 0 ? totalHits / totalRequests : 0;
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.responseCache.clear();
    this.embeddingCache.clear();
    this.tokenUsageHistory = [];
    logger.info('All caches cleared');
  }
}