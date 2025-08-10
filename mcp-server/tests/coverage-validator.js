#!/usr/bin/env node

/**
 * Test Coverage Validator
 * Validates that test coverage meets quality gate requirements
 */

const fs = require('fs');
const path = require('path');

// Coverage thresholds
const THRESHOLDS = {
  lines: 90,
  functions: 85,
  branches: 80,
  statements: 90,
};

// Component-specific thresholds
const COMPONENT_THRESHOLDS = {
  'tools': {
    lines: 95,
    functions: 90,
    branches: 85,
    statements: 95,
  },
  'adapters': {
    lines: 90,
    functions: 85,
    branches: 80,
    statements: 90,
  },
  'utils': {
    lines: 85,
    functions: 80,
    branches: 75,
    statements: 85,
  },
};

// Files that must have 100% coverage
const CRITICAL_FILES = [
  'src/tools/registry.ts',
  'src/adapters/api-client.ts',
  'src/adapters/job-poller.ts',
];

/**
 * Load coverage report
 */
function loadCoverageReport() {
  const coveragePath = path.join(__dirname, '../coverage/coverage-summary.json');
  
  if (!fs.existsSync(coveragePath)) {
    console.error('❌ Coverage report not found. Run tests with coverage first.');
    process.exit(1);
  }
  
  try {
    const content = fs.readFileSync(coveragePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Failed to parse coverage report:', error.message);
    process.exit(1);
  }
}

/**
 * Check if coverage meets threshold
 */
function checkThreshold(actual, threshold, metric) {
  if (actual < threshold) {
    return {
      passed: false,
      message: `${metric} coverage ${actual.toFixed(2)}% is below threshold ${threshold}%`,
    };
  }
  return {
    passed: true,
    message: `${metric} coverage ${actual.toFixed(2)}% meets threshold ${threshold}%`,
  };
}

/**
 * Validate overall coverage
 */
function validateOverallCoverage(coverage) {
  console.log('\n📊 Overall Coverage Validation\n' + '='.repeat(50));
  
  const total = coverage.total;
  const results = [];
  
  for (const [metric, threshold] of Object.entries(THRESHOLDS)) {
    const actual = total[metric].pct;
    const result = checkThreshold(actual, threshold, metric);
    results.push(result);
    
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.message}`);
  }
  
  return results.every(r => r.passed);
}

/**
 * Validate component coverage
 */
function validateComponentCoverage(coverage) {
  console.log('\n🔧 Component Coverage Validation\n' + '='.repeat(50));
  
  let allPassed = true;
  
  for (const [component, thresholds] of Object.entries(COMPONENT_THRESHOLDS)) {
    console.log(`\n${component}:`);
    
    // Find files matching component
    const componentFiles = Object.entries(coverage)
      .filter(([file]) => file.includes(`/${component}/`))
      .reduce((acc, [file, data]) => {
        acc[file] = data;
        return acc;
      }, {});
    
    if (Object.keys(componentFiles).length === 0) {
      console.log('  ⚠️ No files found for component');
      continue;
    }
    
    // Calculate aggregate coverage for component
    const aggregate = calculateAggregate(componentFiles);
    
    for (const [metric, threshold] of Object.entries(thresholds)) {
      const actual = aggregate[metric].pct;
      const result = checkThreshold(actual, threshold, metric);
      
      const icon = result.passed ? '✅' : '❌';
      console.log(`  ${icon} ${result.message}`);
      
      if (!result.passed) {
        allPassed = false;
      }
    }
  }
  
  return allPassed;
}

/**
 * Validate critical files coverage
 */
function validateCriticalFiles(coverage) {
  console.log('\n🔴 Critical Files Coverage\n' + '='.repeat(50));
  
  let allPassed = true;
  
  for (const file of CRITICAL_FILES) {
    const fullPath = path.join(__dirname, '..', file);
    const fileData = Object.entries(coverage).find(([f]) => f.includes(file));
    
    if (!fileData) {
      console.log(`❌ ${file}: Not found in coverage report`);
      allPassed = false;
      continue;
    }
    
    const [, data] = fileData;
    const metrics = ['lines', 'functions', 'branches', 'statements'];
    
    let filePassed = true;
    for (const metric of metrics) {
      if (data[metric].pct < 100) {
        filePassed = false;
        break;
      }
    }
    
    const icon = filePassed ? '✅' : '❌';
    const status = filePassed ? 'Complete coverage' : 'Incomplete coverage';
    console.log(`${icon} ${file}: ${status}`);
    
    if (!filePassed) {
      console.log(`  Lines: ${data.lines.pct}%`);
      console.log(`  Functions: ${data.functions.pct}%`);
      console.log(`  Branches: ${data.branches.pct}%`);
      console.log(`  Statements: ${data.statements.pct}%`);
      allPassed = false;
    }
  }
  
  return allPassed;
}

/**
 * Find uncovered files
 */
function findUncoveredFiles(coverage) {
  console.log('\n🔍 Uncovered Files\n' + '='.repeat(50));
  
  const srcPath = path.join(__dirname, '../src');
  const allFiles = getAllTypeScriptFiles(srcPath);
  const coveredFiles = Object.keys(coverage).map(f => path.normalize(f));
  
  const uncoveredFiles = allFiles.filter(file => 
    !coveredFiles.some(covered => covered.includes(file))
  );
  
  if (uncoveredFiles.length === 0) {
    console.log('✅ All source files have coverage');
    return true;
  }
  
  console.log(`⚠️ Found ${uncoveredFiles.length} files without coverage:`);
  uncoveredFiles.forEach(file => {
    console.log(`  - ${file}`);
  });
  
  return false;
}

/**
 * Get all TypeScript files recursively
 */
function getAllTypeScriptFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.startsWith('.')) {
        getAllTypeScriptFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.endsWith('.test.ts')) {
      fileList.push(path.relative(path.join(__dirname, '..'), filePath));
    }
  }
  
  return fileList;
}

/**
 * Calculate aggregate coverage
 */
function calculateAggregate(files) {
  const aggregate = {
    lines: { total: 0, covered: 0, pct: 0 },
    functions: { total: 0, covered: 0, pct: 0 },
    branches: { total: 0, covered: 0, pct: 0 },
    statements: { total: 0, covered: 0, pct: 0 },
  };
  
  for (const data of Object.values(files)) {
    aggregate.lines.total += data.lines.total;
    aggregate.lines.covered += data.lines.covered;
    aggregate.functions.total += data.functions.total;
    aggregate.functions.covered += data.functions.covered;
    aggregate.branches.total += data.branches.total;
    aggregate.branches.covered += data.branches.covered;
    aggregate.statements.total += data.statements.total;
    aggregate.statements.covered += data.statements.covered;
  }
  
  aggregate.lines.pct = (aggregate.lines.covered / aggregate.lines.total) * 100;
  aggregate.functions.pct = (aggregate.functions.covered / aggregate.functions.total) * 100;
  aggregate.branches.pct = (aggregate.branches.covered / aggregate.branches.total) * 100;
  aggregate.statements.pct = (aggregate.statements.covered / aggregate.statements.total) * 100;
  
  return aggregate;
}

/**
 * Generate coverage report
 */
function generateReport(coverage) {
  console.log('\n📈 Coverage Report\n' + '='.repeat(50));
  
  const total = coverage.total;
  
  console.log('Overall Coverage:');
  console.log(`  Lines:      ${total.lines.covered}/${total.lines.total} (${total.lines.pct.toFixed(2)}%)`);
  console.log(`  Functions:  ${total.functions.covered}/${total.functions.total} (${total.functions.pct.toFixed(2)}%)`);
  console.log(`  Branches:   ${total.branches.covered}/${total.branches.total} (${total.branches.pct.toFixed(2)}%)`);
  console.log(`  Statements: ${total.statements.covered}/${total.statements.total} (${total.statements.pct.toFixed(2)}%)`);
  
  // Find files with lowest coverage
  const fileList = Object.entries(coverage)
    .filter(([file]) => file !== 'total')
    .map(([file, data]) => ({
      file: file.replace(process.cwd(), ''),
      coverage: (data.lines.pct + data.functions.pct + data.branches.pct + data.statements.pct) / 4,
    }))
    .sort((a, b) => a.coverage - b.coverage);
  
  console.log('\n📉 Files with Lowest Coverage:');
  fileList.slice(0, 5).forEach(({ file, coverage }) => {
    console.log(`  ${coverage.toFixed(2)}% - ${file}`);
  });
  
  console.log('\n📈 Files with Highest Coverage:');
  fileList.slice(-5).reverse().forEach(({ file, coverage }) => {
    console.log(`  ${coverage.toFixed(2)}% - ${file}`);
  });
}

/**
 * Main validation function
 */
function main() {
  console.log('🔍 MCP Server Test Coverage Validator');
  console.log('=====================================\n');
  
  const coverage = loadCoverageReport();
  
  // Run all validations
  const overallPassed = validateOverallCoverage(coverage);
  const componentPassed = validateComponentCoverage(coverage);
  const criticalPassed = validateCriticalFiles(coverage);
  const uncoveredPassed = findUncoveredFiles(coverage);
  
  // Generate report
  generateReport(coverage);
  
  // Final verdict
  console.log('\n' + '='.repeat(50));
  
  if (overallPassed && componentPassed && criticalPassed && uncoveredPassed) {
    console.log('✅ All coverage requirements met!');
    console.log('Quality gates: PASSED');
    process.exit(0);
  } else {
    console.log('❌ Coverage requirements not met');
    console.log('Quality gates: FAILED');
    
    if (!overallPassed) console.log('  - Overall coverage below threshold');
    if (!componentPassed) console.log('  - Component coverage below threshold');
    if (!criticalPassed) console.log('  - Critical files incomplete coverage');
    if (!uncoveredPassed) console.log('  - Uncovered files detected');
    
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  loadCoverageReport,
  validateOverallCoverage,
  validateComponentCoverage,
  validateCriticalFiles,
  findUncoveredFiles,
  generateReport,
};