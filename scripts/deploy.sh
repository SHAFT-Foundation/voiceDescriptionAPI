#!/bin/bash

# Voice Description API Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="voice-description-api"
DOCKER_IMAGE_NAME="voice-description-api"
DOCKER_TAG=${1:-latest}

echo -e "${BLUE}🚀 Voice Description API Deployment Script${NC}"
echo "======================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if we're in the project directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Please run this script from the project root directory.${NC}"
    exit 1
fi

# Build Docker image
echo -e "${YELLOW}📦 Building Docker image...${NC}"
docker build -t ${DOCKER_IMAGE_NAME}:${DOCKER_TAG} .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker image built successfully${NC}"
else
    echo -e "${RED}❌ Docker image build failed${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}📝 Please edit .env file with your AWS credentials and configuration${NC}"
        echo -e "${YELLOW}   Required variables:${NC}"
        echo "   - AWS_ACCESS_KEY_ID"
        echo "   - AWS_SECRET_ACCESS_KEY"
        echo "   - INPUT_S3_BUCKET"
        echo "   - OUTPUT_S3_BUCKET"
        echo ""
        read -p "Press Enter to continue after updating .env file..."
    else
        echo -e "${RED}❌ No .env.example file found${NC}"
        exit 1
    fi
fi

# Stop existing container if running
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker stop ${PROJECT_NAME} 2>/dev/null || true
docker rm ${PROJECT_NAME} 2>/dev/null || true

# Run the application
echo -e "${YELLOW}🏃 Starting application container...${NC}"
docker run -d \
    --name ${PROJECT_NAME} \
    --restart unless-stopped \
    -p 3000:3000 \
    --env-file .env \
    -v /tmp:/tmp \
    ${DOCKER_IMAGE_NAME}:${DOCKER_TAG}

# Wait for container to start
echo -e "${YELLOW}⏳ Waiting for application to start...${NC}"
sleep 5

# Check if container is running
if docker ps | grep -q ${PROJECT_NAME}; then
    echo -e "${GREEN}✅ Application started successfully${NC}"
    echo ""
    echo -e "${BLUE}🌐 Application URLs:${NC}"
    echo "   Local: http://localhost:3000"
    
    # Try to get the external IP
    EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipecho.net/plain 2>/dev/null || echo "unknown")
    if [ "$EXTERNAL_IP" != "unknown" ]; then
        echo "   External: http://${EXTERNAL_IP}:3000"
    fi
    
    echo ""
    echo -e "${BLUE}📋 Container Management:${NC}"
    echo "   View logs: docker logs -f ${PROJECT_NAME}"
    echo "   Stop: docker stop ${PROJECT_NAME}"
    echo "   Restart: docker restart ${PROJECT_NAME}"
    echo "   Remove: docker stop ${PROJECT_NAME} && docker rm ${PROJECT_NAME}"
    
    echo ""
    echo -e "${BLUE}🔍 Health Check:${NC}"
    echo "   Container status: docker ps | grep ${PROJECT_NAME}"
    echo "   Application health: curl http://localhost:3000/api/health"
    
else
    echo -e "${RED}❌ Application failed to start${NC}"
    echo -e "${YELLOW}📋 Container logs:${NC}"
    docker logs ${PROJECT_NAME}
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"