import { NextApiRequest, NextApiResponse } from 'next';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('Environment check:');
    console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...` : 'NOT SET');
    console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? `${process.env.AWS_SECRET_ACCESS_KEY.substring(0, 8)}...` : 'NOT SET');
    console.log('AWS_REGION:', process.env.AWS_REGION);
    
    // Try different credential approaches
    const approaches = [
      {
        name: 'Direct environment variables',
        client: new S3Client({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        }),
      },
      {
        name: 'URL decoded secret key',
        client: new S3Client({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: decodeURIComponent(process.env.AWS_SECRET_ACCESS_KEY!),
          },
        }),
      },
      {
        name: 'Manually corrected secret key',
        client: new S3Client({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!.replace(/\s/g, '+'),
          },
        }),
      },
      {
        name: 'Default credential chain',
        client: new S3Client({
          region: process.env.AWS_REGION || 'us-east-1',
        }),
      },
    ];

    const results: any = {
      timestamp: new Date().toISOString(),
      environment: {
        hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
        hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
        accessKeyPrefix: process.env.AWS_ACCESS_KEY_ID?.substring(0, 8),
      },
      tests: [],
    };

    for (const approach of approaches) {
      try {
        console.log(`Testing: ${approach.name}`);
        const command = new ListBucketsCommand({});
        const response = await approach.client.send(command);
        
        results.tests.push({
          approach: approach.name,
          status: 'success',
          bucketCount: response.Buckets?.length || 0,
          buckets: response.Buckets?.slice(0, 3).map(b => b.Name) || [],
        });
        
        console.log(`✅ ${approach.name} worked! Found ${response.Buckets?.length} buckets`);
        
      } catch (error) {
        console.error(`❌ ${approach.name} failed:`, error);
        results.tests.push({
          approach: approach.name,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          errorCode: (error as any)?.name || 'Unknown',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: results,
    });

  } catch (globalError) {
    console.error('Global error:', globalError);
    return res.status(500).json({
      success: false,
      error: {
        message: globalError instanceof Error ? globalError.message : String(globalError),
        details: 'Failed to test AWS connectivity',
      },
    });
  }
}