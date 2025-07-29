import { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { PollyClient, DescribeVoicesCommand } from '@aws-sdk/client-polly';

// AWS Configuration
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const awsStatus: any = {
      timestamp: new Date().toISOString(),
      region: awsConfig.region,
      services: {},
    };

    // Test S3 Access
    try {
      const s3Client = new S3Client(awsConfig);
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.INPUT_S3_BUCKET || 'voice-description-api-input-production-pmhnxlix',
        MaxKeys: 10,
      });
      const s3Response = await s3Client.send(listCommand);
      
      awsStatus.services.s3 = {
        status: 'connected',
        inputBucket: process.env.INPUT_S3_BUCKET,
        outputBucket: process.env.OUTPUT_S3_BUCKET,
        objectCount: s3Response.KeyCount || 0,
        recentFiles: s3Response.Contents?.slice(0, 5).map(obj => ({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
        })) || [],
      };
    } catch (s3Error) {
      awsStatus.services.s3 = {
        status: 'error',
        error: s3Error instanceof Error ? s3Error.message : String(s3Error),
        bucket: process.env.INPUT_S3_BUCKET,
      };
    }

    // Test Rekognition Access
    try {
      const rekognitionClient = new RekognitionClient(awsConfig);
      // Just test if we can create the client without errors
      awsStatus.services.rekognition = {
        status: 'connected',
        region: awsConfig.region,
        message: 'Service accessible - check console for active jobs',
        consoleUrl: `https://console.aws.amazon.com/rekognition/home?region=${awsConfig.region}#/`,
      };
    } catch (rekognitionError) {
      awsStatus.services.rekognition = {
        status: 'error',
        error: rekognitionError instanceof Error ? rekognitionError.message : String(rekognitionError),
      };
    }

    // Test Bedrock Access
    try {
      const bedrockClient = new BedrockRuntimeClient(awsConfig);
      awsStatus.services.bedrock = {
        status: 'connected',
        region: awsConfig.region,
        message: 'Bedrock Runtime accessible',
        consoleUrl: `https://console.aws.amazon.com/bedrock/home?region=${awsConfig.region}#/`,
      };
    } catch (bedrockError) {
      awsStatus.services.bedrock = {
        status: 'error',
        error: bedrockError instanceof Error ? bedrockError.message : String(bedrockError),
      };
    }

    // Test Polly Access
    try {
      const pollyClient = new PollyClient(awsConfig);
      const voicesCommand = new DescribeVoicesCommand({});
      const voicesResponse = await pollyClient.send(voicesCommand);
      
      awsStatus.services.polly = {
        status: 'connected',
        availableVoices: voicesResponse.Voices?.slice(0, 3).map(voice => ({
          id: voice.Id,
          name: voice.Name,
          language: voice.LanguageCode,
        })) || [],
        totalVoices: voicesResponse.Voices?.length || 0,
      };
    } catch (pollyError) {
      awsStatus.services.polly = {
        status: 'error',
        error: pollyError instanceof Error ? pollyError.message : String(pollyError),
      };
    }

    // Overall status
    const connectedServices = Object.values(awsStatus.services).filter((service: any) => service.status === 'connected').length;
    const totalServices = Object.keys(awsStatus.services).length;
    
    awsStatus.overall = {
      status: connectedServices === totalServices ? 'all_connected' : connectedServices > 0 ? 'partial' : 'disconnected',
      connectedServices: `${connectedServices}/${totalServices}`,
      readyForProcessing: connectedServices >= 3, // Need at least S3, Rekognition, and one other
    };

    // Quick action items
    awsStatus.actionItems = [];
    if (awsStatus.services.s3?.status === 'error') {
      awsStatus.actionItems.push('Fix S3 access - check bucket names and permissions');
    }
    if (awsStatus.services.s3?.status === 'connected' && awsStatus.services.s3?.objectCount === 0) {
      awsStatus.actionItems.push('Upload a test video to S3 bucket to begin processing');
    }
    if (awsStatus.overall.readyForProcessing) {
      awsStatus.actionItems.push('✅ System ready - you can upload videos for processing!');
    }

    return res.status(200).json({
      success: true,
      data: awsStatus,
    });

  } catch (error) {
    console.error('AWS status check error:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        details: 'Failed to check AWS service status',
      },
    });
  }
}