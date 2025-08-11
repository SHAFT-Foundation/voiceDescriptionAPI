/**
 * Performance Monitoring and A/B Testing Framework
 * Tracks model performance, quality metrics, and enables experimentation
 */

import { EventEmitter } from 'events';
import { CloudWatch } from '@aws-sdk/client-cloudwatch';
import { logger } from '../../utils/logger';

export interface PerformanceMetrics {
  latency: number;
  throughput: number;
  errorRate: number;
  tokenEfficiency: number;
  qualityScore: number;
  costPerRequest: number;
}

export interface QualityMetrics {
  accuracy: number;
  completeness: number;
  relevance: number;
  consistency: number;
  userSatisfaction?: number;
}

export interface ABTestConfig {
  name: string;
  variants: Array<{
    id: string;
    config: any;
    weight: number;
  }>;
  metrics: string[];
  duration?: number;
  sampleSize?: number;
}

export interface ExperimentResult {
  variant: string;
  metrics: Record<string, number>;
  sampleSize: number;
  confidence: number;
  winner?: boolean;
}

export class PerformanceMonitoringModule extends EventEmitter {
  private readonly cloudWatch: CloudWatch;
  private readonly metricsBuffer: Map<string, PerformanceMetrics[]>;
  private readonly experiments: Map<string, ABTestConfig>;
  private readonly experimentResults: Map<string, Map<string, ExperimentResult>>;
  private readonly qualityBaselines: Map<string, QualityMetrics>;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    this.cloudWatch = new CloudWatch({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    
    this.metricsBuffer = new Map();
    this.experiments = new Map();
    this.experimentResults = new Map();
    this.qualityBaselines = new Map();
    
    // Initialize quality baselines
    this.initializeBaselines();
    
    // Start metrics publishing
    this.startMetricsPublishing();
  }

  /**
   * Track request performance
   */
  trackPerformance(
    operation: string,
    metrics: Partial<PerformanceMetrics>,
    metadata?: Record<string, any>
  ): void {
    const fullMetrics: PerformanceMetrics = {
      latency: metrics.latency || 0,
      throughput: metrics.throughput || 0,
      errorRate: metrics.errorRate || 0,
      tokenEfficiency: metrics.tokenEfficiency || 0,
      qualityScore: metrics.qualityScore || 0,
      costPerRequest: metrics.costPerRequest || 0,
    };

    // Buffer metrics
    if (!this.metricsBuffer.has(operation)) {
      this.metricsBuffer.set(operation, []);
    }
    this.metricsBuffer.get(operation)!.push(fullMetrics);

    // Emit for real-time monitoring
    this.emit('metrics', {
      operation,
      metrics: fullMetrics,
      metadata,
      timestamp: new Date(),
    });

    // Check for anomalies
    this.detectAnomalies(operation, fullMetrics);
  }

  /**
   * Evaluate response quality
   */
  async evaluateQuality(
    response: string,
    expectedFeatures: {
      minLength?: number;
      maxLength?: number;
      requiredElements?: string[];
      forbiddenPatterns?: RegExp[];
      sentimentRange?: [number, number];
    }
  ): Promise<QualityMetrics> {
    const metrics: QualityMetrics = {
      accuracy: 1.0,
      completeness: 1.0,
      relevance: 1.0,
      consistency: 1.0,
    };

    // Length check
    if (expectedFeatures.minLength && response.length < expectedFeatures.minLength) {
      metrics.completeness *= 0.8;
    }
    if (expectedFeatures.maxLength && response.length > expectedFeatures.maxLength) {
      metrics.relevance *= 0.9;
    }

    // Required elements check
    if (expectedFeatures.requiredElements) {
      const found = expectedFeatures.requiredElements.filter(elem =>
        response.toLowerCase().includes(elem.toLowerCase())
      );
      metrics.completeness *= found.length / expectedFeatures.requiredElements.length;
    }

    // Forbidden patterns check
    if (expectedFeatures.forbiddenPatterns) {
      for (const pattern of expectedFeatures.forbiddenPatterns) {
        if (pattern.test(response)) {
          metrics.accuracy *= 0.7;
        }
      }
    }

    // Calculate overall quality score
    const qualityScore = Object.values(metrics).reduce((sum, val) => sum + val, 0) / 4;

    // Track quality degradation
    this.trackQualityTrend('response_quality', metrics);

    return metrics;
  }

  /**
   * Start A/B test
   */
  startABTest(config: ABTestConfig): string {
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.experiments.set(testId, config);
    this.experimentResults.set(testId, new Map());
    
    // Initialize results for each variant
    for (const variant of config.variants) {
      this.experimentResults.get(testId)!.set(variant.id, {
        variant: variant.id,
        metrics: {},
        sampleSize: 0,
        confidence: 0,
      });
    }

    logger.info('A/B test started', {
      testId,
      name: config.name,
      variants: config.variants.map(v => v.id),
    });

    // Set automatic test completion if duration specified
    if (config.duration) {
      setTimeout(() => {
        this.concludeABTest(testId);
      }, config.duration);
    }

    return testId;
  }

  /**
   * Select variant for A/B test
   */
  selectVariant(testId: string): { variant: string; config: any } | null {
    const test = this.experiments.get(testId);
    if (!test) return null;

    // Weighted random selection
    const random = Math.random();
    let cumulative = 0;
    
    for (const variant of test.variants) {
      cumulative += variant.weight;
      if (random <= cumulative) {
        return {
          variant: variant.id,
          config: variant.config,
        };
      }
    }

    // Fallback to first variant
    return {
      variant: test.variants[0].id,
      config: test.variants[0].config,
    };
  }

  /**
   * Record A/B test result
   */
  recordABTestResult(
    testId: string,
    variant: string,
    metrics: Record<string, number>
  ): void {
    const results = this.experimentResults.get(testId);
    if (!results) return;

    const variantResult = results.get(variant);
    if (!variantResult) return;

    // Update metrics with running average
    variantResult.sampleSize++;
    
    for (const [key, value] of Object.entries(metrics)) {
      const current = variantResult.metrics[key] || 0;
      variantResult.metrics[key] = 
        (current * (variantResult.sampleSize - 1) + value) / variantResult.sampleSize;
    }

    // Calculate confidence
    variantResult.confidence = this.calculateConfidence(variantResult.sampleSize);

    // Check if test should conclude
    const test = this.experiments.get(testId);
    if (test?.sampleSize && variantResult.sampleSize >= test.sampleSize) {
      this.concludeABTest(testId);
    }
  }

  /**
   * Conclude A/B test and determine winner
   */
  concludeABTest(testId: string): ExperimentResult[] {
    const test = this.experiments.get(testId);
    const results = this.experimentResults.get(testId);
    
    if (!test || !results) return [];

    const variantResults = Array.from(results.values());
    
    // Determine winner based on primary metric
    const primaryMetric = test.metrics[0];
    let bestScore = -Infinity;
    let winner: string | null = null;
    
    for (const result of variantResults) {
      const score = result.metrics[primaryMetric] || 0;
      if (score > bestScore) {
        bestScore = score;
        winner = result.variant;
      }
    }

    // Mark winner
    variantResults.forEach(result => {
      result.winner = result.variant === winner;
    });

    // Log results
    logger.info('A/B test concluded', {
      testId,
      name: test.name,
      winner,
      results: variantResults.map(r => ({
        variant: r.variant,
        metrics: r.metrics,
        sampleSize: r.sampleSize,
        confidence: r.confidence,
      })),
    });

    // Clean up
    this.experiments.delete(testId);
    this.experimentResults.delete(testId);

    // Publish results to CloudWatch
    this.publishABTestResults(test.name, variantResults);

    return variantResults;
  }

  /**
   * Get real-time performance stats
   */
  getRealtimeStats(
    operation?: string,
    timeWindow?: number
  ): Record<string, PerformanceMetrics> {
    const stats: Record<string, PerformanceMetrics> = {};
    const cutoff = timeWindow ? Date.now() - timeWindow : 0;

    for (const [op, metrics] of this.metricsBuffer.entries()) {
      if (operation && op !== operation) continue;

      // Filter by time window if specified
      const relevantMetrics = timeWindow
        ? metrics.filter(m => (m as any).timestamp > cutoff)
        : metrics;

      if (relevantMetrics.length === 0) continue;

      // Calculate aggregates
      stats[op] = {
        latency: this.average(relevantMetrics.map(m => m.latency)),
        throughput: this.sum(relevantMetrics.map(m => m.throughput)),
        errorRate: this.average(relevantMetrics.map(m => m.errorRate)),
        tokenEfficiency: this.average(relevantMetrics.map(m => m.tokenEfficiency)),
        qualityScore: this.average(relevantMetrics.map(m => m.qualityScore)),
        costPerRequest: this.average(relevantMetrics.map(m => m.costPerRequest)),
      };
    }

    return stats;
  }

  /**
   * Compare pipeline performance
   */
  comparePipelines(
    pipelineMetrics: Map<string, PerformanceMetrics[]>
  ): {
    comparison: Record<string, {
      metrics: PerformanceMetrics;
      rank: number;
      recommendation: string;
    }>;
    winner: string;
  } {
    const comparison: Record<string, any> = {};
    const scores: Map<string, number> = new Map();

    for (const [pipeline, metrics] of pipelineMetrics.entries()) {
      const avgMetrics: PerformanceMetrics = {
        latency: this.average(metrics.map(m => m.latency)),
        throughput: this.average(metrics.map(m => m.throughput)),
        errorRate: this.average(metrics.map(m => m.errorRate)),
        tokenEfficiency: this.average(metrics.map(m => m.tokenEfficiency)),
        qualityScore: this.average(metrics.map(m => m.qualityScore)),
        costPerRequest: this.average(metrics.map(m => m.costPerRequest)),
      };

      // Calculate composite score
      const score = 
        (1 / avgMetrics.latency) * 0.2 +
        avgMetrics.throughput * 0.2 +
        (1 - avgMetrics.errorRate) * 0.2 +
        avgMetrics.tokenEfficiency * 0.15 +
        avgMetrics.qualityScore * 0.15 +
        (1 / avgMetrics.costPerRequest) * 0.1;

      scores.set(pipeline, score);
      comparison[pipeline] = {
        metrics: avgMetrics,
        score,
      };
    }

    // Rank pipelines
    const ranked = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1]);

    ranked.forEach(([pipeline, score], index) => {
      comparison[pipeline].rank = index + 1;
      comparison[pipeline].recommendation = this.generateRecommendation(
        comparison[pipeline].metrics,
        index === 0
      );
    });

    return {
      comparison,
      winner: ranked[0][0],
    };
  }

  /**
   * Detect performance anomalies
   */
  private detectAnomalies(
    operation: string,
    metrics: PerformanceMetrics
  ): void {
    const baseline = this.getBaseline(operation);
    if (!baseline) return;

    const anomalies: string[] = [];

    // Check for significant deviations
    if (metrics.latency > baseline.latency * 2) {
      anomalies.push(`High latency: ${metrics.latency}ms (baseline: ${baseline.latency}ms)`);
    }
    
    if (metrics.errorRate > baseline.errorRate + 0.1) {
      anomalies.push(`Elevated error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
    }
    
    if (metrics.qualityScore < baseline.qualityScore * 0.8) {
      anomalies.push(`Quality degradation: ${metrics.qualityScore.toFixed(2)}`);
    }
    
    if (metrics.costPerRequest > baseline.costPerRequest * 1.5) {
      anomalies.push(`Cost spike: $${metrics.costPerRequest.toFixed(4)}`);
    }

    if (anomalies.length > 0) {
      logger.warn('Performance anomalies detected', {
        operation,
        anomalies,
        metrics,
        baseline,
      });

      this.emit('anomaly', {
        operation,
        anomalies,
        metrics,
        baseline,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Track quality trends
   */
  private trackQualityTrend(
    metric: string,
    quality: QualityMetrics
  ): void {
    const baseline = this.qualityBaselines.get(metric);
    
    if (!baseline) {
      this.qualityBaselines.set(metric, quality);
      return;
    }

    // Update baseline with exponential moving average
    const alpha = 0.1; // Smoothing factor
    
    baseline.accuracy = alpha * quality.accuracy + (1 - alpha) * baseline.accuracy;
    baseline.completeness = alpha * quality.completeness + (1 - alpha) * baseline.completeness;
    baseline.relevance = alpha * quality.relevance + (1 - alpha) * baseline.relevance;
    baseline.consistency = alpha * quality.consistency + (1 - alpha) * baseline.consistency;

    // Check for quality degradation
    const overallQuality = (quality.accuracy + quality.completeness + 
                           quality.relevance + quality.consistency) / 4;
    const baselineQuality = (baseline.accuracy + baseline.completeness + 
                            baseline.relevance + baseline.consistency) / 4;

    if (overallQuality < baselineQuality * 0.9) {
      logger.warn('Quality degradation detected', {
        metric,
        current: overallQuality,
        baseline: baselineQuality,
      });
    }
  }

  /**
   * Initialize quality baselines
   */
  private initializeBaselines(): void {
    this.qualityBaselines.set('response_quality', {
      accuracy: 0.95,
      completeness: 0.90,
      relevance: 0.92,
      consistency: 0.88,
    });
  }

  /**
   * Get performance baseline
   */
  private getBaseline(operation: string): PerformanceMetrics {
    // Default baselines
    return {
      latency: 1000,
      throughput: 10,
      errorRate: 0.01,
      tokenEfficiency: 0.8,
      qualityScore: 0.9,
      costPerRequest: 0.05,
    };
  }

  /**
   * Calculate statistical confidence
   */
  private calculateConfidence(sampleSize: number): number {
    // Simplified confidence calculation
    // In production, use proper statistical methods
    return Math.min(0.99, Math.sqrt(sampleSize / 100));
  }

  /**
   * Generate performance recommendation
   */
  private generateRecommendation(
    metrics: PerformanceMetrics,
    isWinner: boolean
  ): string {
    const recommendations: string[] = [];

    if (metrics.latency > 2000) {
      recommendations.push('Consider caching or request optimization');
    }
    
    if (metrics.errorRate > 0.05) {
      recommendations.push('Investigate error sources and add retry logic');
    }
    
    if (metrics.tokenEfficiency < 0.7) {
      recommendations.push('Optimize prompts to reduce token usage');
    }
    
    if (metrics.costPerRequest > 0.10) {
      recommendations.push('Consider using a more cost-efficient model');
    }

    if (isWinner && recommendations.length === 0) {
      recommendations.push('Performance is optimal');
    }

    return recommendations.join('; ');
  }

  /**
   * Publish metrics to CloudWatch
   */
  private async publishMetrics(): Promise<void> {
    const metricData: any[] = [];

    for (const [operation, metrics] of this.metricsBuffer.entries()) {
      if (metrics.length === 0) continue;

      const avgMetrics = {
        latency: this.average(metrics.map(m => m.latency)),
        throughput: this.sum(metrics.map(m => m.throughput)),
        errorRate: this.average(metrics.map(m => m.errorRate)),
        tokenEfficiency: this.average(metrics.map(m => m.tokenEfficiency)),
        qualityScore: this.average(metrics.map(m => m.qualityScore)),
        costPerRequest: this.average(metrics.map(m => m.costPerRequest)),
      };

      for (const [key, value] of Object.entries(avgMetrics)) {
        metricData.push({
          MetricName: key,
          Value: value,
          Unit: this.getMetricUnit(key),
          Timestamp: new Date(),
          Dimensions: [
            {
              Name: 'Operation',
              Value: operation,
            },
            {
              Name: 'Service',
              Value: 'OpenAI',
            },
          ],
        });
      }
    }

    if (metricData.length > 0) {
      try {
        await this.cloudWatch.putMetricData({
          Namespace: 'VoiceDescriptionAPI/OpenAI',
          MetricData: metricData,
        });
        
        // Clear buffer after publishing
        this.metricsBuffer.clear();
      } catch (error) {
        logger.error('Failed to publish metrics to CloudWatch', { error });
      }
    }
  }

  /**
   * Publish A/B test results
   */
  private async publishABTestResults(
    testName: string,
    results: ExperimentResult[]
  ): Promise<void> {
    const metricData: any[] = [];

    for (const result of results) {
      for (const [metric, value] of Object.entries(result.metrics)) {
        metricData.push({
          MetricName: metric,
          Value: value,
          Unit: 'None',
          Timestamp: new Date(),
          Dimensions: [
            {
              Name: 'TestName',
              Value: testName,
            },
            {
              Name: 'Variant',
              Value: result.variant,
            },
            {
              Name: 'Winner',
              Value: result.winner ? 'true' : 'false',
            },
          ],
        });
      }
    }

    try {
      await this.cloudWatch.putMetricData({
        Namespace: 'VoiceDescriptionAPI/ABTests',
        MetricData: metricData,
      });
    } catch (error) {
      logger.error('Failed to publish A/B test results', { error });
    }
  }

  /**
   * Get metric unit for CloudWatch
   */
  private getMetricUnit(metric: string): string {
    const units: Record<string, string> = {
      latency: 'Milliseconds',
      throughput: 'Count/Second',
      errorRate: 'Percent',
      tokenEfficiency: 'None',
      qualityScore: 'None',
      costPerRequest: 'None',
    };
    
    return units[metric] || 'None';
  }

  /**
   * Start automatic metrics publishing
   */
  private startMetricsPublishing(): void {
    // Publish metrics every minute
    this.metricsInterval = setInterval(() => {
      this.publishMetrics();
    }, 60000);
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate sum
   */
  private sum(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    // Publish remaining metrics
    this.publishMetrics();
  }
}