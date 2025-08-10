/** @type {import('jest').Config} */
module.exports = {
  displayName: 'MCP Server Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/mcp'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@mcp/(.*)$': '<rootDir>/mcp-server/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1',
    '^@utils/(.*)$': '<rootDir>/tests/utils/$1'
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/mcp/setup/globalSetup.ts',
    '<rootDir>/tests/mcp/setup/mockSetup.ts'
  ],
  collectCoverageFrom: [
    'mcp-server/src/**/*.{js,jsx,ts,tsx}',
    '!mcp-server/src/**/*.d.ts',
    '!mcp-server/src/**/*.stories.{js,jsx,ts,tsx}',
    '!mcp-server/src/**/__tests__/**',
    '!mcp-server/src/**/types.ts',
    '!mcp-server/src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 88,
      lines: 90,
      statements: 90
    },
    './mcp-server/src/protocol/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './mcp-server/src/tools/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './mcp-server/src/auth/': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    }
  },
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'text-summary',
    'html',
    'cobertura'
  ],
  testTimeout: 30000,
  maxWorkers: '50%',
  bail: false,
  verbose: true,
  errorOnDeprecated: true,
  
  // Test categories for selective execution
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/tests/mcp/unit/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/mcp/setup/unitSetup.ts']
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/tests/mcp/integration/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/mcp/setup/integrationSetup.ts'],
      testTimeout: 60000
    },
    {
      displayName: 'E2E Tests',
      testMatch: ['<rootDir>/tests/mcp/e2e/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/mcp/setup/e2eSetup.ts'],
      testTimeout: 120000,
      maxWorkers: 1
    },
    {
      displayName: 'Performance Tests',
      testMatch: ['<rootDir>/tests/mcp/performance/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/mcp/setup/performanceSetup.ts'],
      testTimeout: 300000,
      maxWorkers: 1
    },
    {
      displayName: 'Security Tests',
      testMatch: ['<rootDir>/tests/mcp/security/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/mcp/setup/securitySetup.ts'],
      testTimeout: 60000
    }
  ],
  
  // Custom reporters for CI/CD integration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results/mcp',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }],
    ['jest-html-reporters', {
      publicPath: './test-results/mcp/html',
      filename: 'test-report.html',
      expand: true,
      pageTitle: 'MCP Server Test Report',
      logoImgPath: './assets/logo.png',
      hideIcon: false,
      customInfos: [
        {
          title: 'Test Environment',
          value: process.env.NODE_ENV || 'test'
        },
        {
          title: 'MCP Version',
          value: process.env.MCP_VERSION || '1.0.0'
        }
      ]
    }]
  ],
  
  // Global test utilities
  globals: {
    'ts-jest': {
      isolatedModules: true,
      diagnostics: {
        warnOnly: true
      }
    },
    __TEST_TIMEOUT__: 30000,
    __MCP_SERVER_URL__: process.env.MCP_SERVER_URL || 'http://localhost:3001',
    __API_BASE_URL__: process.env.API_BASE_URL || 'http://localhost:3000',
    __USE_MOCK_AWS__: process.env.USE_MOCK_AWS !== 'false'
  }
};