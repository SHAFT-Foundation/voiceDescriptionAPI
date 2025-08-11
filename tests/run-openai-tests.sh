#!/bin/bash

# OpenAI Pipeline Test Suite Runner
# Comprehensive test execution with coverage and reporting

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_ENV=${TEST_ENV:-"development"}
COVERAGE_THRESHOLD=${COVERAGE_THRESHOLD:-90}
PARALLEL_JOBS=${PARALLEL_JOBS:-4}
GENERATE_REPORTS=${GENERATE_REPORTS:-true}

# Directories
REPORTS_DIR="./reports/openai"
COVERAGE_DIR="./coverage/openai"

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   OpenAI Pipeline Test Suite Runner      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Function to run tests with timing
run_test_suite() {
    local suite_name=$1
    local test_command=$2
    local start_time=$(date +%s)
    
    echo -e "${YELLOW}Running ${suite_name}...${NC}"
    
    if eval "$test_command"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo -e "${GREEN}✓ ${suite_name} passed (${duration}s)${NC}"
        return 0
    else
        echo -e "${RED}✗ ${suite_name} failed${NC}"
        return 1
    fi
}

# Create directories
mkdir -p "$REPORTS_DIR"
mkdir -p "$COVERAGE_DIR"

# Clean previous reports
echo -e "${BLUE}Cleaning previous reports...${NC}"
rm -rf "$REPORTS_DIR"/*
rm -rf "$COVERAGE_DIR"/*

# Set environment variables
export NODE_ENV=test
export PIPELINE_MODE=dual
export ENABLE_CACHE=true
export MAX_CONCURRENT_REQUESTS=10
export QUALITY_THRESHOLD=75

# Check dependencies
echo -e "${BLUE}Checking dependencies...${NC}"
npm list jest > /dev/null 2>&1 || npm install

# Run linting
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Running Linting Checks${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
npm run lint || echo -e "${YELLOW}⚠ Linting warnings detected${NC}"

# Run type checking
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Running TypeScript Type Checking${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
npm run typecheck || exit 1

# Run unit tests
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Running Unit Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
run_test_suite "Unit Tests" \
    "npx jest --config jest.config.openai.js \
    --testPathPattern='unit' \
    --coverage \
    --coverageThreshold='{\"global\":{\"branches\":${COVERAGE_THRESHOLD},\"functions\":${COVERAGE_THRESHOLD},\"lines\":${COVERAGE_THRESHOLD},\"statements\":${COVERAGE_THRESHOLD}}}' \
    --maxWorkers=${PARALLEL_JOBS}"

# Run integration tests
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Running Integration Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
run_test_suite "Integration Tests" \
    "npx jest --config jest.config.openai.js \
    --testPathPattern='integration' \
    --runInBand"

# Run performance tests
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Running Performance Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
run_test_suite "Performance Tests" \
    "npx jest --config jest.config.openai.js \
    --testPathPattern='performance' \
    --runInBand \
    --testTimeout=60000"

# Run quality assurance tests
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Running Quality Assurance Tests${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
run_test_suite "Quality Assurance Tests" \
    "npx jest --config jest.config.openai.js \
    --testPathPattern='quality' \
    --runInBand"

# Generate coverage report
if [ "$GENERATE_REPORTS" = true ]; then
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}Generating Coverage Reports${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    
    # Merge coverage data
    npx nyc merge "$COVERAGE_DIR" "$COVERAGE_DIR/merged-coverage.json"
    
    # Generate HTML report
    npx nyc report --reporter=html --report-dir="$COVERAGE_DIR/html"
    
    # Generate lcov report
    npx nyc report --reporter=lcov --report-dir="$COVERAGE_DIR"
    
    # Generate text summary
    npx nyc report --reporter=text-summary > "$REPORTS_DIR/coverage-summary.txt"
    
    echo -e "${GREEN}✓ Coverage reports generated${NC}"
    echo -e "  HTML Report: ${COVERAGE_DIR}/html/index.html"
    echo -e "  LCOV Report: ${COVERAGE_DIR}/lcov.info"
fi

# Run mutation testing (optional)
if [ "$RUN_MUTATION_TESTS" = true ]; then
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    echo -e "${BLUE}Running Mutation Tests${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════${NC}"
    npx stryker run
fi

# Generate test metrics
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Metrics Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"

# Count tests
TOTAL_TESTS=$(find tests -name "*.test.ts" -type f | wc -l)
UNIT_TESTS=$(find tests/unit -name "*.test.ts" -type f | wc -l)
INTEGRATION_TESTS=$(find tests/integration -name "*.test.ts" -type f | wc -l)
PERFORMANCE_TESTS=$(find tests/performance -name "*.test.ts" -type f | wc -l)
QUALITY_TESTS=$(find tests/quality -name "*.test.ts" -type f | wc -l)

echo -e "Total Test Files: ${TOTAL_TESTS}"
echo -e "  • Unit Tests: ${UNIT_TESTS}"
echo -e "  • Integration Tests: ${INTEGRATION_TESTS}"
echo -e "  • Performance Tests: ${PERFORMANCE_TESTS}"
echo -e "  • Quality Tests: ${QUALITY_TESTS}"

# Parse coverage
if [ -f "$REPORTS_DIR/coverage-summary.txt" ]; then
    echo -e "\nCoverage Summary:"
    cat "$REPORTS_DIR/coverage-summary.txt"
fi

# Check if all tests passed
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   ✓ All Tests Passed Successfully!      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
    
    # Open coverage report in browser (optional)
    if [ "$OPEN_COVERAGE" = true ] && [ -f "$COVERAGE_DIR/html/index.html" ]; then
        open "$COVERAGE_DIR/html/index.html" 2>/dev/null || \
        xdg-open "$COVERAGE_DIR/html/index.html" 2>/dev/null || \
        echo "Coverage report available at: $COVERAGE_DIR/html/index.html"
    fi
    
    exit 0
else
    echo -e "\n${RED}╔══════════════════════════════════════════╗${NC}"
    echo -e "${RED}║   ✗ Some Tests Failed                   ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════╝${NC}"
    exit 1
fi