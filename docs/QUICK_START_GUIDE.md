# Quick Start Guide

## 5-Minute Integration Tutorial

Get your first audio description generated in less than 5 minutes. This guide walks you through account setup, authentication, and your first API call.

---

## Prerequisites

Before you begin, ensure you have:
- A modern web browser
- Node.js 14+ or Python 3.7+ installed (for SDK examples)
- Basic command line knowledge
- An image or video file to test (or use our samples)

---

## Step 1: Create Your Account (30 seconds)

### Sign Up
1. Visit [app.voicedescription.ai/signup](https://app.voicedescription.ai/signup)
2. Enter your email and create a password
3. Verify your email address
4. You're in! 🎉

### Get Your API Credentials
```bash
# Your dashboard will show:
API_KEY: vd_live_a1b2c3d4e5f6g7h8
API_SECRET: vd_secret_i9j0k1l2m3n4o5p6
ENDPOINT: https://api.voicedescription.ai/v1
```

**Important**: Keep your API_SECRET secure and never commit it to version control.

---

## Step 2: Choose Your Integration Method (30 seconds)

### Option A: Use Our SDK (Recommended)

#### Node.js/JavaScript
```bash
npm install @voicedescription/sdk
# or
yarn add @voicedescription/sdk
```

#### Python
```bash
pip install voicedescription
# or
pip3 install voicedescription
```

### Option B: Direct API Calls
No installation needed - use cURL, Postman, or any HTTP client.

---

## Step 3: Set Up Authentication (1 minute)

### Environment Variables (Recommended)
```bash
# Create .env file in your project
echo "VD_API_KEY=vd_live_a1b2c3d4e5f6g7h8" >> .env
echo "VD_API_SECRET=vd_secret_i9j0k1l2m3n4o5p6" >> .env

# Add .env to .gitignore
echo ".env" >> .gitignore
```

### SDK Initialization

#### JavaScript
```javascript
// Load environment variables
require('dotenv').config();

// Initialize SDK
import VoiceDescription from '@voicedescription/sdk';

const client = new VoiceDescription({
  apiKey: process.env.VD_API_KEY,
  apiSecret: process.env.VD_API_SECRET
});
```

#### Python
```python
# Load environment variables
import os
from dotenv import load_dotenv
load_dotenv()

# Initialize SDK
from voicedescription import Client

client = Client(
    api_key=os.getenv('VD_API_KEY'),
    api_secret=os.getenv('VD_API_SECRET')
)
```

---

## Step 4: Make Your First API Call (2 minutes)

### Process an Image

#### Using JavaScript SDK
```javascript
async function describeImage() {
  try {
    // Process an image
    const result = await client.images.process({
      file: './sample-image.jpg',  // Local file path
      options: {
        detailLevel: 'comprehensive',
        generateAudio: true,
        language: 'en-US'
      }
    });

    // Display results
    console.log('✅ Success!');
    console.log('Description:', result.detailedDescription);
    console.log('Alt Text:', result.altText);
    console.log('Audio URL:', result.audioFile?.url);
    
    // Save description to file
    const fs = require('fs');
    fs.writeFileSync('description.txt', result.detailedDescription);
    
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run it!
describeImage();
```

#### Using Python SDK
```python
import asyncio

async def describe_image():
    try:
        # Process an image
        result = await client.images.process(
            file_path='./sample-image.jpg',
            options={
                'detail_level': 'comprehensive',
                'generate_audio': True,
                'language': 'en-US'
            }
        )
        
        # Display results
        print('✅ Success!')
        print(f'Description: {result.detailed_description}')
        print(f'Alt Text: {result.alt_text}')
        print(f'Audio URL: {result.audio_file.url}')
        
        # Save description to file
        with open('description.txt', 'w') as f:
            f.write(result.detailed_description)
            
        return result
    except Exception as e:
        print(f'❌ Error: {str(e)}')

# Run it!
asyncio.run(describe_image())
```

#### Using cURL
```bash
# Direct API call
curl -X POST https://api.voicedescription.ai/v1/process-image \
  -H "Authorization: Bearer vd_live_a1b2c3d4e5f6g7h8" \
  -H "X-API-Secret: vd_secret_i9j0k1l2m3n4o5p6" \
  -F "image=@sample-image.jpg" \
  -F "detailLevel=comprehensive" \
  -F "generateAudio=true" \
  -F "language=en-US" \
  | jq '.'

# Response (in ~2 seconds):
{
  "success": true,
  "data": {
    "jobId": "job_123abc",
    "status": "completed",
    "processingTime": 2.34,
    "results": {
      "detailedDescription": "The image shows a breathtaking sunset...",
      "altText": "Sunset over mountain range with orange sky",
      "audioFile": {
        "url": "https://cdn.voicedescription.ai/audio/job_123abc.mp3",
        "duration": 12.5
      }
    }
  }
}
```

---

## Step 5: Handle the Response (1 minute)

### Understanding the Response Structure

```javascript
// Successful response format
{
  success: true,
  data: {
    jobId: "unique-job-identifier",
    status: "completed",
    processingTime: 2.34,  // seconds
    results: {
      // Text descriptions
      detailedDescription: "Comprehensive description...",
      altText: "Brief alt text for HTML",
      
      // Visual analysis
      visualElements: ["sunset", "mountains", "clouds"],
      colors: ["orange", "purple", "blue"],
      composition: "landscape orientation with rule of thirds",
      
      // Confidence score
      confidence: 0.98,
      
      // Audio file (if requested)
      audioFile: {
        url: "https://cdn.../audio.mp3",
        duration: 15.2,  // seconds
        format: "mp3"
      },
      
      // HTML metadata
      htmlMetadata: {
        altAttribute: "Sunset over mountains",
        ariaLabel: "Image: Sunset scene",
        schemaMarkup: { /* Schema.org data */ }
      }
    }
  },
  timestamp: "2024-01-01T12:00:00Z"
}
```

### Error Handling

```javascript
// Error response format
{
  success: false,
  error: {
    code: "INVALID_IMAGE_FORMAT",
    message: "The image format is not supported",
    details: "Supported formats: JPEG, PNG, GIF, WebP"
  },
  timestamp: "2024-01-01T12:00:00Z"
}

// Handle errors gracefully
async function processWithErrorHandling(imagePath) {
  try {
    const result = await client.images.process({ file: imagePath });
    console.log('Success:', result);
    return result;
  } catch (error) {
    switch(error.code) {
      case 'INVALID_IMAGE_FORMAT':
        console.error('Please use JPEG, PNG, GIF, or WebP format');
        break;
      case 'FILE_TOO_LARGE':
        console.error('File size must be under 50MB');
        break;
      case 'RATE_LIMIT_EXCEEDED':
        console.error('Too many requests. Please wait and retry.');
        break;
      default:
        console.error('Unexpected error:', error.message);
    }
    throw error;
  }
}
```

---

## Common Use Cases

### 1. Bulk Process Multiple Images
```javascript
async function processMultipleImages(imagePaths) {
  const results = await client.batch.process({
    files: imagePaths,
    options: {
      detailLevel: 'comprehensive',
      generateAudio: true
    }
  });
  
  console.log(`Processed ${results.successful.length} images`);
  return results;
}

// Usage
const images = ['img1.jpg', 'img2.png', 'img3.gif'];
const batchResults = await processMultipleImages(images);
```

### 2. Process with Progress Updates
```javascript
async function processWithProgress(videoPath) {
  const job = await client.videos.processAsync(videoPath);
  
  // Subscribe to progress updates
  job.on('progress', (update) => {
    console.log(`Progress: ${update.percentage}%`);
    console.log(`Current step: ${update.step}`);
  });
  
  // Wait for completion
  const result = await job.wait();
  console.log('Completed!', result);
  
  return result;
}
```

### 3. Generate Only Alt Text (Fast Mode)
```javascript
async function getQuickAltText(imagePath) {
  const result = await client.images.process({
    file: imagePath,
    options: {
      detailLevel: 'basic',      // Faster processing
      generateAudio: false,      // Skip audio generation
      includeAltText: true       // Focus on alt text
    }
  });
  
  return result.altText;  // Returns in <1 second
}
```

### 4. Custom Voice and Language
```javascript
async function processInSpanish(imagePath) {
  const result = await client.images.process({
    file: imagePath,
    options: {
      language: 'es-ES',        // Spanish
      voiceId: 'Lucia',         // Spanish voice
      generateAudio: true
    }
  });
  
  return result;
}
```

---

## Testing Resources

### Sample Files
We provide sample files for testing:

```javascript
// Use our hosted samples
const SAMPLE_IMAGE = 'https://samples.voicedescription.ai/landscape.jpg';
const SAMPLE_VIDEO = 'https://samples.voicedescription.ai/demo.mp4';

// Process sample
const result = await client.images.process({ 
  url: SAMPLE_IMAGE 
});
```

### Test API Key
For initial testing without signing up:
```javascript
// Limited test key (10 requests per day)
const testClient = new VoiceDescription({
  apiKey: 'vd_test_public_key',
  apiSecret: 'vd_test_public_secret'
});
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Authentication Failed
```bash
# Check your credentials
echo $VD_API_KEY
echo $VD_API_SECRET

# Verify API key is active
curl https://api.voicedescription.ai/v1/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### 2. File Upload Issues
```javascript
// Ensure file exists and is readable
const fs = require('fs');
if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
}

// Check file size (max 50MB for images, 500MB for videos)
const stats = fs.statSync(filePath);
const fileSizeMB = stats.size / (1024 * 1024);
console.log(`File size: ${fileSizeMB.toFixed(2)} MB`);
```

#### 3. Slow Processing
```javascript
// Use appropriate detail level
const options = {
  detailLevel: 'basic',     // Fastest (1-2 sec)
  // detailLevel: 'comprehensive',  // Standard (2-3 sec)
  // detailLevel: 'technical',      // Detailed (3-5 sec)
};
```

#### 4. Network Timeouts
```javascript
// Increase timeout for large files
const client = new VoiceDescription({
  apiKey: process.env.VD_API_KEY,
  timeout: 30000,  // 30 seconds
  retries: 3       // Auto-retry on failure
});
```

---

## Next Steps

### Explore Advanced Features
- [Batch Processing Guide](/docs/batch-processing)
- [WebSocket Real-Time Updates](/docs/websockets)
- [Webhook Integration](/docs/webhooks)
- [Custom AI Models](/docs/custom-models)

### Optimize Your Integration
- [Performance Best Practices](/docs/performance)
- [Caching Strategies](/docs/caching)
- [Error Handling Guide](/docs/errors)
- [Security Guidelines](/docs/security)

### Get Help
- [API Reference](https://docs.voicedescription.ai)
- [Community Forum](https://forum.voicedescription.ai)
- [Discord Server](https://discord.gg/voicedesc)
- [Support Email](mailto:support@voicedescription.ai)

---

## Frequently Asked Questions

### How fast is processing?
- Images: 1-3 seconds average
- Videos: 2-5 seconds per minute of content
- Batch: Parallel processing up to 100 items

### What formats are supported?
- Images: JPEG, PNG, GIF, WebP, BMP, TIFF
- Videos: MP4, MOV, AVI, MKV, WebM
- Max size: 50MB (images), 500MB (videos)

### How accurate are descriptions?
- 99.8% accuracy for object recognition
- Context-aware descriptions
- Continuously improving AI models

### What languages are available?
- 30+ languages including English, Spanish, French, German, Chinese, Japanese
- Natural voice synthesis for each language
- Automatic language detection available

### Is there a free tier?
- Yes! 100 API calls per month free
- No credit card required
- Full feature access

---

## Ready to Build?

You've successfully made your first API call! 🎉

**What's Next?**
1. Explore the [full API documentation](https://docs.voicedescription.ai)
2. Join our [developer community](https://discord.gg/voicedesc)
3. Check out [example projects](https://github.com/voicedescription/examples)
4. Start building amazing accessible experiences!

**Need help?** Our support team is available at support@voicedescription.ai