/**
 * Test Data Fixtures for MCP Server Testing
 */

// Sample video metadata
export const sampleVideoMetadata = {
  filename: 'sample-video.mp4',
  mimeType: 'video/mp4',
  size: 10485760, // 10MB
  duration: 30, // seconds
  width: 1920,
  height: 1080,
  fps: 30,
  codec: 'h264',
};

// Sample image metadata
export const sampleImageMetadata = {
  filename: 'sample-image.jpg',
  mimeType: 'image/jpeg',
  size: 2097152, // 2MB
  width: 1920,
  height: 1080,
  format: 'jpeg',
};

// Sample job responses
export const sampleJobs = {
  pending: {
    jobId: '550e8400-e29b-41d4-a716-446655440000',
    status: 'pending',
    progress: 0,
    step: 'initialization',
    message: 'Job queued for processing',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },

  processing: {
    jobId: '550e8400-e29b-41d4-a716-446655440001',
    status: 'processing',
    progress: 45,
    step: 'segmentation',
    message: 'Analyzing video segments',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:05:00Z',
    estimatedCompletion: '2024-01-01T00:15:00Z',
  },

  completed: {
    jobId: '550e8400-e29b-41d4-a716-446655440002',
    status: 'completed',
    progress: 100,
    step: null,
    message: 'Processing completed successfully',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:10:00Z',
    completedAt: '2024-01-01T00:10:00Z',
    results: {
      textUrl: 'https://api.example.com/results/550e8400-e29b-41d4-a716-446655440002/text',
      audioUrl: 'https://api.example.com/results/550e8400-e29b-41d4-a716-446655440002/audio',
      metadata: {
        scenes: 5,
        duration: 30,
        wordsGenerated: 250,
        audioLength: 28.5,
      },
    },
  },

  failed: {
    jobId: '550e8400-e29b-41d4-a716-446655440003',
    status: 'failed',
    progress: 0,
    step: 'segmentation',
    message: 'Failed to process video',
    error: {
      code: 'VIDEO_PROCESSING_ERROR',
      message: 'Unable to extract video segments',
      details: 'FFmpeg error: Invalid video format',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:05:00Z',
    failedAt: '2024-01-01T00:05:00Z',
  },
};

// Sample text descriptions
export const sampleDescriptions = {
  short: `Scene 1 (0:00-0:05):
A professional presenter stands in a modern studio setting.

Scene 2 (0:05-0:10):
Wide shot reveals a cityscape through floor-to-ceiling windows.`,

  medium: `Scene 1 (0:00-0:05):
A professional presenter in business attire stands confidently in a modern studio setting. The background features soft lighting and minimalist decor with clean lines and neutral colors.

Scene 2 (0:05-0:10):
The camera pulls back to reveal a panoramic view of the city skyline through floor-to-ceiling windows. Natural light floods the space, creating dramatic shadows across the polished floor.

Scene 3 (0:10-0:15):
Close-up on the presenter's hands as they gesture expressively while speaking. A tablet device is visible on the sleek glass table, displaying colorful charts and graphs.`,

  long: `Scene 1 (0:00-0:05):
The video opens with a medium shot of a professional presenter standing in the center of a modern, well-lit studio. The presenter, dressed in a navy blue suit with a crisp white shirt, maintains direct eye contact with the camera. Behind them, the studio features a minimalist design with soft, diffused lighting that creates a warm, inviting atmosphere. The walls are painted in neutral tones, and abstract artwork adds visual interest without being distracting.

Scene 2 (0:05-0:10):
As the camera slowly pulls back in a smooth tracking shot, the full scope of the impressive studio space is revealed. Floor-to-ceiling windows dominate the far wall, offering a breathtaking panoramic view of the city skyline. The late afternoon sun casts long, dramatic shadows across the polished concrete floor, creating a dynamic interplay of light and shadow. The urban landscape outside features a mix of modern glass towers and historic buildings, suggesting a thriving metropolitan area.

Scene 3 (0:10-0:15):
The shot transitions to an intimate close-up of the presenter's hands as they gesture expressively while explaining a complex concept. Their movements are deliberate and confident, emphasizing key points. On the sleek glass table in front of them, a state-of-the-art tablet device displays an interactive dashboard with colorful charts, graphs, and real-time data visualizations. The screen shows quarterly performance metrics with upward trending lines in vibrant blues and greens.

Scene 4 (0:15-0:20):
The camera angle shifts to a three-quarter view, capturing both the presenter and a large wall-mounted display screen that has just illuminated behind them. The screen shows a sophisticated presentation slide with the company logo and key bullet points appearing with subtle animation effects. The presenter turns slightly to reference the information on screen while maintaining engagement with the audience.

Scene 5 (0:20-0:30):
In the final scene, the camera executes a slow circular dolly movement around the presenter, creating a dynamic and engaging visual. As the camera moves, different angles reveal various aspects of the studio: high-tech equipment discretely positioned, plants that add a touch of nature, and the city lights beginning to twinkle as dusk approaches outside. The presenter concludes their message with a confident smile and a professional nod to the camera.`,
};

// Sample batch processing data
export const sampleBatchData = {
  images: [
    {
      id: 'img-001',
      filename: 'landscape-1.jpg',
      status: 'completed',
      description: 'A serene mountain landscape with snow-capped peaks reflecting in a crystal-clear alpine lake.',
      audioUrl: 'https://api.example.com/batch/audio/img-001.mp3',
    },
    {
      id: 'img-002',
      filename: 'portrait-1.jpg',
      status: 'completed',
      description: 'Portrait of a smiling person in professional attire against a neutral background.',
      audioUrl: 'https://api.example.com/batch/audio/img-002.mp3',
    },
    {
      id: 'img-003',
      filename: 'abstract-1.jpg',
      status: 'completed',
      description: 'Abstract geometric patterns in vibrant colors creating a dynamic visual composition.',
      audioUrl: 'https://api.example.com/batch/audio/img-003.mp3',
    },
  ],
  summary: {
    total: 3,
    processed: 3,
    failed: 0,
    duration: 4500, // ms
    averageProcessingTime: 1500, // ms per image
  },
};

// Sample AWS service responses
export const sampleAWSResponses = {
  s3: {
    upload: {
      ETag: '"9bb58f26192e4ba00f01e2e7b136bbd8"',
      ServerSideEncryption: 'AES256',
      VersionId: 'psM2sYY4.o1501dSx8wMvnkOzSBB.V4a',
      Location: 'https://voice-description-bucket.s3.amazonaws.com/videos/sample.mp4',
      Key: 'videos/sample.mp4',
      Bucket: 'voice-description-bucket',
    },
    download: {
      Body: Buffer.from('sample file content'),
      ContentType: 'video/mp4',
      ContentLength: 10485760,
      LastModified: new Date('2024-01-01T00:00:00Z'),
      ETag: '"9bb58f26192e4ba00f01e2e7b136bbd8"',
    },
  },

  rekognition: {
    startSegment: {
      JobId: 'rek-job-123456789',
    },
    getSegment: {
      JobStatus: 'SUCCEEDED',
      StatusMessage: 'Segment detection completed',
      VideoMetadata: {
        Codec: 'h264',
        DurationMillis: 30000,
        Format: 'QuickTime / MOV',
        FrameRate: 30,
        FrameHeight: 1080,
        FrameWidth: 1920,
      },
      Segments: [
        {
          Type: 'SHOT',
          StartTimestampMillis: 0,
          EndTimestampMillis: 5000,
          DurationMillis: 5000,
          StartTimecodeSMPTE: '00:00:00:00',
          EndTimecodeSMPTE: '00:00:05:00',
          DurationSMPTE: '00:00:05:00',
          ShotSegment: {
            Index: 0,
            Confidence: 99.5,
          },
        },
        {
          Type: 'SHOT',
          StartTimestampMillis: 5000,
          EndTimestampMillis: 10000,
          DurationMillis: 5000,
          StartTimecodeSMPTE: '00:00:05:00',
          EndTimecodeSMPTE: '00:00:10:00',
          DurationSMPTE: '00:00:05:00',
          ShotSegment: {
            Index: 1,
            Confidence: 98.7,
          },
        },
      ],
      NextToken: null,
    },
  },

  bedrock: {
    invoke: {
      body: JSON.stringify({
        completion: 'A modern office environment with natural lighting and contemporary furniture. The scene conveys professionalism and innovation.',
        usage: {
          input_tokens: 150,
          output_tokens: 25,
          total_tokens: 175,
        },
      }),
      contentType: 'application/json',
    },
  },

  polly: {
    synthesize: {
      AudioStream: Buffer.from('mock audio data'),
      ContentType: 'audio/mpeg',
      RequestCharacters: 250,
    },
    voices: {
      Voices: [
        {
          Gender: 'Female',
          Id: 'Joanna',
          LanguageCode: 'en-US',
          LanguageName: 'US English',
          Name: 'Joanna',
          SupportedEngines: ['neural', 'standard'],
        },
        {
          Gender: 'Male',
          Id: 'Matthew',
          LanguageCode: 'en-US',
          LanguageName: 'US English',
          Name: 'Matthew',
          SupportedEngines: ['neural', 'standard'],
        },
      ],
    },
  },
};

// Sample error responses
export const sampleErrors = {
  validation: {
    error: true,
    code: 'VALIDATION_ERROR',
    message: 'Invalid input parameters',
    details: {
      field: 'file',
      reason: 'File size exceeds maximum limit of 100MB',
    },
  },

  authentication: {
    error: true,
    code: 'AUTH_ERROR',
    message: 'Authentication failed',
    details: 'Invalid or expired API key',
  },

  rateLimit: {
    error: true,
    code: 'RATE_LIMIT_ERROR',
    message: 'Rate limit exceeded',
    details: {
      limit: 100,
      remaining: 0,
      resetAt: '2024-01-01T01:00:00Z',
    },
  },

  serverError: {
    error: true,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    details: 'Please try again later or contact support',
  },

  timeout: {
    error: true,
    code: 'TIMEOUT_ERROR',
    message: 'Request timeout',
    details: 'The operation took too long to complete',
  },
};

// Sample performance metrics
export const sampleMetrics = {
  apiLatency: {
    upload: { p50: 250, p95: 500, p99: 1000, avg: 280 },
    process: { p50: 150, p95: 300, p99: 500, avg: 170 },
    status: { p50: 50, p95: 100, p99: 200, avg: 60 },
    download: { p50: 100, p95: 200, p99: 400, avg: 120 },
  },

  throughput: {
    requestsPerSecond: 85,
    bytesPerSecond: 10485760, // 10MB/s
    concurrentConnections: 45,
    activeJobs: 12,
  },

  resources: {
    cpuUsage: 65,
    memoryUsage: 512, // MB
    diskUsage: 2048, // MB
    networkIn: 100, // Mbps
    networkOut: 50, // Mbps
  },
};

// Sample configuration
export const sampleConfig = {
  api: {
    baseUrl: 'https://api.voicedescription.com',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    maxConcurrentRequests: 10,
  },

  limits: {
    maxFileSize: 104857600, // 100MB
    maxBatchSize: 10,
    maxDescriptionLength: 5000,
    maxProcessingTime: 300000, // 5 minutes
  },

  aws: {
    region: 'us-east-1',
    s3Bucket: 'voice-description-bucket',
    rekognitionConfidence: 80,
    bedrockModel: 'anthropic.claude-v2',
    pollyVoice: 'Joanna',
  },

  features: {
    enableCache: true,
    enableMetrics: true,
    enableRateLimit: true,
    enableCompression: true,
    enableLogging: true,
  },
};

// Export all fixtures
export default {
  sampleVideoMetadata,
  sampleImageMetadata,
  sampleJobs,
  sampleDescriptions,
  sampleBatchData,
  sampleAWSResponses,
  sampleErrors,
  sampleMetrics,
  sampleConfig,
};