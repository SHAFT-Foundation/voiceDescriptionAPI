# Developer Resources

## Voice Description API - Enterprise Accessibility Platform

Transform your visual content into comprehensive audio descriptions with our production-ready API. Built on AWS infrastructure with enterprise-grade security, scalability, and reliability.

---

## Quick Start Guide

Get up and running in 5 minutes with our RESTful API.

### 1. Authentication Setup

```bash
# Set your API credentials
export API_KEY="your-api-key"
export API_SECRET="your-api-secret"
```

### 2. Your First API Call

```bash
# Process a single image
curl -X POST https://api.voicedescription.ai/v1/process-image \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F "image=@sample.jpg" \
  -F "detailLevel=comprehensive" \
  -F "generateAudio=true"
```

### 3. Get Results

```json
{
  "success": true,
  "data": {
    "jobId": "550e8400-e29b-41d4",
    "status": "completed",
    "processingTime": 2.3,
    "results": {
      "altText": "A sunset over mountain peaks...",
      "detailedDescription": "The image captures a breathtaking sunset...",
      "audioFile": {
        "url": "https://cdn.voicedescription.ai/audio/550e8400.mp3",
        "duration": 15.2
      }
    }
  }
}
```

---

## API Capabilities

### Core Features

- **Multi-Modal Processing**: Handle videos up to 500MB and images up to 50MB
- **Batch Operations**: Process up to 100 items simultaneously
- **Real-Time Status**: WebSocket connections for live progress updates
- **Flexible Output**: JSON, audio files, and structured metadata
- **Language Support**: 30+ languages with natural voice synthesis

### Processing Options

```javascript
const options = {
  detailLevel: 'comprehensive',    // basic | comprehensive | technical
  generateAudio: true,              // Generate audio narration
  includeAltText: true,            // Generate alt text for HTML
  voiceId: 'Joanna',               // AWS Polly voice selection
  language: 'en-US',               // Output language
  format: 'mp3'                    // Audio format: mp3 | wav | ogg
};
```

---

## Integration Examples

### JavaScript/Node.js

```javascript
import VoiceDescriptionAPI from '@voicedescription/sdk';

const client = new VoiceDescriptionAPI({
  apiKey: process.env.API_KEY,
  region: 'us-east-1'
});

// Process an image with comprehensive descriptions
async function processImage(imagePath) {
  try {
    const result = await client.images.process({
      file: imagePath,
      options: {
        detailLevel: 'comprehensive',
        generateAudio: true,
        language: 'en-US'
      }
    });
    
    console.log('Description:', result.detailedDescription);
    console.log('Audio URL:', result.audioFile.url);
    return result;
  } catch (error) {
    console.error('Processing failed:', error);
  }
}

// Batch processing with progress tracking
async function processBatch(images) {
  const batch = await client.batch.create({
    images: images,
    options: { 
      detailLevel: 'comprehensive',
      generateAudio: true 
    }
  });
  
  // Monitor progress
  batch.on('progress', (status) => {
    console.log(`Processed ${status.completed}/${status.total}`);
  });
  
  const results = await batch.wait();
  return results;
}
```

### Python

```python
from voicedescription import Client
import asyncio

# Initialize client
client = Client(
    api_key=os.environ['API_KEY'],
    region='us-east-1'
)

# Async processing for better performance
async def process_video(video_path):
    """Process a video with scene-by-scene descriptions"""
    
    # Upload and process
    job = await client.videos.process_async(
        file_path=video_path,
        options={
            'detail_level': 'comprehensive',
            'generate_audio': True,
            'scene_detection': True
        }
    )
    
    # Poll for completion
    while job.status != 'completed':
        await asyncio.sleep(2)
        await job.refresh()
        print(f"Progress: {job.progress}%")
    
    # Get results
    descriptions = job.get_descriptions()
    audio_url = job.get_audio_url()
    
    return {
        'descriptions': descriptions,
        'audio': audio_url,
        'processing_time': job.processing_time
    }

# Batch processing with error handling
async def batch_process(file_list):
    """Process multiple files with retry logic"""
    
    batch = client.batch.create(files=file_list)
    
    try:
        results = await batch.process(
            max_retries=3,
            timeout=300
        )
        return results
    except BatchProcessingError as e:
        # Handle partial failures
        successful = e.get_successful()
        failed = e.get_failed()
        print(f"Processed {len(successful)} successfully")
        print(f"Failed: {failed}")
        return successful
```

### React Integration

```jsx
import { useVoiceDescription } from '@voicedescription/react';

function AccessibleImageGallery({ images }) {
  const { process, loading, results } = useVoiceDescription({
    apiKey: process.env.REACT_APP_API_KEY,
    autoProcess: true
  });

  return (
    <div className="gallery">
      {images.map((image, index) => (
        <AccessibleImage
          key={index}
          src={image.url}
          onLoad={() => process(image.url)}
          description={results[image.url]?.description}
          audioUrl={results[image.url]?.audioUrl}
          loading={loading[image.url]}
        />
      ))}
    </div>
  );
}

function AccessibleImage({ src, description, audioUrl, loading }) {
  const [playing, setPlaying] = useState(false);
  
  return (
    <figure className="accessible-image">
      <img 
        src={src} 
        alt={description?.altText || 'Processing...'} 
        aria-describedby={`desc-${src}`}
      />
      
      {loading && <LoadingSpinner />}
      
      {description && (
        <>
          <figcaption id={`desc-${src}`}>
            {description.detailedDescription}
          </figcaption>
          
          {audioUrl && (
            <button 
              onClick={() => setPlaying(!playing)}
              aria-label="Play audio description"
            >
              {playing ? '⏸️' : '▶️'} Listen
            </button>
          )}
        </>
      )}
    </figure>
  );
}
```

---

## Enterprise Integration

### WebSocket Real-Time Updates

```javascript
// Connect to real-time processing updates
const ws = new WebSocket('wss://api.voicedescription.ai/v1/stream');

ws.on('connect', () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    jobId: 'your-job-id',
    auth: apiKey
  }));
});

ws.on('message', (data) => {
  const update = JSON.parse(data);
  console.log(`Progress: ${update.progress}%`);
  console.log(`Current step: ${update.step}`);
  
  if (update.status === 'completed') {
    console.log('Results:', update.results);
  }
});
```

### Webhook Integration

```javascript
// Configure webhooks for async processing
const job = await client.videos.process({
  file: 'video.mp4',
  webhook: {
    url: 'https://your-app.com/webhooks/voice-description',
    events: ['started', 'progress', 'completed', 'failed'],
    headers: {
      'X-Custom-Auth': 'your-webhook-secret'
    }
  }
});

// Your webhook endpoint
app.post('/webhooks/voice-description', (req, res) => {
  const { event, jobId, status, results } = req.body;
  
  switch(event) {
    case 'completed':
      // Store results in database
      await db.saveResults(jobId, results);
      // Notify user
      await notifyUser(jobId, results.audioUrl);
      break;
    case 'failed':
      // Handle failure
      await handleFailure(jobId, status.error);
      break;
  }
  
  res.status(200).send('OK');
});
```

### Error Handling & Retry Logic

```javascript
class VoiceDescriptionService {
  constructor(apiKey) {
    this.client = new VoiceDescriptionAPI({ apiKey });
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async processWithRetry(file, options) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.client.process(file, options);
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (this.isRetryableError(error)) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.log(`Retry ${attempt}/${this.maxRetries} after ${delay}ms`);
          await this.sleep(delay);
        } else {
          // Non-retryable error, throw immediately
          throw error;
        }
      }
    }
    
    throw new Error(`Failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  isRetryableError(error) {
    const retryableCodes = ['RATE_LIMIT', 'TIMEOUT', 'SERVICE_UNAVAILABLE'];
    return retryableCodes.includes(error.code);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/process-image` | Process single image |
| POST | `/api/process-images-batch` | Batch process images |
| POST | `/api/upload` | Upload and process video |
| GET | `/api/status/{jobId}` | Get job status |
| GET | `/api/results/{jobId}/text` | Download text descriptions |
| GET | `/api/results/{jobId}/audio` | Download audio file |
| GET | `/api/health` | System health check |

### Response Formats

#### Success Response
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "completed",
    "processingTime": 2.34,
    "results": {
      "detailedDescription": "string",
      "altText": "string",
      "visualElements": ["array"],
      "confidence": 0.98,
      "audioFile": {
        "url": "string",
        "duration": 15.2,
        "format": "mp3"
      }
    }
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Image format not supported",
    "details": "Accepted formats: JPEG, PNG, GIF, WebP"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Rate Limits

| Tier | Requests/Second | Concurrent Jobs | Max File Size |
|------|----------------|-----------------|---------------|
| Free | 1 | 2 | 10 MB |
| Pro | 10 | 20 | 100 MB |
| Enterprise | 100 | 200 | 500 MB |
| Custom | Unlimited | Unlimited | Unlimited |

---

## Best Practices

### 1. Optimize File Sizes
```javascript
// Compress images before processing
import sharp from 'sharp';

async function optimizeImage(inputPath) {
  const optimized = await sharp(inputPath)
    .resize(2048, 2048, { 
      fit: 'inside',
      withoutEnlargement: true 
    })
    .jpeg({ quality: 85 })
    .toBuffer();
    
  return optimized;
}
```

### 2. Implement Caching
```javascript
// Cache descriptions to reduce API calls
const cache = new Map();

async function getCachedDescription(imageHash) {
  if (cache.has(imageHash)) {
    return cache.get(imageHash);
  }
  
  const result = await client.process(imageHash);
  cache.set(imageHash, result);
  
  return result;
}
```

### 3. Handle Large Batches
```javascript
// Process large batches in chunks
async function processLargeBatch(files, chunkSize = 25) {
  const results = [];
  
  for (let i = 0; i < files.length; i += chunkSize) {
    const chunk = files.slice(i, i + chunkSize);
    const chunkResults = await client.batch.process(chunk);
    results.push(...chunkResults);
    
    // Add delay to avoid rate limits
    if (i + chunkSize < files.length) {
      await sleep(1000);
    }
  }
  
  return results;
}
```

---

## Security & Compliance

### Data Protection
- **Encryption**: All data encrypted in transit (TLS 1.3) and at rest (AES-256)
- **Data Retention**: Processed files deleted after 24 hours
- **GDPR Compliant**: Full data portability and right to deletion
- **SOC 2 Type II**: Annual security audits and compliance

### API Security
```javascript
// Implement request signing for additional security
import crypto from 'crypto';

function signRequest(method, path, body, secret) {
  const timestamp = Date.now();
  const payload = `${method}:${path}:${timestamp}:${body}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  return {
    'X-Timestamp': timestamp,
    'X-Signature': signature
  };
}
```

---

## Support & Resources

### Documentation
- [Complete API Reference](https://docs.voicedescription.ai)
- [SDK Documentation](https://sdk.voicedescription.ai)
- [Integration Guides](https://guides.voicedescription.ai)
- [Video Tutorials](https://learn.voicedescription.ai)

### Community & Support
- **Developer Forum**: [forum.voicedescription.ai](https://forum.voicedescription.ai)
- **GitHub**: [github.com/voicedescription](https://github.com/voicedescription)
- **Discord**: [discord.gg/voicedesc](https://discord.gg/voicedesc)
- **Enterprise Support**: enterprise@voicedescription.ai

### SLA & Reliability
- **99.99% Uptime SLA** for Enterprise customers
- **Global CDN** with <50ms latency worldwide
- **Auto-scaling** infrastructure handles traffic spikes
- **24/7 Support** for critical issues

---

## Pricing & Plans

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| API Calls/month | 100 | 10,000 | Unlimited |
| Processing Speed | Standard | Priority | Dedicated |
| Support | Community | Email | 24/7 Phone |
| SLA | - | 99.9% | 99.99% |
| Custom Integration | - | - | ✓ |
| Price | $0 | $99/mo | Custom |

[Start Free Trial](https://app.voicedescription.ai/signup) | [Contact Sales](mailto:sales@voicedescription.ai)