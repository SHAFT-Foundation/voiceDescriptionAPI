/**
 * MCP Server Integration Tests
 * Tests the complete integration of MCP protocol with Voice Description API
 */

import { MCPServer } from '@mcp/server';
import { MCPClient } from '../utils/testHelpers';
import * as request from 'supertest';
import { Server } from 'http';
import * as WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('MCP Server Integration', () => {
  let mcpServer: MCPServer;
  let httpServer: Server;
  let apiServer: Server;
  let wsClient: WebSocket;
  let testJobIds: string[] = [];

  beforeAll(async () => {
    // Start the Voice Description API server
    process.env.NODE_ENV = 'test';
    process.env.USE_MOCK_AWS = 'true';
    
    apiServer = await startAPIServer();
    
    // Start the MCP server
    mcpServer = new MCPServer({
      port: 3001,
      apiBaseUrl: 'http://localhost:3000',
      enableWebSocket: true,
      enableHTTP: true
    });
    
    httpServer = await mcpServer.start();
    
    // Wait for servers to be ready
    await waitForServers();
  });

  afterAll(async () => {
    // Cleanup test jobs
    for (const jobId of testJobIds) {
      try {
        await cleanupJob(jobId);
      } catch (error) {
        console.error(`Failed to cleanup job ${jobId}:`, error);
      }
    }

    // Shutdown servers
    if (wsClient) wsClient.close();
    await mcpServer.stop();
    await stopAPIServer(apiServer);
  });

  describe('Protocol Communication', () => {
    describe('HTTP Transport', () => {
      test('should handle JSON-RPC requests over HTTP', async () => {
        const response = await request(httpServer)
          .post('/rpc')
          .send({
            jsonrpc: '2.0',
            id: uuidv4(),
            method: 'tools/list',
            params: {}
          })
          .expect(200)
          .expect('Content-Type', /json/);

        expect(response.body).toMatchObject({
          jsonrpc: '2.0',
          id: expect.any(String),
          result: {
            tools: expect.arrayContaining([
              expect.objectContaining({
                name: 'voice_description_upload_video',
                description: expect.any(String),
                inputSchema: expect.any(Object)
              }),
              expect.objectContaining({
                name: 'voice_description_process_image',
                description: expect.any(String),
                inputSchema: expect.any(Object)
              })
            ])
          }
        });
      });

      test('should handle batch requests', async () => {
        const batchRequest = [
          {
            jsonrpc: '2.0',
            id: '1',
            method: 'tools/list',
            params: {}
          },
          {
            jsonrpc: '2.0',
            id: '2',
            method: 'tools/call',
            params: {
              name: 'voice_description_health',
              arguments: {}
            }
          }
        ];

        const response = await request(httpServer)
          .post('/rpc')
          .send(batchRequest)
          .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body[0].id).toBe('1');
        expect(response.body[1].id).toBe('2');
      });

      test('should handle invalid JSON-RPC format', async () => {
        const response = await request(httpServer)
          .post('/rpc')
          .send({
            method: 'tools/list' // Missing jsonrpc and id
          })
          .expect(400);

        expect(response.body).toMatchObject({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request'
          }
        });
      });
    });

    describe('WebSocket Transport', () => {
      beforeEach(async () => {
        wsClient = new WebSocket('ws://localhost:3001');
        await new Promise((resolve) => {
          wsClient.once('open', resolve);
        });
      });

      afterEach(() => {
        if (wsClient) {
          wsClient.close();
        }
      });

      test('should establish WebSocket connection', async () => {
        expect(wsClient.readyState).toBe(WebSocket.OPEN);
      });

      test('should handle requests over WebSocket', async () => {
        const requestId = uuidv4();
        
        const responsePromise = new Promise((resolve) => {
          wsClient.once('message', (data) => {
            resolve(JSON.parse(data.toString()));
          });
        });

        wsClient.send(JSON.stringify({
          jsonrpc: '2.0',
          id: requestId,
          method: 'tools/list',
          params: {}
        }));

        const response = await responsePromise;
        
        expect(response).toMatchObject({
          jsonrpc: '2.0',
          id: requestId,
          result: {
            tools: expect.any(Array)
          }
        });
      });

      test('should handle streaming updates', async () => {
        const updates: any[] = [];
        
        wsClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.method === 'progress') {
            updates.push(message.params);
          }
        });

        // Start a job that sends progress updates
        wsClient.send(JSON.stringify({
          jsonrpc: '2.0',
          id: uuidv4(),
          method: 'tools/call',
          params: {
            name: 'voice_description_upload_video',
            arguments: {
              file_path: getTestVideoPath('progress-test.mp4'),
              streaming_updates: true
            }
          }
        }));

        // Wait for updates
        await new Promise(resolve => setTimeout(resolve, 5000));

        expect(updates.length).toBeGreaterThan(0);
        expect(updates[0]).toHaveProperty('progress');
        expect(updates[0]).toHaveProperty('message');
      });
    });
  });

  describe('Tool Integration', () => {
    describe('Video Processing Tools', () => {
      test('should upload and process video end-to-end', async () => {
        const client = new MCPClient({ baseUrl: 'http://localhost:3001' });
        
        // Upload video
        const uploadResult = await client.callTool('voice_description_upload_video', {
          file_path: getTestVideoPath('integration-test.mp4'),
          language: 'en',
          detail_level: 'basic',
          voice_id: 'Joanna'
        });

        expect(uploadResult.success).toBe(true);
        expect(uploadResult.job_id).toBeDefined();
        testJobIds.push(uploadResult.job_id);

        // Check status
        let status;
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
          status = await client.callTool('voice_description_video_status', {
            job_id: uploadResult.job_id
          });

          if (status.status === 'completed' || status.status === 'failed') {
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
        }

        expect(status.status).toBe('completed');

        // Download results
        const results = await client.callTool('voice_description_download_results', {
          job_id: uploadResult.job_id,
          format: 'json'
        });

        expect(results).toMatchObject({
          text_description: expect.any(String),
          audio_url: expect.stringMatching(/^https?:\/\/.*/),
          metadata: expect.objectContaining({
            duration: expect.any(Number),
            scenes: expect.any(Number),
            language: 'en'
          })
        });
      });

      test('should handle video processing failure gracefully', async () => {
        const client = new MCPClient({ baseUrl: 'http://localhost:3001' });
        
        // Upload corrupted video
        const uploadResult = await client.callTool('voice_description_upload_video', {
          file_path: getTestVideoPath('corrupted.mp4')
        });

        testJobIds.push(uploadResult.job_id);

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 5000));

        const status = await client.callTool('voice_description_video_status', {
          job_id: uploadResult.job_id
        });

        expect(status.status).toBe('failed');
        expect(status.error).toBeDefined();
        expect(status.error.message).toContain('processing failed');
      });
    });

    describe('Image Processing Tools', () => {
      test('should process single image with all options', async () => {
        const client = new MCPClient({ baseUrl: 'http://localhost:3001' });
        
        const result = await client.callTool('voice_description_process_image', {
          image_path: getTestImagePath('test-image.jpg'),
          detail_level: 'comprehensive',
          generate_audio: true,
          include_alt_text: true,
          context: 'Product photo for e-commerce website'
        });

        expect(result).toMatchObject({
          success: true,
          job_id: expect.any(String),
          status: 'completed',
          results: expect.objectContaining({
            description: expect.any(String),
            alt_text: expect.any(String),
            visual_elements: expect.any(Array),
            colors: expect.any(Array),
            confidence: expect.any(Number),
            audio: expect.objectContaining({
              url: expect.any(String),
              duration: expect.any(Number)
            })
          })
        });

        testJobIds.push(result.job_id);
      });

      test('should batch process multiple images', async () => {
        const client = new MCPClient({ baseUrl: 'http://localhost:3001' });
        
        const images = [
          'test1.jpg',
          'test2.png',
          'test3.gif'
        ].map(name => getTestImagePath(name));

        const batchResult = await client.callTool('voice_description_batch_images', {
          images,
          detail_level: 'basic',
          parallel: true,
          generate_audio: false
        });

        expect(batchResult.success).toBe(true);
        expect(batchResult.batch_id).toBeDefined();
        testJobIds.push(batchResult.batch_id);

        // Wait for batch completion
        await new Promise(resolve => setTimeout(resolve, 10000));

        const results = await client.callTool('voice_description_batch_results', {
          batch_id: batchResult.batch_id
        });

        expect(results.total).toBe(3);
        expect(results.completed).toBe(3);
        expect(results.images).toHaveLength(3);

        results.images.forEach(img => {
          expect(img).toMatchObject({
            filename: expect.any(String),
            status: 'completed',
            description: expect.any(String),
            processing_time: expect.any(Number)
          });
        });
      });

      test('should handle partial batch failure', async () => {
        const client = new MCPClient({ baseUrl: 'http://localhost:3001' });
        
        const images = [
          getTestImagePath('valid.jpg'),
          getTestImagePath('corrupted.jpg'),
          getTestImagePath('valid2.png')
        ];

        const batchResult = await client.callTool('voice_description_batch_images', {
          images,
          continue_on_error: true
        });

        testJobIds.push(batchResult.batch_id);

        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 8000));

        const results = await client.callTool('voice_description_batch_results', {
          batch_id: batchResult.batch_id
        });

        expect(results.total).toBe(3);
        expect(results.completed).toBe(2);
        expect(results.failed).toBe(1);

        const failedImage = results.images.find(img => img.status === 'failed');
        expect(failedImage).toBeDefined();
        expect(failedImage.error).toBeDefined();
      });
    });

    describe('System Tools', () => {
      test('should return health status', async () => {
        const client = new MCPClient({ baseUrl: 'http://localhost:3001' });
        
        const health = await client.callTool('voice_description_health');

        expect(health).toMatchObject({
          status: 'healthy',
          timestamp: expect.any(String),
          services: expect.objectContaining({
            api: expect.objectContaining({
              status: 'healthy',
              latency: expect.any(Number)
            }),
            s3: expect.objectContaining({
              status: 'healthy'
            }),
            rekognition: expect.objectContaining({
              status: 'healthy'
            }),
            bedrock: expect.objectContaining({
              status: 'healthy'
            }),
            polly: expect.objectContaining({
              status: 'healthy'
            })
          }),
          metrics: expect.objectContaining({
            uptime: expect.any(Number),
            requests_per_minute: expect.any(Number),
            active_jobs: expect.any(Number),
            queue_depth: expect.any(Number)
          })
        });
      });

      test('should return AWS service status', async () => {
        const client = new MCPClient({ baseUrl: 'http://localhost:3001' });
        
        const awsStatus = await client.callTool('voice_description_aws_status');

        expect(awsStatus).toMatchObject({
          region: expect.any(String),
          services: expect.arrayContaining([
            expect.objectContaining({
              name: 'S3',
              status: expect.stringMatching(/healthy|degraded|unavailable/),
              quotas: expect.any(Object)
            }),
            expect.objectContaining({
              name: 'Rekognition',
              status: expect.any(String),
              quotas: expect.any(Object)
            })
          ])
        });
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle authentication errors', async () => {
      const client = new MCPClient({ 
        baseUrl: 'http://localhost:3001',
        apiKey: 'invalid-key'
      });

      await expect(
        client.callTool('voice_description_upload_video', {
          file_path: 'test.mp4'
        })
      ).rejects.toMatchObject({
        code: 'AUTHENTICATION_ERROR',
        message: expect.stringContaining('authentication')
      });
    });

    test('should handle rate limiting', async () => {
      const client = new MCPClient({ baseUrl: 'http://localhost:3001' });
      
      // Send many requests quickly
      const promises = Array(100).fill(null).map(() => 
        client.callTool('voice_description_health')
      );

      const results = await Promise.allSettled(promises);
      
      const rateLimited = results.filter(r => 
        r.status === 'rejected' && 
        r.reason.code === 'RATE_LIMITED'
      );

      expect(rateLimited.length).toBeGreaterThan(0);
    });

    test('should handle network timeouts', async () => {
      const client = new MCPClient({ 
        baseUrl: 'http://localhost:3001',
        timeout: 100 // Very short timeout
      });

      await expect(
        client.callTool('voice_description_upload_video', {
          file_path: getLargeTestVideoPath() // Large file that takes time
        })
      ).rejects.toMatchObject({
        code: 'TIMEOUT',
        message: expect.stringContaining('timeout')
      });
    });

    test('should handle service unavailability', async () => {
      // Simulate API server being down
      await stopAPIServer(apiServer);

      const client = new MCPClient({ baseUrl: 'http://localhost:3001' });

      await expect(
        client.callTool('voice_description_upload_video', {
          file_path: 'test.mp4'
        })
      ).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        message: expect.stringContaining('unavailable')
      });

      // Restart API server for other tests
      apiServer = await startAPIServer();
    });
  });

  describe('Performance', () => {
    test('should handle concurrent requests efficiently', async () => {
      const client = new MCPClient({ baseUrl: 'http://localhost:3001' });
      const concurrentRequests = 20;
      
      const startTime = Date.now();
      
      const promises = Array(concurrentRequests).fill(null).map((_, i) => 
        client.callTool('voice_description_process_image', {
          image_path: getTestImagePath(`concurrent-${i % 5}.jpg`)
        })
      );

      const results = await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrentRequests;

      expect(results.every(r => r.success)).toBe(true);
      expect(avgTime).toBeLessThan(1000); // Average < 1 second per request
      
      // Track job IDs for cleanup
      results.forEach(r => testJobIds.push(r.job_id));
    });

    test('should maintain response times under load', async () => {
      const client = new MCPClient({ baseUrl: 'http://localhost:3001' });
      const responseTimes: number[] = [];
      
      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        
        await client.callTool('voice_description_health');
        
        const responseTime = Date.now() - start;
        responseTimes.push(responseTime);
      }

      responseTimes.sort((a, b) => a - b);
      
      const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
      const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
      const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];

      expect(p50).toBeLessThan(200);
      expect(p95).toBeLessThan(500);
      expect(p99).toBeLessThan(1000);
    });
  });
});

// Helper functions
async function startAPIServer(): Promise<Server> {
  // Implementation to start the Voice Description API server
  const app = require('../../../pages/api');
  return app.listen(3000);
}

async function stopAPIServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

async function waitForServers(): Promise<void> {
  // Wait for both servers to be ready
  const maxAttempts = 30;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      await request('http://localhost:3000').get('/health').expect(200);
      await request('http://localhost:3001').get('/health').expect(200);
      return;
    } catch (error) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('Servers did not start in time');
}

async function cleanupJob(jobId: string): Promise<void> {
  // Implementation to cleanup test job data
  const client = new MCPClient({ baseUrl: 'http://localhost:3001' });
  
  try {
    await client.callTool('voice_description_cleanup_job', { job_id: jobId });
  } catch (error) {
    // Ignore cleanup errors
  }
}

function getTestVideoPath(filename: string): string {
  return path.join(__dirname, '../../fixtures/videos', filename);
}

function getTestImagePath(filename: string): string {
  return path.join(__dirname, '../../fixtures/images', filename);
}

function getLargeTestVideoPath(): string {
  return path.join(__dirname, '../../fixtures/videos/large-video-500mb.mp4');
}