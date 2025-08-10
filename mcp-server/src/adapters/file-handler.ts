import fs from 'fs';
import path from 'path';
import os from 'os';
import { promises as fsPromises } from 'fs';
import mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';
import { logger, createLogger } from '../utils/logger.js';
import { config, filesConfig } from '../config/index.js';
import {
  FileData,
  UploadData,
  ValidationResult,
  MCPToolError,
  ErrorCode
} from '../types/index.js';

const fileLogger = createLogger('file-handler');

export class FileHandler {
  private tempDir: string;
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    this.tempDir = path.resolve(filesConfig.tempDirectory);
    this.initializeTempDirectory();
    this.setupCleanupInterval();
  }
  
  /**
   * Initialize temporary directory
   */
  private initializeTempDirectory(): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
        fileLogger.info('Created temp directory', { path: this.tempDir });
      }
      
      // Test write permissions
      const testFile = path.join(this.tempDir, '.test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      fileLogger.info('Temp directory initialized', { path: this.tempDir });
    } catch (error) {
      const err = new MCPToolError(
        ErrorCode.CONFIGURATION_ERROR,
        'Failed to initialize temp directory',
        { path: this.tempDir, error: error instanceof Error ? error.message : String(error) }
      );
      fileLogger.error('Temp directory initialization failed', err.details);
      throw err;
    }
  }
  
  /**
   * Set up periodic cleanup of temp files
   */
  private setupCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupOldFiles();
      } catch (error) {
        fileLogger.error('Periodic cleanup failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, filesConfig.cleanupInterval);
    
    fileLogger.info('Cleanup interval set', {
      interval: `${filesConfig.cleanupInterval}ms`
    });
  }
  
  /**
   * Clean up old temporary files
   */
  async cleanupOldFiles(maxAge: number = 3600000): Promise<number> { // 1 hour default
    try {
      const files = await fsPromises.readdir(this.tempDir);
      let cleanedCount = 0;
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        
        try {
          const stats = await fsPromises.stat(filePath);
          const age = now - stats.mtime.getTime();
          
          if (age > maxAge) {
            await fsPromises.unlink(filePath);
            cleanedCount++;
            fileLogger.debug('Cleaned up old temp file', {
              file,
              age: `${Math.round(age / 1000)}s`
            });
          }
        } catch (error) {
          // File might have been deleted by another process
          fileLogger.debug('Failed to clean temp file', {
            file,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      if (cleanedCount > 0) {
        fileLogger.info('Completed temp file cleanup', {
          cleanedFiles: cleanedCount,
          maxAge: `${maxAge}ms`
        });
      }
      
      return cleanedCount;
    } catch (error) {
      fileLogger.error('Temp file cleanup failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
  
  /**
   * Validate file path and accessibility
   */
  validateFilePath(filePath: string): ValidationResult {
    try {
      // Normalize path to prevent traversal attacks
      const normalizedPath = path.resolve(filePath);
      
      // Check for path traversal
      if (!normalizedPath.startsWith(path.resolve('/'))) {
        return {
          valid: false,
          error: 'Invalid file path - path traversal detected',
          details: { originalPath: filePath, normalizedPath }
        };
      }
      
      // Check if file exists
      if (!fs.existsSync(normalizedPath)) {
        return {
          valid: false,
          error: 'File does not exist',
          details: { path: normalizedPath }
        };
      }
      
      // Check if it's a file (not directory)
      const stats = fs.statSync(normalizedPath);
      if (!stats.isFile()) {
        return {
          valid: false,
          error: 'Path is not a file',
          details: { path: normalizedPath, isDirectory: stats.isDirectory() }
        };
      }
      
      // Check file permissions
      try {
        fs.accessSync(normalizedPath, fs.constants.R_OK);
      } catch {
        return {
          valid: false,
          error: 'File is not readable',
          details: { path: normalizedPath }
        };
      }
      
      // Check file size
      if (stats.size > filesConfig.maxSize) {
        return {
          valid: false,
          error: 'File exceeds maximum size limit',
          details: {
            path: normalizedPath,
            size: stats.size,
            maxSize: filesConfig.maxSize
          }
        };
      }
      
      // Check if file is empty
      if (stats.size === 0) {
        return {
          valid: false,
          error: 'File is empty',
          details: { path: normalizedPath }
        };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: 'Failed to validate file path',
        details: {
          originalPath: filePath,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
  
  /**
   * Validate file type based on MIME type
   */
  validateFileType(filePath: string, allowedTypes: string[]): ValidationResult {
    try {
      const mimeType = mime.lookup(filePath);
      
      if (!mimeType) {
        return {
          valid: false,
          error: 'Cannot determine file type',
          details: { path: filePath }
        };
      }
      
      if (!allowedTypes.includes(mimeType)) {
        return {
          valid: false,
          error: 'Unsupported file type',
          details: {
            path: filePath,
            detectedType: mimeType,
            allowedTypes
          }
        };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: 'Failed to validate file type',
        details: {
          path: filePath,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
  
  /**
   * Read file and return file data
   */
  async readFile(filePath: string): Promise<FileData> {
    // Validate file path
    const pathValidation = this.validateFilePath(filePath);
    if (!pathValidation.valid) {
      throw new MCPToolError(
        pathValidation.error?.includes('not exist') ? ErrorCode.FILE_NOT_FOUND :
        pathValidation.error?.includes('size') ? ErrorCode.FILE_TOO_LARGE :
        ErrorCode.INVALID_PARAMETERS,
        pathValidation.error!,
        pathValidation.details
      );
    }
    
    try {
      const stats = await fsPromises.stat(filePath);
      const fileName = path.basename(filePath);
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      
      fileLogger.info('Reading file', {
        path: filePath,
        size: stats.size,
        mimeType
      });
      
      // For large files, we might want to use streams
      // For now, read entire file into buffer
      const buffer = await fsPromises.readFile(filePath);
      
      fileLogger.debug('File read successfully', {
        path: filePath,
        bufferSize: buffer.length
      });
      
      return {
        buffer,
        name: fileName,
        mimeType,
        size: buffer.length
      };
    } catch (error) {
      const err = new MCPToolError(
        ErrorCode.FILE_NOT_FOUND,
        'Failed to read file',
        {
          path: filePath,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      
      fileLogger.error('File read failed', err.details);
      throw err;
    }
  }
  
  /**
   * Prepare file for video upload (handles large files with streaming)
   */
  async prepareVideoUpload(filePath: string): Promise<UploadData & { name: string; mimeType: string }> {
    // Validate file path
    const pathValidation = this.validateFilePath(filePath);
    if (!pathValidation.valid) {
      throw new MCPToolError(
        pathValidation.error?.includes('not exist') ? ErrorCode.FILE_NOT_FOUND :
        pathValidation.error?.includes('size') ? ErrorCode.FILE_TOO_LARGE :
        ErrorCode.INVALID_PARAMETERS,
        pathValidation.error!,
        pathValidation.details
      );
    }
    
    // Validate file type
    const typeValidation = this.validateFileType(filePath, filesConfig.allowedVideoTypes);
    if (!typeValidation.valid) {
      throw new MCPToolError(
        ErrorCode.UNSUPPORTED_FORMAT,
        typeValidation.error!,
        typeValidation.details
      );
    }
    
    try {
      const stats = await fsPromises.stat(filePath);
      const fileName = path.basename(filePath);
      const mimeType = mime.lookup(filePath) || 'video/mp4';
      
      fileLogger.info('Preparing video upload', {
        path: filePath,
        size: stats.size,
        mimeType
      });
      
      // Threshold for using streams vs buffers (10MB)
      const streamThreshold = 10 * 1024 * 1024;
      
      if (stats.size > streamThreshold) {
        // Use stream for large files
        const stream = fs.createReadStream(filePath);
        
        return {
          stream,
          size: stats.size,
          name: fileName,
          mimeType,
          mimetype: mimeType
        };
      } else {
        // Use buffer for smaller files
        const buffer = await fsPromises.readFile(filePath);
        
        return {
          buffer,
          size: buffer.length,
          name: fileName,
          mimeType,
          mimetype: mimeType
        };
      }
    } catch (error) {
      const err = new MCPToolError(
        ErrorCode.FILE_NOT_FOUND,
        'Failed to prepare video upload',
        {
          path: filePath,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      
      fileLogger.error('Video upload preparation failed', err.details);
      throw err;
    }
  }
  
  /**
   * Save data to temporary file
   */
  async saveToTemp(
    data: Buffer,
    extension: string,
    prefix: string = 'mcp'
  ): Promise<string> {
    try {
      const fileName = `${prefix}-${uuidv4()}${extension}`;
      const filePath = path.join(this.tempDir, fileName);
      
      await fsPromises.writeFile(filePath, data);
      
      fileLogger.debug('Saved data to temp file', {
        path: filePath,
        size: data.length
      });
      
      return filePath;
    } catch (error) {
      const err = new MCPToolError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to save data to temp file',
        {
          error: error instanceof Error ? error.message : String(error)
        }
      );
      
      fileLogger.error('Temp file save failed', err.details);
      throw err;
    }
  }
  
  /**
   * Save results to specified directory or temp
   */
  async saveResults(
    data: Buffer | string,
    jobId: string,
    format: string,
    saveToPath?: string
  ): Promise<string> {
    try {
      const fileName = `${jobId}.${format}`;
      const outputDir = saveToPath || this.tempDir;
      
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        await fsPromises.mkdir(outputDir, { recursive: true });
      }
      
      const outputPath = path.join(outputDir, fileName);
      
      if (typeof data === 'string') {
        await fsPromises.writeFile(outputPath, data, 'utf8');
      } else {
        await fsPromises.writeFile(outputPath, data);
      }
      
      const stats = await fsPromises.stat(outputPath);
      
      fileLogger.info('Saved results to file', {
        jobId,
        format,
        path: outputPath,
        size: stats.size
      });
      
      return outputPath;
    } catch (error) {
      const err = new MCPToolError(
        ErrorCode.INTERNAL_ERROR,
        'Failed to save results',
        {
          jobId,
          format,
          saveToPath,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      
      fileLogger.error('Results save failed', err.details);
      throw err;
    }
  }
  
  /**
   * Get file information without reading contents
   */
  async getFileInfo(filePath: string): Promise<{
    exists: boolean;
    size?: number;
    mimeType?: string;
    name: string;
    extension: string;
    lastModified?: Date;
  }> {
    try {
      const exists = fs.existsSync(filePath);
      const name = path.basename(filePath);
      const extension = path.extname(filePath);
      
      if (!exists) {
        return { exists: false, name, extension };
      }
      
      const stats = await fsPromises.stat(filePath);
      const mimeType = mime.lookup(filePath) || undefined;
      
      return {
        exists: true,
        size: stats.size,
        mimeType,
        name,
        extension,
        lastModified: stats.mtime
      };
    } catch (error) {
      fileLogger.warn('Failed to get file info', {
        path: filePath,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        exists: false,
        name: path.basename(filePath),
        extension: path.extname(filePath)
      };
    }
  }
  
  /**
   * Delete temporary file
   */
  async deleteTempFile(filePath: string): Promise<void> {
    try {
      // Only delete files in temp directory for safety
      const normalizedPath = path.resolve(filePath);
      const tempDirPath = path.resolve(this.tempDir);
      
      if (!normalizedPath.startsWith(tempDirPath)) {
        fileLogger.warn('Attempted to delete file outside temp directory', {
          path: filePath,
          normalized: normalizedPath,
          tempDir: tempDirPath
        });
        return;
      }
      
      if (fs.existsSync(normalizedPath)) {
        await fsPromises.unlink(normalizedPath);
        fileLogger.debug('Deleted temp file', { path: normalizedPath });
      }
    } catch (error) {
      fileLogger.warn('Failed to delete temp file', {
        path: filePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Get temp directory path
   */
  getTempDirectory(): string {
    return this.tempDir;
  }
  
  /**
   * Get disk usage statistics
   */
  async getDiskUsage(): Promise<{
    tempDirSize: number;
    tempFileCount: number;
    systemStats?: {
      total: number;
      free: number;
      used: number;
    };
  }> {
    try {
      const files = await fsPromises.readdir(this.tempDir);
      let totalSize = 0;
      let fileCount = 0;
      
      for (const file of files) {
        try {
          const stats = await fsPromises.stat(path.join(this.tempDir, file));
          if (stats.isFile()) {
            totalSize += stats.size;
            fileCount++;
          }
        } catch (error) {
          // File might have been deleted, skip it
        }
      }
      
      return {
        tempDirSize: totalSize,
        tempFileCount: fileCount
      };
    } catch (error) {
      fileLogger.warn('Failed to get disk usage', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        tempDirSize: 0,
        tempFileCount: 0
      };
    }
  }
  
  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Final cleanup
    await this.cleanupOldFiles(0); // Delete all temp files
    
    fileLogger.info('File handler shutdown complete');
  }
}