import type { NextApiRequest, NextApiResponse } from 'next';
import { JobManager } from '../../../../../src/orchestrator/jobManager';
import { logger } from '../../../../../src/utils/logger';

const jobManager = new JobManager({
  region: process.env.AWS_REGION || 'us-east-1',
  inputBucket: process.env.INPUT_S3_BUCKET || '',
  outputBucket: process.env.OUTPUT_S3_BUCKET || '',
});

interface ImageTextResult {
  jobId: string;
  altText: string;
  detailedDescription: string;
  technicalDescription?: string;
  visualElements: string[];
  colors: string[];
  composition: string;
  context: string;
  imageType: string;
  confidence: number;
  htmlMetadata: {
    altAttribute: string;
    longDescId?: string;
    ariaLabel?: string;
    schemaMarkup?: object;
  };
  metadata: {
    wordCount: number;
    processingTime: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ImageTextResult | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;

  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'Job ID is required' });
  }

  try {
    logger.info('Image text result request', { jobId });

    // Check if this is an image job
    const jobType = jobManager.determineJobType(jobId);
    
    if (jobType !== 'image') {
      if (jobType === 'video') {
        return res.status(400).json({ 
          error: 'This is a video job. Use /api/results/[jobId]/text instead' 
        });
      }
      return res.status(404).json({ error: 'Image job not found' });
    }

    // Get job details
    const job = jobManager.getJob(jobId) as any;
    
    if (!job) {
      logger.warn('Image job not found', { jobId });
      return res.status(404).json({ error: 'Image job not found' });
    }

    // Check if job is completed
    if (job.status.status !== 'completed') {
      return res.status(400).json({ 
        error: `Job is ${job.status.status}. Text results are only available for completed jobs.` 
      });
    }

    // Check if descriptions are available
    if (!job.compiledDescription || !job.analysis) {
      return res.status(500).json({ 
        error: 'Description data not available for this job' 
      });
    }

    // Format response based on query parameters
    const format = req.query.format as string || 'json';

    if (format === 'text') {
      // Return plain text format
      const textContent = [
        `ALT TEXT: ${job.compiledDescription.altText}`,
        '',
        'DETAILED DESCRIPTION:',
        job.compiledDescription.detailedDescription,
        '',
      ];

      if (job.compiledDescription.technicalDescription) {
        textContent.push(
          'TECHNICAL DESCRIPTION:',
          job.compiledDescription.technicalDescription,
          ''
        );
      }

      textContent.push(
        'VISUAL ELEMENTS:',
        job.analysis.visualElements.join(', '),
        '',
        'COLORS:',
        job.analysis.colors.join(', '),
        '',
        'COMPOSITION:',
        job.analysis.composition,
        '',
        'IMAGE TYPE:',
        job.analysis.imageType,
        '',
        `CONFIDENCE: ${job.analysis.confidence}%`
      );

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="image-description-${jobId}.txt"`);
      res.status(200);
      res.write(textContent.join('\n'));
      return res.end();
    }

    if (format === 'html') {
      // Return HTML format with accessibility metadata
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Image Description - ${jobId}</title>
  <script type="application/ld+json">
  ${JSON.stringify(job.compiledDescription.htmlMetadata.schemaMarkup, null, 2)}
  </script>
</head>
<body>
  <main>
    <h1>Image Accessibility Description</h1>
    
    <section id="${job.compiledDescription.htmlMetadata.longDescId}">
      <h2>Alt Text</h2>
      <p>${job.compiledDescription.altText}</p>
      
      <h2>Detailed Description</h2>
      <p>${job.compiledDescription.detailedDescription}</p>
      
      ${job.compiledDescription.technicalDescription ? `
      <h2>Technical Analysis</h2>
      <p>${job.compiledDescription.technicalDescription}</p>
      ` : ''}
      
      <h2>Visual Elements</h2>
      <ul>
        ${job.analysis.visualElements.map((element: string) => `<li>${element}</li>`).join('\n        ')}
      </ul>
      
      <h2>Color Palette</h2>
      <ul>
        ${job.analysis.colors.map((color: string) => `<li>${color}</li>`).join('\n        ')}
      </ul>
      
      <h2>Composition</h2>
      <p>${job.analysis.composition}</p>
      
      <h2>Metadata</h2>
      <dl>
        <dt>Image Type:</dt>
        <dd>${job.analysis.imageType}</dd>
        <dt>Confidence Score:</dt>
        <dd>${job.analysis.confidence}%</dd>
        <dt>Word Count:</dt>
        <dd>${job.compiledDescription.metadata.wordCount}</dd>
      </dl>
    </section>
    
    <footer>
      <p>Generated by Voice Description API</p>
      <p>Job ID: ${jobId}</p>
    </footer>
  </main>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200);
      res.write(htmlContent);
      return res.end();
    }

    // Default: Return JSON format
    const result: ImageTextResult = {
      jobId,
      altText: job.compiledDescription.altText,
      detailedDescription: job.compiledDescription.detailedDescription,
      technicalDescription: job.compiledDescription.technicalDescription,
      visualElements: job.analysis.visualElements,
      colors: job.analysis.colors,
      composition: job.analysis.composition,
      context: job.analysis.context,
      imageType: job.analysis.imageType,
      confidence: job.analysis.confidence,
      htmlMetadata: job.compiledDescription.htmlMetadata,
      metadata: {
        wordCount: job.compiledDescription.metadata.wordCount,
        processingTime: job.compiledDescription.metadata.processingTime,
      },
    };

    logger.info('Image text results delivered', { 
      jobId, 
      format,
      wordCount: result.metadata.wordCount 
    });

    return res.status(200).json(result);

  } catch (error) {
    logger.error('Error retrieving image text results', { error, jobId });
    return res.status(500).json({ 
      error: 'Failed to retrieve text results' 
    });
  }
}