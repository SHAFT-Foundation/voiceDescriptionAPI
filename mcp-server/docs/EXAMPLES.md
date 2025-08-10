# Voice Description MCP Server - Examples

## Complete Working Examples

This document provides complete, working examples for common use cases with the Voice Description MCP Server.

## Table of Contents

- [Single Image Processing](#single-image-processing)
- [Batch Image Processing](#batch-image-processing)
- [Video Processing](#video-processing)
- [E-commerce Integration](#e-commerce-integration)
- [Educational Content](#educational-content)
- [Social Media Accessibility](#social-media-accessibility)
- [Documentation Generation](#documentation-generation)
- [Multi-language Support](#multi-language-support)

## Single Image Processing

### Basic Image Description

```javascript
// Process a single image with default settings
{
  "tool": "voice_description_process_image",
  "arguments": {
    "image_path": "/images/nature-scene.jpg",
    "detail_level": "comprehensive",
    "generate_audio": true
  }
}

// Expected Response
{
  "success": true,
  "job_id": "img-123456",
  "results": {
    "description": "A serene mountain landscape at sunset. Snow-capped peaks rise majestically against a gradient sky transitioning from deep orange near the horizon to purple at the zenith. In the foreground, a crystal-clear alpine lake reflects the mountains perfectly, creating a mirror image. Pine trees frame the scene on both sides, their dark silhouettes providing contrast to the vibrant sky.",
    "alt_text": "Mountain landscape with lake reflection at sunset",
    "visual_elements": ["mountains", "lake", "trees", "sunset", "snow", "reflection"],
    "colors": ["orange", "purple", "blue", "white", "dark green"],
    "confidence": 0.95,
    "audio": {
      "url": "/api/results/img-123456/audio",
      "duration_seconds": 15,
      "format": "mp3"
    }
  }
}
```

### Product Photo with Context

```javascript
// E-commerce product photo with specific context
{
  "tool": "voice_description_process_image",
  "arguments": {
    "image_path": "/products/laptop-pro-2024.jpg",
    "detail_level": "comprehensive",
    "generate_audio": false,
    "include_alt_text": true,
    "context": "Product listing for premium laptop on e-commerce site",
    "language": "en"
  }
}

// Response includes e-commerce optimized descriptions
{
  "success": true,
  "results": {
    "description": "Professional laptop computer displayed at three-quarter angle on white background. The silver aluminum body features a 15-inch display with ultra-thin bezels. The keyboard shows backlit keys with a large trackpad below. Ports visible on the left side include two USB-C, one HDMI, and a headphone jack. The laptop appears to be approximately 0.6 inches thick when closed.",
    "alt_text": "Silver 15-inch professional laptop with backlit keyboard",
    "visual_elements": ["laptop", "keyboard", "screen", "ports", "trackpad"],
    "colors": ["silver", "black", "white"],
    "html_metadata": {
      "alt_attribute": "Silver 15-inch professional laptop with backlit keyboard",
      "aria_label": "Product image: Professional laptop computer with 15-inch display",
      "title": "Laptop Pro 2024 - Premium Business Computer"
    },
    "usage_recommendations": {
      "web_accessibility": [
        "Use provided alt_text for image alt attribute",
        "Include full description in aria-describedby"
      ],
      "content_management": [
        "Tag with: laptop, computer, business, professional",
        "Category: Electronics > Computers > Laptops"
      ]
    }
  }
}
```

## Batch Image Processing

### E-commerce Product Gallery

```javascript
// Process multiple product images for a listing
{
  "tool": "voice_description_batch_images",
  "arguments": {
    "images": [
      {"path": "/products/shoe-001-front.jpg", "id": "SHOE-001-F", "context": "Front view"},
      {"path": "/products/shoe-001-side.jpg", "id": "SHOE-001-S", "context": "Side view"},
      {"path": "/products/shoe-001-back.jpg", "id": "SHOE-001-B", "context": "Back view"},
      {"path": "/products/shoe-001-sole.jpg", "id": "SHOE-001-SO", "context": "Sole detail"}
    ],
    "options": {
      "detail_level": "basic",
      "generate_audio": false,
      "include_alt_text": true
    },
    "processing": {
      "parallel": true,
      "max_concurrent": 4,
      "continue_on_error": true
    }
  }
}

// Batch processing response
{
  "success": true,
  "total_images": 4,
  "processed": 4,
  "failed": 0,
  "results": [
    {
      "id": "SHOE-001-F",
      "status": "completed",
      "result": {
        "description": "Athletic running shoe in black and neon green, front view showing mesh upper and prominent logo",
        "alt_text": "Black running shoe with neon green accents, front view",
        "visual_elements": ["shoe", "logo", "laces", "mesh"],
        "confidence": 0.92
      }
    },
    {
      "id": "SHOE-001-S",
      "status": "completed",
      "result": {
        "description": "Side profile of athletic shoe showing curved sole design and breathable mesh panels",
        "alt_text": "Running shoe side view with curved sole design",
        "visual_elements": ["shoe", "sole", "mesh", "logo"],
        "confidence": 0.94
      }
    }
    // ... additional results
  ],
  "summary": {
    "average_confidence": 0.93,
    "common_elements": ["shoe", "logo", "mesh"],
    "processing_stats": {
      "min_time_ms": 850,
      "max_time_ms": 1200,
      "avg_time_ms": 975
    }
  }
}
```

### Website Image Audit

```javascript
// Audit all images on a website for accessibility
const imageFiles = [
  "/website/hero-banner.jpg",
  "/website/about-team.jpg",
  "/website/service-icon-1.png",
  "/website/service-icon-2.png",
  "/website/testimonial-bg.jpg"
];

{
  "tool": "voice_description_batch_images",
  "arguments": {
    "images": imageFiles.map(path => ({
      path: path,
      id: path.split('/').pop(),
      context: "Website imagery for accessibility audit"
    })),
    "options": {
      "detail_level": "comprehensive",
      "generate_audio": false,
      "include_alt_text": true
    },
    "processing": {
      "parallel": true,
      "max_concurrent": 5
    }
  }
}
```

## Video Processing

### Educational Video with Chapters

```javascript
// Process educational video with detailed descriptions
{
  "tool": "voice_description_upload_video",
  "arguments": {
    "file_path": "/education/chemistry-lab-demo.mp4",
    "title": "Chemistry Lab Safety Demonstration",
    "description": "Educational video showing proper lab safety procedures",
    "language": "en",
    "voice_id": "Matthew",
    "detail_level": "comprehensive",
    "wait_for_completion": false
  }
}

// Initial response
{
  "success": true,
  "job_id": "vid-edu-789",
  "status": "processing",
  "estimated_time_seconds": 300,
  "message": "Video uploaded and processing started"
}

// Poll for status
{
  "tool": "voice_description_check_status",
  "arguments": {
    "job_id": "vid-edu-789",
    "include_details": true
  }
}

// Status update
{
  "success": true,
  "job_id": "vid-edu-789",
  "status": "processing",
  "progress": 60,
  "step": "scene_analysis",
  "message": "Analyzing scene 8 of 12",
  "processing_details": {
    "current_scene": 8,
    "total_scenes": 12,
    "scenes_processed": 7,
    "current_operation": "Analyzing lab equipment demonstration"
  }
}

// Download completed results
{
  "tool": "voice_description_download_results",
  "arguments": {
    "job_id": "vid-edu-789",
    "format": "all",
    "include_metadata": true
  }
}

// Final results
{
  "success": true,
  "text": {
    "content": "Chemistry Lab Safety Demonstration - Audio Description\n\nScene 1 (0:00-0:15): Laboratory overview showing standard chemistry lab setup with fume hoods, emergency shower, and safety equipment stations...\n\nScene 2 (0:15-0:45): Instructor in white lab coat and safety goggles demonstrates proper PPE...",
    "sections": {
      "summary": "Educational demonstration of chemistry lab safety procedures",
      "scenes": [
        {
          "timestamp": "0:00-0:15",
          "description": "Laboratory overview with safety equipment"
        },
        {
          "timestamp": "0:15-0:45",
          "description": "PPE demonstration by instructor"
        }
      ]
    }
  },
  "audio": {
    "url": "/api/results/vid-edu-789/audio",
    "duration_seconds": 420,
    "format": "mp3",
    "voice_id": "Matthew"
  }
}
```

### Marketing Video from S3

```javascript
// Process video directly from S3
{
  "tool": "voice_description_process_video_url",
  "arguments": {
    "video_url": "s3://marketing-assets/campaigns/2024/product-launch.mp4",
    "title": "Product Launch Campaign Video",
    "options": {
      "language": "en",
      "voice_id": "Joanna",
      "detail_level": "detailed",
      "scene_threshold": 0.8
    },
    "wait_for_completion": true,
    "polling_timeout": 600
  }
}
```

## E-commerce Integration

### Complete Product Listing Workflow

```javascript
// Step 1: Process main product image
const mainImage = await executeTool({
  tool: "voice_description_process_image",
  arguments: {
    image_path: "/products/watch-luxury-main.jpg",
    detail_level: "comprehensive",
    generate_audio: true,
    context: "Luxury watch product main image for e-commerce listing"
  }
});

// Step 2: Process gallery images
const galleryImages = await executeTool({
  tool: "voice_description_batch_images",
  arguments: {
    images: [
      {path: "/products/watch-luxury-detail-1.jpg", id: "detail-1"},
      {path: "/products/watch-luxury-detail-2.jpg", id: "detail-2"},
      {path: "/products/watch-luxury-on-wrist.jpg", id: "lifestyle"}
    ],
    options: {
      detail_level: "basic",
      include_alt_text: true
    }
  }
});

// Step 3: Generate product description HTML
const productHTML = `
<div class="product-images" role="img" aria-label="${mainImage.results.alt_text}">
  <img src="/products/watch-luxury-main.jpg" 
       alt="${mainImage.results.alt_text}"
       aria-describedby="main-description">
  <div id="main-description" class="sr-only">
    ${mainImage.results.description}
  </div>
  
  <div class="gallery">
    ${galleryImages.results.map(img => `
      <img src="${img.path}" 
           alt="${img.result.alt_text}"
           data-description="${img.result.description}">
    `).join('')}
  </div>
</div>

<div class="accessibility-features">
  <button onclick="playAudioDescription()">
    🔊 Play Audio Description
  </button>
  <audio id="product-audio" src="${mainImage.results.audio.url}"></audio>
</div>
`;
```

## Educational Content

### Lecture Video with Slides

```javascript
// Process lecture video with slide detection
async function processLectureVideo(videoPath, courseInfo) {
  // Upload and start processing
  const uploadResult = await executeTool({
    tool: "voice_description_upload_video",
    arguments: {
      file_path: videoPath,
      title: `${courseInfo.course} - ${courseInfo.lecture}`,
      description: "University lecture with presentation slides",
      language: "en",
      detail_level: "comprehensive",
      voice_id: "Matthew"
    }
  });
  
  // Monitor progress
  let status;
  do {
    await sleep(10000); // Wait 10 seconds
    
    status = await executeTool({
      tool: "voice_description_check_status",
      arguments: {
        job_id: uploadResult.job_id,
        include_details: true
      }
    });
    
    console.log(`Processing: ${status.progress}% - ${status.message}`);
  } while (status.status === 'processing');
  
  // Get results
  const results = await executeTool({
    tool: "voice_description_download_results",
    arguments: {
      job_id: uploadResult.job_id,
      format: "all"
    }
  });
  
  // Create accessible transcript
  const transcript = createAccessibleTranscript(results);
  return transcript;
}

function createAccessibleTranscript(results) {
  return {
    title: results.metadata.title,
    duration: results.audio.duration_seconds,
    scenes: results.text.sections.scenes.map(scene => ({
      timestamp: scene.timestamp,
      description: scene.description,
      slides_detected: scene.description.includes('slide') || 
                      scene.description.includes('presentation')
    })),
    audio_track: results.audio.url,
    full_text: results.text.content
  };
}
```

## Social Media Accessibility

### Instagram Post Generator

```javascript
// Generate accessible Instagram post
async function createAccessiblePost(imagePath, postContext) {
  const imageAnalysis = await executeTool({
    tool: "voice_description_process_image",
    arguments: {
      image_path: imagePath,
      detail_level: "basic",
      generate_audio: false,
      context: `Instagram post: ${postContext}`
    }
  });
  
  // Generate Instagram-friendly content
  const post = {
    image: imagePath,
    caption: postContext,
    alt_text: imageAnalysis.results.alt_text,
    accessibility_caption: `[Image Description: ${imageAnalysis.results.description}]`,
    hashtags: generateHashtags(imageAnalysis.results.visual_elements),
    colors: imageAnalysis.results.colors
  };
  
  return post;
}

function generateHashtags(visualElements) {
  return visualElements
    .map(element => `#${element.replace(/\s+/g, '')}`)
    .concat(['#accessibility', '#ImageDescription', '#InclusiveContent']);
}

// Example usage
const post = await createAccessiblePost(
  "/social/sunset-beach.jpg",
  "Perfect evening at the beach 🌅"
);

console.log(post);
// Output:
// {
//   caption: "Perfect evening at the beach 🌅",
//   accessibility_caption: "[Image Description: Sunset over ocean beach with golden sand...]",
//   hashtags: ["#sunset", "#beach", "#ocean", "#accessibility", "#ImageDescription"]
// }
```

## Documentation Generation

### Technical Diagram Documentation

```javascript
// Process technical diagrams for documentation
async function documentTechnicalDiagrams(diagramFolder) {
  const diagrams = [
    {path: `${diagramFolder}/architecture.png`, type: "System Architecture"},
    {path: `${diagramFolder}/data-flow.png`, type: "Data Flow"},
    {path: `${diagramFolder}/network-topology.png`, type: "Network Topology"}
  ];
  
  const results = await executeTool({
    tool: "voice_description_batch_images",
    arguments: {
      images: diagrams.map(d => ({
        path: d.path,
        id: d.type,
        context: `Technical diagram: ${d.type}`
      })),
      options: {
        detail_level: "technical",
        include_alt_text: true
      }
    }
  });
  
  // Generate markdown documentation
  const markdown = results.results.map(result => `
## ${result.id}

![${result.result.alt_text}](${result.path})

**Description:** ${result.result.description}

**Key Elements:**
${result.result.visual_elements.map(e => `- ${e}`).join('\n')}

---
  `).join('\n');
  
  return markdown;
}
```

## Multi-language Support

### Multi-language Video Processing

```javascript
// Process video in multiple languages
async function createMultilingualDescriptions(videoPath) {
  const languages = [
    {code: 'en', voice: 'Joanna'},
    {code: 'es', voice: 'Lucia'},
    {code: 'fr', voice: 'Celine'},
    {code: 'de', voice: 'Vicki'}
  ];
  
  const results = {};
  
  for (const lang of languages) {
    console.log(`Processing in ${lang.code}...`);
    
    const result = await executeTool({
      tool: "voice_description_process_video_url",
      arguments: {
        video_url: videoPath,
        options: {
          language: lang.code,
          voice_id: lang.voice,
          detail_level: "detailed"
        }
      }
    });
    
    // Wait for completion and download
    // ... polling logic ...
    
    results[lang.code] = await executeTool({
      tool: "voice_description_download_results",
      arguments: {
        job_id: result.job_id,
        format: "all"
      }
    });
  }
  
  return results;
}
```

### Internationalized Image Descriptions

```javascript
// Generate descriptions in multiple languages
async function internationalizeImageDescriptions(imagePath) {
  const languages = ['en', 'es', 'fr', 'de', 'ja', 'zh'];
  const descriptions = {};
  
  for (const lang of languages) {
    const result = await executeTool({
      tool: "voice_description_process_image",
      arguments: {
        image_path: imagePath,
        detail_level: "comprehensive",
        language: lang,
        generate_audio: true,
        voice_id: getVoiceForLanguage(lang)
      }
    });
    
    descriptions[lang] = {
      text: result.results.description,
      alt: result.results.alt_text,
      audio: result.results.audio?.url
    };
  }
  
  return descriptions;
}

function getVoiceForLanguage(lang) {
  const voices = {
    'en': 'Joanna',
    'es': 'Lucia',
    'fr': 'Celine',
    'de': 'Vicki',
    'ja': 'Mizuki',
    'zh': 'Zhiyu'
  };
  return voices[lang] || 'Joanna';
}
```

## Error Handling Examples

### Robust Processing with Retry

```javascript
async function processWithRetry(imagePath, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeTool({
        tool: "voice_description_process_image",
        arguments: {
          image_path: imagePath,
          detail_level: "comprehensive"
        }
      });
      
      if (result.success) {
        return result;
      }
      
      // Handle specific errors
      if (result.error?.code === 'RATE_LIMITED') {
        const waitTime = result.error.retry?.suggested_delay_ms || 5000;
        console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
        await sleep(waitTime);
        continue;
      }
      
      throw new Error(result.error?.message || 'Processing failed');
      
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        const backoffTime = Math.pow(2, attempt) * 1000;
        await sleep(backoffTime);
      }
    }
  }
  
  throw lastError;
}
```

### Batch Processing with Error Recovery

```javascript
async function robustBatchProcessing(images) {
  const results = {
    successful: [],
    failed: [],
    retried: []
  };
  
  // First attempt - process all in batch
  const batchResult = await executeTool({
    tool: "voice_description_batch_images",
    arguments: {
      images: images,
      processing: {
        continue_on_error: true
      }
    }
  });
  
  // Separate successful and failed
  for (const result of batchResult.results) {
    if (result.status === 'completed') {
      results.successful.push(result);
    } else {
      results.failed.push(result);
    }
  }
  
  // Retry failed images individually
  for (const failed of results.failed) {
    console.log(`Retrying ${failed.id}...`);
    
    try {
      const retryResult = await processWithRetry(failed.path);
      results.retried.push({
        ...failed,
        retry_result: retryResult
      });
    } catch (error) {
      console.error(`Failed to process ${failed.id} after retries:`, error);
    }
  }
  
  return results;
}
```

## Performance Optimization

### Parallel Processing Pipeline

```javascript
async function optimizedPipeline(videoPath, imageFolder) {
  // Start video processing (long-running)
  const videoPromise = executeTool({
    tool: "voice_description_upload_video",
    arguments: {
      file_path: videoPath,
      wait_for_completion: false
    }
  });
  
  // Process images while video is processing
  const imageFiles = await listImages(imageFolder);
  const imageBatches = chunkArray(imageFiles, 5);
  
  const imagePromises = imageBatches.map(batch => 
    executeTool({
      tool: "voice_description_batch_images",
      arguments: {
        images: batch.map(f => ({path: f})),
        processing: {
          parallel: true,
          max_concurrent: 5
        }
      }
    })
  );
  
  // Wait for all processing
  const [videoResult, ...imageResults] = await Promise.all([
    videoPromise,
    ...imagePromises
  ]);
  
  // Poll for video completion
  const videoFinal = await pollUntilComplete(videoResult.job_id);
  
  return {
    video: videoFinal,
    images: imageResults.flat()
  };
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function pollUntilComplete(jobId, timeout = 600000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const status = await executeTool({
      tool: "voice_description_check_status",
      arguments: { job_id: jobId }
    });
    
    if (status.status === 'completed') {
      return await executeTool({
        tool: "voice_description_download_results",
        arguments: { job_id: jobId, format: "all" }
      });
    }
    
    if (status.status === 'failed') {
      throw new Error(`Job ${jobId} failed: ${status.error?.message}`);
    }
    
    await sleep(5000);
  }
  
  throw new Error(`Timeout waiting for job ${jobId}`);
}
```

## Health Monitoring

### System Health Dashboard

```javascript
async function monitorSystemHealth() {
  const health = await executeTool({
    tool: "voice_description_health_check",
    arguments: {
      include_details: true,
      check_aws: true
    }
  });
  
  const awsStatus = await executeTool({
    tool: "voice_description_aws_status",
    arguments: {
      include_quotas: true
    }
  });
  
  const dashboard = {
    timestamp: new Date().toISOString(),
    overall_status: health.status,
    services: {
      api: health.services.api,
      storage: health.services.storage,
      processing: {
        active_jobs: health.details?.processing.active_jobs,
        queued: health.details?.processing.queued_jobs,
        completed_today: health.details?.processing.completed_today
      }
    },
    aws: {
      rekognition: {
        status: awsStatus.services.rekognition.status,
        quota_used: `${awsStatus.services.rekognition.api_calls_today}/${awsStatus.services.rekognition.quota_limit}`,
        percentage: (awsStatus.services.rekognition.api_calls_today / awsStatus.services.rekognition.quota_limit * 100).toFixed(1)
      },
      bedrock: {
        status: awsStatus.services.bedrock.status,
        tokens_remaining: awsStatus.services.bedrock.tokens_remaining
      },
      polly: {
        status: awsStatus.services.polly.status,
        characters_remaining: awsStatus.services.polly.characters_remaining
      }
    },
    alerts: generateAlerts(health, awsStatus)
  };
  
  return dashboard;
}

function generateAlerts(health, awsStatus) {
  const alerts = [];
  
  if (health.status !== 'healthy') {
    alerts.push({
      level: 'warning',
      message: `System status: ${health.status}`
    });
  }
  
  // Check AWS quotas
  for (const [service, data] of Object.entries(awsStatus.services)) {
    if (data.quota_remaining && data.quota_limit) {
      const percentUsed = (data.quota_limit - data.quota_remaining) / data.quota_limit * 100;
      if (percentUsed > 80) {
        alerts.push({
          level: 'warning',
          message: `${service} quota ${percentUsed.toFixed(1)}% used`
        });
      }
    }
  }
  
  return alerts;
}
```

---

These examples demonstrate real-world usage patterns for the Voice Description MCP Server. Each example includes complete request/response cycles and can be adapted for specific use cases.