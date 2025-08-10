#!/bin/bash

# Voice Description API - Render Deployment Script
# This script automates the deployment process to Render

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/yourusername/voiceDescriptionAPI.git"
SERVICE_NAME="voice-description-api"
REGION="oregon"
PLAN="starter"

echo -e "${GREEN}Voice Description API - Render Deployment Script${NC}"
echo "================================================"

# Check for required tools
check_requirements() {
    echo -e "\n${YELLOW}Checking requirements...${NC}"
    
    # Check for git
    if ! command -v git &> /dev/null; then
        echo -e "${RED}Error: git is not installed${NC}"
        exit 1
    fi
    
    # Check for curl
    if ! command -v curl &> /dev/null; then
        echo -e "${RED}Error: curl is not installed${NC}"
        exit 1
    fi
    
    # Check for jq (optional but helpful)
    if ! command -v jq &> /dev/null; then
        echo -e "${YELLOW}Warning: jq is not installed (optional)${NC}"
    fi
    
    echo -e "${GREEN}✓ All requirements met${NC}"
}

# Load environment variables
load_env() {
    echo -e "\n${YELLOW}Loading environment variables...${NC}"
    
    if [ -f .env.production ]; then
        export $(cat .env.production | grep -v '^#' | xargs)
        echo -e "${GREEN}✓ Production environment loaded${NC}"
    else
        echo -e "${YELLOW}No .env.production file found${NC}"
    fi
}

# Validate AWS credentials
validate_aws() {
    echo -e "\n${YELLOW}Validating AWS credentials...${NC}"
    
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        echo -e "${RED}Error: AWS credentials not set${NC}"
        echo "Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
        exit 1
    fi
    
    # Test AWS connectivity
    if aws sts get-caller-identity &> /dev/null; then
        echo -e "${GREEN}✓ AWS credentials valid${NC}"
    else
        echo -e "${RED}Error: Invalid AWS credentials${NC}"
        exit 1
    fi
}

# Create S3 buckets if they don't exist
setup_s3() {
    echo -e "\n${YELLOW}Setting up S3 buckets...${NC}"
    
    INPUT_BUCKET="${INPUT_S3_BUCKET:-voice-desc-input-production}"
    OUTPUT_BUCKET="${OUTPUT_S3_BUCKET:-voice-desc-output-production}"
    
    # Create input bucket
    if aws s3 ls "s3://${INPUT_BUCKET}" 2>&1 | grep -q 'NoSuchBucket'; then
        echo "Creating input bucket: ${INPUT_BUCKET}"
        aws s3 mb "s3://${INPUT_BUCKET}" --region "${AWS_REGION:-us-east-1}"
    else
        echo "Input bucket exists: ${INPUT_BUCKET}"
    fi
    
    # Create output bucket
    if aws s3 ls "s3://${OUTPUT_BUCKET}" 2>&1 | grep -q 'NoSuchBucket'; then
        echo "Creating output bucket: ${OUTPUT_BUCKET}"
        aws s3 mb "s3://${OUTPUT_BUCKET}" --region "${AWS_REGION:-us-east-1}"
    else
        echo "Output bucket exists: ${OUTPUT_BUCKET}"
    fi
    
    echo -e "${GREEN}✓ S3 buckets configured${NC}"
}

# Build Docker image locally for testing
build_docker() {
    echo -e "\n${YELLOW}Building Docker image...${NC}"
    
    if command -v docker &> /dev/null; then
        docker build -t ${SERVICE_NAME}:latest .
        echo -e "${GREEN}✓ Docker image built successfully${NC}"
        
        # Optional: Test the image
        echo -e "${YELLOW}Testing Docker image...${NC}"
        docker run -d -p 3000:3000 --name ${SERVICE_NAME}-test ${SERVICE_NAME}:latest
        sleep 5
        
        if curl -f http://localhost:3000/api/health &> /dev/null; then
            echo -e "${GREEN}✓ Docker health check passed${NC}"
        else
            echo -e "${RED}Warning: Docker health check failed${NC}"
        fi
        
        docker stop ${SERVICE_NAME}-test && docker rm ${SERVICE_NAME}-test
    else
        echo -e "${YELLOW}Docker not installed, skipping local build test${NC}"
    fi
}

# Deploy to Render
deploy_render() {
    echo -e "\n${YELLOW}Deploying to Render...${NC}"
    
    # Check if Render CLI is installed
    if command -v render &> /dev/null; then
        echo "Using Render CLI"
        render up
    else
        echo -e "${YELLOW}Render CLI not installed${NC}"
        echo "Please deploy manually through the Render dashboard:"
        echo "1. Go to https://dashboard.render.com"
        echo "2. Click 'New +' → 'Web Service'"
        echo "3. Connect your GitHub repository"
        echo "4. Use the render.yaml configuration"
        
        # Provide direct link if possible
        echo -e "\n${GREEN}Direct deployment link:${NC}"
        echo "https://dashboard.render.com/new/web?repo=${REPO_URL}"
    fi
}

# Set environment variables via Render API
set_env_vars() {
    echo -e "\n${YELLOW}Setting environment variables...${NC}"
    
    if [ -z "$RENDER_API_KEY" ] || [ -z "$RENDER_SERVICE_ID" ]; then
        echo -e "${YELLOW}Render API credentials not set, skipping${NC}"
        echo "Set these manually in the Render dashboard"
        return
    fi
    
    # Create env vars JSON
    cat > render-env.json <<EOF
{
  "envVars": [
    {"key": "AWS_ACCESS_KEY_ID", "value": "${AWS_ACCESS_KEY_ID}"},
    {"key": "AWS_SECRET_ACCESS_KEY", "value": "${AWS_SECRET_ACCESS_KEY}"},
    {"key": "AWS_REGION", "value": "${AWS_REGION:-us-east-1}"},
    {"key": "INPUT_S3_BUCKET", "value": "${INPUT_BUCKET}"},
    {"key": "OUTPUT_S3_BUCKET", "value": "${OUTPUT_BUCKET}"},
    {"key": "NOVA_MODEL_ID", "value": "amazon.nova-pro-v1:0"},
    {"key": "POLLY_VOICE_ID", "value": "Joanna"},
    {"key": "MAX_VIDEO_SIZE_MB", "value": "500"},
    {"key": "PROCESSING_TIMEOUT_MINUTES", "value": "30"},
    {"key": "NODE_ENV", "value": "production"},
    {"key": "LOG_LEVEL", "value": "info"}
  ]
}
EOF
    
    # Update env vars via API
    curl -X PATCH \
        "https://api.render.com/v1/services/${RENDER_SERVICE_ID}" \
        -H "Authorization: Bearer ${RENDER_API_KEY}" \
        -H "Content-Type: application/json" \
        -d @render-env.json
    
    rm render-env.json
    echo -e "${GREEN}✓ Environment variables configured${NC}"
}

# Wait for deployment and check health
check_deployment() {
    echo -e "\n${YELLOW}Checking deployment status...${NC}"
    
    if [ -z "$RENDER_SERVICE_URL" ]; then
        RENDER_SERVICE_URL="https://${SERVICE_NAME}.onrender.com"
    fi
    
    echo "Waiting for deployment to complete..."
    sleep 60
    
    MAX_ATTEMPTS=10
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -f "${RENDER_SERVICE_URL}/api/health" &> /dev/null; then
            echo -e "${GREEN}✓ Deployment successful!${NC}"
            echo -e "${GREEN}Application URL: ${RENDER_SERVICE_URL}${NC}"
            break
        fi
        
        ATTEMPT=$((ATTEMPT + 1))
        echo "Attempt $ATTEMPT of $MAX_ATTEMPTS..."
        sleep 30
    done
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}Deployment health check failed${NC}"
        echo "Please check the Render dashboard for errors"
        exit 1
    fi
}

# Run performance test
performance_test() {
    echo -e "\n${YELLOW}Running performance test...${NC}"
    
    if command -v ab &> /dev/null; then
        echo "Running Apache Bench test..."
        ab -n 100 -c 10 "${RENDER_SERVICE_URL}/api/health"
    elif command -v curl &> /dev/null; then
        echo "Running basic performance test..."
        
        START=$(date +%s)
        for i in {1..10}; do
            curl -s -o /dev/null -w "%{time_total}\n" "${RENDER_SERVICE_URL}/api/health"
        done
        END=$(date +%s)
        
        DURATION=$((END - START))
        echo "10 requests completed in ${DURATION} seconds"
    fi
    
    echo -e "${GREEN}✓ Performance test completed${NC}"
}

# Main deployment flow
main() {
    echo -e "\n${GREEN}Starting deployment process...${NC}\n"
    
    # Run deployment steps
    check_requirements
    load_env
    validate_aws
    setup_s3
    build_docker
    deploy_render
    set_env_vars
    check_deployment
    performance_test
    
    echo -e "\n${GREEN}================================${NC}"
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo -e "${GREEN}================================${NC}"
    echo -e "\nApplication URL: ${RENDER_SERVICE_URL}"
    echo -e "Dashboard: https://dashboard.render.com/web/${RENDER_SERVICE_ID}"
    echo -e "\nNext steps:"
    echo "1. Configure custom domain (optional)"
    echo "2. Set up monitoring (Sentry)"
    echo "3. Enable auto-deploy from GitHub"
    echo "4. Configure alerts and notifications"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --validate     Only validate configuration"
        echo "  --build        Only build Docker image"
        echo "  --deploy       Full deployment"
        echo ""
        echo "Environment variables required:"
        echo "  AWS_ACCESS_KEY_ID"
        echo "  AWS_SECRET_ACCESS_KEY"
        echo "  RENDER_API_KEY (optional)"
        echo "  RENDER_SERVICE_ID (optional)"
        exit 0
        ;;
    --validate)
        check_requirements
        load_env
        validate_aws
        echo -e "${GREEN}Validation successful${NC}"
        exit 0
        ;;
    --build)
        build_docker
        exit 0
        ;;
    --deploy|"")
        main
        ;;
    *)
        echo -e "${RED}Unknown option: $1${NC}"
        echo "Use --help for usage information"
        exit 1
        ;;
esac