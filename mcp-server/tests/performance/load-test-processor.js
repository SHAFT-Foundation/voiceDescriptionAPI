/**
 * Artillery Load Test Processor
 * Custom functions for load testing the MCP Server
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Metrics tracking
const metrics = {
  healthCheckSuccess: 0,
  healthCheckFailure: 0,
  processingSuccess: 0,
  processingFailure: 0,
  totalResponseTime: 0,
  requestCount: 0,
  errorsByType: {},
};

// Generate unique request ID
function addRequestId(requestParams, context, ee, next) {
  requestParams.headers = requestParams.headers || {};
  requestParams.headers['X-Request-ID'] = crypto.randomUUID();
  requestParams.headers['X-Load-Test'] = 'true';
  requestParams.headers['X-Scenario'] = context.scenario?.name || 'unknown';
  return next();
}

// Log scenario start
function logScenarioStart(context, ee, next) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting scenario: ${context.scenario?.name}`);
  context.scenarioStartTime = Date.now();
  return next();
}

// Log scenario end
function logScenarioEnd(context, ee, next) {
  const duration = Date.now() - (context.scenarioStartTime || 0);
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Completed scenario: ${context.scenario?.name} (${duration}ms)`);
  return next();
}

// Log response metrics
function logResponseMetrics(requestParams, response, context, ee, next) {
  metrics.requestCount++;
  
  if (response.statusCode >= 200 && response.statusCode < 300) {
    if (requestParams.url?.includes('/health')) {
      metrics.healthCheckSuccess++;
    } else if (requestParams.url?.includes('/process')) {
      metrics.processingSuccess++;
    }
  } else {
    if (requestParams.url?.includes('/health')) {
      metrics.healthCheckFailure++;
    } else if (requestParams.url?.includes('/process')) {
      metrics.processingFailure++;
    }
    
    const errorType = `${response.statusCode}`;
    metrics.errorsByType[errorType] = (metrics.errorsByType[errorType] || 0) + 1;
  }
  
  // Track response time
  if (response.timings) {
    metrics.totalResponseTime += response.timings.response || 0;
  }
  
  // Custom metric reporting
  if (metrics.requestCount % 100 === 0) {
    printMetricsSummary();
  }
  
  return next();
}

// Check response time threshold
function checkResponseTime(requestParams, response, context, ee, next) {
  const responseTime = response.timings?.response || 0;
  
  if (responseTime > 2000) {
    console.warn(`⚠️ Slow response detected: ${requestParams.url} took ${responseTime}ms`);
    ee.emit('counter', 'slow_responses', 1);
  }
  
  if (responseTime > 5000) {
    console.error(`❌ Very slow response: ${requestParams.url} took ${responseTime}ms`);
    ee.emit('counter', 'very_slow_responses', 1);
  }
  
  return next();
}

// Check thresholds
function checkThresholds(context, ee, next) {
  const healthCheckRate = metrics.healthCheckSuccess / 
    (metrics.healthCheckSuccess + metrics.healthCheckFailure || 1);
  
  const processingRate = metrics.processingSuccess / 
    (metrics.processingSuccess + metrics.processingFailure || 1);
  
  if (healthCheckRate < 0.95) {
    console.error(`❌ Health check success rate below threshold: ${(healthCheckRate * 100).toFixed(2)}%`);
    ee.emit('counter', 'threshold_violations', 1);
  }
  
  if (processingRate < 0.90) {
    console.error(`❌ Processing success rate below threshold: ${(processingRate * 100).toFixed(2)}%`);
    ee.emit('counter', 'threshold_violations', 1);
  }
  
  const avgResponseTime = metrics.totalResponseTime / (metrics.requestCount || 1);
  if (avgResponseTime > 1000) {
    console.warn(`⚠️ Average response time above threshold: ${avgResponseTime.toFixed(2)}ms`);
  }
  
  return next();
}

// Generate test file if it doesn't exist
function generateTestFile(context, ee, next) {
  const filePath = context.vars.imagePath || '/tmp/test-image.jpg';
  
  if (!fs.existsSync(filePath)) {
    // Create a small test file
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Generate random image data (simplified)
    const imageData = Buffer.alloc(1024 * 100); // 100KB
    crypto.randomFillSync(imageData);
    fs.writeFileSync(filePath, imageData);
    
    console.log(`Generated test file: ${filePath}`);
  }
  
  return next();
}

// Custom beforeScenario hook for file generation
function beforeScenario(context, ee, next) {
  logScenarioStart(context, ee, () => {
    if (context.scenario?.name?.includes('Image') || context.scenario?.name?.includes('Video')) {
      generateTestFile(context, ee, next);
    } else {
      next();
    }
  });
}

// Custom afterScenario hook
function afterScenario(context, ee, next) {
  logScenarioEnd(context, ee, () => {
    checkThresholds(context, ee, next);
  });
}

// Print metrics summary
function printMetricsSummary() {
  const timestamp = new Date().toISOString();
  const avgResponseTime = metrics.totalResponseTime / (metrics.requestCount || 1);
  const healthCheckRate = metrics.healthCheckSuccess / 
    (metrics.healthCheckSuccess + metrics.healthCheckFailure || 1);
  const processingRate = metrics.processingSuccess / 
    (metrics.processingSuccess + metrics.processingFailure || 1);
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Performance Metrics Summary (${timestamp})`);
  console.log('='.repeat(60));
  console.log(`Total Requests: ${metrics.requestCount}`);
  console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`Health Check Success Rate: ${(healthCheckRate * 100).toFixed(2)}%`);
  console.log(`Processing Success Rate: ${(processingRate * 100).toFixed(2)}%`);
  
  if (Object.keys(metrics.errorsByType).length > 0) {
    console.log('\nErrors by Status Code:');
    Object.entries(metrics.errorsByType).forEach(([code, count]) => {
      console.log(`  ${code}: ${count}`);
    });
  }
  console.log('='.repeat(60) + '\n');
}

// Set up virtual user context
function setupVirtualUser(context, events, done) {
  // Add user-specific context
  context.vars.userId = crypto.randomUUID();
  context.vars.sessionId = crypto.randomUUID();
  context.vars.startTime = Date.now();
  
  // Set random think times
  context.vars.thinkTime = Math.random() * 3000 + 1000; // 1-4 seconds
  
  return done();
}

// Clean up after virtual user
function cleanupVirtualUser(context, events, done) {
  const duration = Date.now() - context.vars.startTime;
  console.log(`User ${context.vars.userId} completed in ${duration}ms`);
  
  // Clean up any temporary files created by this user
  if (context.vars.tempFiles) {
    context.vars.tempFiles.forEach(file => {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        // Ignore cleanup errors
      }
    });
  }
  
  return done();
}

// Generate dynamic payload
function generateDynamicPayload(context, events, done) {
  // Generate random data for testing
  context.vars.dynamicImage = `/tmp/dynamic-${context.vars.userId}-${Date.now()}.jpg`;
  context.vars.dynamicVideo = `/tmp/dynamic-${context.vars.userId}-${Date.now()}.mp4`;
  
  // Track for cleanup
  context.vars.tempFiles = context.vars.tempFiles || [];
  context.vars.tempFiles.push(context.vars.dynamicImage);
  context.vars.tempFiles.push(context.vars.dynamicVideo);
  
  return done();
}

// Validate response data
function validateResponse(requestParams, response, context, ee, next) {
  try {
    if (response.headers['content-type']?.includes('application/json')) {
      const body = JSON.parse(response.body);
      
      // Validate based on endpoint
      if (requestParams.url?.includes('/health')) {
        if (!body.status || !body.timestamp) {
          console.error('Invalid health check response structure');
          ee.emit('counter', 'validation_errors', 1);
        }
      } else if (requestParams.url?.includes('/process')) {
        if (!body.jobId && !body.error) {
          console.error('Invalid processing response structure');
          ee.emit('counter', 'validation_errors', 1);
        }
      }
    }
  } catch (error) {
    console.error('Response validation error:', error.message);
    ee.emit('counter', 'validation_errors', 1);
  }
  
  return next();
}

// Export all processor functions
module.exports = {
  addRequestId,
  logScenarioStart,
  logScenarioEnd,
  logResponseMetrics,
  checkResponseTime,
  checkThresholds,
  generateTestFile,
  beforeScenario,
  afterScenario,
  setupVirtualUser,
  cleanupVirtualUser,
  generateDynamicPayload,
  validateResponse,
  printMetricsSummary,
};