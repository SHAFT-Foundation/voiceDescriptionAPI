import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    return res.status(200).json({
      success: true,
      message: 'Test endpoint working',
      env: {
        nodeEnv: process.env.NODE_ENV,
        awsRegion: process.env.AWS_REGION,
        hasInputBucket: !!process.env.INPUT_S3_BUCKET,
        hasOutputBucket: !!process.env.OUTPUT_S3_BUCKET,
        hasAwsAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasAwsSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        awsAccessKeyPrefix: process.env.AWS_ACCESS_KEY_ID ? process.env.AWS_ACCESS_KEY_ID.substring(0, 8) + '...' : 'N/A',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
  }
}