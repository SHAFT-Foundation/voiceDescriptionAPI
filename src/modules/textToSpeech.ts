import { PollyClient, SynthesizeSpeechCommand, VoiceId, Engine, OutputFormat } from '@aws-sdk/client-polly';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AWSConfig, APIResponse } from '../types';
import { CompiledDescription } from './descriptionCompilation';
import { logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

export interface AudioOutput {
  audioBuffer: Buffer;
  audioUrl?: string;
  metadata: {
    duration: number; // estimated in seconds
    format: string;
    voiceId: string;
    engine: string;
    textLength: number;
    chunkCount: number;
  };
}

export class TextToSpeechModule {
  private pollyClient: PollyClient;
  private config: AWSConfig;
  private voiceConfig: {
    voiceId: VoiceId;
    engine: Engine;
    format: OutputFormat;
    sampleRate: string;
    textChunkSize: number;
  };

  constructor(config: AWSConfig) {
    this.config = config;
    this.pollyClient = new PollyClient({
      region: config.region,
      credentials: config.credentials,
    });

    this.voiceConfig = {
      voiceId: (process.env.POLLY_VOICE_ID as VoiceId) || 'Joanna',
      engine: 'standard',
      format: 'mp3',
      sampleRate: '22050',
      textChunkSize: 2500, // Polly limit is ~3000 characters
    };
  }

  async synthesizeSpeech(
    compiledDescription: CompiledDescription,
    jobId: string
  ): Promise<APIResponse<AudioOutput>> {
    const startTime = Date.now();
    const tempFiles: string[] = [];

    try {
      logger.info('Starting text-to-speech synthesis', { 
        jobId,
        textLength: compiledDescription.cleanText.length,
        voiceId: this.voiceConfig.voiceId,
        engine: this.voiceConfig.engine
      });

      // Prepare text for TTS
      const ttsText = this.prepareTextForTTS(compiledDescription.cleanText);
      
      // Split text into chunks if needed
      const textChunks = this.splitTextIntoChunks(ttsText);
      
      logger.debug('Text prepared for synthesis', {
        jobId,
        originalLength: compiledDescription.cleanText.length,
        processedLength: ttsText.length,
        chunkCount: textChunks.length
      });

      // Synthesize each chunk
      const audioChunks: Buffer[] = [];
      
      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        logger.debug('Synthesizing chunk', { jobId, chunkIndex: i, chunkLength: chunk.length });

        const chunkResult = await this.synthesizeTextChunk(chunk, i);
        if (!chunkResult.success) {
          return chunkResult;
        }

        audioChunks.push(chunkResult.data!);

        // Small delay between chunks to avoid rate limiting
        if (i < textChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Combine audio chunks
      const finalAudioBuffer = this.combineAudioChunks(audioChunks);

      // Calculate estimated duration (rough estimate: ~150 words per minute)
      const wordCount = ttsText.split(/\s+/).length;
      const estimatedDuration = Math.round((wordCount / 150) * 60);

      const audioOutput: AudioOutput = {
        audioBuffer: finalAudioBuffer,
        metadata: {
          duration: estimatedDuration,
          format: this.voiceConfig.format,
          voiceId: this.voiceConfig.voiceId,
          engine: this.voiceConfig.engine,
          textLength: ttsText.length,
          chunkCount: textChunks.length,
        },
      };

      const processingTime = Date.now() - startTime;
      
      logger.info('Text-to-speech synthesis completed', {
        jobId,
        audioSize: finalAudioBuffer.length,
        estimatedDuration,
        chunkCount: textChunks.length,
        processingTime,
      });

      return {
        success: true,
        data: audioOutput,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Text-to-speech synthesis failed', { error, jobId });

      return {
        success: false,
        error: {
          code: 'TTS_SYNTHESIS_FAILED',
          message: 'Failed to synthesize speech from text',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
      
    } finally {
      // Clean up temporary files
      await this.cleanup(tempFiles);
    }
  }

  private async synthesizeTextChunk(text: string, chunkIndex: number): Promise<APIResponse<Buffer>> {
    try {
      const command = new SynthesizeSpeechCommand({
        Text: text,
        VoiceId: this.voiceConfig.voiceId,
        Engine: this.voiceConfig.engine,
        OutputFormat: this.voiceConfig.format,
        SampleRate: this.voiceConfig.sampleRate,
        TextType: 'text',
        // Optional SSML features for better speech quality
        LexiconNames: [], // Could add custom lexicons for pronunciation
      });

      const response = await retryWithBackoff(
        async () => await this.pollyClient.send(command),
        { maxRetries: 3, baseDelay: 1000 },
        `Polly synthesis chunk ${chunkIndex}`
      );

      if (!response.AudioStream) {
        throw new Error('No audio stream in Polly response');
      }

      // Convert stream to buffer
      const audioBuffer = await this.streamToBuffer(response.AudioStream);

      logger.debug('Text chunk synthesized successfully', {
        chunkIndex,
        textLength: text.length,
        audioSize: audioBuffer.length
      });

      return {
        success: true,
        data: audioBuffer,
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to synthesize text chunk', { error, chunkIndex, textLength: text.length });

      return {
        success: false,
        error: {
          code: 'CHUNK_SYNTHESIS_FAILED',
          message: `Failed to synthesize text chunk ${chunkIndex}`,
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private prepareTextForTTS(text: string): string {
    return text
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Add pauses at punctuation for better speech flow
      .replace(/([.!?])\s+/g, '$1 ')
      .replace(/([,;:])\s+/g, '$1 ')
      // Handle abbreviations and numbers that might need special pronunciation
      .replace(/\bU\.S\.A?\b/gi, 'United States')
      .replace(/\bUK\b/gi, 'United Kingdom')
      .replace(/\be\.g\.\b/gi, 'for example')
      .replace(/\bi\.e\.\b/gi, 'that is')
      .replace(/\betc\.\b/gi, 'etcetera')
      // Remove any remaining brackets or special characters that might confuse TTS
      .replace(/[\[\]{}]/g, '')
      .replace(/[<>]/g, '')
      .trim();
  }

  private splitTextIntoChunks(text: string): string[] {
    if (text.length <= this.voiceConfig.textChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk = '';
    const sentences = text.split(/([.!?]+\s*)/);

    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] || '';
      const punctuation = sentences[i + 1] || '';
      const fullSentence = sentence + punctuation;

      // If adding this sentence would exceed chunk size, start new chunk
      if (currentChunk.length + fullSentence.length > this.voiceConfig.textChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = fullSentence;
      } else {
        currentChunk += fullSentence;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Handle edge case where a single sentence is too long
    const finalChunks: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length <= this.voiceConfig.textChunkSize) {
        finalChunks.push(chunk);
      } else {
        // Force split long sentences at word boundaries
        const words = chunk.split(' ');
        let wordChunk = '';
        
        for (const word of words) {
          if (wordChunk.length + word.length + 1 > this.voiceConfig.textChunkSize && wordChunk.length > 0) {
            finalChunks.push(wordChunk.trim());
            wordChunk = word;
          } else {
            wordChunk += (wordChunk ? ' ' : '') + word;
          }
        }
        
        if (wordChunk.trim()) {
          finalChunks.push(wordChunk.trim());
        }
      }
    }

    logger.debug('Text split into chunks', {
      originalLength: text.length,
      chunkCount: finalChunks.length,
      chunkSizes: finalChunks.map(chunk => chunk.length)
    });

    return finalChunks;
  }

  private combineAudioChunks(audioChunks: Buffer[]): Buffer {
    if (audioChunks.length === 1) {
      return audioChunks[0];
    }

    // Simple concatenation for MP3 files
    // Note: This is a basic approach. For production, you might want to use
    // more sophisticated audio processing to ensure smooth transitions
    return Buffer.concat(audioChunks);
  }

  private async streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      
      stream.on('data', (chunk: any) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async saveAudioToFile(audioOutput: AudioOutput, filePath: string): Promise<APIResponse<{ filePath: string }>> {
    try {
      await fs.promises.writeFile(filePath, audioOutput.audioBuffer);
      
      logger.info('Audio saved to file', { 
        filePath, 
        size: audioOutput.audioBuffer.length,
        format: audioOutput.metadata.format
      });

      return {
        success: true,
        data: { filePath },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to save audio to file', { error, filePath });

      return {
        success: false,
        error: {
          code: 'AUDIO_SAVE_FAILED',
          message: 'Failed to save audio to file',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  async uploadAudioToS3(audioOutput: AudioOutput, jobId: string): Promise<APIResponse<{ s3Uri: string }>> {
    try {
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const s3Client = new S3Client({
        region: this.config.region,
        credentials: this.config.credentials,
      });

      const key = `audio/${jobId}/description.${audioOutput.metadata.format}`;
      const command = new PutObjectCommand({
        Bucket: this.config.outputBucket,
        Key: key,
        Body: audioOutput.audioBuffer,
        ContentType: `audio/${audioOutput.metadata.format}`,
        Metadata: {
          jobId,
          voiceId: audioOutput.metadata.voiceId,
          engine: audioOutput.metadata.engine,
          duration: audioOutput.metadata.duration.toString(),
          textLength: audioOutput.metadata.textLength.toString(),
          chunkCount: audioOutput.metadata.chunkCount.toString(),
          generatedAt: new Date().toISOString(),
        },
      });

      await s3Client.send(command);
      const s3Uri = `s3://${this.config.outputBucket}/${key}`;

      logger.info('Audio uploaded to S3', { jobId, s3Uri, size: audioOutput.audioBuffer.length });

      return {
        success: true,
        data: { s3Uri },
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to upload audio to S3', { error, jobId });

      return {
        success: false,
        error: {
          code: 'S3_UPLOAD_FAILED',
          message: 'Failed to upload audio to S3',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }

  private async cleanup(tempFiles: string[]): Promise<void> {
    const cleanupPromises = tempFiles.map(file =>
      fs.promises.unlink(file).catch(error =>
        logger.warn('Failed to cleanup temp file', { file, error: error.message })
      )
    );

    await Promise.all(cleanupPromises);
    logger.debug('TTS cleanup completed', { fileCount: tempFiles.length });
  }

  // Utility method to get supported voices
  async getSupportedVoices(): Promise<APIResponse<any[]>> {
    try {
      const { DescribeVoicesCommand } = require('@aws-sdk/client-polly');
      const command = new DescribeVoicesCommand({
        Engine: this.voiceConfig.engine,
      });

      const response = await this.pollyClient.send(command);
      
      return {
        success: true,
        data: response.Voices || [],
        timestamp: new Date(),
      };

    } catch (error) {
      logger.error('Failed to get supported voices', { error });

      return {
        success: false,
        error: {
          code: 'VOICES_FETCH_FAILED',
          message: 'Failed to fetch supported voices',
          details: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      };
    }
  }
}