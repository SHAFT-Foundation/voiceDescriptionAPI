# MCP Server Test Suite Documentation

## Overview

This comprehensive test suite ensures the reliability, performance, and quality of the Voice Description API MCP Server. The suite includes unit tests, integration tests, end-to-end workflows, and performance benchmarks.

## Test Architecture

```
tests/
├── unit/                  # Unit tests for individual components
│   ├── tools/            # MCP tool implementations
│   ├── adapters/         # Service adapters
│   └── utils/            # Utility functions
├── integration/          # API connectivity and service integration
├── performance/          # Load testing and performance benchmarks
├── fixtures/             # Test data and mock responses
├── utils/                # Test helpers and utilities
└── coverage-validator.js # Coverage validation script
```

## Coverage Requirements

### Overall Targets
- **Lines**: 90%
- **Functions**: 85%
- **Branches**: 80%
- **Statements**: 90%

### Component-Specific Targets
- **Tools**: 95% lines, 90% functions
- **Adapters**: 90% lines, 85% functions
- **Critical Files**: 100% coverage required

## Running Tests

### Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:performance
```

### Detailed Commands

#### Unit Tests
```bash
# Run all unit tests
npm run test:unit

# Run specific tool tests
npm test tests/unit/tools/video/upload-video.test.ts

# Run with watch mode
npm run test:watch

# Debug mode
node --inspect-brk ./node_modules/.bin/jest tests/unit
```

#### Integration Tests
```bash
# Ensure API is running
docker-compose up -d api

# Run integration tests
npm run test:integration

# Run specific workflow
npm test tests/integration/e2e-workflows.test.ts
```

#### Performance Tests
```bash
# Run Jest performance tests
npm test tests/performance/load-tests.test.ts

# Run Artillery load testing
cd tests/performance
artillery run load-test.yml

# Quick performance check
artillery quick --count 10 --num 50 http://localhost:3000/api/health
```

### Coverage Validation
```bash
# Generate coverage report
npm run test:coverage

# Validate coverage meets thresholds
node tests/coverage-validator.js

# Generate HTML report
npm run coverage:report
```

## Test Categories

### 1. Unit Tests

#### Tool Tests
- **Upload Video**: File validation, multipart upload, error handling
- **Process Image**: Single image processing, format validation
- **Batch Images**: Concurrent processing, partial failures
- **Check Status**: Job polling, caching behavior
- **Download Results**: File retrieval, format conversion

#### Adapter Tests
- **API Client**: Request construction, retry logic, authentication
- **File Handler**: File validation, stream processing, cleanup
- **Job Poller**: Polling intervals, timeout handling

### 2. Integration Tests

#### API Connectivity
- Health check endpoints
- AWS service status
- Authentication flow
- Rate limiting behavior

#### Service Integration
- S3 upload/download
- Rekognition processing
- Bedrock AI analysis
- Polly TTS synthesis

### 3. End-to-End Workflows

#### Complete Workflows
1. **Video Processing**
   - Upload → Process → Poll → Download
   - Expected time: <3 minutes

2. **Image Processing**
   - Upload → Analyze → Generate Audio
   - Expected time: <1 minute

3. **Batch Processing**
   - Multiple images → Parallel processing
   - Expected time: <2 minutes

### 4. Performance Tests

#### Load Scenarios
- **Baseline**: Single user, normal load
- **Concurrent**: 50 simultaneous users
- **Sustained**: 30 seconds continuous load
- **Spike**: 10x traffic surge

#### Performance Metrics
- **Response Time**: p50 <200ms, p95 <500ms, p99 <1000ms
- **Throughput**: >100 requests/second
- **Error Rate**: <1%
- **CPU Usage**: <70%
- **Memory**: <512MB

## Mock Data and Fixtures

### Test Data Files
```javascript
// fixtures/test-data.ts
- sampleVideoMetadata
- sampleImageMetadata
- sampleJobs
- sampleDescriptions
- sampleBatchData
- sampleAWSResponses
```

### Mock Utilities
```javascript
// utils/mocks.ts
- createMockAPIClient()
- createMockFileHandler()
- createMockJobPoller()
- createMockLogger()
```

### Test Helpers
```javascript
// utils/test-helpers.ts
- generateTestVideo()
- generateTestImage()
- createTestFile()
- cleanupTestFile()
- PerformanceMonitor
- TestCleanup
```

## CI/CD Integration

### GitHub Actions Workflow

The test suite runs automatically on:
- Push to main/develop branches
- Pull requests
- Daily scheduled runs (2 AM UTC)
- Manual workflow dispatch

### Pipeline Stages
1. **Setup**: Install dependencies, cache
2. **Lint**: Code quality checks
3. **Unit Tests**: Parallel execution (3 shards)
4. **Integration Tests**: API connectivity
5. **E2E Tests**: Complete workflows
6. **Performance Tests**: Load testing
7. **Coverage Report**: Validation and reporting

### Quality Gates
- ✅ All tests must pass
- ✅ Coverage thresholds met
- ✅ No linting errors
- ✅ Performance benchmarks satisfied
- ✅ Security scan passed

## Test Best Practices

### Writing Tests

1. **Descriptive Names**
```typescript
describe('UploadVideoTool', () => {
  describe('File Upload Success', () => {
    it('should upload video file successfully', async () => {
      // Test implementation
    });
  });
});
```

2. **Proper Setup/Teardown**
```typescript
beforeEach(() => {
  // Setup mocks and test data
});

afterEach(async () => {
  // Cleanup resources
  await cleanup.execute();
});
```

3. **Comprehensive Assertions**
```typescript
expect(result).toMatchObject({
  success: true,
  jobId: expect.stringMatching(/^[0-9a-f]{8}-/),
  message: expect.stringContaining('success'),
});
```

### Mock Strategies

1. **Service Mocking**
```typescript
mockAPIClient.upload.mockResolvedValue({
  data: mockResponses.uploadSuccess(),
});
```

2. **Error Simulation**
```typescript
mockAPIClient.processImage.mockRejectedValue(
  new Error('Network timeout')
);
```

3. **Progressive States**
```typescript
mockJobPoller.setStatuses([
  { status: 'pending', progress: 0 },
  { status: 'processing', progress: 50 },
  { status: 'completed', progress: 100 },
]);
```

## Troubleshooting

### Common Issues

#### Tests Failing Locally
```bash
# Clear Jest cache
npm run test -- --clearCache

# Run with verbose output
npm test -- --verbose

# Check for port conflicts
lsof -i :3000
```

#### Coverage Not Meeting Threshold
```bash
# Check uncovered lines
npm run test:coverage -- --collectCoverageFrom='src/**/*.ts'

# Generate detailed HTML report
npm run coverage:report
open coverage/index.html
```

#### Performance Tests Slow
```bash
# Run with limited scenarios
artillery run load-test.yml --target http://localhost:3000 --phases.0.duration 10

# Check system resources
top -o cpu
iostat -x 1
```

### Debug Mode

```bash
# Debug specific test
node --inspect-brk ./node_modules/.bin/jest tests/unit/tools/video/upload-video.test.ts

# Connect Chrome DevTools
chrome://inspect

# Use VS Code debugger
# Add breakpoint and press F5
```

## Test Metrics

### Success Criteria
- **Test Execution Time**: <5 min for unit, <15 min for integration
- **Test Flakiness**: <1% flaky tests
- **Test Maintenance**: <10% test changes per feature
- **Test Documentation**: 100% complex tests documented

### Monitoring
- Test execution trends
- Coverage trends over time
- Performance regression detection
- Flaky test identification

## Contributing

### Adding New Tests

1. **Create test file** following naming convention
2. **Import test utilities** from `utils/`
3. **Write comprehensive test cases**
4. **Verify coverage** meets requirements
5. **Update documentation** if needed

### Test Review Checklist
- [ ] Tests are descriptive and well-organized
- [ ] All edge cases covered
- [ ] Mocks properly reset between tests
- [ ] No hardcoded values or timeouts
- [ ] Resources properly cleaned up
- [ ] Coverage requirements met

## Support

For test-related issues:
1. Check this documentation
2. Review existing test examples
3. Consult test strategy document
4. Contact QA team

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Artillery Documentation](https://www.artillery.io/docs)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [MCP Protocol Specification](https://modelcontextprotocol.io/docs)