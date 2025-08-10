#!/usr/bin/env node

/**
 * CI/CD Test Scripts
 * Collection of scripts for test automation, reporting, and threshold checking
 */

const fs = require('fs');
const path = require('path');

// Script: generate-performance-report.js
function generatePerformanceReport() {
  const metricsFile = path.join(process.cwd(), 'test-results', 'performance-metrics.json');
  const reportDir = path.join(process.cwd(), 'performance-report');
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  try {
    const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        avgResponseTime: calculateAverage(metrics.responseTimes),
        p95ResponseTime: calculatePercentile(metrics.responseTimes, 95),
        p99ResponseTime: calculatePercentile(metrics.responseTimes, 99),
        throughput: metrics.throughput,
        errorRate: metrics.errorRate,
        concurrentUsers: metrics.concurrentUsers
      },
      details: {
        singleImageProcessing: {
          small: metrics.singleImage?.small || {},
          large: metrics.singleImage?.large || {}
        },
        batchProcessing: {
          count: metrics.batch?.count || 0,
          totalTime: metrics.batch?.totalTime || 0,
          imagesPerSecond: metrics.batch?.throughput || 0
        },
        memoryUsage: {
          peak: metrics.memory?.peak || 0,
          average: metrics.memory?.average || 0
        },
        cpuUsage: {
          peak: metrics.cpu?.peak || 0,
          average: metrics.cpu?.average || 0
        }
      },
      thresholds: {
        passed: checkPerformanceThresholds(metrics),
        details: getThresholdDetails(metrics)
      }
    };
    
    // Generate HTML report
    const htmlReport = generateHTMLReport(report);
    fs.writeFileSync(path.join(reportDir, 'index.html'), htmlReport);
    
    // Generate JSON report
    fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2));
    
    // Generate markdown summary
    const markdownSummary = generateMarkdownSummary(report);
    fs.writeFileSync(path.join(reportDir, 'summary.md'), markdownSummary);
    
    console.log('Performance report generated successfully');
    return report;
    
  } catch (error) {
    console.error('Failed to generate performance report:', error);
    process.exit(1);
  }
}

// Script: check-performance-thresholds.js
function checkPerformanceThresholds() {
  const metricsFile = path.join(process.cwd(), 'test-results', 'performance-metrics.json');
  
  const thresholds = {
    singleImageProcessing: 15000, // 15 seconds
    batchProcessing: 60000, // 60 seconds
    memoryUsageMB: 512,
    cpuUsagePercent: 80,
    errorRate: 0.05, // 5%
    p95ResponseTime: 20000 // 20 seconds
  };
  
  try {
    const metrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
    const failures = [];
    
    // Check single image processing
    if (metrics.singleImage?.large?.time > thresholds.singleImageProcessing) {
      failures.push(`Single image processing exceeded threshold: ${metrics.singleImage.large.time}ms > ${thresholds.singleImageProcessing}ms`);
    }
    
    // Check batch processing
    if (metrics.batch?.totalTime > thresholds.batchProcessing) {
      failures.push(`Batch processing exceeded threshold: ${metrics.batch.totalTime}ms > ${thresholds.batchProcessing}ms`);
    }
    
    // Check memory usage
    if (metrics.memory?.peak > thresholds.memoryUsageMB) {
      failures.push(`Memory usage exceeded threshold: ${metrics.memory.peak}MB > ${thresholds.memoryUsageMB}MB`);
    }
    
    // Check CPU usage
    if (metrics.cpu?.peak > thresholds.cpuUsagePercent) {
      failures.push(`CPU usage exceeded threshold: ${metrics.cpu.peak}% > ${thresholds.cpuUsagePercent}%`);
    }
    
    // Check error rate
    if (metrics.errorRate > thresholds.errorRate) {
      failures.push(`Error rate exceeded threshold: ${metrics.errorRate * 100}% > ${thresholds.errorRate * 100}%`);
    }
    
    // Check P95 response time
    const p95 = calculatePercentile(metrics.responseTimes || [], 95);
    if (p95 > thresholds.p95ResponseTime) {
      failures.push(`P95 response time exceeded threshold: ${p95}ms > ${thresholds.p95ResponseTime}ms`);
    }
    
    if (failures.length > 0) {
      console.error('Performance threshold violations:');
      failures.forEach(f => console.error(`  - ${f}`));
      process.exit(1);
    }
    
    console.log('All performance thresholds passed ✓');
    return true;
    
  } catch (error) {
    console.error('Failed to check performance thresholds:', error);
    process.exit(1);
  }
}

// Script: generate-accessibility-report.js
function generateAccessibilityReport() {
  const resultsFile = path.join(process.cwd(), 'test-results', 'accessibility-results.json');
  const reportDir = path.join(process.cwd(), 'accessibility-report');
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  try {
    const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: results.total,
        passed: results.passed,
        failed: results.failed,
        wcagCompliance: {
          levelA: results.wcag?.levelA || { passed: 0, total: 0 },
          levelAA: results.wcag?.levelAA || { passed: 0, total: 0 },
          levelAAA: results.wcag?.levelAAA || { passed: 0, total: 0 }
        },
        screenReaderCompatibility: results.screenReaders || {}
      },
      details: {
        altTextValidation: results.altText || {},
        descriptionQuality: results.descriptions || {},
        htmlAccessibility: results.html || {},
        confidenceScores: results.confidence || {}
      },
      issues: results.issues || [],
      recommendations: generateRecommendations(results)
    };
    
    // Generate HTML report
    const htmlReport = generateAccessibilityHTMLReport(report);
    fs.writeFileSync(path.join(reportDir, 'index.html'), htmlReport);
    
    // Generate JSON report
    fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2));
    
    // Generate WCAG compliance report
    const wcagReport = generateWCAGReport(report);
    fs.writeFileSync(path.join(reportDir, 'wcag-compliance.md'), wcagReport);
    
    console.log('Accessibility report generated successfully');
    return report;
    
  } catch (error) {
    console.error('Failed to generate accessibility report:', error);
    process.exit(1);
  }
}

// Script: check-wcag-compliance.js
function checkWCAGCompliance() {
  const resultsFile = path.join(process.cwd(), 'test-results', 'accessibility-results.json');
  
  const requirements = {
    levelA: 0.95, // 95% pass rate for Level A
    levelAA: 0.90, // 90% pass rate for Level AA
    minConfidence: 0.85 // Minimum confidence score
  };
  
  try {
    const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    const failures = [];
    
    // Check Level A compliance
    const levelARate = results.wcag?.levelA?.passed / results.wcag?.levelA?.total || 0;
    if (levelARate < requirements.levelA) {
      failures.push(`WCAG Level A compliance below threshold: ${(levelARate * 100).toFixed(1)}% < ${requirements.levelA * 100}%`);
    }
    
    // Check Level AA compliance
    const levelAARate = results.wcag?.levelAA?.passed / results.wcag?.levelAA?.total || 0;
    if (levelAARate < requirements.levelAA) {
      failures.push(`WCAG Level AA compliance below threshold: ${(levelAARate * 100).toFixed(1)}% < ${requirements.levelAA * 100}%`);
    }
    
    // Check confidence scores
    const avgConfidence = results.confidence?.average || 0;
    if (avgConfidence < requirements.minConfidence) {
      failures.push(`Average confidence below threshold: ${avgConfidence} < ${requirements.minConfidence}`);
    }
    
    if (failures.length > 0) {
      console.error('WCAG compliance violations:');
      failures.forEach(f => console.error(`  - ${f}`));
      process.exit(1);
    }
    
    console.log('WCAG compliance check passed ✓');
    console.log(`  Level A: ${(levelARate * 100).toFixed(1)}%`);
    console.log(`  Level AA: ${(levelAARate * 100).toFixed(1)}%`);
    console.log(`  Avg Confidence: ${avgConfidence.toFixed(2)}`);
    return true;
    
  } catch (error) {
    console.error('Failed to check WCAG compliance:', error);
    process.exit(1);
  }
}

// Helper functions
function calculateAverage(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculatePercentile(values, percentile) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

function generateHTMLReport(report) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Test Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .metric { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .pass { color: green; }
    .fail { color: red; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    .chart { margin: 20px 0; }
  </style>
</head>
<body>
  <h1>Performance Test Report</h1>
  <p>Generated: ${report.timestamp}</p>
  
  <div class="metric">
    <h2>Summary</h2>
    <table>
      <tr><th>Metric</th><th>Value</th><th>Status</th></tr>
      <tr>
        <td>Average Response Time</td>
        <td>${report.summary.avgResponseTime}ms</td>
        <td class="${report.summary.avgResponseTime < 10000 ? 'pass' : 'fail'}">
          ${report.summary.avgResponseTime < 10000 ? '✓' : '✗'}
        </td>
      </tr>
      <tr>
        <td>P95 Response Time</td>
        <td>${report.summary.p95ResponseTime}ms</td>
        <td class="${report.summary.p95ResponseTime < 20000 ? 'pass' : 'fail'}">
          ${report.summary.p95ResponseTime < 20000 ? '✓' : '✗'}
        </td>
      </tr>
      <tr>
        <td>Throughput</td>
        <td>${report.summary.throughput} req/s</td>
        <td class="pass">✓</td>
      </tr>
      <tr>
        <td>Error Rate</td>
        <td>${(report.summary.errorRate * 100).toFixed(2)}%</td>
        <td class="${report.summary.errorRate < 0.05 ? 'pass' : 'fail'}">
          ${report.summary.errorRate < 0.05 ? '✓' : '✗'}
        </td>
      </tr>
    </table>
  </div>
  
  <div class="metric">
    <h2>Threshold Status</h2>
    <p class="${report.thresholds.passed ? 'pass' : 'fail'}">
      ${report.thresholds.passed ? 'All thresholds passed ✓' : 'Some thresholds failed ✗'}
    </p>
  </div>
</body>
</html>
  `;
}

function generateMarkdownSummary(report) {
  return `
# Performance Test Summary

**Generated:** ${report.timestamp}

## Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Avg Response Time | ${report.summary.avgResponseTime}ms | ${report.summary.avgResponseTime < 10000 ? '✅' : '❌'} |
| P95 Response Time | ${report.summary.p95ResponseTime}ms | ${report.summary.p95ResponseTime < 20000 ? '✅' : '❌'} |
| P99 Response Time | ${report.summary.p99ResponseTime}ms | ${report.summary.p99ResponseTime < 30000 ? '✅' : '❌'} |
| Throughput | ${report.summary.throughput} req/s | ✅ |
| Error Rate | ${(report.summary.errorRate * 100).toFixed(2)}% | ${report.summary.errorRate < 0.05 ? '✅' : '❌'} |

## Resource Usage

- **Memory Peak:** ${report.details.memoryUsage.peak}MB
- **Memory Average:** ${report.details.memoryUsage.average}MB
- **CPU Peak:** ${report.details.cpuUsage.peak}%
- **CPU Average:** ${report.details.cpuUsage.average}%

## Test Results

${report.thresholds.passed ? '✅ **All performance thresholds passed**' : '❌ **Some performance thresholds failed**'}
  `;
}

function generateAccessibilityHTMLReport(report) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Test Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f0f8ff; padding: 20px; border-radius: 5px; margin: 20px 0; }
    .wcag-level { display: inline-block; padding: 5px 10px; margin: 5px; border-radius: 3px; }
    .level-a { background: #90EE90; }
    .level-aa { background: #87CEEB; }
    .level-aaa { background: #DDA0DD; }
    .issues { background: #fff0f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .issue { padding: 5px 0; }
    .recommendation { background: #f0fff0; padding: 10px; margin: 5px 0; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Accessibility Test Report</h1>
  <p>Generated: ${report.timestamp}</p>
  
  <div class="summary">
    <h2>Summary</h2>
    <p>Total Tests: ${report.summary.totalTests}</p>
    <p>Passed: ${report.summary.passed} | Failed: ${report.summary.failed}</p>
    
    <h3>WCAG Compliance</h3>
    <div>
      <span class="wcag-level level-a">
        Level A: ${report.summary.wcagCompliance.levelA.passed}/${report.summary.wcagCompliance.levelA.total}
      </span>
      <span class="wcag-level level-aa">
        Level AA: ${report.summary.wcagCompliance.levelAA.passed}/${report.summary.wcagCompliance.levelAA.total}
      </span>
      <span class="wcag-level level-aaa">
        Level AAA: ${report.summary.wcagCompliance.levelAAA.passed}/${report.summary.wcagCompliance.levelAAA.total}
      </span>
    </div>
  </div>
  
  ${report.issues.length > 0 ? `
  <div class="issues">
    <h2>Issues Found</h2>
    ${report.issues.map(issue => `<div class="issue">⚠️ ${issue}</div>`).join('')}
  </div>
  ` : ''}
  
  <div class="recommendations">
    <h2>Recommendations</h2>
    ${report.recommendations.map(rec => `<div class="recommendation">💡 ${rec}</div>`).join('')}
  </div>
</body>
</html>
  `;
}

function generateWCAGReport(report) {
  const levelA = report.summary.wcagCompliance.levelA;
  const levelAA = report.summary.wcagCompliance.levelAA;
  const levelAAA = report.summary.wcagCompliance.levelAAA;
  
  return `
# WCAG 2.1 Compliance Report

## Compliance Summary

| Level | Passed | Total | Percentage | Status |
|-------|--------|-------|------------|--------|
| A | ${levelA.passed} | ${levelA.total} | ${((levelA.passed/levelA.total)*100).toFixed(1)}% | ${levelA.passed/levelA.total >= 0.95 ? '✅ Compliant' : '❌ Non-compliant'} |
| AA | ${levelAA.passed} | ${levelAA.total} | ${((levelAA.passed/levelAA.total)*100).toFixed(1)}% | ${levelAA.passed/levelAA.total >= 0.90 ? '✅ Compliant' : '❌ Non-compliant'} |
| AAA | ${levelAAA.passed} | ${levelAAA.total} | ${((levelAAA.passed/levelAAA.total)*100).toFixed(1)}% | ${levelAAA.passed/levelAAA.total >= 0.85 ? '✅ Compliant' : '⚠️ Partial'} |

## Key Findings

### Alt Text Validation
- Average length: ${report.details.altTextValidation?.avgLength || 'N/A'} characters
- Redundant phrases found: ${report.details.altTextValidation?.redundantPhrases || 0}
- Missing alt text: ${report.details.altTextValidation?.missing || 0}

### Description Quality
- Average confidence: ${report.details.descriptionQuality?.avgConfidence || 'N/A'}
- Readability score: ${report.details.descriptionQuality?.readability || 'N/A'}
- Completeness: ${report.details.descriptionQuality?.completeness || 'N/A'}%

### Screen Reader Compatibility
${Object.entries(report.summary.screenReaderCompatibility || {}).map(([reader, compat]) => 
  `- ${reader}: ${compat}%`
).join('\n')}

## Recommendations

${report.recommendations.join('\n- ')}
  `;
}

function generateRecommendations(results) {
  const recommendations = [];
  
  if (results.altText?.tooShort > 0) {
    recommendations.push('Increase alt text length to provide more descriptive information');
  }
  
  if (results.altText?.redundantPhrases > 0) {
    recommendations.push('Remove redundant phrases like "image of" from alt text');
  }
  
  if (results.confidence?.average < 0.90) {
    recommendations.push('Consider reprocessing low-confidence images with higher quality settings');
  }
  
  if (results.wcag?.levelAA?.passed / results.wcag?.levelAA?.total < 0.95) {
    recommendations.push('Focus on improving WCAG Level AA compliance for better accessibility');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Continue maintaining high accessibility standards');
  }
  
  return recommendations;
}

function getThresholdDetails(metrics) {
  return {
    singleImage: metrics.singleImage?.large?.time < 15000,
    batchProcessing: metrics.batch?.totalTime < 60000,
    memoryUsage: metrics.memory?.peak < 512,
    cpuUsage: metrics.cpu?.peak < 80,
    errorRate: metrics.errorRate < 0.05,
    p95ResponseTime: calculatePercentile(metrics.responseTimes || [], 95) < 20000
  };
}

// Export functions for use as scripts
module.exports = {
  generatePerformanceReport,
  checkPerformanceThresholds,
  generateAccessibilityReport,
  checkWCAGCompliance
};

// Run specific script based on command line argument
if (require.main === module) {
  const script = process.argv[2];
  
  switch (script) {
    case 'performance-report':
      generatePerformanceReport();
      break;
    case 'performance-thresholds':
      checkPerformanceThresholds();
      break;
    case 'accessibility-report':
      generateAccessibilityReport();
      break;
    case 'wcag-compliance':
      checkWCAGCompliance();
      break;
    default:
      console.log('Usage: node test-ci-scripts.js [performance-report|performance-thresholds|accessibility-report|wcag-compliance]');
      process.exit(1);
  }
}