# Migration Guide: Single Pipeline to Dual Pipeline

## Overview

This guide helps you migrate from a single-pipeline system (AWS-only) to the new dual-pipeline system with OpenAI integration. The migration is designed to be non-breaking with gradual rollout options.

## Migration Timeline

```
Week 1: Setup & Testing
├── Configure OpenAI credentials
├── Test with small subset
└── Validate quality metrics

Week 2: Gradual Rollout
├── 10% traffic to OpenAI
├── Monitor performance
└── Gather feedback

Week 3: Optimization
├── Adjust routing rules
├── Optimize costs
└── Update documentation

Week 4: Full Deployment
├── 100% dual-pipeline
├── Deprecate old endpoints
└── Final validation
```

## Step 1: Environment Setup

### Add OpenAI Configuration

Update your `.env` file:

```bash
# Existing AWS configuration (keep unchanged)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
INPUT_S3_BUCKET=voice-desc-input
OUTPUT_S3_BUCKET=voice-desc-output

# New OpenAI configuration
OPENAI_API_KEY=sk-your-openai-key
OPENAI_ORG_ID=org-your-org-id
OPENAI_VISION_MODEL=gpt-4-vision-preview

# Enable dual pipeline
ENABLE_OPENAI_PIPELINE=true
ENABLE_PIPELINE_SELECTION=true
DEFAULT_PIPELINE=auto  # Start with auto-selection

# OpenAI specific settings
OPENAI_MAX_IMAGE_SIZE_MB=20
OPENAI_MAX_VIDEO_CHUNK_MB=25
OPENAI_MAX_RETRIES=3
OPENAI_CONCURRENT_ANALYSES=3
```

## Step 2: Code Migration

### Update API Calls

#### Before (Single Pipeline)

```javascript
// Old single-pipeline code
const result = await api.processVideo({
  file: videoFile,
  options: {
    detailLevel: 'comprehensive'
  }
});
```

#### After (Dual Pipeline)

```javascript
// New dual-pipeline code with backward compatibility
const result = await api.processVideo({
  file: videoFile,
  pipeline: 'auto',  // New: pipeline selection
  options: {
    detailLevel: 'comprehensive'
  },
  // New: OpenAI-specific options
  openaiOptions: {
    detail: 'high',
    contextualAnalysis: true
  }
});
```

### Implement Gradual Rollout

```javascript
// Gradual migration with percentage-based routing
class MigrationRouter {
  constructor(rolloutPercentage = 10) {
    this.rolloutPercentage = rolloutPercentage;
  }
  
  selectPipeline(request) {
    // Honor explicit pipeline selection
    if (request.pipeline) {
      return request.pipeline;
    }
    
    // Gradual rollout for auto-selection
    const useOpenAI = Math.random() * 100 < this.rolloutPercentage;
    
    if (useOpenAI) {
      console.log('Routing to OpenAI pipeline (migration rollout)');
      return 'openai';
    }
    
    console.log('Routing to AWS pipeline (default)');
    return 'aws';
  }
}

// Start with 10% rollout
const router = new MigrationRouter(10);
```

## Step 3: Update Response Handling

### Handle New Response Fields

```javascript
// Enhanced response handling for dual pipeline
function handleResponse(response) {
  const { pipeline, data } = response;
  
  // Check which pipeline was used
  if (pipeline === 'openai') {
    // Handle OpenAI-specific fields
    const {
      contextualSummary,
      chapters,
      keyMoments,
      tokensUsed
    } = data;
    
    // Process OpenAI results
    displayChapters(chapters);
    trackTokenUsage(tokensUsed);
  } else {
    // Handle AWS pipeline results (backward compatible)
    const {
      segments,
      technicalCues
    } = data;
    
    // Process AWS results
    displaySegments(segments);
  }
  
  // Common fields work for both pipelines
  const { description, audioUrl } = data;
  displayResults(description, audioUrl);
}
```

## Step 4: Database Schema Updates

### Add Pipeline Tracking

```sql
-- Add pipeline tracking to your jobs table
ALTER TABLE processing_jobs 
ADD COLUMN pipeline VARCHAR(10) DEFAULT 'aws',
ADD COLUMN pipeline_metadata JSONB,
ADD COLUMN tokens_used INTEGER,
ADD COLUMN processing_cost DECIMAL(10, 4);

-- Create index for pipeline analytics
CREATE INDEX idx_pipeline ON processing_jobs(pipeline);
CREATE INDEX idx_processing_date ON processing_jobs(created_at);

-- Migration tracking table
CREATE TABLE pipeline_migration (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  total_jobs INTEGER,
  openai_jobs INTEGER,
  aws_jobs INTEGER,
  hybrid_jobs INTEGER,
  avg_processing_time_openai DECIMAL(10, 2),
  avg_processing_time_aws DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Step 5: Monitoring & Validation

### Set Up Comparison Metrics

```javascript
// A/B testing for quality comparison
class PipelineComparator {
  async compareResults(content) {
    // Process with both pipelines
    const [openaiResult, awsResult] = await Promise.all([
      this.processWithOpenAI(content),
      this.processWithAWS(content)
    ]);
    
    // Compare metrics
    const comparison = {
      processingTime: {
        openai: openaiResult.processingTime,
        aws: awsResult.processingTime,
        winner: openaiResult.processingTime < awsResult.processingTime ? 'openai' : 'aws'
      },
      quality: {
        openai: await this.assessQuality(openaiResult),
        aws: await this.assessQuality(awsResult),
        winner: null // Requires human evaluation
      },
      cost: {
        openai: openaiResult.cost,
        aws: awsResult.cost,
        winner: openaiResult.cost < awsResult.cost ? 'openai' : 'aws'
      },
      wordCount: {
        openai: openaiResult.description.split(' ').length,
        aws: awsResult.description.split(' ').length
      }
    };
    
    // Log for analysis
    await this.logComparison(comparison);
    
    return comparison;
  }
}
```

### Monitor Key Metrics

```javascript
// Real-time monitoring dashboard
const monitoringMetrics = {
  // Performance metrics
  avgProcessingTime: {
    openai: [],
    aws: []
  },
  
  // Quality metrics
  confidenceScores: {
    openai: [],
    aws: []
  },
  
  // Cost metrics
  dailyCost: {
    openai: 0,
    aws: 0
  },
  
  // Error rates
  errorRates: {
    openai: 0,
    aws: 0
  },
  
  // Usage distribution
  pipelineUsage: {
    openai: 0,
    aws: 0,
    hybrid: 0
  }
};

// Update metrics in real-time
function updateMetrics(job) {
  const { pipeline, processingTime, cost, confidence, error } = job;
  
  monitoringMetrics.avgProcessingTime[pipeline].push(processingTime);
  monitoringMetrics.dailyCost[pipeline] += cost;
  
  if (confidence) {
    monitoringMetrics.confidenceScores[pipeline].push(confidence);
  }
  
  if (error) {
    monitoringMetrics.errorRates[pipeline]++;
  }
  
  monitoringMetrics.pipelineUsage[pipeline]++;
}
```

## Step 6: Rollback Plan

### Emergency Rollback Procedure

```javascript
// Quick rollback to single pipeline if issues arise
class RollbackManager {
  async emergencyRollback(reason) {
    console.error('EMERGENCY ROLLBACK INITIATED:', reason);
    
    // 1. Disable OpenAI pipeline
    process.env.ENABLE_OPENAI_PIPELINE = 'false';
    process.env.DEFAULT_PIPELINE = 'aws';
    
    // 2. Route all traffic to AWS
    await this.updateLoadBalancer({
      openai: 0,
      aws: 100
    });
    
    // 3. Process queued OpenAI jobs with AWS
    const pendingJobs = await this.getPendingOpenAIJobs();
    for (const job of pendingJobs) {
      await this.reprocessWithAWS(job);
    }
    
    // 4. Alert team
    await this.sendAlert({
      severity: 'critical',
      message: `Rollback executed: ${reason}`,
      affectedJobs: pendingJobs.length
    });
    
    // 5. Log incident
    await this.logIncident({
      type: 'rollback',
      reason,
      timestamp: new Date(),
      affectedServices: ['openai-pipeline']
    });
  }
}
```

## Step 7: Update Documentation

### Update API Documentation

```markdown
## Pipeline Selection

The API now supports dual-pipeline processing:

- **OpenAI Pipeline**: Ultra-fast processing (30-60 seconds) with GPT-4 Vision
- **AWS Pipeline**: Detailed analysis (5-10 minutes) with Rekognition + Bedrock
- **Auto Selection**: Intelligent routing based on content and requirements
- **Hybrid Mode**: Split processing for optimization

### Migration Notes

- All existing endpoints remain functional
- Default behavior unchanged (AWS pipeline)
- New `pipeline` parameter is optional
- Backward compatible with v1 API
```

### Update Client Libraries

```javascript
// Update SDK with dual-pipeline support
class VoiceDescriptionSDK {
  constructor(config = {}) {
    this.apiKey = config.apiKey;
    this.defaultPipeline = config.pipeline || 'auto';
    this.version = '2.0.0'; // Bump version
  }
  
  // Backward compatible method
  async processVideo(file, options = {}) {
    // Support both old and new formats
    const request = {
      file,
      pipeline: options.pipeline || this.defaultPipeline,
      ...options
    };
    
    // Handle v1 compatibility
    if (this.version.startsWith('1.')) {
      delete request.pipeline;
      delete request.openaiOptions;
    }
    
    return this.post('/api/process-video', request);
  }
}
```

## Step 8: Testing Strategy

### Test Coverage Requirements

```javascript
// Comprehensive test suite for migration
describe('Dual Pipeline Migration Tests', () => {
  describe('Backward Compatibility', () => {
    test('v1 API calls still work', async () => {
      const result = await api.processVideo(testVideo);
      expect(result).toHaveProperty('description');
    });
    
    test('Default pipeline is AWS', async () => {
      const result = await api.processVideo(testVideo);
      expect(result.pipeline).toBe('aws');
    });
  });
  
  describe('Pipeline Selection', () => {
    test('Explicit OpenAI selection', async () => {
      const result = await api.processVideo(testVideo, {
        pipeline: 'openai'
      });
      expect(result.pipeline).toBe('openai');
    });
    
    test('Auto selection based on file size', async () => {
      const smallFile = createTestFile(10 * 1024 * 1024); // 10MB
      const result = await api.processVideo(smallFile, {
        pipeline: 'auto'
      });
      expect(result.pipeline).toBe('openai');
    });
  });
  
  describe('Feature Parity', () => {
    test('Both pipelines generate descriptions', async () => {
      const [openai, aws] = await Promise.all([
        api.processVideo(testVideo, { pipeline: 'openai' }),
        api.processVideo(testVideo, { pipeline: 'aws' })
      ]);
      
      expect(openai).toHaveProperty('description');
      expect(aws).toHaveProperty('description');
    });
  });
});
```

## Migration Checklist

### Pre-Migration
- [ ] Backup current configuration
- [ ] Document current API usage patterns
- [ ] Set up OpenAI account and API keys
- [ ] Test OpenAI connectivity
- [ ] Review cost implications
- [ ] Plan rollback strategy

### During Migration
- [ ] Deploy dual-pipeline code
- [ ] Start with 10% traffic to OpenAI
- [ ] Monitor error rates
- [ ] Compare quality metrics
- [ ] Track cost changes
- [ ] Gather user feedback

### Post-Migration
- [ ] Increase OpenAI traffic gradually
- [ ] Optimize pipeline selection rules
- [ ] Update documentation
- [ ] Train support team
- [ ] Deprecate old endpoints
- [ ] Celebrate success! 🎉

## Common Migration Issues

### Issue 1: API Key Problems

```bash
# Verify OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Should return list of models
```

### Issue 2: Rate Limiting

```javascript
// Implement gradual ramp-up
const rampUpSchedule = [
  { day: 1, percentage: 10 },
  { day: 3, percentage: 25 },
  { day: 7, percentage: 50 },
  { day: 14, percentage: 100 }
];
```

### Issue 3: Cost Overruns

```javascript
// Implement cost controls
const costLimits = {
  daily: 100,    // $100 per day
  monthly: 2000  // $2000 per month
};

if (todaysCost > costLimits.daily) {
  // Switch to AWS pipeline
  forcePipeline = 'aws';
}
```

## Support Resources

- **Migration Support**: migration@voicedescription.ai
- **Technical Documentation**: [docs.voicedescription.ai/migration](https://docs.voicedescription.ai/migration)
- **Status Page**: [status.voicedescription.ai](https://status.voicedescription.ai)
- **Community Forum**: [community.voicedescription.ai](https://community.voicedescription.ai)

## Next Steps

After successful migration:

1. **Optimize Pipeline Rules**: Fine-tune auto-selection based on your usage patterns
2. **Implement Advanced Features**: Custom prompts, contextual analysis, chapter generation
3. **Monitor Long-term Metrics**: Track quality improvements and cost savings
4. **Share Feedback**: Help us improve the dual-pipeline system

---

**Questions?** Contact our migration team at migration@voicedescription.ai for personalized assistance.