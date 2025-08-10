import { NextApiRequest, NextApiResponse } from 'next';

interface CodeSample {
  language: string;
  label: string;
  code: string;
}

interface EndpointSamples {
  endpoint: string;
  description: string;
  samples: CodeSample[];
}

const codeSamples: EndpointSamples[] = [
  {
    endpoint: 'POST /api/upload',
    description: 'Upload and process a video file',
    samples: [
      {
        language: 'javascript',
        label: 'JavaScript (Fetch API)',
        code: `// Upload video file with Fetch API
const uploadVideo = async (file) => {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('title', 'My Accessible Video');
  formData.append('language', 'en');

  try {
    const response = await fetch('https://api.voicedescription.ai/v2/api/upload', {
      method: 'POST',
      headers: {
        'X-API-Key': 'your-api-key-here'
      },
      body: formData
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Job ID:', result.data.jobId);
      console.log('Status URL:', result.data.statusUrl);
      
      // Start polling for status
      pollJobStatus(result.data.jobId);
    } else {
      console.error('Upload failed:', result.error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};

// Poll for job status
const pollJobStatus = async (jobId) => {
  const interval = setInterval(async () => {
    const response = await fetch(\`/api/status/\${jobId}\`, {
      headers: { 'X-API-Key': 'your-api-key-here' }
    });
    
    const status = await response.json();
    
    if (status.data.status === 'completed') {
      clearInterval(interval);
      console.log('Processing complete!');
      console.log('Audio URL:', status.data.audioUrl);
      console.log('Text URL:', status.data.textUrl);
    } else if (status.data.status === 'failed') {
      clearInterval(interval);
      console.error('Processing failed:', status.data.error);
    } else {
      console.log(\`Progress: \${status.data.progress}% - \${status.data.message}\`);
    }
  }, 5000); // Poll every 5 seconds
};`
      },
      {
        language: 'python',
        label: 'Python (requests)',
        code: `import requests
import time
import json

def upload_video(file_path, api_key):
    """Upload a video file for processing"""
    
    # Prepare the request
    url = 'https://api.voicedescription.ai/v2/api/upload'
    headers = {'X-API-Key': api_key}
    
    # Open the file and create form data
    with open(file_path, 'rb') as video_file:
        files = {'video': video_file}
        data = {
            'title': 'My Accessible Video',
            'language': 'en',
            'description': 'A video that needs audio description'
        }
        
        # Make the upload request
        response = requests.post(url, files=files, data=data, headers=headers)
    
    # Handle the response
    if response.status_code == 200:
        result = response.json()
        if result['success']:
            job_id = result['data']['jobId']
            print(f"Upload successful! Job ID: {job_id}")
            return job_id
        else:
            print(f"Upload failed: {result['error']['message']}")
            return None
    else:
        print(f"HTTP Error {response.status_code}: {response.text}")
        return None

def poll_job_status(job_id, api_key):
    """Poll for job completion status"""
    
    url = f'https://api.voicedescription.ai/v2/api/status/{job_id}'
    headers = {'X-API-Key': api_key}
    
    while True:
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            status = response.json()
            
            if status['data']['status'] == 'completed':
                print("Processing complete!")
                print(f"Audio URL: {status['data']['audioUrl']}")
                print(f"Text URL: {status['data']['textUrl']}")
                return status['data']
            
            elif status['data']['status'] == 'failed':
                print(f"Processing failed: {status['data']['error']}")
                return None
            
            else:
                progress = status['data']['progress']
                message = status['data']['message']
                print(f"Progress: {progress}% - {message}")
                time.sleep(5)  # Wait 5 seconds before next poll
        else:
            print(f"Failed to get status: {response.status_code}")
            return None

# Example usage
if __name__ == '__main__':
    API_KEY = 'your-api-key-here'
    VIDEO_FILE = 'path/to/your/video.mp4'
    
    job_id = upload_video(VIDEO_FILE, API_KEY)
    if job_id:
        result = poll_job_status(job_id, API_KEY)
        
        if result:
            # Download the results
            audio_response = requests.get(
                f'https://api.voicedescription.ai/v2/api/results/{job_id}/audio',
                headers={'X-API-Key': API_KEY}
            )
            
            with open('description_audio.mp3', 'wb') as f:
                f.write(audio_response.content)
                print("Audio description saved to description_audio.mp3")`
      },
      {
        language: 'curl',
        label: 'cURL',
        code: `# Upload video file
curl -X POST https://api.voicedescription.ai/v2/api/upload \\
  -H "X-API-Key: your-api-key-here" \\
  -F "video=@/path/to/video.mp4" \\
  -F "title=My Accessible Video" \\
  -F "language=en" \\
  -F "description=A video that needs audio description"

# Response will include jobId
# {"success":true,"data":{"jobId":"550e8400-e29b-41d4-a716-446655440000",...}}

# Check job status
curl -X GET https://api.voicedescription.ai/v2/api/status/550e8400-e29b-41d4-a716-446655440000 \\
  -H "X-API-Key: your-api-key-here"

# Download text description
curl -X GET https://api.voicedescription.ai/v2/api/results/550e8400-e29b-41d4-a716-446655440000/text \\
  -H "X-API-Key: your-api-key-here" \\
  -o description.txt

# Download audio description
curl -X GET https://api.voicedescription.ai/v2/api/results/550e8400-e29b-41d4-a716-446655440000/audio \\
  -H "X-API-Key: your-api-key-here" \\
  -o description.mp3`
      },
      {
        language: 'nodejs',
        label: 'Node.js (Axios)',
        code: `const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

class VoiceDescriptionClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.voicedescription.ai/v2';
  }

  async uploadVideo(filePath, metadata = {}) {
    const form = new FormData();
    form.append('video', fs.createReadStream(filePath));
    form.append('title', metadata.title || 'Untitled Video');
    form.append('language', metadata.language || 'en');
    
    if (metadata.description) {
      form.append('description', metadata.description);
    }

    try {
      const response = await axios.post(
        `${this.baseURL}/api/upload`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'X-API-Key': this.apiKey
          }
        }
      );

      if (response.data.success) {
        console.log('Upload successful:', response.data.data.jobId);
        return response.data.data;
      } else {
        throw new Error(response.data.error.message);
      }
    } catch (error) {
      console.error('Upload failed:', error.message);
      throw error;
    }
  }

  async getJobStatus(jobId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/status/${jobId}`,
        {
          headers: { 'X-API-Key': this.apiKey }
        }
      );
      return response.data.data;
    } catch (error) {
      console.error('Failed to get status:', error.message);
      throw error;
    }
  }

  async waitForCompletion(jobId, pollInterval = 5000) {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const status = await this.getJobStatus(jobId);
          
          if (status.status === 'completed') {
            resolve(status);
          } else if (status.status === 'failed') {
            reject(new Error(status.error || 'Processing failed'));
          } else {
            console.log(`Progress: ${status.progress}% - ${status.message}`);
            setTimeout(checkStatus, pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      checkStatus();
    });
  }

  async downloadResults(jobId, outputDir = './') {
    const status = await this.getJobStatus(jobId);
    
    if (status.status !== 'completed') {
      throw new Error('Job not completed');
    }

    // Download text description
    const textResponse = await axios.get(
      `${this.baseURL}/api/results/${jobId}/text`,
      {
        headers: { 'X-API-Key': this.apiKey }
      }
    );
    
    fs.writeFileSync(
      `${outputDir}/description_${jobId}.txt`,
      textResponse.data
    );

    // Download audio description
    const audioResponse = await axios.get(
      `${this.baseURL}/api/results/${jobId}/audio`,
      {
        headers: { 'X-API-Key': this.apiKey },
        responseType: 'arraybuffer'
      }
    );
    
    fs.writeFileSync(
      `${outputDir}/description_${jobId}.mp3`,
      audioResponse.data
    );

    console.log('Results downloaded successfully');
    return {
      textFile: `${outputDir}/description_${jobId}.txt`,
      audioFile: `${outputDir}/description_${jobId}.mp3`
    };
  }
}

// Example usage
async function main() {
  const client = new VoiceDescriptionClient('your-api-key-here');
  
  try {
    // Upload video
    const uploadResult = await client.uploadVideo('./video.mp4', {
      title: 'My Accessible Video',
      description: 'A demonstration video',
      language: 'en'
    });
    
    // Wait for processing to complete
    const completedJob = await client.waitForCompletion(uploadResult.jobId);
    
    // Download results
    const files = await client.downloadResults(uploadResult.jobId);
    console.log('Downloaded files:', files);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();`
      }
    ]
  },
  {
    endpoint: 'POST /api/process-image',
    description: 'Process a single image for accessibility',
    samples: [
      {
        language: 'javascript',
        label: 'JavaScript (React)',
        code: `import React, { useState } from 'react';
import axios from 'axios';

function ImageAccessibilityProcessor() {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFileSelect = (event) => {
    setFile(event.target.files[0]);
    setError(null);
  };

  const processImage = async () => {
    if (!file) {
      setError('Please select an image file');
      return;
    }

    setProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', file);
    formData.append('detailLevel', 'comprehensive');
    formData.append('generateAudio', 'true');
    formData.append('includeAltText', 'true');
    formData.append('title', file.name);
    formData.append('context', 'Website content image');

    try {
      const response = await axios.post(
        '/api/process-image',
        formData,
        {
          headers: {
            'X-API-Key': process.env.REACT_APP_API_KEY,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setResults(response.data.data.results);
      } else {
        setError(response.data.error.message);
      }
    } catch (err) {
      setError(err.message || 'Failed to process image');
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="image-processor">
      <h2>Image Accessibility Processor</h2>
      
      <div className="upload-section">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          disabled={processing}
        />
        <button
          onClick={processImage}
          disabled={!file || processing}
        >
          {processing ? 'Processing...' : 'Process Image'}
        </button>
      </div>

      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}

      {results && (
        <div className="results">
          <h3>Accessibility Information Generated:</h3>
          
          <div className="result-section">
            <h4>Alt Text (for img tag):</h4>
            <code>{results.altText}</code>
            <button onClick={() => copyToClipboard(results.altText)}>
              Copy Alt Text
            </button>
          </div>

          <div className="result-section">
            <h4>Detailed Description:</h4>
            <p>{results.detailedDescription}</p>
            <button onClick={() => copyToClipboard(results.detailedDescription)}>
              Copy Description
            </button>
          </div>

          <div className="result-section">
            <h4>Visual Elements Detected:</h4>
            <ul>
              {results.visualElements.map((element, index) => (
                <li key={index}>{element}</li>
              ))}
            </ul>
          </div>

          <div className="result-section">
            <h4>Colors:</h4>
            <div className="color-palette">
              {results.colors.map((color, index) => (
                <span
                  key={index}
                  className="color-chip"
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {color}
                </span>
              ))}
            </div>
          </div>

          {results.audioFile && (
            <div className="result-section">
              <h4>Audio Description:</h4>
              <audio controls src={results.audioFile.url}>
                Your browser does not support the audio element.
              </audio>
              <p>Duration: {results.audioFile.duration}s</p>
            </div>
          )}

          <div className="result-section">
            <h4>HTML Implementation:</h4>
            <pre>
              <code>
{`<img 
  src="your-image.jpg"
  alt="${results.htmlMetadata.altAttribute}"
  aria-label="${results.htmlMetadata.ariaLabel}"
  longdesc="#${results.htmlMetadata.longDescId}"
/>

<div id="${results.htmlMetadata.longDescId}" hidden>
  ${results.detailedDescription}
</div>`}
              </code>
            </pre>
          </div>

          <div className="result-section">
            <h4>Confidence Score:</h4>
            <progress value={results.confidence} max="1">
              {(results.confidence * 100).toFixed(1)}%
            </progress>
            <span>{(results.confidence * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageAccessibilityProcessor;`
      },
      {
        language: 'python',
        label: 'Python (Flask Integration)',
        code: `from flask import Flask, request, jsonify, render_template_string
import requests
import base64
import os

app = Flask(__name__)

API_KEY = os.environ.get('VOICE_DESCRIPTION_API_KEY')
API_BASE_URL = 'https://api.voicedescription.ai/v2'

class ImageAccessibilityService:
    """Service for generating accessibility content for images"""
    
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = API_BASE_URL
    
    def process_image(self, image_path, options=None):
        """Process an image and generate accessibility content"""
        
        url = f'{self.base_url}/api/process-image'
        headers = {'X-API-Key': self.api_key}
        
        # Default options
        if options is None:
            options = {
                'detailLevel': 'comprehensive',
                'generateAudio': True,
                'includeAltText': True
            }
        
        # Prepare the request
        with open(image_path, 'rb') as image_file:
            files = {'image': image_file}
            data = options
            
            response = requests.post(url, files=files, data=data, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            if result['success']:
                return result['data']['results']
            else:
                raise Exception(f"API Error: {result['error']['message']}")
        else:
            raise Exception(f"HTTP Error {response.status_code}")
    
    def process_image_from_url(self, image_url, options=None):
        """Process an image from URL"""
        
        # Download image first
        image_response = requests.get(image_url)
        if image_response.status_code != 200:
            raise Exception(f"Failed to download image from {image_url}")
        
        # Convert to base64
        image_base64 = base64.b64encode(image_response.content).decode('utf-8')
        
        url = f'{self.base_url}/api/process-image'
        headers = {
            'X-API-Key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        payload = {
            'image': image_base64,
            'options': options or {
                'detailLevel': 'comprehensive',
                'generateAudio': True,
                'includeAltText': True
            }
        }
        
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            if result['success']:
                return result['data']['results']
            else:
                raise Exception(f"API Error: {result['error']['message']}")
        else:
            raise Exception(f"HTTP Error {response.status_code}")
    
    def batch_process_images(self, image_list, options=None):
        """Process multiple images in batch"""
        
        url = f'{self.base_url}/api/process-images-batch'
        headers = {
            'X-API-Key': self.api_key,
            'Content-Type': 'application/json'
        }
        
        # Prepare batch request
        images = []
        for idx, image_path in enumerate(image_list):
            if image_path.startswith('http'):
                # URL
                images.append({
                    'source': image_path,
                    'id': f'image_{idx}'
                })
            elif image_path.startswith('s3://'):
                # S3 URI
                images.append({
                    'source': image_path,
                    'id': f'image_{idx}'
                })
            else:
                # Local file - convert to base64
                with open(image_path, 'rb') as f:
                    image_base64 = base64.b64encode(f.read()).decode('utf-8')
                    images.append({
                        'source': f'data:image/jpeg;base64,{image_base64}',
                        'id': f'image_{idx}'
                    })
        
        payload = {
            'images': images,
            'options': options or {
                'detailLevel': 'comprehensive',
                'generateAudio': False,
                'includeAltText': True
            }
        }
        
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 200:
            result = response.json()
            if result['success']:
                return result['data']
            else:
                raise Exception(f"API Error: {result['error']['message']}")
        else:
            raise Exception(f"HTTP Error {response.status_code}")

# Flask routes for web interface
@app.route('/')
def index():
    return render_template_string('''
<!DOCTYPE html>
<html>
<head>
    <title>Image Accessibility Generator</title>
</head>
<body>
    <h1>Image Accessibility Generator</h1>
    <form action="/process" method="post" enctype="multipart/form-data">
        <input type="file" name="image" accept="image/*" required>
        <select name="detailLevel">
            <option value="basic">Basic</option>
            <option value="comprehensive" selected>Comprehensive</option>
            <option value="technical">Technical</option>
        </select>
        <label>
            <input type="checkbox" name="generateAudio" value="true">
            Generate Audio Description
        </label>
        <button type="submit">Process Image</button>
    </form>
</body>
</html>
    ''')

@app.route('/process', methods=['POST'])
def process():
    try:
        # Get uploaded file
        image_file = request.files['image']
        if not image_file:
            return jsonify({'error': 'No image uploaded'}), 400
        
        # Save temporarily
        temp_path = f'/tmp/{image_file.filename}'
        image_file.save(temp_path)
        
        # Process image
        service = ImageAccessibilityService(API_KEY)
        options = {
            'detailLevel': request.form.get('detailLevel', 'comprehensive'),
            'generateAudio': request.form.get('generateAudio') == 'true',
            'includeAltText': True
        }
        
        results = service.process_image(temp_path, options)
        
        # Clean up
        os.remove(temp_path)
        
        # Return results
        return jsonify({
            'success': True,
            'results': results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/batch', methods=['POST'])
def batch_process():
    try:
        data = request.json
        image_urls = data.get('images', [])
        
        if not image_urls:
            return jsonify({'error': 'No images provided'}), 400
        
        service = ImageAccessibilityService(API_KEY)
        results = service.batch_process_images(image_urls)
        
        return jsonify({
            'success': True,
            'results': results
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)`
      }
    ]
  },
  {
    endpoint: 'POST /api/process-images-batch',
    description: 'Process multiple images in batch',
    samples: [
      {
        language: 'javascript',
        label: 'JavaScript (Batch Processing)',
        code: `// Batch process multiple images for accessibility
class BatchImageProcessor {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.voicedescription.ai/v2';
  }

  async processBatch(images, options = {}) {
    const batchRequest = {
      images: images.map((image, index) => ({
        source: image.source || image.url || image.s3Uri,
        id: image.id || `image_${index}`,
        metadata: image.metadata || {}
      })),
      options: {
        detailLevel: options.detailLevel || 'comprehensive',
        generateAudio: options.generateAudio || false,
        includeAltText: options.includeAltText !== false,
        ...options
      }
    };

    const response = await fetch(`${this.baseURL}/api/process-images-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify(batchRequest)
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result.data;
  }

  // Helper method to process local files
  async processLocalFiles(fileList, options = {}) {
    const images = [];
    
    for (const file of fileList) {
      const base64 = await this.fileToBase64(file);
      images.push({
        source: `data:${file.type};base64,${base64}`,
        id: file.name,
        metadata: {
          title: file.name,
          size: file.size,
          type: file.type
        }
      });
    }

    return this.processBatch(images, options);
  }

  // Helper method to process S3 images
  async processS3Images(s3Uris, options = {}) {
    const images = s3Uris.map((uri, index) => ({
      source: uri,
      id: `s3_image_${index}`
    }));

    return this.processBatch(images, options);
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  }

  // Generate HTML accessibility markup for all results
  generateAccessibilityHTML(batchResults) {
    let html = '';
    
    for (const imageResult of batchResults.results) {
      if (imageResult.status === 'completed') {
        const { result } = imageResult;
        html += `
<!-- Image: ${imageResult.id} -->
<figure>
  <img 
    src="${imageResult.id}"
    alt="${result.htmlMetadata.altAttribute}"
    aria-label="${result.htmlMetadata.ariaLabel}"
    longdesc="#desc_${imageResult.jobId}"
  />
  <figcaption id="desc_${imageResult.jobId}" hidden>
    ${result.detailedDescription}
  </figcaption>
</figure>
\n`;
      }
    }
    
    return html;
  }

  // Generate accessibility report
  generateReport(batchResults) {
    const report = {
      totalImages: batchResults.totalImages,
      processedCount: batchResults.processedCount,
      successCount: 0,
      failedCount: 0,
      results: []
    };

    for (const imageResult of batchResults.results) {
      if (imageResult.status === 'completed') {
        report.successCount++;
        report.results.push({
          id: imageResult.id,
          altText: imageResult.result.altText,
          confidence: imageResult.result.confidence,
          visualElements: imageResult.result.visualElements.length,
          colors: imageResult.result.colors.length
        });
      } else {
        report.failedCount++;
        report.results.push({
          id: imageResult.id,
          error: imageResult.error
        });
      }
    }

    return report;
  }
}

// Example usage
async function processProductImages() {
  const processor = new BatchImageProcessor('your-api-key');
  
  // Process product images from S3
  const s3Images = [
    's3://my-bucket/products/product1.jpg',
    's3://my-bucket/products/product2.jpg',
    's3://my-bucket/products/product3.jpg'
  ];
  
  try {
    const results = await processor.processS3Images(s3Images, {
      detailLevel: 'comprehensive',
      includeAltText: true,
      generateAudio: false
    });
    
    // Generate HTML markup
    const accessibilityHTML = processor.generateAccessibilityHTML(results);
    console.log('Generated HTML:', accessibilityHTML);
    
    // Generate report
    const report = processor.generateReport(results);
    console.log('Processing Report:', report);
    
    // Save results to database or CMS
    for (const result of results.results) {
      if (result.status === 'completed') {
        await saveToDatabase({
          imageId: result.id,
          altText: result.result.altText,
          description: result.result.detailedDescription,
          metadata: result.result.htmlMetadata
        });
      }
    }
    
  } catch (error) {
    console.error('Batch processing failed:', error);
  }
}

// Process images from file upload
async function handleFileUpload(event) {
  const files = event.target.files;
  const processor = new BatchImageProcessor('your-api-key');
  
  try {
    const results = await processor.processLocalFiles(files, {
      detailLevel: 'basic',
      includeAltText: true
    });
    
    // Update UI with results
    updateUIWithResults(results);
    
  } catch (error) {
    console.error('Failed to process files:', error);
  }
}`
      }
    ]
  }
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, language } = req.query;

  // Filter by endpoint if specified
  let filteredSamples = codeSamples;
  if (endpoint && typeof endpoint === 'string') {
    filteredSamples = codeSamples.filter(s => 
      s.endpoint.toLowerCase().includes(endpoint.toLowerCase())
    );
  }

  // Filter by language if specified
  if (language && typeof language === 'string') {
    filteredSamples = filteredSamples.map(sample => ({
      ...sample,
      samples: sample.samples.filter(s => 
        s.language.toLowerCase() === language.toLowerCase()
      )
    })).filter(s => s.samples.length > 0);
  }

  res.status(200).json({
    samples: filteredSamples,
    availableLanguages: ['javascript', 'python', 'curl', 'nodejs'],
    totalSamples: codeSamples.reduce((acc, curr) => acc + curr.samples.length, 0)
  });
}