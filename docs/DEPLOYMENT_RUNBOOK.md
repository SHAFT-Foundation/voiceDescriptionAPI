# Voice Description API - Production Deployment Runbook

## 📋 Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Initial Deployment](#initial-deployment)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Process](#deployment-process)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Monitoring Setup](#monitoring-setup)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)
9. [Maintenance Tasks](#maintenance-tasks)
10. [Emergency Contacts](#emergency-contacts)

---

## 🔍 Pre-Deployment Checklist

### Code Readiness
- [ ] All tests passing (`npm run test:all`)
- [ ] TypeScript compilation successful (`npm run typecheck`)
- [ ] ESLint checks passed (`npm run lint`)
- [ ] Security vulnerabilities scanned (`npm audit`)
- [ ] Code reviewed and approved
- [ ] Version tagged in Git

### AWS Setup
- [ ] AWS credentials configured
- [ ] S3 buckets created (input/output/backup)
- [ ] IAM roles and policies configured
- [ ] Bedrock Nova Pro access approved
- [ ] CloudWatch log groups created
- [ ] Cost alerts configured

### Render Setup
- [ ] Render account created
- [ ] Payment method configured
- [ ] Service plan selected (Starter - $7/mo)
- [ ] GitHub repository connected
- [ ] Environment variables prepared

### Documentation
- [ ] API documentation updated
- [ ] Changelog prepared
- [ ] Customer notification drafted (if needed)
- [ ] Runbook reviewed

---

## 🚀 Initial Deployment

### Step 1: Clone and Prepare Repository
```bash
# Clone the repository
git clone https://github.com/yourusername/voiceDescriptionAPI.git
cd voiceDescriptionAPI

# Install dependencies
npm install

# Run tests
npm run test:all

# Build locally to verify
npm run build
```

### Step 2: Configure Environment Variables
```bash
# Copy production environment template
cp .env.production.example .env.production

# Edit with your values
nano .env.production

# Required variables:
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - JWT_SECRET (generate with: openssl rand -base64 32)
# - SENTRY_DSN (from Sentry dashboard)
```

### Step 3: Deploy to Render

#### Option A: Using Render Dashboard
1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Select branch: `main`
5. Build Command: `npm run build`
6. Start Command: `npm start`
7. Select plan: Starter ($7/mo)
8. Add environment variables from `.env.production`
9. Click "Create Web Service"

#### Option B: Using Deployment Script
```bash
# Make script executable
chmod +x scripts/deploy-render.sh

# Run deployment
./scripts/deploy-render.sh --deploy

# Follow prompts for configuration
```

#### Option C: Using Render CLI
```bash
# Install Render CLI
npm install -g @render/cli

# Login to Render
render login

# Deploy using render.yaml
render up
```

---

## ⚙️ Environment Configuration

### Required Environment Variables

#### Core Configuration
```bash
NODE_ENV=production
PORT=3000
```

#### AWS Services
```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
INPUT_S3_BUCKET=voice-desc-input-production
OUTPUT_S3_BUCKET=voice-desc-output-production
NOVA_MODEL_ID=amazon.nova-pro-v1:0
POLLY_VOICE_ID=Joanna
```

#### Security
```bash
JWT_SECRET=<generate-strong-secret>
API_KEY=<generate-api-key>
ALLOWED_ORIGINS=https://voice-description-api.onrender.com
```

#### Monitoring
```bash
SENTRY_DSN=https://...@sentry.io/...
LOG_LEVEL=info
ENABLE_PERFORMANCE_MONITORING=true
```

### Setting Environment Variables in Render

1. Go to Service Settings → Environment
2. Add each variable as Key-Value pair
3. Mark sensitive variables as "Secret"
4. Click "Save Changes"
5. Service will auto-redeploy

---

## 📦 Deployment Process

### Automated Deployment (GitHub Actions)

Push to main branch triggers automatic deployment:

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature

# After PR approval and merge to main
# Deployment automatically triggered
```

### Manual Deployment

```bash
# Via Render Dashboard
1. Go to Service → Manual Deploy
2. Select commit/branch
3. Click "Deploy"

# Via API
curl -X POST \
  "https://api.render.com/v1/services/${SERVICE_ID}/deploys" \
  -H "Authorization: Bearer ${RENDER_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"clearCache": true}'
```

### Deployment Stages

1. **Build Stage** (5-10 minutes)
   - Docker image building
   - Dependencies installation
   - Next.js compilation
   - Asset optimization

2. **Deploy Stage** (2-3 minutes)
   - Container deployment
   - Health check initialization
   - Traffic routing update
   - Old instance termination

3. **Verification Stage** (5 minutes)
   - Health checks passing
   - Metrics collection started
   - Logs streaming
   - Performance baseline

---

## ✅ Post-Deployment Verification

### Health Checks

```bash
# Basic health check
curl https://voice-description-api.onrender.com/api/health

# Detailed health check
curl https://voice-description-api.onrender.com/api/health?detailed=true

# Expected response:
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-08-10T12:00:00Z",
  "checks": {
    "database": "healthy",
    "aws": "healthy",
    "memory": "healthy"
  }
}
```

### Functional Tests

```bash
# Test image processing
curl -X POST https://voice-description-api.onrender.com/api/process-image \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "s3://bucket/test-image.jpg"}'

# Check job status
curl https://voice-description-api.onrender.com/api/status/${JOB_ID}
```

### Performance Tests

```bash
# Load test with Apache Bench
ab -n 100 -c 10 https://voice-description-api.onrender.com/api/health

# Response time test
for i in {1..10}; do
  curl -w "@curl-format.txt" -o /dev/null -s https://voice-description-api.onrender.com/
done
```

### Monitoring Verification

1. **Sentry**: Check for errors at https://sentry.io
2. **CloudWatch**: Verify logs streaming
3. **Render Metrics**: Check dashboard metrics
4. **Uptime Monitoring**: Verify external monitors

---

## 📊 Monitoring Setup

### Sentry Configuration

1. Create project at https://sentry.io
2. Get DSN from project settings
3. Add to environment variables
4. Verify error reporting:
```javascript
// Test error reporting
Sentry.captureMessage('Deployment test', 'info');
```

### CloudWatch Setup

```bash
# Create log group
aws logs create-log-group \
  --log-group-name /aws/render/voice-description-api \
  --region us-east-1

# Set retention
aws logs put-retention-policy \
  --log-group-name /aws/render/voice-description-api \
  --retention-in-days 30
```

### Alerts Configuration

#### Render Alerts
1. Go to Service → Settings → Notifications
2. Configure alerts for:
   - Deployment failures
   - Health check failures
   - High memory usage
   - Error rate spikes

#### CloudWatch Alarms
```bash
# CPU utilization alarm
aws cloudwatch put-metric-alarm \
  --alarm-name high-cpu-usage \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Deployment Fails

**Symptoms**: Build fails in Render
**Solutions**:
```bash
# Check build logs
render logs --service voice-description-api --type build

# Common fixes:
- Verify Node version (must be 18+)
- Check package-lock.json is committed
- Ensure all dependencies are listed
- Verify environment variables
```

#### 2. Health Check Failures

**Symptoms**: Service shows as unhealthy
**Solutions**:
```bash
# Check application logs
render logs --service voice-description-api

# Common fixes:
- Verify PORT environment variable
- Check database connectivity
- Ensure AWS credentials are valid
- Review memory usage
```

#### 3. AWS Connection Issues

**Symptoms**: S3/Bedrock/Polly errors
**Solutions**:
```bash
# Test AWS credentials
aws sts get-caller-identity

# Verify bucket access
aws s3 ls s3://voice-desc-input-production

# Check IAM permissions
aws iam get-user-policy --user-name service-user --policy-name VoiceDescriptionPolicy
```

#### 4. Performance Issues

**Symptoms**: Slow response times
**Solutions**:
```bash
# Check metrics
curl https://voice-description-api.onrender.com/api/metrics

# Common optimizations:
- Scale up Render instance
- Enable Redis caching
- Optimize database queries
- Review CloudWatch metrics
```

#### 5. Memory Leaks

**Symptoms**: Increasing memory usage
**Solutions**:
```bash
# Monitor memory
render metrics --service voice-description-api --metric memory

# Force garbage collection (temporary)
curl -X POST https://voice-description-api.onrender.com/api/admin/gc \
  -H "X-Admin-Token: ${ADMIN_TOKEN}"
```

---

## 🔄 Rollback Procedures

### Immediate Rollback

```bash
# Via Render Dashboard
1. Go to Service → Deploys
2. Find previous successful deployment
3. Click "Rollback to this deploy"
4. Confirm rollback

# Via CLI
render rollback --service voice-description-api --deploy-id ${PREVIOUS_DEPLOY_ID}
```

### Git-based Rollback

```bash
# Revert last commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard ${COMMIT_HASH}
git push --force origin main
```

### Database Rollback

```bash
# If using database migrations
npm run db:migrate:undo

# Restore from backup
pg_restore -d voice_description < backup.sql
```

### Emergency Procedures

1. **Service Down**:
   ```bash
   # Switch to maintenance mode
   render env --service voice-description-api --set MAINTENANCE_MODE=true
   
   # Investigate and fix
   # ...
   
   # Resume service
   render env --service voice-description-api --set MAINTENANCE_MODE=false
   ```

2. **Data Corruption**:
   ```bash
   # Stop processing new jobs
   render scale --service voice-description-api --count 0
   
   # Fix data issues
   # ...
   
   # Resume service
   render scale --service voice-description-api --count 1
   ```

---

## 🛠️ Maintenance Tasks

### Daily Tasks
- [ ] Check health endpoint
- [ ] Review error logs in Sentry
- [ ] Monitor AWS costs
- [ ] Check job processing queue

### Weekly Tasks
- [ ] Review performance metrics
- [ ] Clean up temporary files
- [ ] Update dependencies (dev only)
- [ ] Backup database

### Monthly Tasks
- [ ] Security updates review
- [ ] Cost optimization review
- [ ] Capacity planning
- [ ] Disaster recovery drill

### Maintenance Scripts

```bash
# Cleanup old files
./scripts/cleanup.sh

# Backup database
./scripts/backup.sh

# Update dependencies (development)
npm update
npm audit fix
```

---

## 📞 Emergency Contacts

### Escalation Path

1. **Level 1 - On-Call Engineer**
   - Primary: [Name] - [Phone] - [Email]
   - Secondary: [Name] - [Phone] - [Email]

2. **Level 2 - Team Lead**
   - [Name] - [Phone] - [Email]

3. **Level 3 - CTO/VP Engineering**
   - [Name] - [Phone] - [Email]

### Service Providers

- **Render Support**: support@render.com
- **AWS Support**: [Support Case URL]
- **Sentry Support**: support@sentry.io
- **Cloudflare Support**: support@cloudflare.com

### Communication Channels

- **Slack**: #voice-description-ops
- **PagerDuty**: voice-description-service
- **Status Page**: https://status.voicedescription.ai

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [AWS Service Documentation](https://docs.aws.amazon.com)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Monitoring Best Practices](https://www.datadoghq.com/blog/monitoring-best-practices/)

---

## 🔐 Security Considerations

### Secret Management
- Never commit secrets to Git
- Use Render's secret management
- Rotate credentials regularly
- Use IAM roles when possible

### Access Control
- Limit production access
- Use MFA for all accounts
- Audit access logs regularly
- Implement least privilege

### Compliance
- GDPR compliance for EU users
- CCPA compliance for CA users
- SOC2 requirements
- Regular security audits

---

## 📈 Performance Benchmarks

### Target Metrics
- **API Response Time**: < 200ms (p95)
- **Image Processing**: < 5 seconds
- **Video Processing**: < 30 seconds
- **Uptime**: > 99.9%
- **Error Rate**: < 0.1%

### Monitoring Dashboards
- Render Metrics: https://dashboard.render.com
- CloudWatch: https://console.aws.amazon.com/cloudwatch
- Sentry: https://sentry.io/organizations/[org]/issues/
- Custom Dashboard: https://voice-description-api.onrender.com/admin/metrics

---

**Last Updated**: 2025-08-10
**Version**: 1.0.0
**Maintained By**: DevOps Team