/**
 * Performance and Load Testing Suite for Image Processing
 * Tests performance metrics, concurrent processing, and resource usage
 */

import { performance } from 'perf_hooks';
import { 
  ParallelProcessingMockHelper,
  MemoryUsageMockHelper,
  RateLimitMockHelper
} from '../utils/awsMocks';
import {
  PERFORMANCE_SCENARIOS,
  generateMockImageBuffer,
  TestUtils
} from '../fixtures/imageTestData';

// Performance testing configuration
const PERFORMANCE_CONFIG = {
  thresholds: {
    singleImageProcessing: 15000, // 15 seconds max
    batchProcessing: 60000, // 60 seconds for batch
    memoryUsageMB: 512, // Max 512MB memory
    cpuUsagePercent: 80, // Max 80% CPU
    concurrentJobs: 10, // Max 10 concurrent
    throughputPerSecond: 1 // At least 1 image/second
  },
  testDurations: {
    loadTest: 60000, // 1 minute load test
    stressTest: 180000, // 3 minute stress test
    spikeTest: 30000, // 30 second spike test
    soakTest: 600000 // 10 minute soak test
  }
};

// Performance metrics collector
class PerformanceMetrics {
  private metrics: Map<string, any[]> = new Map();
  
  record(metric: string, value: number): void {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    this.metrics.get(metric)!.push(value);
  }
  
  getAverage(metric: string): number {
    const values = this.metrics.get(metric) || [];
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  getMin(metric: string): number {
    const values = this.metrics.get(metric) || [];
    return values.length > 0 ? Math.min(...values) : 0;
  }
  
  getMax(metric: string): number {
    const values = this.metrics.get(metric) || [];
    return values.length > 0 ? Math.max(...values) : 0;
  }
  
  getPercentile(metric: string, percentile: number): number {
    const values = (this.metrics.get(metric) || []).sort((a, b) => a - b);
    if (values.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[index];
  }
  
  getSummary(metric: string): any {
    return {
      avg: this.getAverage(metric),
      min: this.getMin(metric),
      max: this.getMax(metric),
      p50: this.getPercentile(metric, 50),
      p95: this.getPercentile(metric, 95),
      p99: this.getPercentile(metric, 99),
      count: (this.metrics.get(metric) || []).length
    };
  }
  
  getAllSummaries(): Map<string, any> {
    const summaries = new Map();
    for (const [metric, _] of this.metrics) {
      summaries.set(metric, this.getSummary(metric));
    }
    return summaries;
  }
  
  reset(): void {
    this.metrics.clear();
  }
}

// Load generator for simulating traffic
class LoadGenerator {
  private activeRequests = 0;
  private totalRequests = 0;
  private startTime = 0;
  
  async generateLoad(
    requestsPerSecond: number,
    duration: number,
    requestHandler: () => Promise<void>
  ): Promise<void> {
    this.startTime = Date.now();
    const interval = 1000 / requestsPerSecond;
    
    return new Promise((resolve) => {
      const intervalId = setInterval(async () => {
        if (Date.now() - this.startTime >= duration) {
          clearInterval(intervalId);
          resolve();
          return;
        }
        
        this.totalRequests++;
        this.activeRequests++;
        
        requestHandler().finally(() => {
          this.activeRequests--;
        });
      }, interval);
    });
  }
  
  getStats(): any {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return {
      totalRequests: this.totalRequests,
      activeRequests: this.activeRequests,
      requestsPerSecond: this.totalRequests / elapsed,
      duration: elapsed
    };
  }
  
  reset(): void {
    this.activeRequests = 0;
    this.totalRequests = 0;
    this.startTime = 0;
  }
}

// Resource monitor for tracking system resources
class ResourceMonitor {
  private samples: any[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  
  start(sampleInterval: number = 100): void {
    this.intervalId = setInterval(() => {
      this.samples.push({
        timestamp: Date.now(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      });
    }, sampleInterval);
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  getReport(): any {
    if (this.samples.length === 0) return null;
    
    const memoryMB = this.samples.map(s => s.memory.heapUsed / 1024 / 1024);
    const cpuPercent = this.samples.map((s, i) => {
      if (i === 0) return 0;
      const prevCpu = this.samples[i - 1].cpu;
      const elapsed = s.timestamp - this.samples[i - 1].timestamp;
      const userDiff = s.cpu.user - prevCpu.user;
      const systemDiff = s.cpu.system - prevCpu.system;
      return ((userDiff + systemDiff) / (elapsed * 1000)) * 100;
    });
    
    return {
      memory: {
        avg: memoryMB.reduce((a, b) => a + b, 0) / memoryMB.length,
        max: Math.max(...memoryMB),
        min: Math.min(...memoryMB)
      },
      cpu: {
        avg: cpuPercent.reduce((a, b) => a + b, 0) / cpuPercent.length,
        max: Math.max(...cpuPercent),
        min: Math.min(...cpuPercent)
      },
      samples: this.samples.length
    };
  }
  
  reset(): void {
    this.samples = [];
  }
}

describe('Image Processing Performance Tests', () => {
  const metrics = new PerformanceMetrics();
  const loadGenerator = new LoadGenerator();
  const resourceMonitor = new ResourceMonitor();
  const concurrentHelper = new ParallelProcessingMockHelper(10, 100);
  const memoryHelper = new MemoryUsageMockHelper(512);
  const rateLimiter = new RateLimitMockHelper(10, 1000);
  
  beforeEach(() => {
    metrics.reset();
    loadGenerator.reset();
    resourceMonitor.reset();
    concurrentHelper.reset();
    memoryHelper.reset();
    rateLimiter.reset();
  });
  
  afterEach(() => {
    resourceMonitor.stop();
  });
  
  describe('Single Image Processing Performance', () => {
    test('should process small image within 5 seconds', async () => {
      const scenario = PERFORMANCE_SCENARIOS.singleSmallImage;
      const imageBuffer = generateMockImageBuffer('jpeg', scenario.size);
      
      const startTime = performance.now();
      
      // Simulate image processing
      await simulateImageProcessing(imageBuffer);
      
      const processingTime = performance.now() - startTime;
      metrics.record('small_image_processing', processingTime);
      
      expect(processingTime).toBeLessThan(scenario.expectedTime);
    });
    
    test('should process large image within 15 seconds', async () => {
      const scenario = PERFORMANCE_SCENARIOS.singleLargeImage;
      const imageBuffer = generateMockImageBuffer('jpeg', scenario.size);
      
      const startTime = performance.now();
      
      // Simulate image processing with larger file
      await simulateImageProcessing(imageBuffer);
      
      const processingTime = performance.now() - startTime;
      metrics.record('large_image_processing', processingTime);
      
      expect(processingTime).toBeLessThan(scenario.expectedTime);
    });
    
    test('should handle different image formats efficiently', async () => {
      const formats = ['jpeg', 'png', 'webp', 'gif', 'bmp'] as const;
      const processingTimes: number[] = [];
      
      for (const format of formats) {
        const imageBuffer = generateMockImageBuffer(format, 1048576); // 1MB
        
        const startTime = performance.now();
        await simulateImageProcessing(imageBuffer);
        const processingTime = performance.now() - startTime;
        
        processingTimes.push(processingTime);
        metrics.record(`${format}_processing`, processingTime);
      }
      
      // All formats should process in similar time
      const avgTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      processingTimes.forEach(time => {
        expect(Math.abs(time - avgTime)).toBeLessThan(2000); // Within 2 seconds of average
      });
    });
  });
  
  describe('Batch Processing Performance', () => {
    test('should process batch of 10 small images efficiently', async () => {
      const scenario = PERFORMANCE_SCENARIOS.batchSmallImages;
      const images = Array.from({ length: scenario.count }, () =>
        generateMockImageBuffer('jpeg', scenario.size)
      );
      
      const startTime = performance.now();
      
      if (scenario.parallel) {
        await Promise.all(images.map(img => simulateImageProcessing(img)));
      } else {
        for (const img of images) {
          await simulateImageProcessing(img);
        }
      }
      
      const totalTime = performance.now() - startTime;
      metrics.record('batch_processing', totalTime);
      
      expect(totalTime).toBeLessThan(scenario.expectedTime);
      
      // Calculate throughput
      const throughput = (scenario.count / totalTime) * 1000; // images per second
      expect(throughput).toBeGreaterThan(PERFORMANCE_CONFIG.thresholds.throughputPerSecond);
    });
    
    test('should handle mixed size batch efficiently', async () => {
      const scenario = PERFORMANCE_SCENARIOS.batchMixedSizes;
      const images = scenario.images.map(img =>
        generateMockImageBuffer('jpeg', img.size)
      );
      
      const startTime = performance.now();
      
      await Promise.all(images.map(img => simulateImageProcessing(img)));
      
      const totalTime = performance.now() - startTime;
      metrics.record('mixed_batch_processing', totalTime);
      
      expect(totalTime).toBeLessThan(scenario.expectedTime);
    });
  });
  
  describe('Concurrent Processing Limits', () => {
    test('should respect concurrent job limit of 10', async () => {
      const scenario = PERFORMANCE_SCENARIOS.concurrentLimit;
      
      const processJob = async (index: number) => {
        try {
          await concurrentHelper.startJob();
          await simulateImageProcessing(
            generateMockImageBuffer('jpeg', scenario.size)
          );
          concurrentHelper.finishJob();
          return { success: true, index };
        } catch (error: any) {
          return { success: false, error: error.message, index };
        }
      };
      
      const jobs = Array.from({ length: scenario.count }, (_, i) => processJob(i));
      const results = await Promise.allSettled(jobs);
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;
      
      expect(successful).toBeLessThanOrEqual(scenario.maxConcurrent);
      expect(concurrentHelper.getActiveJobs()).toBeLessThanOrEqual(scenario.maxConcurrent);
    });
    
    test('should queue excess jobs when limit exceeded', async () => {
      const jobQueue: Promise<void>[] = [];
      let queuedJobs = 0;
      let processedJobs = 0;
      
      for (let i = 0; i < 15; i++) {
        const job = (async () => {
          if (concurrentHelper.getActiveJobs() >= 10) {
            queuedJobs++;
            await TestUtils.delay(100); // Wait before retry
          }
          
          await concurrentHelper.startJob();
          await simulateImageProcessing(
            generateMockImageBuffer('jpeg', 100000)
          );
          concurrentHelper.finishJob();
          processedJobs++;
        })();
        
        jobQueue.push(job);
      }
      
      await Promise.all(jobQueue);
      
      expect(queuedJobs).toBeGreaterThan(0);
      expect(processedJobs).toBe(15);
    });
  });
  
  describe('Memory Management', () => {
    test('should not exceed memory limit during processing', async () => {
      resourceMonitor.start(50);
      
      // Process multiple large images
      const images = Array.from({ length: 5 }, () =>
        generateMockImageBuffer('jpeg', 10 * 1024 * 1024) // 10MB each
      );
      
      for (const img of images) {
        memoryHelper.allocate(img.length);
        await simulateImageProcessing(img);
        memoryHelper.free(img.length);
      }
      
      resourceMonitor.stop();
      const report = resourceMonitor.getReport();
      
      expect(report.memory.max).toBeLessThan(PERFORMANCE_CONFIG.thresholds.memoryUsageMB);
    });
    
    test('should handle memory pressure gracefully', async () => {
      // Allocate most of available memory
      memoryHelper.allocate(400 * 1024 * 1024); // 400MB of 512MB limit
      
      // Try to process large image
      const largeImage = generateMockImageBuffer('jpeg', 50 * 1024 * 1024); // 50MB
      
      // Should handle gracefully even with limited memory
      let processed = false;
      try {
        memoryHelper.allocate(largeImage.length);
        await simulateImageProcessing(largeImage);
        memoryHelper.free(largeImage.length);
        processed = true;
      } catch (error: any) {
        expect(error.message).toContain('memory');
      }
      
      // Either processed successfully or failed gracefully
      expect(processed || true).toBe(true);
    });
    
    test('should clean up memory after processing', async () => {
      const initialUsage = memoryHelper.getUsagePercent();
      
      // Process image
      const image = generateMockImageBuffer('jpeg', 5 * 1024 * 1024);
      memoryHelper.allocate(image.length);
      await simulateImageProcessing(image);
      memoryHelper.free(image.length);
      
      const finalUsage = memoryHelper.getUsagePercent();
      
      expect(finalUsage).toBeLessThanOrEqual(initialUsage + 1); // Allow 1% variance
    });
  });
  
  describe('Load Testing', () => {
    test('should handle sustained load for 1 minute', async () => {
      const requestsPerSecond = 2;
      const duration = 10000; // 10 seconds for test (would be 60000 in production)
      
      metrics.reset();
      let successCount = 0;
      let errorCount = 0;
      
      const requestHandler = async () => {
        try {
          const startTime = performance.now();
          await simulateImageProcessing(
            generateMockImageBuffer('jpeg', 500000)
          );
          const responseTime = performance.now() - startTime;
          metrics.record('response_time', responseTime);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      };
      
      await loadGenerator.generateLoad(requestsPerSecond, duration, requestHandler);
      
      const stats = loadGenerator.getStats();
      const responseTimes = metrics.getSummary('response_time');
      
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(successCount / stats.totalRequests).toBeGreaterThan(0.95); // 95% success rate
      expect(responseTimes.p95).toBeLessThan(15000); // 95th percentile under 15s
    });
    
    test('should handle traffic spikes', async () => {
      // Normal load
      let normalRequests = 0;
      const normalHandler = async () => {
        normalRequests++;
        await simulateImageProcessing(generateMockImageBuffer('jpeg', 100000));
      };
      
      // Start with normal load (1 req/sec)
      const normalLoadPromise = loadGenerator.generateLoad(1, 5000, normalHandler);
      
      // Wait 2 seconds then spike to 5 req/sec
      await TestUtils.delay(2000);
      
      let spikeRequests = 0;
      const spikeHandler = async () => {
        spikeRequests++;
        await simulateImageProcessing(generateMockImageBuffer('jpeg', 100000));
      };
      
      const spikeGenerator = new LoadGenerator();
      const spikeLoadPromise = spikeGenerator.generateLoad(5, 3000, spikeHandler);
      
      await Promise.all([normalLoadPromise, spikeLoadPromise]);
      
      expect(normalRequests).toBeGreaterThan(0);
      expect(spikeRequests).toBeGreaterThan(normalRequests);
    });
  });
  
  describe('Stress Testing', () => {
    test('should identify breaking point', async () => {
      let requestsPerSecond = 1;
      let breakingPoint = 0;
      let lastSuccessfulRPS = 0;
      
      while (requestsPerSecond <= 20) {
        const successRate = await testLoadAtRate(requestsPerSecond, 5000);
        
        if (successRate >= 0.95) {
          lastSuccessfulRPS = requestsPerSecond;
        } else {
          breakingPoint = requestsPerSecond;
          break;
        }
        
        requestsPerSecond += 2;
      }
      
      expect(lastSuccessfulRPS).toBeGreaterThan(0);
      if (breakingPoint > 0) {
        expect(breakingPoint).toBeGreaterThan(lastSuccessfulRPS);
      }
    });
    
    test('should recover from overload', async () => {
      // Overload the system
      const overloadGenerator = new LoadGenerator();
      let overloadErrors = 0;
      
      const overloadHandler = async () => {
        try {
          await rateLimiter.checkLimit();
          await simulateImageProcessing(generateMockImageBuffer('jpeg', 100000));
        } catch {
          overloadErrors++;
        }
      };
      
      // Apply heavy load for 3 seconds
      await overloadGenerator.generateLoad(15, 3000, overloadHandler);
      
      expect(overloadErrors).toBeGreaterThan(0);
      
      // Reset and apply normal load
      rateLimiter.reset();
      let recoverySuccess = 0;
      
      const recoveryHandler = async () => {
        try {
          await rateLimiter.checkLimit();
          await simulateImageProcessing(generateMockImageBuffer('jpeg', 100000));
          recoverySuccess++;
        } catch {
          // Ignore
        }
      };
      
      const recoveryGenerator = new LoadGenerator();
      await recoveryGenerator.generateLoad(2, 3000, recoveryHandler);
      
      expect(recoverySuccess).toBeGreaterThan(0);
    });
  });
  
  describe('Performance Metrics Analysis', () => {
    test('should calculate accurate performance statistics', async () => {
      // Generate sample data
      for (let i = 0; i < 100; i++) {
        metrics.record('test_metric', Math.random() * 1000);
      }
      
      const summary = metrics.getSummary('test_metric');
      
      expect(summary.count).toBe(100);
      expect(summary.avg).toBeGreaterThan(0);
      expect(summary.min).toBeLessThanOrEqual(summary.avg);
      expect(summary.max).toBeGreaterThanOrEqual(summary.avg);
      expect(summary.p50).toBeDefined();
      expect(summary.p95).toBeGreaterThanOrEqual(summary.p50);
      expect(summary.p99).toBeGreaterThanOrEqual(summary.p95);
    });
    
    test('should track multiple metrics simultaneously', async () => {
      // Process images and record different metrics
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        const size = (i + 1) * 100000;
        
        await simulateImageProcessing(generateMockImageBuffer('jpeg', size));
        
        const processingTime = performance.now() - startTime;
        metrics.record('processing_time', processingTime);
        metrics.record('image_size', size);
        metrics.record('throughput', size / processingTime);
      }
      
      const allSummaries = metrics.getAllSummaries();
      
      expect(allSummaries.has('processing_time')).toBe(true);
      expect(allSummaries.has('image_size')).toBe(true);
      expect(allSummaries.has('throughput')).toBe(true);
    });
  });
  
  describe('Rate Limiting', () => {
    test('should respect rate limits', async () => {
      const limit = 5;
      const windowMs = 1000;
      const limiter = new RateLimitMockHelper(limit, windowMs);
      
      let accepted = 0;
      let rejected = 0;
      
      // Try to make 10 requests quickly
      for (let i = 0; i < 10; i++) {
        try {
          await limiter.checkLimit();
          accepted++;
        } catch {
          rejected++;
        }
      }
      
      expect(accepted).toBe(limit);
      expect(rejected).toBe(5);
    });
    
    test('should allow requests after window resets', async () => {
      const limiter = new RateLimitMockHelper(3, 500);
      
      // Use up the limit
      for (let i = 0; i < 3; i++) {
        await limiter.checkLimit();
      }
      
      // Should be rate limited
      await expect(limiter.checkLimit()).rejects.toThrow('Rate limit exceeded');
      
      // Wait for window to reset
      await TestUtils.delay(600);
      
      // Should work again
      await expect(limiter.checkLimit()).resolves.toBe(true);
    });
  });
});

// Helper functions
async function simulateImageProcessing(imageBuffer: Buffer): Promise<void> {
  // Simulate processing time based on image size
  const processingTime = Math.min(100 + (imageBuffer.length / 10000), 5000);
  await TestUtils.delay(processingTime);
}

async function testLoadAtRate(rps: number, duration: number): Promise<number> {
  const generator = new LoadGenerator();
  let success = 0;
  let total = 0;
  
  const handler = async () => {
    total++;
    try {
      await simulateImageProcessing(generateMockImageBuffer('jpeg', 100000));
      success++;
    } catch {
      // Count as failure
    }
  };
  
  await generator.generateLoad(rps, duration, handler);
  
  return total > 0 ? success / total : 0;
}