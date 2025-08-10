import { jest } from '@jest/globals';

// Mock logger to reduce noise in tests
jest.mock('../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  logToolExecution: jest.fn(),
  logToolResult: jest.fn(),
  logAPICall: jest.fn(),
  logAPIResponse: jest.fn(),
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.API_BASE_URL = 'http://localhost:3000';
process.env.LOG_LEVEL = 'error';
process.env.MCP_TRANSPORT = 'stdio';
process.env.TEMP_DIRECTORY = '/tmp/mcp-voice-desc-test';

// Global test timeout
jest.setTimeout(30000);