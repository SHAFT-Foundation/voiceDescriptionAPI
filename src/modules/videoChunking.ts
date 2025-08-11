import { 
  APIResponse,
  VideoChunk,
  VideoChunkingOptions,
  VideoChunkingResult
} from '../types';
import { logger } from '../utils/logger';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const execAsync = promisify(require('child_process').exec);

export class VideoChunkingModule {
  private s3Client: S3Client;
  private tempDir: string;
  private maxChunkSize: number;
  private chunkDuration: number;
  private outputBucket: string;

  constructor(config: { region: string; outputBucket: string }) {
    this.s3Client = new S3Client({ region: config.region });
    this.outputBucket = config.outputBucket;
    
    // Configuration
    this.tempDir = process.env.TEMP_DIR || '/tmp/video-chunks';
    this.maxChunkSize = parseInt(process.env.OPENAI_CHUNK_SIZE_MB || '20') * 1024 * 1024;
    this.chunkDuration = parseInt(process.env.OPENAI_CHUNK_DURATION_SECONDS || '30');
  }

  /**
   * Chunk video into smaller segments for OpenAI processing
   */
  async chunkVideo(
    s3Uri: string,
    jobId: string,
    options?: VideoChunkingOptions
  ): Promise<APIResponse<VideoChunkingResult>> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting video chunking', { 
        jobId,
        s3Uri,
        options 
      });

      // Ensure temp directory exists
      await this.ensureTempDirectory();

      // Download video from S3
      const localVideoPath = await this.downloadVideo(s3Uri, jobId);
      
      // Get video metadata
      const metadata = await this.getVideoMetadata(localVideoPath);
      
      // Calculate optimal chunk strategy
      const chunkStrategy = this.calculateChunkStrategy(
        metadata,
        options || {}
      );

      // Create chunks
      const chunks = await this.createChunks(
        localVideoPath,
        jobId,
        chunkStrategy
      );

      // Upload chunks to S3
      const uploadedChunks = await this.uploadChunks(chunks, jobId);

      // Cleanup local files
      await this.cleanupLocalFiles(localVideoPath, chunks);

      const result: VideoChunkingResult = {
        jobId,
        originalUri: s3Uri,
        chunks: uploadedChunks,
        metadata: {
          originalDuration: metadata.duration,
          originalSize: metadata.size,
          totalChunks: uploadedChunks.length,
          chunkDuration: chunkStrategy.duration,
          processingTime: Date.now() - startTime,
        },
      };

      logger.info('Video chunking completed', {
        jobId,
        totalChunks: result.chunks.length,
        processingTime: result.metadata.processingTime,
      });

      return {
        success: true,
        data: result,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Video chunking failed', { 
        error, 
        jobId,
        s3Uri 
      });

      return {
        success: false,
        error: {
          code: 'VIDEO_CHUNKING_FAILED',
          message: 'Failed to chunk video for OpenAI processing',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Smart chunking with scene detection
   */
  async smartChunkVideo(
    s3Uri: string,
    jobId: string,
    sceneTimestamps?: number[]
  ): Promise<APIResponse<VideoChunkingResult>> {
    try {
      logger.info('Starting smart video chunking with scene detection', { 
        jobId,
        s3Uri,
        sceneCount: sceneTimestamps?.length 
      });

      // Download video
      const localVideoPath = await this.downloadVideo(s3Uri, jobId);
      const metadata = await this.getVideoMetadata(localVideoPath);

      // Use scene timestamps if provided, otherwise detect scenes
      const scenes = sceneTimestamps || await this.detectScenes(localVideoPath);
      
      // Group scenes into optimal chunks
      const chunkGroups = this.groupScenesIntoChunks(
        scenes,
        metadata.duration,
        this.maxChunkSize,
        metadata.bitrate
      );

      // Create chunks based on scene groups
      const chunks = await this.createSceneBasedChunks(
        localVideoPath,
        jobId,
        chunkGroups
      );

      // Upload chunks
      const uploadedChunks = await this.uploadChunks(chunks, jobId);

      // Cleanup
      await this.cleanupLocalFiles(localVideoPath, chunks);

      const result: VideoChunkingResult = {
        jobId,
        originalUri: s3Uri,
        chunks: uploadedChunks,
        metadata: {
          originalDuration: metadata.duration,
          originalSize: metadata.size,
          totalChunks: uploadedChunks.length,
          chunkDuration: 0, // Variable for scene-based chunks
          processingTime: Date.now(),
          sceneBasedChunking: true,
        },
      };

      logger.info('Smart video chunking completed', {
        jobId,
        totalChunks: result.chunks.length,
      });

      return {
        success: true,
        data: result,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Smart video chunking failed', { error, jobId });

      return {
        success: false,
        error: {
          code: 'SMART_CHUNKING_FAILED',
          message: 'Failed to perform smart video chunking',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Calculate optimal chunk strategy
   */
  private calculateChunkStrategy(
    metadata: any,
    options: VideoChunkingOptions
  ): {
    duration: number;
    overlap: number;
    keyframeAlign: boolean;
  } {
    const targetChunkSize = options.targetChunkSize || this.maxChunkSize;
    const videoBitrate = metadata.bitrate || 1000000; // Default 1 Mbps
    
    // Calculate optimal duration based on target size
    const optimalDuration = Math.floor(
      (targetChunkSize * 8) / videoBitrate
    );

    // Constrain to reasonable limits
    const duration = Math.min(
      Math.max(optimalDuration, 10), // Min 10 seconds
      options.maxChunkDuration || this.chunkDuration
    );

    return {
      duration,
      overlap: options.overlap || 2, // 2 second overlap by default
      keyframeAlign: options.keyframeAlign !== false,
    };
  }

  /**
   * Create video chunks using FFmpeg
   */
  private async createChunks(
    inputPath: string,
    jobId: string,
    strategy: any
  ): Promise<string[]> {
    const chunks: string[] = [];
    const metadata = await this.getVideoMetadata(inputPath);
    const totalDuration = metadata.duration;
    
    let currentTime = 0;
    let chunkIndex = 0;

    while (currentTime < totalDuration) {
      const chunkPath = path.join(
        this.tempDir,
        `${jobId}_chunk_${chunkIndex}.mp4`
      );

      const duration = Math.min(
        strategy.duration,
        totalDuration - currentTime
      );

      // FFmpeg command for chunking
      const ffmpegCmd = [
        '-ss', currentTime.toString(),
        '-i', inputPath,
        '-t', duration.toString(),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        chunkPath
      ];

      // Add keyframe alignment if requested
      if (strategy.keyframeAlign) {
        ffmpegCmd.splice(0, 0, '-avoid_negative_ts', 'make_zero');
        ffmpegCmd.splice(ffmpegCmd.indexOf('-c:v'), 0, '-force_key_frames', `expr:gte(t,n_forced*${strategy.duration})`);
      }

      await this.runFFmpeg(ffmpegCmd);
      chunks.push(chunkPath);
      
      // Move to next chunk with overlap
      currentTime += strategy.duration - strategy.overlap;
      chunkIndex++;
    }

    logger.info('Created video chunks', { 
      jobId,
      totalChunks: chunks.length 
    });

    return chunks;
  }

  /**
   * Create scene-based chunks
   */
  private async createSceneBasedChunks(
    inputPath: string,
    jobId: string,
    chunkGroups: Array<{ start: number; end: number }>
  ): Promise<string[]> {
    const chunks: string[] = [];

    for (let i = 0; i < chunkGroups.length; i++) {
      const group = chunkGroups[i];
      const chunkPath = path.join(
        this.tempDir,
        `${jobId}_scene_chunk_${i}.mp4`
      );

      const ffmpegCmd = [
        '-ss', group.start.toString(),
        '-i', inputPath,
        '-t', (group.end - group.start).toString(),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        chunkPath
      ];

      await this.runFFmpeg(ffmpegCmd);
      chunks.push(chunkPath);
    }

    return chunks;
  }

  /**
   * Detect scenes in video using FFmpeg scene detection
   */
  private async detectScenes(videoPath: string): Promise<number[]> {
    try {
      const sceneDetectCmd = [
        '-i', videoPath,
        '-filter:v', 'select=\'gt(scene,0.3)\',showinfo',
        '-f', 'null',
        '-'
      ];

      const output = await this.runFFmpegWithOutput(sceneDetectCmd);
      
      // Parse scene timestamps from FFmpeg output
      const sceneTimestamps: number[] = [0]; // Start with 0
      const regex = /pts_time:(\d+\.?\d*)/g;
      let match;

      while ((match = regex.exec(output)) !== null) {
        sceneTimestamps.push(parseFloat(match[1]));
      }

      logger.info('Detected scenes in video', {
        sceneCount: sceneTimestamps.length
      });

      return sceneTimestamps;
    } catch (error) {
      logger.warn('Scene detection failed, using fixed intervals', { error });
      return [];
    }
  }

  /**
   * Group scenes into optimal chunks
   */
  private groupScenesIntoChunks(
    scenes: number[],
    totalDuration: number,
    maxChunkSize: number,
    bitrate: number
  ): Array<{ start: number; end: number }> {
    const maxChunkDuration = (maxChunkSize * 8) / bitrate;
    const groups: Array<{ start: number; end: number }> = [];
    
    let currentStart = 0;
    
    for (let i = 1; i < scenes.length; i++) {
      const currentEnd = scenes[i];
      const duration = currentEnd - currentStart;
      
      if (duration >= maxChunkDuration || i === scenes.length - 1) {
        groups.push({
          start: currentStart,
          end: currentEnd,
        });
        currentStart = currentEnd;
      }
    }

    // Add final chunk if needed
    if (currentStart < totalDuration) {
      groups.push({
        start: currentStart,
        end: totalDuration,
      });
    }

    return groups;
  }

  /**
   * Upload chunks to S3
   */
  private async uploadChunks(
    chunkPaths: string[],
    jobId: string
  ): Promise<VideoChunk[]> {
    const uploadedChunks: VideoChunk[] = [];

    for (let i = 0; i < chunkPaths.length; i++) {
      const chunkPath = chunkPaths[i];
      const chunkId = `${jobId}_chunk_${i}`;
      const s3Key = `chunks/${jobId}/${chunkId}.mp4`;

      // Read chunk file
      const fileBuffer = await fs.readFile(chunkPath);
      const fileStats = await fs.stat(chunkPath);

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.outputBucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'video/mp4',
        Metadata: {
          jobId,
          chunkIndex: i.toString(),
          originalChunk: path.basename(chunkPath),
        },
      });

      await this.s3Client.send(command);

      // Get chunk metadata
      const metadata = await this.getVideoMetadata(chunkPath);

      uploadedChunks.push({
        chunkId,
        index: i,
        s3Uri: `s3://${this.outputBucket}/${s3Key}`,
        startTime: metadata.startTime || i * this.chunkDuration,
        endTime: metadata.endTime || (i + 1) * this.chunkDuration,
        duration: metadata.duration,
        size: fileStats.size,
      });

      logger.debug('Uploaded chunk to S3', { 
        chunkId,
        index: i,
        size: fileStats.size 
      });
    }

    return uploadedChunks;
  }

  /**
   * Download video from S3
   */
  private async downloadVideo(s3Uri: string, jobId: string): Promise<string> {
    // Parse S3 URI
    const match = s3Uri.match(/^s3:\/\/([^\/]+)\/(.+)$/);
    if (!match) {
      throw new Error('Invalid S3 URI format');
    }

    const [, bucket, key] = match;
    const localPath = path.join(this.tempDir, `${jobId}_original.mp4`);

    // Download from S3
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty response from S3');
    }

    // Write to local file
    const writeStream = require('fs').createWriteStream(localPath);
    await pipeline(response.Body as Readable, writeStream);

    logger.info('Downloaded video from S3', { 
      jobId,
      s3Uri,
      localPath 
    });

    return localPath;
  }

  /**
   * Get video metadata using FFprobe
   */
  private async getVideoMetadata(videoPath: string): Promise<any> {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`
    );

    const metadata = JSON.parse(stdout);
    const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
    
    return {
      duration: parseFloat(metadata.format.duration),
      size: parseInt(metadata.format.size),
      bitrate: parseInt(metadata.format.bit_rate),
      width: videoStream?.width,
      height: videoStream?.height,
      fps: eval(videoStream?.r_frame_rate), // Convert fraction to number
    };
  }

  /**
   * Run FFmpeg command
   */
  private async runFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      
      ffmpeg.stderr.on('data', (data) => {
        logger.debug('FFmpeg output:', data.toString());
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Run FFmpeg command and capture output
   */
  private async runFFmpegWithOutput(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);
      let output = '';
      
      ffmpeg.stderr.on('data', (data) => {
        output += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', { error });
      throw error;
    }
  }

  /**
   * Cleanup local files
   */
  private async cleanupLocalFiles(
    originalPath: string,
    chunkPaths: string[]
  ): Promise<void> {
    try {
      // Delete original
      await fs.unlink(originalPath);
      
      // Delete chunks
      for (const chunkPath of chunkPaths) {
        await fs.unlink(chunkPath);
      }

      logger.debug('Cleaned up local files');
    } catch (error) {
      logger.warn('Failed to cleanup some local files', { error });
    }
  }
}