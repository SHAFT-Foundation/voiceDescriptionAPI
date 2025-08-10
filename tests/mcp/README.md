# MCP Server Testing Framework

## Overview

This directory contains the comprehensive testing framework for the Voice Description API MCP Server. The framework ensures high reliability, security, and performance for AI assistant integrations through systematic testing at multiple levels.

## 📁 Directory Structure

```
tests/mcp/
├── README.md                           # This file
├── MCP_TEST_STRATEGY.md               # Comprehensive testing strategy
├── TEST_SCENARIOS.md                  # Detailed test scenarios and examples
├── QUALITY_GATES.md                   # Quality gate configuration and requirements
├── jest.config.mcp.js                 # Jest configuration for MCP tests
│
├── unit/                              # Unit tests
│   ├── tools/                         # Tool implementation tests
│   │   ├── uploadVideo.test.ts       # Video upload tool tests
│   │   ├── processImage.test.ts      # Image processing tool tests
│   │   └── ...
│   ├── protocol/                      # Protocol handler tests
│   └── services/                      # Service adapter tests
│
├── integration/                       # Integration tests
│   ├── mcpServerIntegration.test.ts  # Complete MCP server integration
│   ├── apiConnectivity.test.ts       # API connectivity tests
│   └── toolOrchestration.test.ts     # Tool orchestration tests
│
├── e2e/                              # End-to-end tests
│   ├── videoWorkflow.test.ts         # Complete video processing workflow
│   ├── imageWorkflow.test.ts         # Complete image processing workflow
│   └── errorRecovery.test.ts         # Error recovery scenarios
│
├── performance/                       # Performance tests
│   ├── load-test.yml                 # Artillery load test configuration
│   ├── stress-test.js                # Stress testing scenarios
│   ├── performance-processor.js      # Custom metrics processor
│   └── analyze-results.js            # Performance analysis script
│
├── security/                          # Security tests
│   ├── authentication.test.ts        # Auth testing
│   ├── authorization.test.ts         # Access control testing
│   └── vulnerability.test.ts         # Security vulnerability tests
│
├── utils/                            # Test utilities
│   ├── testHelpers.ts               # Common test helper functions
│   ├── mockServices.ts              # Mock service implementations
│   └── fixtures.ts                  # Test data generators
│
├── fixtures/                         # Test data
│   ├── videos/                      # Test video files
│   ├── images/                      # Test image files
│   └── responses/                   # Mock response data
│
└── setup/                           # Test setup files
    ├── globalSetup.ts               # Global test setup
    ├── mockSetup.ts                 # Mock configuration
    └── teardown.ts                  # Test cleanup
```

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Install test-specific dependencies
npm install -D @testing-library/react @testing-library/jest-dom
npm install -D artillery autocannon
npm install -D jest-junit jest-html-reporters

# Setup test environment
cp .env.test.example .env.test
```

### Running Tests

```bash
# Run all MCP tests
npm run test:mcp

# Run specific test suites
npm run test:mcp:unit          # Unit tests only
npm run test:mcp:integration   # Integration tests
npm run test:mcp:e2e           # End-to-end tests
npm run test:mcp:performance   # Performance tests
npm run test:mcp:security      # Security tests

# Run with coverage
npm run test:mcp:coverage

# Run in watch mode (development)
npm run test:mcp:watch

# Run specific test file
npm test tests/mcp/unit/tools/uploadVideo.test.ts
```

### CI/CD Integration

```bash
# Run tests in CI mode
npm run test:mcp:ci

# Check quality gates
npm run quality:gates:check

# Generate test reports
npm run test:mcp:report
```

## 📊 Test Coverage Requirements

### Minimum Coverage Thresholds

| Component | Lines | Functions | Branches | Statements |
|-----------|-------|-----------|----------|------------|
| Overall | 90% | 88% | 85% | 90% |
| Protocol Handler | 95% | 95% | 95% | 95% |
| Tool Implementations | 90% | 90% | 85% | 90% |
| Authentication | 100% | 100% | 100% | 100% |
| Error Handling | 95% | 95% | 90% | 95% |

### Running Coverage Reports

```bash
# Generate coverage report
npm run test:mcp:coverage

# View HTML coverage report
open coverage/lcov-report/index.html

# Upload to Codecov (CI only)
npm run coverage:upload
```

## 🎯 Testing Strategy

### 1. Unit Testing (60% of tests)
- Test individual MCP tools in isolation
- Mock all external dependencies (AWS services, API calls)
- Focus on business logic and error handling
- Fast execution (<5 minutes for full suite)

### 2. Integration Testing (30% of tests)
- Test tool interactions with Voice Description API
- Use LocalStack for AWS service mocking
- Validate data flow between components
- Medium execution time (~15 minutes)

### 3. E2E Testing (10% of tests)
- Test complete user workflows
- Run against staging environment
- Validate real-world scenarios
- Longer execution time (~30 minutes)

## 🏃 Performance Testing

### Load Testing

```bash
# Run load test with Artillery
artillery run tests/mcp/performance/load-test.yml

# Run stress test
node tests/mcp/performance/stress-test.js

# Analyze results
node tests/mcp/performance/analyze-results.js
```

### Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| P50 Response Time | <200ms | <500ms |
| P95 Response Time | <500ms | <1000ms |
| P99 Response Time | <1000ms | <2000ms |
| Throughput | >100 req/s | >50 req/s |
| Error Rate | <0.1% | <1% |

## 🔒 Security Testing

### Security Checks

```bash
# Run security tests
npm run test:mcp:security

# OWASP dependency check
npm run security:owasp

# Snyk vulnerability scan
npm run security:snyk

# ZAP security scan (requires Docker)
npm run security:zap
```

### Security Requirements

- Zero critical vulnerabilities
- Maximum 3 high-severity issues
- All authentication tests must pass 100%
- Input validation coverage >95%

## 🏁 Quality Gates

### Pre-Commit Checks
```bash
# Run pre-commit checks
npm run precommit:mcp

# Checks include:
# - Linting (ESLint)
# - Type checking (TypeScript)
# - Code formatting (Prettier)
# - Unit tests
```

### Pull Request Requirements
- All tests must pass
- Coverage thresholds met
- No security vulnerabilities
- Performance benchmarks passed
- 2+ code review approvals

### Deployment Gates
- E2E tests passed
- Load testing successful
- Security audit passed
- Rollback plan documented
- Monitoring configured

## 🛠 Test Development

### Writing New Tests

1. **Create test file** following naming convention:
   - Unit: `*.test.ts`
   - Integration: `*.integration.test.ts`
   - E2E: `*.e2e.test.ts`

2. **Use test helpers**:
```typescript
import { MCPClient, createMockAWSServices } from '../utils/testHelpers';

describe('My Test Suite', () => {
  let client: MCPClient;
  
  beforeEach(() => {
    client = new MCPClient();
  });
  
  test('should do something', async () => {
    const result = await client.callTool('tool_name', { /* args */ });
    expect(result.success).toBe(true);
  });
});
```

3. **Follow testing best practices**:
   - Write descriptive test names
   - Use proper setup/teardown
   - Mock external dependencies
   - Test edge cases
   - Clean up resources

### Test Data Management

```typescript
// Use test data generators
import { TestDataGenerator } from '../utils/testHelpers';

const videoFile = await TestDataGenerator.createTestVideo('test.mp4', 10);
const imageFile = await TestDataGenerator.createTestImage('test.jpg');
const corruptedFile = await TestDataGenerator.createCorruptedFile('bad.mp4');
```

## 📈 Monitoring & Reporting

### Test Reports

Reports are generated in multiple formats:
- **JUnit XML**: `test-results/mcp/junit.xml`
- **HTML Report**: `test-results/mcp/html/test-report.html`
- **Coverage Report**: `coverage/lcov-report/index.html`
- **Performance Report**: `tests/mcp/performance/results/`

### CI/CD Dashboard

View test results in:
- GitHub Actions: Check workflow runs
- Codecov: Coverage trends
- SonarQube: Code quality metrics
- Datadog: Performance monitoring

## 🔧 Troubleshooting

### Common Issues

#### Tests Failing Locally
```bash
# Clear test cache
npm run test:mcp:clear-cache

# Reset test database
npm run test:db:reset

# Check environment variables
npm run test:env:check
```

#### Coverage Not Meeting Threshold
```bash
# Find uncovered lines
npm run coverage:report:detailed

# Generate coverage for specific file
npm test -- --coverage --collectCoverageFrom=src/mcp/tools/uploadVideo.ts
```

#### Performance Tests Timing Out
```bash
# Increase timeout
TEST_TIMEOUT=300000 npm run test:mcp:performance

# Run with fewer concurrent users
artillery run tests/mcp/performance/load-test.yml --overrides '{"config":{"phases":[{"duration":60,"arrivalRate":5}]}}'
```

## 📚 Documentation

- [Test Strategy](./MCP_TEST_STRATEGY.md) - Comprehensive testing approach
- [Test Scenarios](./TEST_SCENARIOS.md) - Detailed test cases and examples
- [Quality Gates](./QUALITY_GATES.md) - Quality requirements and gates
- [Performance Guide](./performance/README.md) - Performance testing details
- [Security Testing](./security/README.md) - Security testing approach

## 🤝 Contributing

### Adding New Tests

1. Create test file in appropriate directory
2. Follow existing patterns and helpers
3. Ensure coverage targets are met
4. Update documentation if needed
5. Submit PR with test results

### Test Review Checklist

- [ ] Tests are clear and descriptive
- [ ] Proper mocking is used
- [ ] Edge cases are covered
- [ ] Resources are cleaned up
- [ ] Documentation is updated
- [ ] Coverage thresholds met

## 📞 Support

For test-related issues:
- Check [Troubleshooting](#-troubleshooting) section
- Review test logs in `logs/test/`
- Contact QA team in #mcp-testing Slack channel
- Create issue with `test` label in GitHub

## 📅 Maintenance Schedule

- **Daily**: Unit tests run on every commit
- **Hourly**: Integration tests in staging
- **Nightly**: Full test suite including E2E
- **Weekly**: Performance benchmark tests
- **Monthly**: Security vulnerability scans
- **Quarterly**: Test framework review and updates