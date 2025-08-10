# 🚀 Voice Description API - Quick Deployment Guide

## **Option 1: Manual Render Setup (Recommended - 5 minutes)**

### **Step 1: Create Render Account & Connect GitHub**
1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Sign up/login with GitHub
3. Click **"New +"** → **"Web Service"**
4. Select **"Build and deploy from a Git repository"**
5. Connect this GitHub repository

### **Step 2: Configure Service**
```yaml
Runtime: Docker
Build Command: (leave blank - uses Dockerfile)
Start Command: (leave blank - uses Dockerfile CMD)
Region: Oregon (or closest to you)
Plan: Starter ($7/month)
```

### **Step 3: Add Environment Variables** 
In the Render dashboard, add these environment variables:

**Required AWS Variables:**
```
AWS_REGION = us-east-1
AWS_ACCESS_KEY_ID = [your-aws-access-key]
AWS_SECRET_ACCESS_KEY = [your-aws-secret-key]
```

**Bucket Names:**
```
INPUT_S3_BUCKET = voice-description-api-input-production
OUTPUT_S3_BUCKET = voice-description-api-output-production
```

**Processing Config:**
```
NOVA_MODEL_ID = amazon.nova-pro-v1:0
POLLY_VOICE_ID = Joanna
MAX_VIDEO_SIZE_MB = 500
MAX_IMAGE_SIZE_MB = 50
PROCESSING_TIMEOUT_MINUTES = 30
NODE_ENV = production
LOG_LEVEL = info
```

### **Step 4: Deploy**
- Click **"Create Web Service"**
- Render will automatically build and deploy your app
- Build time: ~5-8 minutes
- Your app will be live at: `https://[your-service-name].onrender.com`

---

## **Option 2: Automated Script (Advanced Users)**

If you have AWS CLI configured locally:

```bash
# 1. Create environment file
cp .env.production.example .env.production
# Edit with your AWS credentials

# 2. Run deployment
./scripts/deploy-render.sh --deploy
```

---

## **🔧 AWS Credentials Setup**

If you don't have AWS credentials yet:

### **Method 1: AWS Console (Recommended for Testing)**
1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click **"Users"** → **"Create User"**
3. Username: `voice-description-api`
4. Select **"Attach policies directly"**
5. Add these policies:
   - `AmazonS3FullAccess`
   - `AmazonRekognitionFullAccess` 
   - `AmazonPollyFullAccess`
   - `AmazonBedrockFullAccess`
6. Click **"Create User"**
7. Go to **"Security Credentials"** → **"Access Keys"** → **"Create Access Key"**
8. Choose **"Application running outside AWS"**
9. Copy the Access Key ID and Secret Access Key

### **Method 2: AWS CLI (If you have it installed)**
```bash
aws configure
# Enter your access key, secret key, region (us-east-1), output format (json)
```

---

## **📊 After Deployment**

Your deployed API will be available at:
- **UI Demo**: `https://[your-app].onrender.com`
- **API Docs**: `https://[your-app].onrender.com/api/docs?ui=true`
- **Health Check**: `https://[your-app].onrender.com/api/health`

### **Test the Deployment**
```bash
# Test health endpoint
curl https://[your-app].onrender.com/api/health

# Test image processing
curl -X POST https://[your-app].onrender.com/api/process-image \
  -F "image=@test-image.jpg" \
  -F "detailLevel=comprehensive"
```

---

## **💡 Pro Tips**

1. **Custom Domain**: Add your domain in Render dashboard
2. **Auto-Deploy**: Enable auto-deploy from your main branch
3. **Monitoring**: View logs and metrics in Render dashboard
4. **Scaling**: Upgrade plan as usage grows

---

## **🆘 Troubleshooting**

**Build Fails?**
- Check Render build logs
- Verify all environment variables are set
- Ensure AWS credentials are valid

**API Errors?**
- Check AWS service availability in your region
- Verify S3 bucket permissions
- Test Bedrock model access

**Need Help?**
- Check Render logs: Dashboard → Your Service → Logs
- Monitor AWS CloudWatch for service errors
- Review API documentation at `/api/docs`

---

## **Estimated Costs**

- **Render Starter Plan**: $7/month
- **AWS Usage** (estimated):
  - S3 Storage: $1-5/month
  - Bedrock API: $10-50/month (usage based)
  - Rekognition: $1-10/month
  - Polly TTS: $1-20/month
- **Total**: ~$20-90/month depending on usage

**Ready to deploy? Use Option 1 above! 🚀**