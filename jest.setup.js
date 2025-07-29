import '@testing-library/jest-dom'

// Mock AWS SDK modules
jest.mock('@aws-sdk/client-s3')
jest.mock('@aws-sdk/client-rekognition')
jest.mock('@aws-sdk/client-bedrock-runtime')
jest.mock('@aws-sdk/client-polly')
jest.mock('@aws-sdk/client-cloudwatch-logs')

// Mock FFmpeg
jest.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = jest.fn(() => ({
    input: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    seekInput: jest.fn().mockReturnThis(),
    duration: jest.fn().mockReturnThis(),
    run: jest.fn((callback) => callback && callback()),
    on: jest.fn().mockReturnThis(),
    save: jest.fn().mockReturnThis()
  }))
  mockFfmpeg.ffprobe = jest.fn()
  return mockFfmpeg
})

// Global test utilities
global.createMockS3Client = () => ({
  send: jest.fn()
})

global.createMockRekognitionClient = () => ({
  send: jest.fn()
})

global.createMockBedrockClient = () => ({
  send: jest.fn()
})

global.createMockPollyClient = () => ({
  send: jest.fn()
})

// Setup test environment variables
process.env.NODE_ENV = 'test'
process.env.AWS_REGION = 'us-east-1'
process.env.INPUT_S3_BUCKET = 'test-input-bucket'
process.env.OUTPUT_S3_BUCKET = 'test-output-bucket'
process.env.NOVA_MODEL_ID = 'amazon.nova-pro-v1:0'
process.env.POLLY_VOICE_ID = 'Joanna'
process.env.MAX_VIDEO_SIZE_MB = '500'
process.env.PROCESSING_TIMEOUT_MINUTES = '30'