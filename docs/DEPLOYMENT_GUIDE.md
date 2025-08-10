# Voice Description API - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Voice Description API to Render, our recommended production platform.

## Prerequisites

Before deploying, ensure you have:

1. **GitHub Account** with repository access
2. **Render Account** (free tier available at render.com)
3. **AWS Credentials** with appropriate permissions
4. **Domain Name** (optional, for custom domain)

## Quick Start Deployment

### Step 1: Fork/Clone Repository

```bash
git clone https://github.com/yourusername/voiceDescriptionAPI.git
cd voiceDescriptionAPI
```

### Step 2: Create Render Account

1. Visit [render.com](https://render.com)
2. Sign up with GitHub for easy integration
3. Authorize Render to access your repositories

### Step 3: Deploy to Render

#### Option A: One-Click Deploy (Recommended)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yourusername/voiceDescriptionAPI)

#### Option B: Manual Deploy

1. **Create New Web Service**
   - Go to Render Dashboard
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select `voiceDescriptionAPI` repository

2. **Configure Service Settings**
   ```yaml
   Name: voice-description-api
   Region: Oregon (US West)
   Branch: main
   Runtime: Docker
   Plan: Starter ($7/month) or Free
   ```

3. **Set Environment Variables**
   Navigate to Environment tab and add:

   ```bash
   # AWS Configuration (Required)
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_REGION=us-east-1
   
   # S3 Buckets (Required)
   INPUT_S3_BUCKET=voice-desc-input-production
   OUTPUT_S3_BUCKET=voice-desc-output-production
   
   # Bedrock Configuration
   NOVA_MODEL_ID=amazon.nova-pro-v1:0
   
   # Polly Configuration
   POLLY_VOICE_ID=Joanna
   
   # Processing Configuration
   MAX_VIDEO_SIZE_MB=500
   PROCESSING_TIMEOUT_MINUTES=30
   
   # Application Settings
   NODE_ENV=production
   JWT_SECRET=generate_secure_random_string
   LOG_LEVEL=info
   
   # Monitoring (Optional)
   SENTRY_DSN=your_sentry_dsn
   ```

4. **Add Persistent Disk** (Optional but Recommended)
   - Mount Path: `/tmp/uploads`
   - Size: 10GB
   - Used for temporary file storage during processing

5. **Deploy**
   - Click "Create Web Service"
   - Wait for initial deployment (5-10 minutes)
   - Monitor build logs for any issues

## Environment Configuration

### AWS Credentials Setup

1. **Create IAM User**
   ```bash
   aws iam create-user --user-name voice-description-api-prod
   ```

2. **Attach Required Policies**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:PutObject",
           "s3:DeleteObject"
         ],
         "Resource": [
           "arn:aws:s3:::voice-desc-input-production/*",
           "arn:aws:s3:::voice-desc-output-production/*"
         ]
       },
       {
         "Effect": "Allow",
         "Action": [
           "rekognition:StartSegmentDetection",
           "rekognition:GetSegmentDetection"
         ],
         "Resource": "*"
       },
       {
         "Effect": "Allow",
         "Action": [
           "bedrock:InvokeModel"
         ],
         "Resource": "arn:aws:bedrock:*:*:model/amazon.nova-pro-v1:0"
       },
       {
         "Effect": "Allow",
         "Action": [
           "polly:SynthesizeSpeech"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

3. **Generate Access Keys**
   ```bash
   aws iam create-access-key --user-name voice-description-api-prod
   ```

### S3 Bucket Configuration

1. **Create S3 Buckets**
   ```bash
   # Input bucket
   aws s3 mb s3://voice-desc-input-production
   
   # Output bucket
   aws s3 mb s3://voice-desc-output-production
   ```

2. **Configure CORS** (for direct uploads)
   ```json
   {
     "CORSRules": [
       {
         "AllowedHeaders": ["*"],
         "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
         "AllowedOrigins": ["https://voice-description-api.onrender.com"],
         "ExposeHeaders": ["ETag"],
         "MaxAgeSeconds": 3000
       }
     ]
   }
   ```

## Custom Domain Setup

### Configure Custom Domain on Render

1. **Add Custom Domain**
   - Go to Settings → Custom Domains
   - Add your domain: `api.yourdomain.com`

2. **Update DNS Records**
   Add CNAME record:
   ```
   Type: CNAME
   Name: api
   Value: voice-description-api.onrender.com
   TTL: 300
   ```

3. **SSL Certificate**
   - Render automatically provisions Let's Encrypt SSL
   - Wait for certificate validation (5-10 minutes)

## CI/CD Pipeline Setup

### GitHub Actions Configuration

1. **Get Render API Key**
   - Go to Account Settings → API Keys
   - Create new API key for deployments

2. **Get Service ID**
   - Find in Render dashboard URL: `srv-xxxxxxxxxxxxx`

3. **Add GitHub Secrets**
   In repository settings → Secrets:
   ```
   RENDER_API_KEY=your_render_api_key
   RENDER_SERVICE_ID=srv-xxxxxxxxxxxxx
   AWS_ACCESS_KEY_ID=your_aws_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret
   CODECOV_TOKEN=your_codecov_token (optional)
   SENTRY_DSN=your_sentry_dsn (optional)
   ```

4. **Enable Auto-Deploy**
   - Push to main branch triggers deployment
   - Pull requests create preview deployments

## Monitoring Setup

### 1. Application Monitoring (Sentry)

```javascript
// Install Sentry
npm install @sentry/nextjs

// Configure in next.config.js
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(
  nextConfig,
  {
    silent: true,
    org: "your-org",
    project: "voice-description-api",
  }
);
```

### 2. Uptime Monitoring

1. **Render Health Checks**
   - Automatically configured via `/api/health`
   - Checks every 30 seconds
   - Alerts on failures

2. **External Monitoring** (Optional)
   - [UptimeRobot](https://uptimerobot.com)
   - [Pingdom](https://pingdom.com)
   - [StatusCake](https://statuscake.com)

### 3. Performance Monitoring

```javascript
// Add to pages/_app.tsx
import { useEffect } from 'react';
import { initSentry } from '../monitoring/sentry.config';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    initSentry();
  }, []);
  
  return <Component {...pageProps} />;
}
```

### 4. AWS CloudWatch Integration

```javascript
// Configure CloudWatch logging
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';

const cloudwatch = new CloudWatchLogsClient({
  region: process.env.AWS_REGION,
});

// Log important events
await cloudwatch.putLogEvents({
  logGroupName: '/aws/voice-description-api',
  logStreamName: 'production',
  logEvents: [
    {
      message: JSON.stringify(event),
      timestamp: Date.now(),
    },
  ],
});
```

## Scaling Configuration

### Horizontal Scaling

```yaml
# render.yaml
scaling:
  minInstances: 1
  maxInstances: 5
  targetMemoryPercent: 80
  targetCPUPercent: 70
```

### Vertical Scaling

Upgrade plans as needed:
- **Starter**: $7/month - 512MB RAM, 0.5 CPU
- **Standard**: $25/month - 2GB RAM, 1 CPU
- **Pro**: $85/month - 4GB RAM, 2 CPU
- **Pro Plus**: $225/month - 8GB RAM, 4 CPU

## Troubleshooting

### Common Issues and Solutions

#### 1. Build Failures

**Issue**: Docker build fails
```bash
# Check build logs
render logs --service voice-description-api --type build
```

**Solution**: Ensure all dependencies are in package.json

#### 2. Memory Issues

**Issue**: Out of memory errors
```javascript
// Add to next.config.js
module.exports = {
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};
```

#### 3. File Upload Failures

**Issue**: Large files fail to upload
```javascript
// Increase timeout in API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '500mb',
    },
    responseLimit: false,
  },
};
```

#### 4. AWS Connection Issues

**Issue**: AWS services unreachable
```bash
# Test AWS credentials
aws sts get-caller-identity

# Check IAM permissions
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::ACCOUNT:user/voice-api \
  --action-names s3:PutObject bedrock:InvokeModel \
  --resource-arns "*"
```

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review error logs in Sentry
   - Check AWS costs and usage
   - Monitor disk usage

2. **Monthly**
   - Update dependencies
   - Review and optimize AWS costs
   - Performance analysis

3. **Quarterly**
   - Security audit
   - Disaster recovery test
   - Scale planning review

### Backup Strategy

1. **Application State**
   ```bash
   # Backup environment variables
   render config export > config-backup.yaml
   ```

2. **S3 Data**
   ```bash
   # Backup S3 buckets
   aws s3 sync s3://voice-desc-output-production ./backups/
   ```

## Security Best Practices

1. **Environment Variables**
   - Never commit secrets to repository
   - Rotate AWS keys quarterly
   - Use strong JWT secrets

2. **Network Security**
   - Enable Render DDoS protection
   - Configure rate limiting
   - Use HTTPS everywhere

3. **Application Security**
   ```javascript
   // Add security headers
   import helmet from 'helmet';
   app.use(helmet());
   ```

## Cost Optimization

### Estimated Monthly Costs

| Service | Usage | Cost |
|---------|-------|------|
| Render Starter | Always-on | $7 |
| AWS S3 | 100GB storage | $2.30 |
| AWS Bedrock | 1000 requests | $10 |
| AWS Polly | 1M characters | $4 |
| AWS Rekognition | 100 minutes | $10 |
| **Total** | | **~$33.30** |

### Cost Saving Tips

1. **Use S3 Lifecycle Policies**
   ```json
   {
     "Rules": [{
       "Status": "Enabled",
       "Expiration": {
         "Days": 30
       }
     }]
   }
   ```

2. **Implement Caching**
   - Cache Bedrock responses
   - Store processed audio files
   - Reuse Rekognition results

3. **Monitor Usage**
   ```bash
   # Set up AWS budget alerts
   aws budgets create-budget \
     --account-id 123456789012 \
     --budget file://budget.json
   ```

## Support and Resources

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **Render Status**: [status.render.com](https://status.render.com)
- **Community Forum**: [community.render.com](https://community.render.com)
- **Support Email**: support@render.com

## Next Steps

1. ✅ Deploy application to Render
2. ✅ Configure custom domain
3. ✅ Set up monitoring
4. ⏳ Implement caching layer
5. ⏳ Add CDN for static assets
6. ⏳ Set up staging environment

## Deployment Checklist

- [ ] Repository connected to Render
- [ ] Environment variables configured
- [ ] AWS credentials tested
- [ ] S3 buckets created and configured
- [ ] Custom domain DNS updated
- [ ] SSL certificate validated
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] CI/CD pipeline active
- [ ] Initial deployment successful
- [ ] Performance baseline established
- [ ] Documentation updated

## Emergency Procedures

### Rollback Deployment

```bash
# Via Render Dashboard
# Settings → Deploy → Rollback to previous

# Via API
curl -X POST \
  "https://api.render.com/v1/services/${SERVICE_ID}/deploys/${DEPLOY_ID}/rollback" \
  -H "Authorization: Bearer ${RENDER_API_KEY}"
```

### Emergency Scaling

```bash
# Immediately scale up
curl -X PATCH \
  "https://api.render.com/v1/services/${SERVICE_ID}" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -d '{"plan": "pro"}'
```

### Incident Response

1. Check Render status page
2. Review application logs
3. Check AWS service health
4. Notify stakeholders
5. Implement fix or rollback
6. Post-mortem analysis