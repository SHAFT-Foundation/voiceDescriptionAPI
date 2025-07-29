import { mockClient } from 'aws-sdk-client-mock';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { SceneAnalysisModule } from '../../../src/modules/sceneAnalysis';
import { ExtractedScene } from '../../../src/modules/sceneExtraction';
import * as fs from 'fs';

const bedrockMock = mockClient(BedrockRuntimeClient);

// Mock fs
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

describe('SceneAnalysisModule', () => {
  let sceneAnalysis: SceneAnalysisModule;
  const mockExtractedScenes: ExtractedScene[] = [
    {
      segmentId: 'segment-0',
      localPath: '/tmp/scene-0.mp4',
      startTime: 0,
      endTime: 5.5,
      duration: 5.5,
    },
    {
      segmentId: 'segment-1',
      localPath: '/tmp/scene-1.mp4',
      startTime: 5.5,
      endTime: 12.3,
      duration: 6.8,
    },
  ];

  beforeEach(() => {
    bedrockMock.reset();
    sceneAnalysis = new SceneAnalysisModule({
      region: 'us-east-1',
      inputBucket: 'test-input-bucket',
      outputBucket: 'test-output-bucket',
    });

    // Mock fs.readFile
    const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;
    fsMock.readFile.mockResolvedValue(Buffer.from('mock video data'));
  });

  describe('analyzeScenes', () => {
    test('should analyze all scenes successfully', async () => {
      const jobId = 'test-job-id';
      const mockResponse = {
        content: [
          {
            text: JSON.stringify({
              description: 'A person walking in a park with trees and benches visible in the background.',
              visualElements: ['person', 'park', 'trees', 'benches'],
              actions: ['walking'],
              context: 'outdoor park setting',
              confidence: 95.5,
            }),
          },
        ],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(mockResponse)),
      });

      const result = await sceneAnalysis.analyzeScenes(mockExtractedScenes, jobId);

      expect(result.success).toBe(true);
      expect(result.data?.analyses).toHaveLength(2);
      expect(result.data?.analyses[0].description).toContain('person walking in a park');
      expect(result.data?.analyses[0].visualElements).toContain('person');
      expect(result.data?.analyses[0].confidence).toBe(95.5);

      // Verify Bedrock was called for each scene
      expect(bedrockMock.commandCalls(InvokeModelCommand)).toHaveLength(2);
    });

    test('should handle Bedrock API errors gracefully', async () => {
      const jobId = 'test-job-id';

      bedrockMock
        .on(InvokeModelCommand)
        .resolvesOnce({
          body: new TextEncoder().encode(JSON.stringify({
            content: [{
              text: JSON.stringify({
                description: 'Successfully analyzed scene',
                visualElements: ['element1'],
                actions: ['action1'],
                context: 'context1',
                confidence: 90.0,
              }),
            }],
          }))
        })
        .rejectsOnce(new Error('Model not available'));

      const result = await sceneAnalysis.analyzeScenes(mockExtractedScenes, jobId);

      expect(result.success).toBe(true);
      expect(result.data?.analyses).toHaveLength(1); // Only successful analysis
      expect(result.data?.errors).toHaveLength(1);
      expect(result.data?.errors[0]).toContain('segment-1');
    });

    test('should handle invalid JSON responses', async () => {
      const jobId = 'test-job-id';

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify({
          content: [{ text: 'Invalid JSON response' }],
        })),
      });

      const result = await sceneAnalysis.analyzeScenes(mockExtractedScenes, jobId);

      expect(result.success).toBe(true);
      expect(result.data?.analyses).toHaveLength(0);
      expect(result.data?.errors).toHaveLength(2);
    });

    test('should respect rate limiting with retry logic', async () => {
      const jobId = 'test-job-id';
      const singleScene = [mockExtractedScenes[0]];

      // First call fails with throttling, second succeeds
      bedrockMock
        .on(InvokeModelCommand)
        .rejectsOnce({ name: 'ThrottlingException' })
        .resolvesOnce({
          body: new TextEncoder().encode(JSON.stringify({
            content: [{
              text: JSON.stringify({
                description: 'Scene analyzed after retry',
                visualElements: ['element'],
                actions: ['action'],
                context: 'context',
                confidence: 85.0,
              }),
            }],
          })),
        });

      const result = await sceneAnalysis.analyzeScenes(singleScene, jobId);

      expect(result.success).toBe(true);
      expect(result.data?.analyses).toHaveLength(1);
      expect(result.data?.analyses[0].description).toContain('Scene analyzed after retry');
    });
  });

  describe('analyzeSingleScene', () => {
    test('should analyze single scene with correct prompt', async () => {
      const scene = mockExtractedScenes[0];
      const mockResponse = {
        content: [{
          text: JSON.stringify({
            description: 'Detailed scene description',
            visualElements: ['person', 'background'],
            actions: ['walking', 'looking'],
            context: 'urban environment',
            confidence: 92.3,
          }),
        }],
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify(mockResponse)),
      });

      const result = await sceneAnalysis.analyzeSingleScene(scene);

      expect(result.success).toBe(true);
      expect(result.data?.segmentId).toBe('segment-0');
      expect(result.data?.description).toBe('Detailed scene description');
      expect(result.data?.visualElements).toEqual(['person', 'background']);
      expect(result.data?.actions).toEqual(['walking', 'looking']);
      expect(result.data?.context).toBe('urban environment');
      expect(result.data?.confidence).toBe(92.3);

      // Verify the prompt was constructed correctly
      const invokeCall = bedrockMock.commandCalls(InvokeModelCommand)[0];
      const requestBody = JSON.parse(new TextDecoder().decode(invokeCall.args[0].input.body));
      expect(requestBody.messages[0].content[0].text).toContain('accessibility audio description');
      expect(requestBody.messages[0].content[1].source.data).toBeDefined(); // Base64 video data
    });

    test('should handle file read errors', async () => {
      const scene = mockExtractedScenes[0];

      const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;
      fsMock.readFile.mockRejectedValue(new Error('File not found'));

      const result = await sceneAnalysis.analyzeSingleScene(scene);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_READ_FAILED');
    });

    test('should handle Bedrock model errors', async () => {
      const scene = mockExtractedScenes[0];

      bedrockMock.on(InvokeModelCommand).rejects({
        name: 'ValidationException',
        message: 'Invalid model parameters',
      });

      const result = await sceneAnalysis.analyzeSingleScene(scene);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BEDROCK_ANALYSIS_FAILED');
      expect(result.error?.details).toContain('Invalid model parameters');
    });
  });

  describe('encodeVideoToBase64', () => {
    test('should encode video file to base64', async () => {
      const filePath = '/tmp/test-video.mp4';
      const mockBuffer = Buffer.from('mock video data');

      const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;
      fsMock.readFile.mockResolvedValue(mockBuffer);

      const result = await sceneAnalysis.encodeVideoToBase64(filePath);

      expect(result.success).toBe(true);
      expect(result.data?.base64Data).toBe(mockBuffer.toString('base64'));
      expect(result.data?.mimeType).toBe('video/mp4');
    });

    test('should handle file read errors', async () => {
      const filePath = '/tmp/nonexistent.mp4';

      const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;
      fsMock.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await sceneAnalysis.encodeVideoToBase64(filePath);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_READ_FAILED');
    });

    test('should detect correct MIME type for different extensions', async () => {
      const testCases = [
        { path: '/tmp/video.mp4', expectedMime: 'video/mp4' },
        { path: '/tmp/video.avi', expectedMime: 'video/avi' },
        { path: '/tmp/video.mov', expectedMime: 'video/quicktime' },
        { path: '/tmp/video.webm', expectedMime: 'video/webm' },
        { path: '/tmp/video.unknown', expectedMime: 'video/mp4' }, // Default
      ];

      const fsMock = fs.promises as jest.Mocked<typeof fs.promises>;
      fsMock.readFile.mockResolvedValue(Buffer.from('test'));

      for (const testCase of testCases) {
        const result = await sceneAnalysis.encodeVideoToBase64(testCase.path);
        expect(result.success).toBe(true);
        expect(result.data?.mimeType).toBe(testCase.expectedMime);
      }
    });
  });

  describe('constructAnalysisPrompt', () => {
    test('should construct proper analysis prompt for accessibility', () => {
      const scene = mockExtractedScenes[0];
      const prompt = sceneAnalysis.constructAnalysisPrompt(scene);

      expect(prompt).toContain('accessibility audio description');
      expect(prompt).toContain('visually impaired');
      expect(prompt).toContain('JSON format');
      expect(prompt).toContain('description');
      expect(prompt).toContain('visualElements');
      expect(prompt).toContain('actions');
      expect(prompt).toContain('context');
      expect(prompt).toContain('confidence');
      expect(prompt).toContain(`Duration: ${scene.duration.toFixed(1)} seconds`);
    });
  });

  describe('parseBedrockResponse', () => {
    test('should parse valid Bedrock response', () => {
      const validResponse = {
        content: [{
          text: JSON.stringify({
            description: 'Test description',
            visualElements: ['element1', 'element2'],
            actions: ['action1'],
            context: 'test context',
            confidence: 88.5,
          }),
        }],
      };

      const result = sceneAnalysis.parseBedrockResponse(validResponse, 'segment-0');

      expect(result.success).toBe(true);
      expect(result.data?.description).toBe('Test description');
      expect(result.data?.visualElements).toEqual(['element1', 'element2']);
      expect(result.data?.confidence).toBe(88.5);
    });

    test('should handle missing content', () => {
      const invalidResponse = {};

      const result = sceneAnalysis.parseBedrockResponse(invalidResponse, 'segment-0');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_RESPONSE_FORMAT');
    });

    test('should handle invalid JSON in content', () => {
      const invalidResponse = {
        content: [{ text: 'Not valid JSON' }],
      };

      const result = sceneAnalysis.parseBedrockResponse(invalidResponse, 'segment-0');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('JSON_PARSE_FAILED');
    });

    test('should validate required fields', () => {
      const incompleteResponse = {
        content: [{
          text: JSON.stringify({
            description: 'Missing other fields',
          }),
        }],
      };

      const result = sceneAnalysis.parseBedrockResponse(incompleteResponse, 'segment-0');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MISSING_REQUIRED_FIELDS');
    });
  });
});