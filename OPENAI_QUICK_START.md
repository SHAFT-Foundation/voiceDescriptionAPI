# OpenAI Pipeline - 5-Minute Quick Start Guide

Get up and running with the OpenAI dual-pipeline in just 5 minutes! This guide shows you how to process your first video or image using our ultra-fast GPT-4 Vision pipeline.

## Prerequisites

- Node.js 18+ installed
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))
- 5 minutes of your time

## Step 1: Clone & Install (1 minute)

```bash
# Clone the repository
git clone https://github.com/voicedescription/api.git
cd voiceDescriptionAPI

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

## Step 2: Configure OpenAI (1 minute)

Edit `.env` and add your OpenAI credentials:

```bash
# OpenAI Configuration (REQUIRED)
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_ORG_ID=org-your-org-id-here  # Optional

# AWS Configuration (for audio generation)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret

# S3 Buckets
INPUT_S3_BUCKET=voice-desc-input
OUTPUT_S3_BUCKET=voice-desc-output

# Enable OpenAI Pipeline
ENABLE_OPENAI_PIPELINE=true
OPENAI_VISION_MODEL=gpt-4-vision-preview
```

## Step 3: Start the Server (30 seconds)

```bash
# Start development server
npm run dev

# Server runs at http://localhost:3000
```

## Step 4: Process Your First Video (1 minute)

### Option A: Using cURL

```bash
# Process a video with OpenAI pipeline
curl -X POST http://localhost:3000/api/process-video \
  -H "Content-Type: multipart/form-data" \
  -F "file=@your-video.mp4" \
  -F "pipeline=openai" \
  -F "options[detailLevel]=high"

# Response:
# {
#   "success": true,
#   "data": {
#     "jobId": "abc-123",
#     "pipeline": "openai",
#     "status": "processing"
#   }
# }
```

### Option B: Using JavaScript

```javascript
// Quick processing script
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function processVideo() {
  const form = new FormData();
  form.append('file', fs.createReadStream('video.mp4'));
  form.append('pipeline', 'openai');
  
  const response = await axios.post(
    'http://localhost:3000/api/process-video',
    form,
    { headers: form.getHeaders() }
  );
  
  console.log('Job ID:', response.data.data.jobId);
  return response.data.data.jobId;
}

processVideo().then(jobId => {
  console.log(`Processing started! Job ID: ${jobId}`);
});
```

### Option C: Using the Web Interface

1. Open http://localhost:3000 in your browser
2. Click "Upload Video" or drag & drop
3. Select "OpenAI Pipeline (Fast)" 
4. Click "Process"
5. Watch real-time progress!

## Step 5: Get Results (30 seconds)

### Check Status

```bash
# Check processing status
curl http://localhost:3000/api/status/your-job-id

# Response shows progress:
# {
#   "status": "completed",
#   "progress": 100,
#   "results": {
#     "textUrl": "https://...",
#     "audioUrl": "https://..."
#   }
# }
```

### Download Results

```bash
# Get text description
curl http://localhost:3000/api/results/your-job-id/text > description.txt

# Get audio narration
curl http://localhost:3000/api/results/your-job-id/audio > narration.mp3
```

## Quick Image Processing

Process images even faster (2-5 seconds):

```javascript
// Process single image
const processImage = async () => {
  const form = new FormData();
  form.append('image', fs.createReadStream('product.jpg'));
  form.append('pipeline', 'openai');
  
  const response = await axios.post(
    'http://localhost:3000/api/process-image',
    form
  );
  
  console.log('Alt Text:', response.data.data.altText);
  console.log('Description:', response.data.data.detailedDescription);
};

// Process image batch
const processBatch = async () => {
  const response = await axios.post(
    'http://localhost:3000/api/process-images-batch',
    {
      images: [
        { source: 's3://bucket/image1.jpg', id: 'img1' },
        { source: 's3://bucket/image2.jpg', id: 'img2' }
      ],
      pipeline: 'openai'
    }
  );
  
  console.log('Batch ID:', response.data.data.batchId);
};
```

## Common Use Cases

### 1. E-commerce Product Images

```javascript
// Optimized for product descriptions
const response = await api.processImage({
  file: productImage,
  pipeline: 'openai',
  options: {
    customPrompt: {
      altText: 'Product name, color, key features',
      detailed: 'Include materials, dimensions, uses',
      seo: 'Optimize for product search keywords'
    }
  }
});
```

### 2. Educational Video Content

```javascript
// Focus on educational elements
const response = await api.processVideo({
  file: educationalVideo,
  pipeline: 'openai',
  options: {
    customPrompt: 'Describe educational content, key concepts, and visual demonstrations',
    contextualAnalysis: true,
    generateChapters: true
  }
});
```

### 3. Social Media Accessibility

```javascript
// Quick processing for social media
const response = await api.processVideo({
  file: socialVideo,
  pipeline: 'openai',  // Fast processing
  options: {
    detailLevel: 'auto',
    targetLength: 280   // Twitter-friendly
  }
});
```

## Docker Quick Start

Run everything in Docker:

```bash
# Build and run
docker-compose up

# Or use our pre-built image
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-your-key \
  voicedescription/api:latest
```

## Quick Troubleshooting

### Issue: "Invalid API Key"
```bash
# Check your OpenAI key
echo $OPENAI_API_KEY

# Verify it starts with 'sk-'
# Get a new key at https://platform.openai.com/api-keys
```

### Issue: "Rate Limit Exceeded"
```javascript
// Add rate limiting to your requests
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

for (const video of videos) {
  await processVideo(video);
  await delay(1000); // 1 second between requests
}
```

### Issue: "File Too Large"
```javascript
// Check file size before processing
const stats = fs.statSync('video.mp4');
const fileSizeMB = stats.size / (1024 * 1024);

if (fileSizeMB > 25) {
  console.log('File will be automatically chunked');
}
```

## Performance Tips

### 1. Optimize File Sizes
```bash
# Compress video before processing
ffmpeg -i input.mp4 -vcodec h264 -acodec aac output.mp4
```

### 2. Use Batch Processing
```javascript
// Process multiple files efficiently
const results = await api.processBatch(files, {
  pipeline: 'openai',
  maxConcurrent: 3
});
```

### 3. Enable Caching
```javascript
// Cache results for repeated processing
const cached = await cache.get(fileHash);
if (cached) return cached;

const result = await api.process(file);
await cache.set(fileHash, result);
```

## Cost Estimates

| Content Type | Processing Time | Estimated Cost |
|-------------|----------------|----------------|
| 30-second video | 15-30 seconds | $0.10-0.20 |
| 5-minute video | 30-60 seconds | $0.50-1.00 |
| Single image | 2-5 seconds | $0.01 |
| 100 images (batch) | 30-60 seconds | $1.00 |

## Next Steps

**Ready for more?** Check out:

- 📖 [Full API Documentation](./API_DOCUMENTATION.md)
- 🔧 [Implementation Guide](./OPENAI_IMPLEMENTATION_GUIDE.md)
- 💰 [Cost Optimization Guide](./COST_OPTIMIZATION_GUIDE.md)
- 📊 [Pipeline Comparison](./PIPELINE_COMPARISON.md)
- 🐛 [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)

## Quick Reference Card

```javascript
// Initialize client
const VoiceDescriptionAPI = require('voice-description-api');
const api = new VoiceDescriptionAPI({
  apiKey: process.env.OPENAI_API_KEY,
  pipeline: 'openai'  // Default to OpenAI
});

// Process video (fast)
const videoResult = await api.processVideo('video.mp4');

// Process image (ultra-fast)
const imageResult = await api.processImage('image.jpg');

// Batch process
const batchResult = await api.processBatch(['img1.jpg', 'img2.jpg']);

// Check status
const status = await api.getStatus(jobId);

// Get results
const { text, audio } = await api.getResults(jobId);
```

## Support

Need help? We're here:

- 💬 Discord: [discord.gg/voicedesc](https://discord.gg/voicedesc)
- 📧 Email: quickstart@voicedescription.ai
- 📚 Docs: [docs.voicedescription.ai](https://docs.voicedescription.ai)
- 🐛 Issues: [github.com/voicedescription/api/issues](https://github.com/voicedescription/api/issues)

---

**🎉 Congratulations!** You've successfully processed your first content with the OpenAI pipeline. You're now ready to make your content accessible at lightning speed!