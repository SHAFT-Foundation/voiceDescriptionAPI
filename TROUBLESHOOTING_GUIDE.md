# Troubleshooting Guide

## Quick Fix Directory

| **Problem** | **Solution** | **Page** |
|------------|-------------|----------|
| Invalid API Key | [Check API key format](#invalid-api-key) | ↓ |
| Rate limit exceeded | [Implement backoff](#rate-limiting-issues) | ↓ |
| File too large | [Enable chunking](#file-size-issues) | ↓ |
| Processing timeout | [Adjust timeout settings](#timeout-errors) | ↓ |
| Poor quality output | [Optimize pipeline settings](#quality-issues) | ↓ |
| High costs | [Switch to AWS pipeline](#cost-issues) | ↓ |
| Slow processing | [Enable parallel processing](#performance-issues) | ↓ |
| Connection errors | [Check network/firewall](#network-issues) | ↓ |

## Common Issues and Solutions

### Authentication Issues

#### Invalid API Key

**Error Message:**
```
Error: Invalid API key provided: sk-...
```

**Solutions:**

1. **Verify API Key Format**
   ```bash
   # OpenAI keys start with 'sk-'
   echo $OPENAI_API_KEY | head -c 3
   # Should output: sk-
   ```

2. **Check Environment Variables**
   ```javascript
   // Verify in code
   console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
   console.log('Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 3));
   ```

3. **Test API Connection**
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

4. **Common Mistakes**
   - Extra spaces in API key
   - Using organization key instead of API key
   - Key revoked or expired
   - Wrong environment (dev vs prod)

#### AWS Credentials Issues

**Error Message:**
```
Error: The security token included in the request is invalid
```

**Solutions:**

```bash
# 1. Verify AWS credentials
aws sts get-caller-identity

# 2. Check credential file
cat ~/.aws/credentials

# 3. Use AWS CLI to configure
aws configure

# 4. Test S3 access
aws s3 ls s3://your-bucket-name
```

### Rate Limiting Issues

#### OpenAI Rate Limits

**Error Message:**
```
Error: Rate limit exceeded. Please retry after X seconds.
```

**Solutions:**

1. **Implement Exponential Backoff**
   ```javascript
   async function retryWithBackoff(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.status === 429) {
           const delay = Math.pow(2, i) * 1000;
           console.log(`Rate limited. Waiting ${delay}ms...`);
           await new Promise(r => setTimeout(r, delay));
         } else {
           throw error;
         }
       }
     }
   }
   ```

2. **Batch Processing with Delays**
   ```javascript
   const BATCH_SIZE = 3;
   const DELAY_MS = 1000;
   
   for (let i = 0; i < items.length; i += BATCH_SIZE) {
     const batch = items.slice(i, i + BATCH_SIZE);
     await Promise.all(batch.map(processItem));
     
     if (i + BATCH_SIZE < items.length) {
       await new Promise(r => setTimeout(r, DELAY_MS));
     }
   }
   ```

3. **Monitor Rate Limit Headers**
   ```javascript
   // Check response headers
   const remaining = response.headers['x-ratelimit-remaining'];
   const resetTime = response.headers['x-ratelimit-reset'];
   
   if (remaining < 10) {
     console.warn('Approaching rate limit:', remaining);
   }
   ```

### File Size Issues

#### File Too Large for OpenAI

**Error Message:**
```
Error: File size exceeds maximum limit of 25MB
```

**Solutions:**

1. **Enable Automatic Chunking**
   ```javascript
   const processor = new VideoProcessor({
     enableChunking: true,
     chunkSize: 20 * 1024 * 1024, // 20MB chunks
     chunkOverlap: 2 // seconds
   });
   ```

2. **Compress Before Processing**
   ```bash
   # Compress video
   ffmpeg -i input.mp4 -vcodec h264 -acodec aac -crf 23 output.mp4
   
   # Reduce resolution
   ffmpeg -i input.mp4 -vf scale=1280:720 output.mp4
   ```

3. **Use AWS Pipeline for Large Files**
   ```javascript
   function selectPipelineBySize(file) {
     const MAX_OPENAI_SIZE = 25 * 1024 * 1024; // 25MB
     
     if (file.size > MAX_OPENAI_SIZE) {
       return 'aws'; // AWS handles up to 500MB
     }
     return 'openai';
   }
   ```

### Processing Errors

#### Timeout Errors

**Error Message:**
```
Error: Processing timeout after 30000ms
```

**Solutions:**

1. **Increase Timeout Settings**
   ```javascript
   const config = {
     timeout: 60000, // 60 seconds
     processingTimeout: 300000, // 5 minutes
     connectionTimeout: 10000 // 10 seconds
   };
   ```

2. **Implement Progress Monitoring**
   ```javascript
   const job = await startProcessing(file);
   
   const checkProgress = setInterval(async () => {
     const status = await getJobStatus(job.id);
     console.log(`Progress: ${status.progress}%`);
     
     if (status.status === 'completed' || status.status === 'failed') {
       clearInterval(checkProgress);
     }
   }, 5000);
   ```

3. **Use Streaming for Large Files**
   ```javascript
   const stream = fs.createReadStream(filePath);
   const upload = new Upload({
     client: s3Client,
     params: {
       Bucket: bucket,
       Key: key,
       Body: stream
     },
     partSize: 10 * 1024 * 1024, // 10MB parts
     queueSize: 4
   });
   ```

#### Chunking Failures

**Error Message:**
```
Error: Failed to chunk video at timestamp 00:15:30
```

**Solutions:**

```javascript
// 1. Verify FFmpeg installation
const { exec } = require('child_process');
exec('ffmpeg -version', (error, stdout) => {
  if (error) {
    console.error('FFmpeg not installed');
  } else {
    console.log('FFmpeg version:', stdout);
  }
});

// 2. Use safer chunking parameters
const chunkOptions = {
  codec: 'copy', // Don't re-encode
  keyframeAlign: true, // Align to keyframes
  errorHandling: 'skip' // Skip problematic segments
};

// 3. Implement chunk validation
async function validateChunk(chunkPath) {
  const stats = await fs.stat(chunkPath);
  if (stats.size === 0) {
    throw new Error('Empty chunk created');
  }
  return true;
}
```

### Quality Issues

#### Poor Description Quality

**Problem:** Descriptions are too generic or missing important details

**Solutions:**

1. **Use Custom Prompts**
   ```javascript
   const customPrompts = {
     ecommerce: "Describe product features, materials, dimensions, and brand",
     educational: "Focus on educational content, concepts, and demonstrations",
     medical: "Include clinical details, anatomical structures, and procedures",
     entertainment: "Describe action, emotions, cinematography, and plot elements"
   };
   
   const result = await analyze(image, {
     customPrompt: customPrompts[contentType]
   });
   ```

2. **Increase Detail Level**
   ```javascript
   // For important content
   const options = {
     detail: 'high', // vs 'auto' or 'low'
     maxTokens: 1000, // Increase token limit
     temperature: 0.3 // Lower temperature for consistency
   };
   ```

3. **Provide Context**
   ```javascript
   const context = {
     title: "Product page for luxury handbag",
     category: "Fashion accessories",
     targetAudience: "Screen reader users shopping online"
   };
   
   const result = await analyze(image, { metadata: context });
   ```

#### Inconsistent Results

**Problem:** Same input produces different outputs

**Solutions:**

```javascript
// 1. Set deterministic parameters
const config = {
  temperature: 0, // Deterministic output
  topP: 1,
  seed: 12345 // Fixed seed for reproducibility
};

// 2. Implement result validation
function validateDescription(description) {
  const minLength = 50;
  const maxLength = 500;
  const requiredElements = ['subject', 'action', 'setting'];
  
  if (description.length < minLength) {
    return { valid: false, error: 'Too short' };
  }
  
  // Check for required elements
  const hasRequired = requiredElements.every(elem => 
    description.toLowerCase().includes(elem)
  );
  
  return { valid: hasRequired };
}

// 3. Cache validated results
const cache = new Map();
const hash = createHash(input);

if (cache.has(hash)) {
  return cache.get(hash);
}
```

### Performance Issues

#### Slow Processing Speed

**Problem:** Processing takes longer than expected

**Solutions:**

1. **Enable Parallel Processing**
   ```javascript
   // Process chunks in parallel
   const CONCURRENT_LIMIT = 5;
   
   async function processParallel(chunks) {
     const results = [];
     
     for (let i = 0; i < chunks.length; i += CONCURRENT_LIMIT) {
       const batch = chunks.slice(i, i + CONCURRENT_LIMIT);
       const batchResults = await Promise.all(
         batch.map(chunk => processChunk(chunk))
       );
       results.push(...batchResults);
     }
     
     return results;
   }
   ```

2. **Optimize Media Before Processing**
   ```bash
   # Reduce video bitrate
   ffmpeg -i input.mp4 -b:v 1M -b:a 128k output.mp4
   
   # Extract keyframes only
   ffmpeg -i input.mp4 -vf "select='eq(pict_type,I)'" -vsync vfr output_%04d.jpg
   ```

3. **Use Appropriate Pipeline**
   ```javascript
   // Quick decision tree
   function selectFastestPipeline(requirements) {
     if (requirements.time < 60) { // Need results in < 1 minute
       return 'openai';
     }
     if (requirements.quality > 0.9) { // High quality required
       return 'openai';
     }
     if (requirements.cost < 0.01) { // Budget constraint
       return 'aws';
     }
     return 'hybrid';
   }
   ```

#### Memory Issues

**Error Message:**
```
Error: JavaScript heap out of memory
```

**Solutions:**

```javascript
// 1. Increase Node.js memory limit
// In package.json
{
  "scripts": {
    "start": "node --max-old-space-size=4096 server.js"
  }
}

// 2. Stream large files
const stream = fs.createReadStream(largefile, {
  highWaterMark: 16 * 1024 // 16KB chunks
});

stream.on('data', (chunk) => {
  // Process chunk
});

// 3. Clean up after processing
function cleanup() {
  global.gc && global.gc(); // Force garbage collection
  cache.clear(); // Clear caches
  tempFiles.forEach(file => fs.unlink(file)); // Delete temp files
}
```

### Network Issues

#### Connection Timeouts

**Error Message:**
```
Error: ETIMEDOUT - Connection timed out
```

**Solutions:**

1. **Configure Retry Logic**
   ```javascript
   const axios = require('axios').create({
     timeout: 30000,
     retry: 3,
     retryDelay: 1000
   });
   ```

2. **Check Firewall/Proxy**
   ```bash
   # Test connectivity
   curl -I https://api.openai.com
   curl -I https://rekognition.us-east-1.amazonaws.com
   
   # Use proxy if needed
   export HTTPS_PROXY=http://proxy.company.com:8080
   ```

3. **Implement Circuit Breaker**
   ```javascript
   class CircuitBreaker {
     constructor(threshold = 5, timeout = 60000) {
       this.failures = 0;
       this.threshold = threshold;
       this.timeout = timeout;
       this.state = 'CLOSED';
     }
     
     async call(fn) {
       if (this.state === 'OPEN') {
         throw new Error('Circuit breaker is OPEN');
       }
       
       try {
         const result = await fn();
         this.onSuccess();
         return result;
       } catch (error) {
         this.onFailure();
         throw error;
       }
     }
     
     onFailure() {
       this.failures++;
       if (this.failures >= this.threshold) {
         this.state = 'OPEN';
         setTimeout(() => {
           this.state = 'HALF_OPEN';
           this.failures = 0;
         }, this.timeout);
       }
     }
     
     onSuccess() {
       this.failures = 0;
       this.state = 'CLOSED';
     }
   }
   ```

### Cost Issues

#### Unexpectedly High Costs

**Problem:** API costs exceeding budget

**Solutions:**

1. **Implement Cost Monitoring**
   ```javascript
   class CostTracker {
     constructor(dailyLimit = 100) {
       this.dailyLimit = dailyLimit;
       this.todaySpend = 0;
     }
     
     async process(item) {
       const estimatedCost = this.estimateCost(item);
       
       if (this.todaySpend + estimatedCost > this.dailyLimit) {
         throw new Error(`Daily limit exceeded: $${this.dailyLimit}`);
       }
       
       const result = await processItem(item);
       this.todaySpend += estimatedCost;
       
       return result;
     }
     
     estimateCost(item) {
       if (item.type === 'video') {
         return item.duration * 0.10; // $0.10 per minute
       }
       return 0.01; // $0.01 per image
     }
   }
   ```

2. **Optimize Token Usage**
   ```javascript
   // Reduce prompt size
   const concisePrompt = "Describe: subject, action, setting (max 200 chars)";
   
   // Use lower detail when appropriate
   const detail = priority === 'low' ? 'low' : 'auto';
   
   // Batch similar items
   const batched = groupSimilarItems(items);
   ```

3. **Switch to AWS for Bulk**
   ```javascript
   function routeByCost(items) {
     const costThreshold = 50; // $50
     const estimatedCost = items.length * 0.01;
     
     if (estimatedCost > costThreshold) {
       console.log('Routing to AWS to save costs');
       return 'aws';
     }
     return 'openai';
   }
   ```

## Debugging Tools

### Enable Debug Logging

```javascript
// Set environment variable
process.env.DEBUG = 'voice-api:*';

// Or in code
const debug = require('debug')('voice-api:processing');

debug('Starting processing for job:', jobId);
debug('Pipeline selected:', pipeline);
debug('Options:', JSON.stringify(options, null, 2));
```

### Request/Response Logging

```javascript
// Log all API requests
axios.interceptors.request.use(request => {
  console.log('Starting Request:', {
    url: request.url,
    method: request.method,
    headers: request.headers,
    data: request.data?.substring?.(0, 100) // First 100 chars
  });
  return request;
});

// Log all responses
axios.interceptors.response.use(
  response => {
    console.log('Response:', {
      status: response.status,
      headers: response.headers,
      data: response.data?.substring?.(0, 100)
    });
    return response;
  },
  error => {
    console.error('Error Response:', {
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);
```

### Performance Profiling

```javascript
// Profile processing time
console.time('Total Processing');

console.time('Upload');
await uploadFile(file);
console.timeEnd('Upload');

console.time('Analysis');
const result = await analyze(file);
console.timeEnd('Analysis');

console.time('Synthesis');
await synthesize(result);
console.timeEnd('Synthesis');

console.timeEnd('Total Processing');
```

## Health Checks

### System Health Verification

```javascript
async function healthCheck() {
  const checks = {
    openai: false,
    aws: false,
    storage: false,
    memory: false
  };
  
  // Check OpenAI
  try {
    await openai.models.list();
    checks.openai = true;
  } catch (error) {
    console.error('OpenAI health check failed:', error);
  }
  
  // Check AWS
  try {
    await s3.headBucket({ Bucket: process.env.INPUT_BUCKET });
    checks.aws = true;
  } catch (error) {
    console.error('AWS health check failed:', error);
  }
  
  // Check memory
  const usage = process.memoryUsage();
  checks.memory = usage.heapUsed < usage.heapTotal * 0.9;
  
  return checks;
}
```

### Monitoring Dashboard

```javascript
// Simple monitoring endpoint
app.get('/health', async (req, res) => {
  const health = await healthCheck();
  const allHealthy = Object.values(health).every(v => v === true);
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    checks: health,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date()
  });
});
```

## Error Recovery Strategies

### Automatic Retry with Fallback

```javascript
async function processWithFallback(file) {
  try {
    // Try primary pipeline
    return await processWithOpenAI(file);
  } catch (error) {
    console.warn('OpenAI failed, falling back to AWS:', error.message);
    
    try {
      // Fallback to secondary pipeline
      return await processWithAWS(file);
    } catch (fallbackError) {
      console.error('Both pipelines failed');
      
      // Last resort: return basic processing
      return await basicProcessing(file);
    }
  }
}
```

### Graceful Degradation

```javascript
class GracefulProcessor {
  async process(file, options = {}) {
    const levels = [
      { fn: this.fullProcessing, name: 'full' },
      { fn: this.reducedProcessing, name: 'reduced' },
      { fn: this.minimalProcessing, name: 'minimal' }
    ];
    
    for (const level of levels) {
      try {
        console.log(`Attempting ${level.name} processing`);
        return await level.fn.call(this, file, options);
      } catch (error) {
        console.warn(`${level.name} processing failed:`, error.message);
      }
    }
    
    throw new Error('All processing levels failed');
  }
}
```

## Common Error Codes

| **Code** | **Description** | **Solution** |
|----------|----------------|-------------|
| `INVALID_API_KEY` | API key is invalid or expired | Regenerate API key |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Implement backoff |
| `FILE_TOO_LARGE` | File exceeds size limit | Enable chunking or compress |
| `TIMEOUT` | Processing took too long | Increase timeout or use smaller files |
| `INSUFFICIENT_FUNDS` | Account out of credits | Add payment method |
| `NETWORK_ERROR` | Connection failed | Check network/firewall |
| `INVALID_FORMAT` | Unsupported file format | Convert to supported format |
| `PROCESSING_FAILED` | Internal processing error | Retry or contact support |

## Getting Help

### Support Channels

1. **Documentation**: [docs.voicedescription.ai](https://docs.voicedescription.ai)
2. **Email Support**: support@voicedescription.ai
3. **Emergency**: urgent@voicedescription.ai (for production issues)
4. **Community**: [discord.gg/voicedesc](https://discord.gg/voicedesc)
5. **GitHub Issues**: [github.com/voicedescription/api/issues](https://github.com/voicedescription/api/issues)

### Information to Provide

When reporting issues, include:

```markdown
## Issue Report

**Environment:**
- Pipeline: OpenAI/AWS/Hybrid
- Node.js version: 
- API version:
- Operating System:

**Error Message:**
```
[Paste complete error message]
```

**Request Details:**
- Endpoint:
- File size:
- File type:
- Options used:

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected vs Actual:**
- Expected:
- Actual:

**Logs:**
```
[Paste relevant logs]
```
```

### Emergency Procedures

For production emergencies:

1. **Switch to fallback pipeline**
2. **Enable circuit breaker**
3. **Increase rate limiting**
4. **Contact emergency support**
5. **Monitor system health**

---

**Remember:** Most issues can be resolved by checking API keys, implementing proper retry logic, and choosing the appropriate pipeline for your use case.