/**
 * Jest Configuration for OpenAI Dual-Pipeline Tests
 * Comprehensive test setup with coverage targets and performance benchmarks
 */

module.exports = {
  displayName: 'OpenAI Pipeline Tests',
  testEnvironment: 'node',
  preset: 'ts-jest',
  
  // Test file patterns
  testMatch: [
    '**/tests/unit/modules/openai*.test.ts',
    '**/tests/integration/openai*.test.ts',
    '**/tests/performance/openai*.test.ts',
    '**/tests/quality/openai*.test.ts'
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage/openai',
  collectCoverageFrom: [
    'src/modules/openai/**/*.{ts,js}',
    'src/modules/openaiImageAnalysis.{ts,js}',
    'src/modules/openaiVideoAnalysis.{ts,js}',
    'src/modules/videoChunking.{ts,js}',
    'src/modules/descriptionSynthesis.{ts,js}',
    '!**/*.test.{ts,js}',
    '!**/node_modules/**',
    '!**/dist/**'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/modules/openai/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@openai/(.*)$': '<rootDir>/src/modules/openai/$1',
    '^@mocks/(.*)$': '<rootDir>/tests/utils/$1'
  },

  // Setup files
  setupFiles: [
    '<rootDir>/tests/setup/env.setup.js',
    '<rootDir>/tests/setup/openai.setup.js'
  ],

  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.js'
  ],

  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },

  // Test timeout
  testTimeout: 30000,

  // Globals
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  },

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './reports/openai',
        filename: 'test-report.html',
        openReport: false,
        pageTitle: 'OpenAI Pipeline Test Report',
        logoImgPath: './assets/logo.png',
        hideIcon: false,
        expand: false
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './reports/openai',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true
      }
    ]
  ],

  // Watch configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Performance monitoring
  maxWorkers: '50%',
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  // Error handling
  bail: false,
  verbose: true,
  errorOnDeprecated: true,

  // Custom matchers
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/.next/',
    '/coverage/'
  ],

  // Module file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Snapshot configuration
  snapshotSerializers: [
    'jest-serializer-html'
  ],

  // Custom test environment variables
  testEnvironmentOptions: {
    env: {
      OPENAI_API_KEY: 'test-key',
      NODE_ENV: 'test',
      PIPELINE_MODE: 'dual',
      ENABLE_CACHE: 'true',
      MAX_CONCURRENT_REQUESTS: '10',
      QUALITY_THRESHOLD: '75',
      ENABLE_MONITORING: 'true'
    }
  }
};