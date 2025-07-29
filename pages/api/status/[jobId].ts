import { NextApiRequest, NextApiResponse } from 'next';
import { RekognitionClient, GetSegmentDetectionCommand } from '@aws-sdk/client-rekognition';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getJob, setJob } from '../../../lib/jobStorage';

// AWS Configuration with proper secret key encoding
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  outputBucket: process.env.OUTPUT_S3_BUCKET || 'voice-description-api-output-production-pmhnxlix',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.replace(/\s/g, '+'),
  } : undefined,
};

// AWS SDK Clients
const rekognitionClient = new RekognitionClient({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
});

const bedrockClient = new BedrockRuntimeClient({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
});

const pollyClient = new PollyClient({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
});

const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: awsConfig.credentials,
});

/**
 * Check actual Rekognition job status and advance pipeline
 */
async function processRealAWSPipeline(job: any) {
  console.log(`🔍 Processing pipeline for job ${job.id}, step: ${job.step}`);
  
  try {
    // Step 1: Check Rekognition segmentation status
    if (job.step === 'segmentation' && job.rekognitionJobId) {
      console.log(`📹 Checking Rekognition job ${job.rekognitionJobId}`);
      
      const segmentCommand = new GetSegmentDetectionCommand({
        JobId: job.rekognitionJobId,
      });
      
      const segmentResult = await rekognitionClient.send(segmentCommand);
      console.log(`Rekognition status: ${segmentResult.JobStatus}`);
      
      if (segmentResult.JobStatus === 'SUCCEEDED') {
        // Extract segments
        const segments = segmentResult.Segments || [];
        console.log(`✅ Found ${segments.length} video segments`);
        
        // Update job to analysis phase
        const updatedJob = {
          ...job,
          step: 'analysis',
          progress: 40,
          message: `Found ${segments.length} segments, starting scene analysis...`,
          segments: segments, // Process ALL segments
          segmentCount: segments.length,
        };
        
        setJob(job.id, updatedJob);
        return updatedJob;
        
      } else if (segmentResult.JobStatus === 'FAILED') {
        const failedJob = {
          ...job,
          status: 'failed',
          message: 'Video segmentation failed',
          error: segmentResult.StatusMessage || 'Unknown Rekognition error',
        };
        setJob(job.id, failedJob);
        return failedJob;
        
      } else {
        // Still processing
        const progressJob = {
          ...job,
          progress: Math.min(35, job.progress + 5),
          message: `Video segmentation in progress (${segmentResult.JobStatus})...`,
        };
        setJob(job.id, progressJob);
        return progressJob;
      }
    }
    
    // Step 2: Bedrock scene analysis with video frame extraction
    if (job.step === 'analysis' && job.segments && !job.descriptions) {
      console.log(`🧠 Starting Bedrock Nova Pro analysis for ${job.segments.length} segments`);
      
      const descriptions = [];
      
      // Analyze ALL segments for complete video coverage
      for (let i = 0; i < job.segments.length; i++) {
        const segment = job.segments[i];
        const startTime = segment.StartTimestampMillis / 1000;
        const endTime = segment.EndTimestampMillis / 1000;
        
        console.log(`Analyzing segment ${i + 1}: ${startTime}s - ${endTime}s`);
        
        try {
          console.log(`🎬 Processing segment ${i + 1}/${job.segments.length}: ${startTime}s - ${endTime}s`);
          
          // Extract video frame for Nova Pro analysis (AWS blog approach)
          const midpoint = startTime + (endTime - startTime) / 2;
          const videoFrameData = await extractVideoFrame(job.s3Bucket, job.s3Key, midpoint);
          
          // Use Nova Pro with video analysis following AWS blog methodology
          const bedrockCommand = new InvokeModelCommand({
            modelId: 'amazon.nova-pro-v1:0',
            contentType: 'application/json',
            body: JSON.stringify({
              messages: [{
                role: 'user',
                content: [
                  {
                    text: `You are creating audio descriptions for visually impaired audiences. Analyze this video frame from timestamp ${startTime} to ${endTime} seconds and provide a detailed, descriptive narration.

Focus on:
- People: their actions, expressions, clothing, and positioning
- Setting: environment, lighting, background elements  
- Objects: important items, their movement or interaction
- Visual story: what's happening, the mood, significant details

Create a natural, engaging description suitable for audio narration. Be specific and vivid. Keep it under 60 words but make every word count for accessibility.`
                  },
                  {
                    image: {
                      format: 'jpeg',
                      source: {
                        bytes: videoFrameData
                      }
                    }
                  }
                ]
              }],
              inferenceConfig: {
                maxTokens: 200,
                temperature: 0.4
              }
            }),
          });
          
          console.log(`🧠 Sending ${videoFrameData.length} bytes of frame data to Nova Pro for analysis (segment ${i + 1})`);
          const bedrockResponse = await bedrockClient.send(bedrockCommand);
          const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
          
          console.log(`📥 Nova Pro response structure:`, JSON.stringify(responseBody, null, 2));
          
          // Parse Nova Pro response - try different possible structures
          let description = '';
          if (responseBody.content && responseBody.content[0] && responseBody.content[0].text) {
            description = responseBody.content[0].text;
          } else if (responseBody.output && responseBody.output.message && responseBody.output.message.content) {
            description = responseBody.output.message.content[0]?.text || responseBody.output.message.content;
          } else if (responseBody.choices && responseBody.choices[0] && responseBody.choices[0].message) {
            description = responseBody.choices[0].message.content;
          } else if (responseBody.result) {
            description = responseBody.result;
          } else {
            description = `Nova Pro returned: ${JSON.stringify(responseBody)}`;
          }
          
          descriptions.push({
            startTime,
            endTime,
            text: description,
          });
          
          console.log(`✅ Generated Nova Pro video description for segment ${i + 1}: "${description.substring(0, 50)}..."`);
          
        } catch (segmentError) {
          console.error(`❌ Error processing segment ${i + 1} (${startTime}s - ${endTime}s):`, segmentError);
          
          // If Nova Pro fails, fail the entire job as per user requirements
          throw new Error(`Nova Pro analysis failed for segment ${i + 1}: ${segmentError instanceof Error ? segmentError.message : String(segmentError)}`);
        }
      }
      
      // Update job with descriptions
      const analysisJob = {
        ...job,
        step: 'synthesis',
        progress: 70,
        message: `Generated ${descriptions.length} scene descriptions using Nova Pro, starting audio synthesis...`,
        descriptions,
      };
      
      setJob(job.id, analysisJob);
      return analysisJob;
    }
    
    // Step 3: Polly text-to-speech synthesis with chunking for 3000 character limit
    if (job.step === 'synthesis' && job.descriptions && !job.audioUrl) {
      console.log(`🎤 Starting Polly synthesis for ${job.descriptions.length} descriptions`);
      
      // Combine all descriptions into single text
      const fullText = job.descriptions
        .map(desc => `At ${Math.floor(desc.startTime)} seconds: ${desc.text}`)
        .join(' ... ');
      
      console.log(`Full text length: ${fullText.length} characters`);
      
      try {
        // AWS Polly has a 3000 character limit, so chunk the text
        const POLLY_MAX_CHARS = 3000;
        const textChunks: string[] = [];
        
        if (fullText.length <= POLLY_MAX_CHARS) {
          textChunks.push(fullText);
        } else {
          // Split text into chunks at sentence boundaries
          let currentChunk = '';
          const sentences = fullText.split(/(\.\s+|\.\.\. )/g);
          
          for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            
            // If adding this sentence would exceed limit, save current chunk
            if (currentChunk.length + sentence.length > POLLY_MAX_CHARS && currentChunk.length > 0) {
              textChunks.push(currentChunk.trim());
              currentChunk = sentence;
            } else {
              currentChunk += sentence;
            }
          }
          
          // Don't forget the last chunk
          if (currentChunk.trim().length > 0) {
            textChunks.push(currentChunk.trim());
          }
        }
        
        console.log(`📝 Split text into ${textChunks.length} chunks for Polly synthesis`);
        
        // Process each chunk with Polly
        const audioBuffers: Buffer[] = [];
        
        for (let i = 0; i < textChunks.length; i++) {
          const chunk = textChunks[i];
          console.log(`🎤 Synthesizing chunk ${i + 1}/${textChunks.length} (${chunk.length} chars)`);
          
          const pollyCommand = new SynthesizeSpeechCommand({
            Text: chunk,
            OutputFormat: 'mp3',
            VoiceId: 'Joanna',
            Engine: 'neural',
          });
          
          const pollyResponse = await pollyClient.send(pollyCommand);
          
          if (pollyResponse.AudioStream) {
            const audioBytes = await streamToBuffer(pollyResponse.AudioStream);
            audioBuffers.push(audioBytes);
            console.log(`✅ Chunk ${i + 1} synthesized: ${audioBytes.length} bytes`);
          }
        }
        
        // Concatenate all audio buffers
        console.log(`🔊 Concatenating ${audioBuffers.length} audio chunks...`);
        const finalAudioBuffer = Buffer.concat(audioBuffers);
        console.log(`📊 Final audio size: ${finalAudioBuffer.length} bytes`);
        
        // Upload combined audio to S3
        const audioKey = `${job.id}/audio.mp3`;
        const s3Command = new PutObjectCommand({
          Bucket: awsConfig.outputBucket,
          Key: audioKey,
          Body: finalAudioBuffer,
          ContentType: 'audio/mpeg',
        });
        
        await s3Client.send(s3Command);
        
        // Also save text description
        const textKey = `${job.id}/description.txt`;
        const s3TextCommand = new PutObjectCommand({
          Bucket: awsConfig.outputBucket,
          Key: textKey,
          Body: fullText,
          ContentType: 'text/plain',
        });
        
        await s3Client.send(s3TextCommand);
        
        console.log(`✅ Audio and text saved to S3`);
        console.log(`📊 Text chunks: ${textChunks.length}, Total audio size: ${finalAudioBuffer.length} bytes`);
        
        // Complete the job
        const completedJob = {
          ...job,
          status: 'completed',
          step: 'completed',
          progress: 100,
          message: `Video analysis and audio generation completed successfully (${textChunks.length} audio chunks)`,
          audioUrl: `s3://${awsConfig.outputBucket}/${audioKey}`,
          textUrl: `s3://${awsConfig.outputBucket}/${textKey}`,
          completedAt: new Date().toISOString(),
        };
        
        setJob(job.id, completedJob);
        return completedJob;
        
      } catch (pollyError) {
        console.error(`❌ Polly synthesis error:`, pollyError);
        
        const errorJob = {
          ...job,
          status: 'failed',
          message: 'Audio synthesis failed',
          error: pollyError instanceof Error ? pollyError.message : String(pollyError),
        };
        
        setJob(job.id, errorJob);
        return errorJob;
      }
    }
    
    // Return current job state if no processing needed
    return job;
    
  } catch (error) {
    console.error(`❌ Pipeline processing error for job ${job.id}:`, error);
    
    const errorJob = {
      ...job,
      status: 'failed',
      message: 'Processing pipeline error',
      error: error instanceof Error ? error.message : String(error),
    };
    
    setJob(job.id, errorJob);
    return errorJob;
  }
}

/**
 * Extract video frame at specific timestamp - AWS Blog approach for Nova Pro analysis
 * Downloads video chunk and extracts frame using FFmpeg for multimodal analysis
 */
async function extractVideoFrame(s3Bucket: string, s3Key: string, timestampSeconds: number): Promise<string> {
  const { spawn } = require('child_process');
  const fs = require('fs').promises;
  const path = require('path');
  const os = require('os');
  
  console.log(`🎬 Extracting video frame at ${timestampSeconds}s from s3://${s3Bucket}/${s3Key}`);
  
  // Create temporary files
  const tempDir = os.tmpdir();
  const tempVideoPath = path.join(tempDir, `video_${Date.now()}.mp4`);
  const tempFramePath = path.join(tempDir, `frame_${Date.now()}.jpg`);
  
  try {
    // Download video from S3 to temporary file
    console.log(`📥 Downloading video segment from S3...`);
    const getObjectCommand = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
    });
    
    const response = await s3Client.send(getObjectCommand);
    
    if (!response.Body) {
      throw new Error('No video data received from S3');
    }
    
    // Stream video data to temporary file
    const videoBuffer = await streamToBuffer(response.Body);
    await fs.writeFile(tempVideoPath, videoBuffer);
    
    console.log(`🎬 Extracting frame at ${timestampSeconds}s using FFmpeg...`);
    
    // Use FFmpeg to extract frame at specific timestamp
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', tempVideoPath,
        '-ss', timestampSeconds.toString(),
        '-vframes', '1',
        '-f', 'image2',
        '-vcodec', 'mjpeg',
        '-q:v', '2',
        '-y',
        tempFramePath
      ]);
      
      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(code);
        } else {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
    
    // Read extracted frame and convert to base64
    console.log(`📸 Converting frame to base64 for Nova Pro analysis...`);
    const frameBuffer = await fs.readFile(tempFramePath);
    const base64Frame = frameBuffer.toString('base64');
    
    // Clean up temporary files
    await fs.unlink(tempVideoPath).catch(() => {});
    await fs.unlink(tempFramePath).catch(() => {});
    
    console.log(`✅ Successfully extracted ${base64Frame.length} bytes of frame data`);
    return base64Frame;
    
  } catch (error) {
    console.error('❌ Frame extraction error:', error);
    
    // Clean up temporary files in case of error
    try {
      await fs.unlink(tempVideoPath).catch(() => {});
      await fs.unlink(tempFramePath).catch(() => {});
    } catch {}
    
    throw error;
  }
}

/**
 * Convert stream to buffer
 */
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only GET method allowed',
      },
      timestamp: new Date(),
    });
  }

  try {
    const { jobId } = req.query;

    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JOB_ID',
          message: 'Valid job ID is required',
        },
        timestamp: new Date(),
      });
    }

    console.log(`📊 Status request for job: ${jobId}`);

    // Get stored job from jobStorage
    let job = getJob(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Job not found. Please check the job ID or create a new processing request.',
        },
        timestamp: new Date(),
      });
    }

    console.log(`Current job status: ${job.status}, step: ${job.step}`);

    // Process pipeline for all processing jobs
    if (job.status === 'processing') {
      job = await processRealAWSPipeline(job);
    }

    return res.status(200).json({
      success: true,
      data: {
        id: job.id,
        status: job.status,
        step: job.step,
        progress: job.progress,
        message: job.message,
        s3Uri: job.s3Uri,
        metadata: job.metadata,
        fileInfo: job.fileInfo,
        segmentCount: job.segmentCount || 0,
        descriptions: job.descriptions || [],
        audioUrl: job.audioUrl,
        textUrl: job.textUrl,
        error: job.error,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        rekognitionJobId: job.rekognitionJobId,
      },
      timestamp: new Date(),
    });

  } catch (error) {
    console.error('❌ Status endpoint error:', error);

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred while checking job status',
        details: error instanceof Error ? error.message : String(error),
      },
      timestamp: new Date(),
    });
  }
}