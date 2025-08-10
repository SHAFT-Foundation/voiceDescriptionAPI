# MCP Server Test Scenarios

## Table of Contents

1. [Happy Path Workflows](#happy-path-workflows)
2. [Error Conditions](#error-conditions)
3. [Edge Cases](#edge-cases)
4. [Performance Scenarios](#performance-scenarios)
5. [Security Scenarios](#security-scenarios)
6. [Integration Scenarios](#integration-scenarios)

## Happy Path Workflows

### 1. Video Processing Workflow

#### Scenario: Complete Video Processing
```gherkin
Feature: Video Processing via MCP Tools

  Scenario: Process educational video with audio description
    Given an authenticated MCP client
    And a valid MP4 video file "lecture.mp4"
    When I call "voice_description_upload_video" tool with:
      | file_path | /path/to/lecture.mp4 |
      | language | en |
      | detail_level | comprehensive |
      | wait_for_completion | false |
    Then the response should contain:
      | success | true |
      | job_id | <valid_uuid> |
      | status | processing |
    
    When I poll "voice_description_video_status" with the job_id
    Then eventually the status should be "completed"
    
    When I call "voice_description_download_results" with the job_id
    Then I should receive:
      | text_description | <complete_description> |
      | audio_file_url | <valid_s3_url> |
      | metadata | <timing_information> |
```

#### Test Implementation
```typescript
describe('Video Processing Happy Path', () => {
  let mcpClient: MCPClient;
  let jobId: string;
  
  beforeAll(async () => {
    mcpClient = await createAuthenticatedClient();
  });
  
  test('should process video end-to-end', async () => {
    // Upload video
    const uploadResponse = await mcpClient.callTool('voice_description_upload_video', {
      file_path: getTestVideoPath('sample.mp4'),
      language: 'en',
      detail_level: 'comprehensive'
    });
    
    expect(uploadResponse.success).toBe(true);
    expect(uploadResponse.job_id).toMatch(UUID_REGEX);
    jobId = uploadResponse.job_id;
    
    // Poll for completion
    const finalStatus = await pollUntilComplete(mcpClient, jobId, {
      maxAttempts: 30,
      interval: 2000
    });
    
    expect(finalStatus.status).toBe('completed');
    
    // Download results
    const results = await mcpClient.callTool('voice_description_download_results', {
      job_id: jobId
    });
    
    expect(results.text_description).toBeDefined();
    expect(results.audio_file_url).toMatch(S3_URL_REGEX);
    expect(results.metadata.duration).toBeGreaterThan(0);
  });
});
```

### 2. Image Batch Processing Workflow

#### Scenario: Process Multiple Images
```gherkin
Feature: Batch Image Processing

  Scenario: Process product catalog images
    Given an authenticated MCP client
    And a set of product images
    When I call "voice_description_batch_images" tool with:
      | images | [image1.jpg, image2.jpg, image3.jpg] |
      | detail_level | comprehensive |
      | generate_audio | true |
      | parallel | true |
    Then the response should contain:
      | success | true |
      | batch_id | <valid_uuid> |
      | total_images | 3 |
      | status | processing |
    
    When I monitor the batch progress
    Then I should see incremental progress updates
    And all images should complete processing
    And results should include descriptions and audio for each image
```

#### Test Implementation
```typescript
describe('Image Batch Processing', () => {
  test('should process multiple images in parallel', async () => {
    const images = [
      'product1.jpg',
      'product2.jpg', 
      'product3.jpg'
    ].map(name => getTestImagePath(name));
    
    const batchResponse = await mcpClient.callTool('voice_description_batch_images', {
      images,
      detail_level: 'comprehensive',
      generate_audio: true,
      parallel: true
    });
    
    expect(batchResponse.success).toBe(true);
    expect(batchResponse.total_images).toBe(3);
    
    // Monitor progress
    const progressUpdates = [];
    await monitorBatchProgress(mcpClient, batchResponse.batch_id, {
      onProgress: (update) => progressUpdates.push(update),
      timeout: 60000
    });
    
    // Verify incremental progress
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[progressUpdates.length - 1].completed).toBe(3);
    
    // Get final results
    const results = await mcpClient.callTool('voice_description_batch_results', {
      batch_id: batchResponse.batch_id
    });
    
    expect(results.images).toHaveLength(3);
    results.images.forEach(img => {
      expect(img.description).toBeDefined();
      expect(img.audio_url).toMatch(S3_URL_REGEX);
      expect(img.status).toBe('completed');
    });
  });
});
```

## Error Conditions

### 1. Authentication Failures

#### Scenario: Invalid API Key
```typescript
describe('Authentication Error Handling', () => {
  test('should reject invalid API key', async () => {
    const invalidClient = new MCPClient({
      apiKey: 'invalid-key-12345'
    });
    
    await expect(
      invalidClient.callTool('voice_description_upload_video', {
        file_path: 'test.mp4'
      })
    ).rejects.toThrow(AuthenticationError);
  });
  
  test('should handle expired token gracefully', async () => {
    const client = await createAuthenticatedClient();
    
    // Simulate token expiration
    jest.advanceTimersByTime(TOKEN_LIFETIME + 1000);
    
    const response = await client.callTool('voice_description_health');
    
    // Should auto-refresh token
    expect(response.success).toBe(true);
    expect(client.getTokenRefreshCount()).toBe(1);
  });
});
```

### 2. File Processing Errors

#### Scenario: Corrupted File Upload
```typescript
describe('File Processing Errors', () => {
  test('should handle corrupted video file', async () => {
    const corruptedFile = createCorruptedFile('video.mp4', 1024);
    
    await expect(
      mcpClient.callTool('voice_description_upload_video', {
        file_path: corruptedFile
      })
    ).rejects.toThrow(ValidationError);
  });
  
  test('should reject oversized files', async () => {
    const largeFile = createLargeFile('huge.mp4', 600 * 1024 * 1024); // 600MB
    
    const response = await mcpClient.callTool('voice_description_upload_video', {
      file_path: largeFile
    });
    
    expect(response.success).toBe(false);
    expect(response.error).toContain('exceeds maximum size');
  });
  
  test('should handle unsupported formats', async () => {
    await expect(
      mcpClient.callTool('voice_description_upload_video', {
        file_path: 'document.pdf'
      })
    ).rejects.toThrow(UnsupportedFormatError);
  });
});
```

### 3. AWS Service Failures

#### Scenario: S3 Upload Failure
```typescript
describe('AWS Service Error Handling', () => {
  test('should retry S3 upload on transient failure', async () => {
    // Mock S3 to fail twice then succeed
    mockS3Upload
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockRejectedValueOnce(new Error('Service unavailable'))
      .mockResolvedValueOnce({ success: true });
    
    const response = await mcpClient.callTool('voice_description_upload_video', {
      file_path: 'test.mp4',
      retry_config: { max_attempts: 3 }
    });
    
    expect(response.success).toBe(true);
    expect(mockS3Upload).toHaveBeenCalledTimes(3);
  });
  
  test('should handle Bedrock rate limiting', async () => {
    mockBedrock.mockRejectedValueOnce({
      code: 'ThrottlingException',
      message: 'Rate exceeded'
    });
    
    const response = await mcpClient.callTool('voice_description_process_image', {
      image_path: 'test.jpg',
      auto_retry: true
    });
    
    // Should implement exponential backoff
    expect(response.success).toBe(true);
    expect(response.retry_count).toBe(1);
  });
});
```

## Edge Cases

### 1. Concurrent Operations

#### Scenario: Race Conditions
```typescript
describe('Concurrent Operation Handling', () => {
  test('should handle multiple clients processing same file', async () => {
    const file = 'shared-video.mp4';
    const clients = Array(5).fill(null).map(() => createAuthenticatedClient());
    
    // All clients try to process the same file simultaneously
    const promises = clients.map(client => 
      client.callTool('voice_description_upload_video', {
        file_path: file,
        deduplicate: true
      })
    );
    
    const results = await Promise.all(promises);
    
    // Should deduplicate and return same job_id
    const jobIds = results.map(r => r.job_id);
    const uniqueJobIds = [...new Set(jobIds)];
    
    expect(uniqueJobIds).toHaveLength(1);
    results.forEach(r => expect(r.success).toBe(true));
  });
  
  test('should handle connection pool exhaustion', async () => {
    const clients = Array(150).fill(null).map(() => createAuthenticatedClient());
    
    const promises = clients.map((client, i) => 
      client.callTool('voice_description_health', {
        client_id: `client_${i}`
      })
    );
    
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled');
    const queued = results.filter(r => 
      r.status === 'rejected' && r.reason.code === 'CONNECTION_QUEUED'
    );
    
    expect(successful.length).toBeGreaterThan(0);
    expect(successful.length + queued.length).toBe(150);
  });
});
```

### 2. Network Failures

#### Scenario: Intermittent Connectivity
```typescript
describe('Network Failure Handling', () => {
  test('should resume interrupted upload', async () => {
    const file = createLargeFile('video.mp4', 100 * 1024 * 1024); // 100MB
    
    // Simulate network interruption at 50%
    mockNetworkInterruption(50);
    
    const response = await mcpClient.callTool('voice_description_upload_video', {
      file_path: file,
      resumable: true
    });
    
    expect(response.success).toBe(true);
    expect(response.upload_attempts).toBeGreaterThan(1);
    expect(response.bytes_uploaded).toBe(100 * 1024 * 1024);
  });
  
  test('should handle WebSocket disconnection', async () => {
    const wsClient = await createWebSocketClient();
    
    // Start long-running operation
    const promise = wsClient.callTool('voice_description_upload_video', {
      file_path: 'large.mp4',
      streaming_updates: true
    });
    
    // Simulate disconnection
    await simulateWebSocketDisconnect(wsClient);
    
    // Should reconnect and resume
    const response = await promise;
    expect(response.success).toBe(true);
    expect(wsClient.getReconnectCount()).toBe(1);
  });
});
```

### 3. Resource Cleanup

#### Scenario: Cleanup on Failure
```typescript
describe('Resource Cleanup', () => {
  test('should cleanup temporary files on processing failure', async () => {
    const tempDir = getTempDirectory();
    
    // Force processing to fail
    mockBedrock.mockRejectedValue(new Error('Processing failed'));
    
    try {
      await mcpClient.callTool('voice_description_upload_video', {
        file_path: 'test.mp4'
      });
    } catch (error) {
      // Expected to fail
    }
    
    // Verify cleanup
    const remainingFiles = await listFiles(tempDir);
    expect(remainingFiles).toHaveLength(0);
  });
  
  test('should release locks on job cancellation', async () => {
    const response = await mcpClient.callTool('voice_description_upload_video', {
      file_path: 'test.mp4'
    });
    
    // Cancel the job
    await mcpClient.callTool('voice_description_cancel_job', {
      job_id: response.job_id
    });
    
    // Verify lock released
    const lockStatus = await checkJobLock(response.job_id);
    expect(lockStatus.locked).toBe(false);
  });
});
```

## Performance Scenarios

### 1. Load Testing

#### Scenario: Sustained Load
```typescript
describe('Performance Under Load', () => {
  test('should maintain SLA under sustained load', async () => {
    const metrics = await runLoadTest({
      duration: 60000, // 1 minute
      rps: 100, // 100 requests per second
      scenario: async () => {
        return mcpClient.callTool('voice_description_process_image', {
          image_path: getRandomTestImage()
        });
      }
    });
    
    expect(metrics.successRate).toBeGreaterThan(0.99);
    expect(metrics.p50).toBeLessThan(200);
    expect(metrics.p95).toBeLessThan(500);
    expect(metrics.p99).toBeLessThan(1000);
  });
  
  test('should handle traffic spikes', async () => {
    const baseline = 10; // 10 rps baseline
    const spike = 100; // 100 rps spike
    
    const metrics = await runSpikeTest({
      baselineRps: baseline,
      spikeRps: spike,
      spikeDuration: 10000,
      totalDuration: 30000
    });
    
    expect(metrics.errorsDuringSpike).toBeLessThan(0.01);
    expect(metrics.recoveryTime).toBeLessThan(5000);
  });
});
```

### 2. Memory Management

#### Scenario: Memory Leak Detection
```typescript
describe('Memory Management', () => {
  test('should not leak memory during extended operation', async () => {
    const initialMemory = process.memoryUsage();
    
    // Run 1000 operations
    for (let i = 0; i < 1000; i++) {
      await mcpClient.callTool('voice_description_process_image', {
        image_path: getTestImagePath('test.jpg')
      });
      
      if (i % 100 === 0) {
        global.gc(); // Force garbage collection
      }
    }
    
    const finalMemory = process.memoryUsage();
    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
    
    // Allow for some growth but not linear with operations
    expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB max growth
  });
});
```

## Security Scenarios

### 1. Input Validation

#### Scenario: Injection Attacks
```typescript
describe('Security - Input Validation', () => {
  test('should prevent path traversal attacks', async () => {
    const maliciousPath = '../../../etc/passwd';
    
    await expect(
      mcpClient.callTool('voice_description_upload_video', {
        file_path: maliciousPath
      })
    ).rejects.toThrow(SecurityError);
  });
  
  test('should sanitize file names', async () => {
    const maliciousName = 'test<script>alert(1)</script>.mp4';
    
    const response = await mcpClient.callTool('voice_description_upload_video', {
      file_path: createTestFile(maliciousName)
    });
    
    expect(response.stored_filename).toBe('testscriptalert1script.mp4');
  });
  
  test('should prevent command injection', async () => {
    const maliciousInput = 'test.mp4; rm -rf /';
    
    await expect(
      mcpClient.callTool('voice_description_upload_video', {
        file_path: maliciousInput
      })
    ).rejects.toThrow(ValidationError);
  });
});
```

### 2. Authorization

#### Scenario: Access Control
```typescript
describe('Security - Authorization', () => {
  test('should enforce user resource isolation', async () => {
    const user1Client = await createClientForUser('user1');
    const user2Client = await createClientForUser('user2');
    
    // User1 uploads a video
    const response = await user1Client.callTool('voice_description_upload_video', {
      file_path: 'user1-video.mp4'
    });
    
    // User2 tries to access User1's job
    await expect(
      user2Client.callTool('voice_description_video_status', {
        job_id: response.job_id
      })
    ).rejects.toThrow(ForbiddenError);
  });
  
  test('should enforce rate limits per API key', async () => {
    const requests = Array(150).fill(null).map(() => 
      mcpClient.callTool('voice_description_health')
    );
    
    const results = await Promise.allSettled(requests);
    const rateLimited = results.filter(r => 
      r.status === 'rejected' && r.reason.code === 'RATE_LIMITED'
    );
    
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

## Integration Scenarios

### 1. Third-Party Service Integration

#### Scenario: External API Integration
```typescript
describe('External Service Integration', () => {
  test('should integrate with webhook notifications', async () => {
    const webhookUrl = 'https://example.com/webhook';
    const webhookReceived = createWebhookListener(webhookUrl);
    
    const response = await mcpClient.callTool('voice_description_upload_video', {
      file_path: 'test.mp4',
      webhook_url: webhookUrl,
      webhook_events: ['started', 'progress', 'completed']
    });
    
    // Wait for processing
    await waitForJobCompletion(response.job_id);
    
    const webhooks = await webhookReceived;
    expect(webhooks).toHaveLength(3);
    expect(webhooks[0].event).toBe('started');
    expect(webhooks[2].event).toBe('completed');
  });
  
  test('should integrate with external storage', async () => {
    const response = await mcpClient.callTool('voice_description_upload_video', {
      file_path: 'test.mp4',
      output_storage: {
        type: 'azure_blob',
        container: 'voice-descriptions',
        sas_token: process.env.AZURE_SAS_TOKEN
      }
    });
    
    expect(response.success).toBe(true);
    expect(response.output_location).toContain('blob.core.windows.net');
  });
});
```

### 2. Database Consistency

#### Scenario: Transaction Management
```typescript
describe('Database Consistency', () => {
  test('should maintain consistency during partial failure', async () => {
    // Start batch operation
    const batchResponse = await mcpClient.callTool('voice_description_batch_images', {
      images: ['img1.jpg', 'img2.jpg', 'corrupted.jpg', 'img4.jpg']
    });
    
    await waitForBatchCompletion(batchResponse.batch_id);
    
    // Check final state
    const results = await mcpClient.callTool('voice_description_batch_results', {
      batch_id: batchResponse.batch_id
    });
    
    expect(results.total).toBe(4);
    expect(results.successful).toBe(3);
    expect(results.failed).toBe(1);
    
    // Verify database consistency
    const dbState = await queryDatabase(batchResponse.batch_id);
    expect(dbState.images.filter(i => i.status === 'completed')).toHaveLength(3);
    expect(dbState.images.filter(i => i.status === 'failed')).toHaveLength(1);
  });
});
```