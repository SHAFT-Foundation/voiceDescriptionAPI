import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { performance } from 'perf_hooks';
import { APIClient } from '../../src/adapters/api-client.js';
import { FileHandler } from '../../src/adapters/file-handler.js';
import { ToolRegistry } from '../../src/tools/registry.js';
import {
  generateTestVideo,
  generateTestImage,
  createTestFile,
  cleanupTestFile,
  wait,
  PerformanceMonitor,
  TestCleanup,
} from '../utils/test-helpers.js';

interface PerformanceMetrics {
  responseTime: number[];
  throughput: number;
  errorRate: number;
  concurrentConnections: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

describe('Performance and Load Tests', () => {
  let apiClient: APIClient;
  let fileHandler: FileHandler;
  let toolRegistry: ToolRegistry;
  let cleanup: TestCleanup;
  const baseURL = process.env.API_BASE_URL || 'http://localhost:3000';

  // Performance thresholds
  const THRESHOLDS = {
    responseTime: {
      p50: 200,   // milliseconds
      p95: 500,
      p99: 1000,
    },
    throughput: 100,  // requests per second
    errorRate: 0.01,  // 1%
    cpuUsage: 70,     // percentage
    memoryUsage: 512, // MB
  };

  beforeAll(async () => {
    apiClient = new APIClient({ baseUrl: baseURL });
    fileHandler = new FileHandler();
    cleanup = new TestCleanup();
    
    toolRegistry = new ToolRegistry({
      apiClient,
      fileHandler,
      jobPoller: null, // Not needed for performance tests
    });

    // Warm up the API
    await apiClient.checkHealth();
  });

  afterAll(async () => {
    await cleanup.execute();
  });

  describe('Baseline Performance Tests', () => {
    it('should meet single request latency requirements', async () => {
      const metrics = new PerformanceMonitor();
      
      // Test health check endpoint
      const healthTimer = metrics.startTimer('health');
      await apiClient.checkHealth();
      healthTimer();
      
      // Test AWS status endpoint
      const awsTimer = metrics.startTimer('aws-status');
      await apiClient.checkAWSStatus();
      awsTimer();
      
      // Verify latencies
      const healthMetrics = metrics.getMetrics('health');
      const awsMetrics = metrics.getMetrics('aws-status');
      
      expect(healthMetrics?.avg).toBeLessThan(THRESHOLDS.responseTime.p50);
      expect(awsMetrics?.avg).toBeLessThan(THRESHOLDS.responseTime.p95);
    });

    it('should handle file upload within performance limits', async () => {
      const metrics = new PerformanceMonitor();
      const testSizes = [
        { size: 1024 * 100, name: '100KB', maxTime: 500 },      // 100KB
        { size: 1024 * 1024, name: '1MB', maxTime: 2000 },      // 1MB
        { size: 1024 * 1024 * 5, name: '5MB', maxTime: 5000 },  // 5MB
      ];

      for (const test of testSizes) {
        const imagePath = `/tmp/perf-${test.name}.jpg`;
        await createTestFile(imagePath, generateTestImage(test.size));
        
        const timer = metrics.startTimer(test.name);
        const buffer = await fileHandler.readFileAsBuffer(imagePath);
        await apiClient.processImage({
          image: buffer,
          filename: `test-${test.name}.jpg`,
        });
        timer();
        
        await cleanupTestFile(imagePath);
        
        const testMetrics = metrics.getMetrics(test.name);
        expect(testMetrics?.avg).toBeLessThan(test.maxTime);
        
        // Calculate throughput
        const throughput = (test.size / 1024 / 1024) / (testMetrics!.avg / 1000); // MB/s
        expect(throughput).toBeGreaterThan(1); // At least 1 MB/s
      }
    });
  });

  describe('Concurrent Load Tests', () => {
    it('should handle concurrent health checks', async () => {
      const concurrentRequests = 50;
      const metrics = new PerformanceMonitor();
      const errors: Error[] = [];
      
      const timer = metrics.startTimer('concurrent-health');
      
      const requests = Array.from({ length: concurrentRequests }, async () => {
        try {
          const start = performance.now();
          await apiClient.checkHealth();
          return performance.now() - start;
        } catch (error) {
          errors.push(error as Error);
          return null;
        }
      });
      
      const results = await Promise.all(requests);
      timer();
      
      const successfulRequests = results.filter(r => r !== null) as number[];
      const errorRate = errors.length / concurrentRequests;
      
      expect(errorRate).toBeLessThan(THRESHOLDS.errorRate);
      expect(successfulRequests.length).toBeGreaterThan(concurrentRequests * 0.95);
      
      // Calculate percentiles
      const sorted = successfulRequests.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      
      expect(p50).toBeLessThan(THRESHOLDS.responseTime.p50 * 2); // Allow 2x for concurrent
      expect(p95).toBeLessThan(THRESHOLDS.responseTime.p95 * 2);
      expect(p99).toBeLessThan(THRESHOLDS.responseTime.p99 * 2);
    });

    it('should handle concurrent image processing', async () => {
      const concurrentUploads = 10;
      const metrics = new PerformanceMonitor();
      const errors: Error[] = [];
      
      // Create test images
      const images = [];
      for (let i = 0; i < concurrentUploads; i++) {
        const path = `/tmp/concurrent-${i}.jpg`;
        await createTestFile(path, generateTestImage(512 * 1024)); // 512KB each
        images.push(path);
        cleanup.add(() => cleanupTestFile(path));
      }
      
      const timer = metrics.startTimer('concurrent-processing');
      
      const uploads = images.map(async (path, index) => {
        try {
          const start = performance.now();
          const buffer = await fileHandler.readFileAsBuffer(path);
          await apiClient.processImage({
            image: buffer,
            filename: `concurrent-${index}.jpg`,
          });
          return performance.now() - start;
        } catch (error) {
          errors.push(error as Error);
          return null;
        }
      });
      
      const results = await Promise.all(uploads);
      timer();
      
      const successfulUploads = results.filter(r => r !== null) as number[];
      const errorRate = errors.length / concurrentUploads;
      
      expect(errorRate).toBeLessThan(0.1); // 10% error rate acceptable for heavy load
      expect(successfulUploads.length).toBeGreaterThan(concurrentUploads * 0.8);
      
      const totalMetrics = metrics.getMetrics('concurrent-processing');
      const avgTimePerUpload = totalMetrics!.avg / concurrentUploads;
      expect(avgTimePerUpload).toBeLessThan(5000); // 5 seconds per upload average
    });
  });

  describe('Stress Tests', () => {
    it('should handle sustained load for extended period', async () => {
      const durationMs = 30000; // 30 seconds
      const requestsPerSecond = 10;
      const metrics = new PerformanceMonitor();
      const errors: Error[] = [];
      let requestCount = 0;
      
      const startTime = performance.now();
      const endTime = startTime + durationMs;
      
      while (performance.now() < endTime) {
        const batchStart = performance.now();
        
        // Send batch of requests
        const batch = Array.from({ length: requestsPerSecond }, async () => {
          try {
            const timer = metrics.startTimer('sustained-request');
            await apiClient.checkHealth();
            timer();
            requestCount++;
          } catch (error) {
            errors.push(error as Error);
          }
        });
        
        await Promise.all(batch);
        
        // Wait for remainder of the second
        const elapsed = performance.now() - batchStart;
        if (elapsed < 1000) {
          await wait(1000 - elapsed);
        }
      }
      
      const actualDuration = (performance.now() - startTime) / 1000; // seconds
      const actualThroughput = requestCount / actualDuration;
      const errorRate = errors.length / requestCount;
      
      expect(actualThroughput).toBeGreaterThan(requestsPerSecond * 0.8);
      expect(errorRate).toBeLessThan(0.05); // 5% error rate under stress
      
      const requestMetrics = metrics.getMetrics('sustained-request');
      expect(requestMetrics?.p95).toBeLessThan(1000);
    });

    it('should handle traffic spikes gracefully', async () => {
      const normalLoad = 5;
      const spikeLoad = 50;
      const metrics = new PerformanceMonitor();
      const errors: Error[] = [];
      
      // Normal load
      const normalTimer = metrics.startTimer('normal-load');
      const normalRequests = Array.from({ length: normalLoad }, () =>
        apiClient.checkHealth().catch(e => errors.push(e))
      );
      await Promise.all(normalRequests);
      normalTimer();
      
      // Traffic spike
      const spikeTimer = metrics.startTimer('spike-load');
      const spikeRequests = Array.from({ length: spikeLoad }, () =>
        apiClient.checkHealth().catch(e => errors.push(e))
      );
      await Promise.all(spikeRequests);
      spikeTimer();
      
      // Return to normal
      const recoveryTimer = metrics.startTimer('recovery-load');
      const recoveryRequests = Array.from({ length: normalLoad }, () =>
        apiClient.checkHealth().catch(e => errors.push(e))
      );
      await Promise.all(recoveryRequests);
      recoveryTimer();
      
      const normalMetrics = metrics.getMetrics('normal-load');
      const spikeMetrics = metrics.getMetrics('spike-load');
      const recoveryMetrics = metrics.getMetrics('recovery-load');
      
      // Spike should be slower but not catastrophically
      expect(spikeMetrics?.avg).toBeLessThan(normalMetrics!.avg * 5);
      
      // Recovery should return to near-normal performance
      expect(recoveryMetrics?.avg).toBeLessThan(normalMetrics!.avg * 1.5);
      
      // Overall error rate should be manageable
      const totalRequests = normalLoad + spikeLoad + normalLoad;
      const errorRate = errors.length / totalRequests;
      expect(errorRate).toBeLessThan(0.1);
    });
  });

  describe('Resource Utilization Tests', () => {
    it('should not leak memory during extended operations', async () => {
      const iterations = 100;
      const memorySnapshots: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        // Perform operations
        await apiClient.checkHealth();
        
        // Take memory snapshot every 10 iterations
        if (i % 10 === 0) {
          if (global.gc) global.gc(); // Force garbage collection if available
          const memUsage = process.memoryUsage();
          memorySnapshots.push(memUsage.heapUsed / 1024 / 1024); // MB
        }
        
        await wait(100);
      }
      
      // Check for memory leaks (memory shouldn't continuously increase)
      const firstHalf = memorySnapshots.slice(0, 5);
      const secondHalf = memorySnapshots.slice(5);
      
      const avgFirstHalf = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecondHalf = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      // Memory usage shouldn't increase by more than 20%
      expect(avgSecondHalf).toBeLessThan(avgFirstHalf * 1.2);
    });

    it('should handle connection pool efficiently', async () => {
      const connections = 20;
      const metrics = new PerformanceMonitor();
      
      // Create multiple clients to test connection pooling
      const clients = Array.from({ length: connections }, () => 
        new APIClient({ baseUrl: baseURL })
      );
      
      const timer = metrics.startTimer('connection-pool');
      
      const requests = clients.map(async (client, index) => {
        const requestTimer = metrics.startTimer(`client-${index}`);
        await client.checkHealth();
        requestTimer();
      });
      
      await Promise.all(requests);
      timer();
      
      // Check that connection pooling is efficient
      const poolMetrics = metrics.getMetrics('connection-pool');
      const avgPerClient = poolMetrics!.avg / connections;
      
      expect(avgPerClient).toBeLessThan(100); // Should benefit from pooling
      
      // Individual client times should be consistent
      for (let i = 0; i < connections; i++) {
        const clientMetrics = metrics.getMetrics(`client-${i}`);
        expect(clientMetrics?.avg).toBeLessThan(200);
      }
    });
  });

  describe('Throughput Tests', () => {
    it('should achieve minimum throughput requirements', async () => {
      const testDuration = 10000; // 10 seconds
      const minThroughput = 50; // requests per second
      let successCount = 0;
      let errorCount = 0;
      
      const startTime = performance.now();
      const endTime = startTime + testDuration;
      
      // Continuously send requests
      const sendRequests = async () => {
        while (performance.now() < endTime) {
          try {
            await apiClient.checkHealth();
            successCount++;
          } catch {
            errorCount++;
          }
        }
      };
      
      // Run multiple concurrent senders
      const senders = Array.from({ length: 5 }, () => sendRequests());
      await Promise.all(senders);
      
      const actualDuration = (performance.now() - startTime) / 1000;
      const throughput = successCount / actualDuration;
      const errorRate = errorCount / (successCount + errorCount);
      
      expect(throughput).toBeGreaterThan(minThroughput);
      expect(errorRate).toBeLessThan(0.05);
    });

    it('should maintain throughput under mixed workload', async () => {
      const testDuration = 15000; // 15 seconds
      const metrics = {
        health: 0,
        status: 0,
        upload: 0,
        errors: 0,
      };
      
      const startTime = performance.now();
      const endTime = startTime + testDuration;
      
      // Mixed workload simulation
      const workloadMix = async () => {
        while (performance.now() < endTime) {
          const operation = Math.random();
          
          try {
            if (operation < 0.6) {
              // 60% health checks (light)
              await apiClient.checkHealth();
              metrics.health++;
            } else if (operation < 0.9) {
              // 30% status checks (medium)
              await apiClient.checkStatus('123e4567-e89b-12d3-a456-426614174000').catch(() => {});
              metrics.status++;
            } else {
              // 10% uploads (heavy)
              const buffer = generateTestImage(100 * 1024); // 100KB
              await apiClient.processImage({
                image: buffer,
                filename: 'test.jpg',
              });
              metrics.upload++;
            }
          } catch {
            metrics.errors++;
          }
          
          await wait(50); // Small delay between operations
        }
      };
      
      // Run concurrent workers
      const workers = Array.from({ length: 3 }, () => workloadMix());
      await Promise.all(workers);
      
      const actualDuration = (performance.now() - startTime) / 1000;
      const totalOperations = metrics.health + metrics.status + metrics.upload;
      const overallThroughput = totalOperations / actualDuration;
      const errorRate = metrics.errors / (totalOperations + metrics.errors);
      
      expect(overallThroughput).toBeGreaterThan(10); // At least 10 ops/sec
      expect(errorRate).toBeLessThan(0.1);
      
      // Verify workload distribution
      const healthRatio = metrics.health / totalOperations;
      const statusRatio = metrics.status / totalOperations;
      const uploadRatio = metrics.upload / totalOperations;
      
      expect(healthRatio).toBeGreaterThan(0.4);
      expect(statusRatio).toBeGreaterThan(0.2);
      expect(uploadRatio).toBeGreaterThan(0.05);
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with load increase', async () => {
      const loadLevels = [5, 10, 20];
      const results: { load: number; throughput: number; avgLatency: number }[] = [];
      
      for (const load of loadLevels) {
        const metrics = new PerformanceMonitor();
        const timer = metrics.startTimer(`load-${load}`);
        
        const requests = Array.from({ length: load }, async () => {
          const reqTimer = metrics.startTimer('request');
          await apiClient.checkHealth();
          reqTimer();
        });
        
        await Promise.all(requests);
        timer();
        
        const loadMetrics = metrics.getMetrics(`load-${load}`);
        const requestMetrics = metrics.getMetrics('request');
        
        results.push({
          load,
          throughput: load / (loadMetrics!.avg / 1000),
          avgLatency: requestMetrics!.avg,
        });
      }
      
      // Verify linear scalability
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        
        // Throughput should increase somewhat linearly
        const throughputRatio = curr.throughput / prev.throughput;
        const loadRatio = curr.load / prev.load;
        
        expect(throughputRatio).toBeGreaterThan(loadRatio * 0.7); // At least 70% linear
        
        // Latency shouldn't increase dramatically
        expect(curr.avgLatency).toBeLessThan(prev.avgLatency * 2);
      }
    });
  });
});