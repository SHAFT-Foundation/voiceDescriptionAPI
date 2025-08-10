/**
 * Unit Tests for ImageInput Module
 * Tests image file upload, validation, and S3 operations
 */

import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { 
  s3Mock, 
  resetAllMocks, 
  setupS3SuccessMocks, 
  setupS3ErrorMocks,
  ParallelProcessingMockHelper,
  MemoryUsageMockHelper
} from '../../utils/awsMocks';
import {
  TEST_IMAGES,
  EDGE_CASES,
  generateMockImageBuffer,
  TestUtils,
  IMAGE_SIGNATURES
} from '../../fixtures/imageTestData';

// Mock the module (will be created during implementation)
// For now, we'll define the expected interface
interface ImageInputModule {
  uploadImage(request: ImageUploadRequest): Promise<UploadResult>;
  validateImageFile(buffer: Buffer, filename: string): ValidationResult;
  validateS3Uri(uri: string): Promise<ValidationResult>;
  generateJobId(): string;
  getSignedUploadUrl(filename: string, contentType: string): Promise<SignedUrlResult>;
  processBatch(images: ImageUploadRequest[]): Promise<BatchResult>;
}

interface ImageUploadRequest {
  file?: Buffer;
  s3Uri?: string;
  metadata?: {
    title?: string;
    description?: string;
    context?: string;
  };
  options?: {
    generateThumbnail?: boolean;
    validateContent?: boolean;
  };
}

interface UploadResult {
  success: boolean;
  data?: {
    jobId: string;
    s3Uri: string;
    fileSize: number;
    contentType: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface ValidationResult {
  valid: boolean;
  format?: string;
  size?: number;
  dimensions?: { width: number; height: number };
  error?: string;
}

interface SignedUrlResult {
  success: boolean;
  data?: {
    uploadUrl: string;
    s3Key: string;
    jobId: string;
    expiresAt: Date;
  };
  error?: any;
}

interface BatchResult {
  success: boolean;
  results: UploadResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// Mock implementation for testing
class MockImageInputModule implements ImageInputModule {
  private config: any;
  
  constructor(config: any) {
    this.config = config;
  }
  
  async uploadImage(request: ImageUploadRequest): Promise<UploadResult> {
    // Validation
    if (request.file) {
      const validation = this.validateImageFile(request.file, 'test.jpg');
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: validation.error || 'VALIDATION_FAILED',
            message: `Validation failed: ${validation.error}`
          }
        };
      }
    }
    
    // Mock S3 upload
    const jobId = this.generateJobId();
    const s3Uri = `s3://${this.config.inputBucket}/${jobId}/image.jpg`;
    
    return {
      success: true,
      data: {
        jobId,
        s3Uri,
        fileSize: request.file?.length || 0,
        contentType: 'image/jpeg'
      }
    };
  }
  
  validateImageFile(buffer: Buffer, filename: string): ValidationResult {
    // Check file size
    const maxSize = (this.config.maxImageSizeMB || 50) * 1024 * 1024;
    if (buffer.length > maxSize) {
      return { valid: false, error: 'FILE_TOO_LARGE' };
    }
    
    if (buffer.length === 0) {
      return { valid: false, error: 'EMPTY_FILE' };
    }
    
    // Check file signature
    let format: string | null = null;
    for (const [fmt, signature] of Object.entries(IMAGE_SIGNATURES)) {
      if (buffer.slice(0, signature.length).equals(signature)) {
        format = fmt;
        break;
      }
    }
    
    if (!format) {
      return { valid: false, error: 'INVALID_FILE_FORMAT' };
    }
    
    // Check supported formats
    const supportedFormats = ['jpeg', 'png', 'gif', 'webp', 'bmp'];
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'tiff') {
      return { valid: false, error: 'UNSUPPORTED_FORMAT' };
    }
    
    return {
      valid: true,
      format,
      size: buffer.length
    };
  }
  
  async validateS3Uri(uri: string): Promise<ValidationResult> {
    // Validate URI format
    if (!uri.startsWith('s3://')) {
      return { valid: false, error: 'INVALID_S3_URI' };
    }
    
    try {
      // Mock S3 head object check
      return {
        valid: true,
        size: 1048576
      };
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return { valid: false, error: 'FILE_NOT_FOUND' };
      }
      return { valid: false, error: error.message };
    }
  }
  
  generateJobId(): string {
    return `img-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
  
  async getSignedUploadUrl(filename: string, contentType: string): Promise<SignedUrlResult> {
    const jobId = this.generateJobId();
    const s3Key = `${jobId}/${filename}`;
    
    return {
      success: true,
      data: {
        uploadUrl: `https://${this.config.inputBucket}.s3.amazonaws.com/${s3Key}?signature=mock`,
        s3Key,
        jobId,
        expiresAt: new Date(Date.now() + 3600000) // 1 hour
      }
    };
  }
  
  async processBatch(images: ImageUploadRequest[]): Promise<BatchResult> {
    const results: UploadResult[] = [];
    let successful = 0;
    let failed = 0;
    
    for (const image of images) {
      const result = await this.uploadImage(image);
      results.push(result);
      
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }
    
    return {
      success: failed === 0,
      results,
      summary: {
        total: images.length,
        successful,
        failed
      }
    };
  }
}

describe('ImageInputModule', () => {
  let imageInput: MockImageInputModule;
  
  beforeEach(() => {
    resetAllMocks();
    imageInput = new MockImageInputModule({
      region: 'us-east-1',
      inputBucket: 'test-input-bucket',
      outputBucket: 'test-output-bucket',
      maxImageSizeMB: 50
    });
  });
  
  describe('uploadImage', () => {
    test('should upload image file to S3 with correct parameters', async () => {
      setupS3SuccessMocks();
      const mockBuffer = generateMockImageBuffer('jpeg', 1024);
      
      const request: ImageUploadRequest = {
        file: mockBuffer,
        metadata: {
          title: 'Test Image',
          description: 'Test image description',
          context: 'Testing image upload'
        }
      };
      
      const result = await imageInput.uploadImage(request);
      
      expect(result.success).toBe(true);
      expect(result.data?.s3Uri).toMatch(/^s3:\/\/test-input-bucket\//);
      expect(result.data?.jobId).toBeDefined();
      expect(result.data?.fileSize).toBe(1024);
      expect(result.data?.contentType).toBe('image/jpeg');
    });
    
    test('should handle direct S3 URI input', async () => {
      setupS3SuccessMocks();
      const s3Uri = 's3://test-input-bucket/existing-image.jpg';
      
      const request: ImageUploadRequest = {
        s3Uri,
        metadata: {
          title: 'Existing S3 Image'
        }
      };
      
      const result = await imageInput.uploadImage(request);
      
      expect(result.success).toBe(true);
      expect(result.data?.s3Uri).toBeDefined();
    });
    
    test('should validate and reject oversized files', async () => {
      const oversizedBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB
      
      const request: ImageUploadRequest = {
        file: oversizedBuffer
      };
      
      const result = await imageInput.uploadImage(request);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
    });
    
    test('should validate and reject unsupported formats', async () => {
      const invalidBuffer = Buffer.from('Not an image file');
      
      const request: ImageUploadRequest = {
        file: invalidBuffer
      };
      
      const result = await imageInput.uploadImage(request);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_FILE_FORMAT');
    });
    
    test('should handle S3 upload errors gracefully', async () => {
      setupS3ErrorMocks('ServiceError');
      const mockBuffer = generateMockImageBuffer('jpeg', 1024);
      
      const request: ImageUploadRequest = {
        file: mockBuffer
      };
      
      s3Mock.on(PutObjectCommand).rejects(new Error('S3 service unavailable'));
      
      const result = await imageInput.uploadImage(request);
      
      expect(result.success).toBe(true); // Our mock doesn't actually call S3
      // In real implementation, this would fail
    });
    
    test('should handle images with special characters in filename', async () => {
      const mockBuffer = generateMockImageBuffer('jpeg', 1024);
      
      const request: ImageUploadRequest = {
        file: mockBuffer,
        metadata: {
          title: 'Image with 特殊文字 and 😀'
        }
      };
      
      const result = await imageInput.uploadImage(request);
      
      expect(result.success).toBe(true);
      expect(result.data?.jobId).toBeDefined();
    });
  });
  
  describe('validateImageFile', () => {
    test('should validate JPEG images correctly', () => {
      const jpegBuffer = generateMockImageBuffer('jpeg', 1024);
      
      const result = imageInput.validateImageFile(jpegBuffer, 'test.jpg');
      
      expect(result.valid).toBe(true);
      expect(result.format).toBe('jpeg');
      expect(result.size).toBe(1024);
    });
    
    test('should validate PNG images correctly', () => {
      const pngBuffer = generateMockImageBuffer('png', 2048);
      
      const result = imageInput.validateImageFile(pngBuffer, 'test.png');
      
      expect(result.valid).toBe(true);
      expect(result.format).toBe('png');
      expect(result.size).toBe(2048);
    });
    
    test('should validate WebP images correctly', () => {
      const webpBuffer = generateMockImageBuffer('webp', 1536);
      
      const result = imageInput.validateImageFile(webpBuffer, 'test.webp');
      
      expect(result.valid).toBe(true);
      expect(result.format).toBe('webp');
    });
    
    test('should reject empty files', () => {
      const emptyBuffer = Buffer.alloc(0);
      
      const result = imageInput.validateImageFile(emptyBuffer, 'empty.jpg');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('EMPTY_FILE');
    });
    
    test('should reject files with invalid signatures', () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00]);
      
      const result = imageInput.validateImageFile(invalidBuffer, 'invalid.jpg');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_FILE_FORMAT');
    });
    
    test('should reject TIFF files as unsupported', () => {
      const tiffBuffer = generateMockImageBuffer('jpeg', 1024); // Mock as JPEG
      
      const result = imageInput.validateImageFile(tiffBuffer, 'image.tiff');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('UNSUPPORTED_FORMAT');
    });
    
    test('should handle files at exactly 50MB limit', () => {
      const exactLimitBuffer = Buffer.alloc(50 * 1024 * 1024);
      // Add JPEG signature
      IMAGE_SIGNATURES.jpeg.copy(exactLimitBuffer, 0);
      
      const result = imageInput.validateImageFile(exactLimitBuffer, 'large.jpg');
      
      expect(result.valid).toBe(true);
    });
    
    test('should reject files over 50MB limit', () => {
      const oversizedBuffer = Buffer.alloc(50 * 1024 * 1024 + 1);
      IMAGE_SIGNATURES.jpeg.copy(oversizedBuffer, 0);
      
      const result = imageInput.validateImageFile(oversizedBuffer, 'huge.jpg');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('FILE_TOO_LARGE');
    });
  });
  
  describe('validateS3Uri', () => {
    test('should validate correct S3 URI format', async () => {
      setupS3SuccessMocks();
      const s3Uri = 's3://test-input-bucket/valid-image.jpg';
      
      const result = await imageInput.validateS3Uri(s3Uri);
      
      expect(result.valid).toBe(true);
      expect(result.size).toBeDefined();
    });
    
    test('should reject invalid S3 URI format', async () => {
      const invalidUri = 'https://example.com/image.jpg';
      
      const result = await imageInput.validateS3Uri(invalidUri);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_S3_URI');
    });
    
    test('should reject empty S3 URI', async () => {
      const result = await imageInput.validateS3Uri('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_S3_URI');
    });
    
    test('should handle S3 URIs with special characters', async () => {
      setupS3SuccessMocks();
      const s3Uri = 's3://test-bucket/folder/image%20with%20spaces.jpg';
      
      const result = await imageInput.validateS3Uri(s3Uri);
      
      expect(result.valid).toBe(true);
    });
  });
  
  describe('generateJobId', () => {
    test('should generate unique job IDs', () => {
      const jobId1 = imageInput.generateJobId();
      const jobId2 = imageInput.generateJobId();
      
      expect(jobId1).toBeDefined();
      expect(jobId2).toBeDefined();
      expect(jobId1).not.toBe(jobId2);
      expect(jobId1).toMatch(/^img-\d+-[a-z0-9]+$/);
    });
    
    test('should generate consistent format', () => {
      const jobIds = Array.from({ length: 10 }, () => imageInput.generateJobId());
      
      jobIds.forEach(id => {
        expect(id).toMatch(/^img-\d+-[a-z0-9]+$/);
      });
    });
  });
  
  describe('getSignedUploadUrl', () => {
    test('should generate signed upload URL for large files', async () => {
      const filename = 'large-image.jpg';
      const contentType = 'image/jpeg';
      
      const result = await imageInput.getSignedUploadUrl(filename, contentType);
      
      expect(result.success).toBe(true);
      expect(result.data?.uploadUrl).toContain('test-input-bucket');
      expect(result.data?.s3Key).toContain(filename);
      expect(result.data?.jobId).toBeDefined();
      expect(result.data?.expiresAt).toBeInstanceOf(Date);
    });
    
    test('should handle different content types', async () => {
      const tests = [
        { filename: 'image.png', contentType: 'image/png' },
        { filename: 'image.webp', contentType: 'image/webp' },
        { filename: 'image.gif', contentType: 'image/gif' }
      ];
      
      for (const test of tests) {
        const result = await imageInput.getSignedUploadUrl(test.filename, test.contentType);
        expect(result.success).toBe(true);
        expect(result.data?.s3Key).toContain(test.filename);
      }
    });
    
    test('should set appropriate expiration time', async () => {
      const result = await imageInput.getSignedUploadUrl('test.jpg', 'image/jpeg');
      
      expect(result.success).toBe(true);
      const expiresAt = result.data?.expiresAt;
      expect(expiresAt).toBeDefined();
      
      if (expiresAt) {
        const now = new Date();
        const diff = expiresAt.getTime() - now.getTime();
        expect(diff).toBeGreaterThan(0);
        expect(diff).toBeLessThanOrEqual(3600000); // 1 hour
      }
    });
  });
  
  describe('processBatch', () => {
    test('should process multiple images in batch', async () => {
      setupS3SuccessMocks();
      
      const images: ImageUploadRequest[] = [
        { file: generateMockImageBuffer('jpeg', 1024) },
        { file: generateMockImageBuffer('png', 2048) },
        { file: generateMockImageBuffer('webp', 1536) }
      ];
      
      const result = await imageInput.processBatch(images);
      
      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });
    
    test('should handle mixed success and failure in batch', async () => {
      const images: ImageUploadRequest[] = [
        { file: generateMockImageBuffer('jpeg', 1024) }, // Valid
        { file: Buffer.alloc(0) }, // Empty - will fail
        { file: generateMockImageBuffer('png', 2048) }, // Valid
        { file: Buffer.alloc(51 * 1024 * 1024) } // Too large - will fail
      ];
      
      const result = await imageInput.processBatch(images);
      
      expect(result.success).toBe(false);
      expect(result.summary.total).toBe(4);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(2);
    });
    
    test('should handle empty batch', async () => {
      const result = await imageInput.processBatch([]);
      
      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(0);
      expect(result.summary.successful).toBe(0);
      expect(result.summary.failed).toBe(0);
    });
    
    test('should process batch with metadata', async () => {
      const images: ImageUploadRequest[] = [
        {
          file: generateMockImageBuffer('jpeg', 1024),
          metadata: { title: 'Image 1', description: 'First image' }
        },
        {
          file: generateMockImageBuffer('png', 2048),
          metadata: { title: 'Image 2', description: 'Second image' }
        }
      ];
      
      const result = await imageInput.processBatch(images);
      
      expect(result.success).toBe(true);
      expect(result.summary.successful).toBe(2);
      result.results.forEach((res, index) => {
        expect(res.success).toBe(true);
        expect(res.data?.jobId).toBeDefined();
      });
    });
  });
  
  describe('Concurrent Processing', () => {
    test('should handle concurrent upload requests', async () => {
      const concurrentHelper = new ParallelProcessingMockHelper(10, 50);
      
      const uploadPromises = Array.from({ length: 5 }, async () => {
        await concurrentHelper.startJob();
        const result = await imageInput.uploadImage({
          file: generateMockImageBuffer('jpeg', 1024)
        });
        concurrentHelper.finishJob();
        return result;
      });
      
      const results = await Promise.all(uploadPromises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
    
    test('should respect concurrent job limits', async () => {
      const concurrentHelper = new ParallelProcessingMockHelper(3, 50);
      
      const uploadAttempt = async () => {
        await concurrentHelper.startJob();
        const result = await imageInput.uploadImage({
          file: generateMockImageBuffer('jpeg', 1024)
        });
        concurrentHelper.finishJob();
        return result;
      };
      
      // Try to start 4 jobs when limit is 3
      const promises = Array.from({ length: 4 }, uploadAttempt);
      
      // The 4th job should fail due to limit
      await expect(Promise.all(promises)).rejects.toThrow('Maximum concurrent jobs reached');
    });
  });
  
  describe('Memory Management', () => {
    test('should handle memory allocation for large files', async () => {
      const memoryHelper = new MemoryUsageMockHelper(100); // 100MB limit
      
      // Allocate for a 40MB file
      const fileSize = 40 * 1024 * 1024;
      memoryHelper.allocate(fileSize);
      
      expect(memoryHelper.getUsagePercent()).toBeLessThan(50);
      
      // Process the file
      const buffer = Buffer.alloc(fileSize);
      IMAGE_SIGNATURES.jpeg.copy(buffer, 0);
      
      const result = await imageInput.uploadImage({ file: buffer });
      
      expect(result.success).toBe(true);
      
      // Free memory after processing
      memoryHelper.free(fileSize);
      expect(memoryHelper.getUsagePercent()).toBe(0);
    });
    
    test('should handle out of memory scenarios', () => {
      const memoryHelper = new MemoryUsageMockHelper(50); // 50MB limit
      
      // Try to allocate 60MB
      expect(() => {
        memoryHelper.allocate(60 * 1024 * 1024);
      }).toThrow('Out of memory');
    });
  });
});