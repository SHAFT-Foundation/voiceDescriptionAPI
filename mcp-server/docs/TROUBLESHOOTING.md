# Voice Description MCP Server - Troubleshooting Guide

## Quick Diagnosis

Use this flowchart to quickly identify and resolve common issues:

```
Is the server starting? 
├─ No → Check [Startup Issues](#startup-issues)
└─ Yes → Can you connect?
         ├─ No → Check [Connection Issues](#connection-issues)
         └─ Yes → Are tools working?
                  ├─ No → Check [Tool Execution Issues](#tool-execution-issues)
                  └─ Yes → Check [Performance Issues](#performance-issues)
```

## Table of Contents

- [Common Issues](#common-issues)
- [Startup Issues](#startup-issues)
- [Connection Issues](#connection-issues)
- [Tool Execution Issues](#tool-execution-issues)
- [File Processing Issues](#file-processing-issues)
- [API Issues](#api-issues)
- [Performance Issues](#performance-issues)
- [Error Messages](#error-messages)
- [Debug Techniques](#debug-techniques)
- [Getting Help](#getting-help)

## Common Issues

### Issue: Server Won't Start

**Symptoms:**
- Error: `Cannot find module`
- Error: `EADDRINUSE`
- Server exits immediately

**Quick Fix:**
```bash
# Rebuild the project
npm run clean
npm run build

# Check port availability
lsof -i :3001

# Kill existing process
kill -9 $(lsof -t -i:3001)
```

### Issue: Cannot Connect to Server

**Symptoms:**
- `ECONNREFUSED` error
- WebSocket connection fails
- Tools not available in Claude Desktop

**Quick Fix:**
```bash
# Check server is running
ps aux | grep node

# Test connection
curl http://localhost:3001/health

# Check firewall
sudo ufw status
```

### Issue: File Processing Fails

**Symptoms:**
- "File not found" errors
- "Invalid file type" errors
- Upload timeouts

**Quick Fix:**
```javascript
// Use absolute paths
"/absolute/path/to/file.jpg" ✓
"./relative/path.jpg" ✗

// Check file permissions
ls -la /path/to/file

// Verify file size
du -h /path/to/file
```

## Startup Issues

### Problem: Module Not Found

**Error Message:**
```
Error: Cannot find module './dist/index.js'
```

**Causes:**
- TypeScript not compiled
- Missing dependencies
- Incorrect path configuration

**Solutions:**

1. **Rebuild the project:**
   ```bash
   npm run clean
   npm run build
   ```

2. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check TypeScript compilation:**
   ```bash
   npx tsc --noEmit
   ```

### Problem: Port Already in Use

**Error Message:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solutions:**

1. **Find and kill the process:**
   ```bash
   # Find process using port
   lsof -i :3001
   
   # Kill the process
   kill -9 <PID>
   ```

2. **Use a different port:**
   ```env
   MCP_PORT=3002
   ```

3. **Docker cleanup:**
   ```bash
   docker ps
   docker stop <container>
   ```

### Problem: Environment Variables Not Loaded

**Symptoms:**
- API key errors
- Wrong API endpoint
- Missing configuration

**Solutions:**

1. **Check .env file exists:**
   ```bash
   ls -la .env
   cat .env
   ```

2. **Verify environment loading:**
   ```javascript
   // Add to src/index.ts
   console.log('ENV:', process.env.API_BASE_URL);
   ```

3. **Use dotenv explicitly:**
   ```javascript
   import dotenv from 'dotenv';
   dotenv.config({ path: '.env' });
   ```

## Connection Issues

### Problem: WebSocket Connection Fails

**Error Message:**
```
WebSocket connection to 'ws://localhost:3001' failed
```

**Solutions:**

1. **Check transport mode:**
   ```env
   MCP_TRANSPORT=websocket
   ```

2. **Test WebSocket connection:**
   ```javascript
   const ws = new WebSocket('ws://localhost:3001');
   ws.on('open', () => console.log('Connected'));
   ws.on('error', (e) => console.error('Error:', e));
   ```

3. **Check CORS settings:**
   ```javascript
   // If using browser client
   const ws = new WebSocket('ws://localhost:3001', {
     origin: 'http://localhost:3000'
   });
   ```

### Problem: Claude Desktop Can't Find Tools

**Symptoms:**
- Tools not appearing in Claude
- "MCP server not found" error

**Solutions:**

1. **Verify configuration path:**
   ```json
   // Claude Desktop config
   {
     "mcpServers": {
       "voice-description": {
         "command": "node",
         "args": ["/absolute/path/to/dist/index.js"]
       }
     }
   }
   ```

2. **Check server logs:**
   ```bash
   # Enable debug logging
   LOG_LEVEL=debug npm start
   ```

3. **Test with stdio transport:**
   ```env
   MCP_TRANSPORT=stdio
   ```

### Problem: Authentication Failures

**Error Message:**
```
Error: Authentication failed - Invalid API key
```

**Solutions:**

1. **Verify API key:**
   ```bash
   echo $API_KEY
   ```

2. **Check header format:**
   ```javascript
   headers: {
     'X-API-Key': process.env.API_KEY
   }
   ```

3. **Test API directly:**
   ```bash
   curl -H "X-API-Key: your-key" http://localhost:3000/api/health
   ```

## Tool Execution Issues

### Problem: Tool Not Found

**Error Message:**
```
Error: Tool 'voice_description_process_image' not found
```

**Solutions:**

1. **Check tool registration:**
   ```javascript
   // Add logging to src/tools/index.ts
   console.log('Registering tools:', tools.map(t => t.name));
   ```

2. **Verify tool name:**
   ```javascript
   // Correct tool names
   "voice_description_process_image" ✓
   "process_image" ✗
   ```

3. **Check registry initialization:**
   ```bash
   LOG_LEVEL=debug npm start | grep "Tool registered"
   ```

### Problem: Parameter Validation Fails

**Error Message:**
```
Error: Invalid parameters - Expected string, received undefined
```

**Solutions:**

1. **Check parameter names:**
   ```javascript
   // Correct
   {
     "tool": "voice_description_process_image",
     "arguments": {
       "image_path": "/path/to/image.jpg"  // ✓ image_path
     }
   }
   
   // Wrong
   {
     "arguments": {
       "imagePath": "/path/to/image.jpg"  // ✗ imagePath
     }
   }
   ```

2. **Verify required parameters:**
   ```javascript
   // Check tool schema
   const schema = tool.inputSchema;
   console.log('Required:', schema.shape);
   ```

3. **Test with minimal parameters:**
   ```javascript
   {
     "tool": "voice_description_process_image",
     "arguments": {
       "image_path": "/test.jpg"  // Only required param
     }
   }
   ```

### Problem: Tool Timeout

**Error Message:**
```
Error: Tool execution timeout after 30000ms
```

**Solutions:**

1. **Increase timeout:**
   ```env
   PROCESSING_TIMEOUT=60000
   API_TIMEOUT=60000
   ```

2. **Check for hanging operations:**
   ```javascript
   // Add timeout to async operations
   await Promise.race([
     processImage(),
     timeout(30000)
   ]);
   ```

3. **Enable progress monitoring:**
   ```javascript
   {
     "arguments": {
       "wait_for_completion": false  // Don't wait
     }
   }
   ```

## File Processing Issues

### Problem: File Not Found

**Error Message:**
```
Error: ENOENT: no such file or directory
```

**Solutions:**

1. **Use absolute paths:**
   ```javascript
   // Good
   "/Users/username/images/photo.jpg"
   
   // Bad
   "./images/photo.jpg"
   "~/images/photo.jpg"
   ```

2. **Check file exists:**
   ```bash
   ls -la /path/to/file
   file /path/to/file
   ```

3. **Fix permissions:**
   ```bash
   chmod 644 /path/to/file
   ```

### Problem: File Too Large

**Error Message:**
```
Error: File size exceeds limit (524288000 bytes)
```

**Solutions:**

1. **Increase limit:**
   ```env
   MAX_FILE_SIZE=1073741824  # 1GB
   ```

2. **Use S3 URL instead:**
   ```javascript
   {
     "tool": "voice_description_process_video_url",
     "arguments": {
       "video_url": "s3://bucket/large-video.mp4"
     }
   }
   ```

3. **Compress file:**
   ```bash
   ffmpeg -i input.mp4 -vcodec h264 -acodec mp3 output.mp4
   ```

### Problem: Unsupported File Format

**Error Message:**
```
Error: Unsupported format - File type 'video/x-matroska' not allowed
```

**Solutions:**

1. **Check supported formats:**
   ```env
   ALLOWED_VIDEO_TYPES=video/mp4,video/mpeg,video/quicktime,video/x-matroska
   ```

2. **Convert file format:**
   ```bash
   # Convert to MP4
   ffmpeg -i input.mkv -codec copy output.mp4
   ```

3. **Update MIME type detection:**
   ```javascript
   // Force MIME type
   const mimeType = 'video/mp4';
   ```

## API Issues

### Problem: API Connection Failed

**Error Message:**
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Solutions:**

1. **Check API is running:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Verify API URL:**
   ```env
   API_BASE_URL=http://localhost:3000
   ```

3. **Check network:**
   ```bash
   ping localhost
   netstat -an | grep 3000
   ```

### Problem: Rate Limiting

**Error Message:**
```
Error: Rate limit exceeded - 429 Too Many Requests
```

**Solutions:**

1. **Implement retry logic:**
   ```javascript
   async function retryWithBackoff(fn, retries = 3) {
     for (let i = 0; i < retries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.code === 'RATE_LIMITED' && i < retries - 1) {
           await sleep(Math.pow(2, i) * 1000);
           continue;
         }
         throw error;
       }
     }
   }
   ```

2. **Reduce request rate:**
   ```javascript
   // Add delays between requests
   await sleep(1000);
   ```

3. **Check rate limit headers:**
   ```javascript
   console.log('Remaining:', response.headers['x-ratelimit-remaining']);
   console.log('Reset:', response.headers['x-ratelimit-reset']);
   ```

### Problem: AWS Service Errors

**Error Message:**
```
Error: AWS Rekognition quota exceeded
```

**Solutions:**

1. **Check AWS quotas:**
   ```javascript
   {
     "tool": "voice_description_aws_status",
     "arguments": {
       "include_quotas": true
     }
   }
   ```

2. **Request quota increase:**
   ```bash
   aws service-quotas request-service-quota-increase \
     --service-code rekognition \
     --quota-code L-12345678 \
     --desired-value 1000
   ```

3. **Implement caching:**
   ```javascript
   // Cache results to reduce API calls
   const cache = new Map();
   if (cache.has(key)) return cache.get(key);
   ```

## Performance Issues

### Problem: Slow Processing

**Symptoms:**
- Long response times
- Timeouts
- High CPU usage

**Solutions:**

1. **Profile performance:**
   ```javascript
   console.time('processing');
   await processImage();
   console.timeEnd('processing');
   ```

2. **Optimize batch size:**
   ```javascript
   {
     "processing": {
       "max_concurrent": 3  // Reduce from 10
     }
   }
   ```

3. **Enable caching:**
   ```env
   CACHE_TTL=600
   CACHE_ENABLED=true
   ```

### Problem: Memory Leaks

**Symptoms:**
- Increasing memory usage
- Server crashes after time
- `FATAL ERROR: JavaScript heap out of memory`

**Solutions:**

1. **Increase memory limit:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=4096" npm start
   ```

2. **Monitor memory:**
   ```javascript
   setInterval(() => {
     const usage = process.memoryUsage();
     console.log('Memory:', {
       rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
       heap: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`
     });
   }, 30000);
   ```

3. **Fix leaks:**
   ```javascript
   // Clear references
   largeObject = null;
   
   // Remove event listeners
   emitter.removeAllListeners();
   
   // Close connections
   await connection.close();
   ```

### Problem: High CPU Usage

**Symptoms:**
- 100% CPU usage
- Slow responses
- System lag

**Solutions:**

1. **Profile CPU:**
   ```bash
   node --prof dist/index.js
   node --prof-process isolate-*.log
   ```

2. **Optimize hot paths:**
   ```javascript
   // Cache expensive computations
   const memoized = memoize(expensiveFunction);
   ```

3. **Use worker threads:**
   ```javascript
   const { Worker } = require('worker_threads');
   const worker = new Worker('./processor.js');
   ```

## Error Messages

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `FILE_NOT_FOUND` | Input file doesn't exist | Check file path |
| `FILE_TOO_LARGE` | File exceeds size limit | Reduce size or use URL |
| `UNSUPPORTED_FORMAT` | File format not supported | Convert format |
| `INVALID_PARAMETERS` | Invalid tool parameters | Check parameter names |
| `RATE_LIMITED` | Too many requests | Wait and retry |
| `API_ERROR` | API communication failed | Check API status |
| `TIMEOUT` | Operation timed out | Increase timeout |
| `INTERNAL_ERROR` | Server error | Check logs |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "File not found: /path/to/file.jpg",
    "details": {
      "path": "/path/to/file.jpg",
      "syscall": "open",
      "errno": -2
    },
    "retry": {
      "should_retry": false
    }
  }
}
```

## Debug Techniques

### Enable Debug Logging

```bash
# Maximum verbosity
LOG_LEVEL=debug npm start

# Component-specific debugging
DEBUG=mcp:tools:* npm start
DEBUG=mcp:api:* npm start

# All debugging
DEBUG=* npm start
```

### Inspect Network Traffic

```bash
# Monitor HTTP traffic
tcpdump -i lo0 -A 'tcp port 3000'

# Use proxy for inspection
HTTP_PROXY=http://localhost:8888 npm start
```

### Use Node.js Inspector

```bash
# Start with inspector
node --inspect dist/index.js

# Break on first line
node --inspect-brk dist/index.js

# Open Chrome DevTools
chrome://inspect
```

### Add Debug Breakpoints

```javascript
// Add debugger statement
debugger;

// Conditional breakpoint
if (condition) {
  debugger;
}
```

### Log Detailed Information

```javascript
// src/utils/debug.ts
export function debugLog(component: string, message: string, data?: any) {
  if (process.env.DEBUG?.includes(component)) {
    console.log(`[${component}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }
}

// Usage
debugLog('tools', 'Processing image', { path, options });
```

## Getting Help

### Diagnostic Information

When reporting issues, include:

1. **System Information:**
   ```bash
   node --version
   npm --version
   uname -a
   ```

2. **Error Messages:**
   ```bash
   # Full error with stack trace
   npm start 2>&1 | tee error.log
   ```

3. **Configuration:**
   ```bash
   # Sanitized environment
   env | grep -E "MCP_|API_|LOG_" | sed 's/=.*/=***/'
   ```

4. **Reproduction Steps:**
   ```javascript
   // Minimal example that reproduces issue
   {
     "tool": "voice_description_process_image",
     "arguments": {
       "image_path": "/test.jpg"
     }
   }
   ```

### Support Channels

1. **GitHub Issues**
   - Bug reports
   - Feature requests
   - Documentation issues

2. **Discord/Slack**
   - Real-time help
   - Community support
   - Quick questions

3. **Stack Overflow**
   - Tag: `voice-description-mcp`
   - Detailed technical questions
   - Code examples

4. **Email Support**
   - support@voicedescription.com
   - Enterprise support
   - Security issues

### Diagnostic Script

```bash
#!/bin/bash
# diagnostic.sh - Collect diagnostic information

echo "=== System Information ==="
uname -a
node --version
npm --version

echo -e "\n=== Environment ==="
env | grep -E "MCP_|API_|LOG_" | sed 's/API_KEY=.*/API_KEY=***/'

echo -e "\n=== Server Status ==="
curl -s http://localhost:3001/health | json_pp

echo -e "\n=== Recent Logs ==="
tail -n 50 server.log

echo -e "\n=== Process Info ==="
ps aux | grep node

echo -e "\n=== Network ==="
netstat -an | grep 3001

echo -e "\n=== Disk Space ==="
df -h

echo -e "\n=== Memory ==="
free -m
```

---

This troubleshooting guide covers the most common issues and their solutions. For issues not covered here, please check the GitHub issues or contact support.