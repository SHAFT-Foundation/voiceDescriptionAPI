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
          segments: segments.slice(0, 5), // Process first 5 segments
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
    
    // Step 2: Bedrock scene analysis
    if (job.step === 'analysis' && job.segments && !job.descriptions) {
      console.log(`🧠 Starting Bedrock analysis for ${job.segments.length} segments`);
      
      const descriptions = [];
      
      for (let i = 0; i < Math.min(3, job.segments.length); i++) {
        const segment = job.segments[i];
        const startTime = segment.StartTimestampMillis / 1000;
        const endTime = segment.EndTimestampMillis / 1000;
        
        console.log(`Analyzing segment ${i + 1}: ${startTime}s - ${endTime}s`);
        
        // Create Bedrock prompt for scene analysis
        const prompt = `You are analyzing a video segment from ${startTime} to ${endTime} seconds. Provide a concise, descriptive narration suitable for audio description for visually impaired audiences. Focus on:
- Key visual elements and actions
- Important scene details
- Character movements and interactions
- Setting and environment

Keep the description under 100 words and make it engaging for audio narration.`;
        
        const bedrockCommand = new InvokeModelCommand({
          modelId: 'amazon.nova-pro-v1:0',
          contentType: 'application/json',
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: prompt,
            }],
            max_tokens: 200,
            temperature: 0.7,
          }),
        });
        
        try {
          const bedrockResponse = await bedrockClient.send(bedrockCommand);
          const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
          
          descriptions.push({
            startTime,
            endTime,
            text: responseBody.content[0]?.text || 'Scene description unavailable',
          });
          
          console.log(`✅ Generated description for segment ${i + 1}`);
          
        } catch (bedrockError) {
          console.error(`❌ Bedrock error for segment ${i + 1}:`, bedrockError);
          descriptions.push({
            startTime,
            endTime,
            text: `Scene ${i + 1}: Video content from ${startTime} to ${endTime} seconds`,
          });
        }
      }
      
      // Update job with descriptions
      const analysisJob = {
        ...job,
        step: 'synthesis',
        progress: 70,
        message: `Generated ${descriptions.length} scene descriptions, starting audio synthesis...`,
        descriptions,
      };
      
      setJob(job.id, analysisJob);
      return analysisJob;
    }
    
    // Step 3: Polly text-to-speech synthesis
    if (job.step === 'synthesis' && job.descriptions && !job.audioUrl) {
      console.log(`🎤 Starting Polly synthesis for ${job.descriptions.length} descriptions`);
      
      // Combine all descriptions into single text
      const fullText = job.descriptions
        .map(desc => `At ${Math.floor(desc.startTime)} seconds: ${desc.text}`)
        .join(' ... ');
      
      console.log(`Synthesizing text: ${fullText.substring(0, 100)}...`);
      
      const pollyCommand = new SynthesizeSpeechCommand({
        Text: fullText,
        OutputFormat: 'mp3',
        VoiceId: 'Joanna',
        Engine: 'neural',
      });
      
      try {
        const pollyResponse = await pollyClient.send(pollyCommand);
        
        if (pollyResponse.AudioStream) {
          // Upload audio to S3
          const audioKey = `${job.id}/audio.mp3`;
          const audioBytes = await streamToBuffer(pollyResponse.AudioStream);
          
          const s3Command = new PutObjectCommand({
            Bucket: awsConfig.outputBucket,
            Key: audioKey,
            Body: audioBytes,
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
          
          // Complete the job
          const completedJob = {
            ...job,
            status: 'completed',
            step: 'completed',
            progress: 100,
            message: 'Video analysis and audio generation completed successfully',
            audioUrl: `s3://${awsConfig.outputBucket}/${audioKey}`,
            textUrl: `s3://${awsConfig.outputBucket}/${textKey}`,
            completedAt: new Date().toISOString(),
          };
          
          setJob(job.id, completedJob);
          return completedJob;
        }
        
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

    // Process the real AWS pipeline if job is still processing
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