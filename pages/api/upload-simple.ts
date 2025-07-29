import { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import { promisify } from 'util';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept video files only
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

const uploadMiddleware = promisify(upload.single('video'));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method allowed',
      },
    });
  }

  try {
    // Handle multipart file upload
    await uploadMiddleware(req as any, res as any);

    const file = (req as any).file;
    const { s3Uri, title, description, language } = req.body;

    // Validate request
    if (!file && !s3Uri) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_INPUT',
          message: 'Either file upload or S3 URI must be provided',
        },
      });
    }

    // Mock response for now
    const mockJobId = `test-job-${Date.now()}`;

    return res.status(200).json({
      success: true,
      data: {
        jobId: mockJobId,
        message: 'Upload successful (mock response)',
        fileSize: file ? file.size : 0,
        fileName: file ? file.originalname : 'N/A',
        s3Uri: s3Uri || 'N/A',
        metadata: {
          title: title || 'Untitled Video',
          description: description || '',
          language: language || 'en',
        },
      },
    });

  } catch (error) {
    console.error('Upload error:', error);

    if (error instanceof Error && error.message.includes('Only video files')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Only video files are allowed',
        },
      });
    }

    if (error instanceof Error && error.message.includes('File too large')) {
      return res.status(413).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds 500MB limit',
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

// Disable default body parser for multipart
export const config = {
  api: {
    bodyParser: false,
  },
};