#!/bin/bash

# Terraform Deployment Script for Voice Description API
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
TERRAFORM_DIR="terraform"
STATE_FILE="terraform.tfstate"
ENVIRONMENT=${1:-production}

echo -e "${BLUE}☁️  Voice Description API - AWS Deployment${NC}"
echo "==========================================="

# Check dependencies
echo -e "${YELLOW}🔍 Checking dependencies...${NC}"

if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform is not installed. Please install Terraform first.${NC}"
    echo "   Download from: https://www.terraform.io/downloads.html"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install AWS CLI first.${NC}"
    echo "   Install with: curl \"https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip\" -o \"awscliv2.zip\" && unzip awscliv2.zip && sudo ./aws/install"
    exit 1
fi

# Check AWS credentials
echo -e "${YELLOW}🔑 Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured.${NC}"
    echo "   Configure with: aws configure"
    echo "   Or set environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")

echo -e "${GREEN}✅ AWS Account: ${ACCOUNT_ID}${NC}"
echo -e "${GREEN}✅ AWS Region: ${AWS_REGION}${NC}"

# Check if SSH key exists (required for EC2)
if [ ! -f "$HOME/.ssh/id_rsa.pub" ]; then
    echo -e "${YELLOW}🔑 SSH key not found. Generating new SSH key pair...${NC}"
    ssh-keygen -t rsa -b 4096 -f "$HOME/.ssh/id_rsa" -N ""
    echo -e "${GREEN}✅ SSH key pair generated${NC}"
fi

# Navigate to terraform directory
cd ${TERRAFORM_DIR}

# Initialize Terraform
echo -e "${YELLOW}🏗️  Initializing Terraform...${NC}"
terraform init

# Validate Terraform configuration
echo -e "${YELLOW}✅ Validating Terraform configuration...${NC}"
terraform validate

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Terraform validation failed${NC}"
    exit 1
fi

# Plan deployment
echo -e "${YELLOW}📋 Planning deployment...${NC}"
terraform plan \
    -var="environment=${ENVIRONMENT}" \
    -var="aws_region=${AWS_REGION}" \
    -out="tfplan"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Terraform planning failed${NC}"
    exit 1
fi

# Ask for confirmation
echo ""
echo -e "${YELLOW}⚠️  Review the plan above carefully.${NC}"
echo "This will create AWS resources that may incur costs:"
echo "  • EC2 instance (t3.large)"
echo "  • S3 buckets for input/output"
echo "  • IAM roles and policies"
echo "  • Security groups"
echo "  • CloudWatch log groups"
echo ""
read -p "Do you want to proceed with the deployment? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}🛑 Deployment cancelled${NC}"
    exit 0
fi

# Apply Terraform configuration
echo -e "${YELLOW}🚀 Applying Terraform configuration...${NC}"
terraform apply "tfplan"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Infrastructure deployed successfully!${NC}"
else
    echo -e "${RED}❌ Terraform deployment failed${NC}"
    exit 1
fi

# Get outputs
echo -e "${BLUE}📊 Deployment Information:${NC}"
INSTANCE_IP=$(terraform output -raw instance_public_ip)
INSTANCE_DNS=$(terraform output -raw instance_public_dns)
INPUT_BUCKET=$(terraform output -raw input_bucket_name)
OUTPUT_BUCKET=$(terraform output -raw output_bucket_name)
SSH_COMMAND=$(terraform output -raw ssh_command)

echo "  🖥️  Instance IP: ${INSTANCE_IP}"
echo "  🌐 Instance DNS: ${INSTANCE_DNS}"
echo "  📦 Input Bucket: ${INPUT_BUCKET}"
echo "  📦 Output Bucket: ${OUTPUT_BUCKET}"
echo ""

echo -e "${BLUE}🔧 Next Steps:${NC}"
echo "1. Wait for the instance to finish initialization (5-10 minutes)"
echo "2. SSH into the instance:"
echo "   ${SSH_COMMAND}"
echo ""
echo "3. Deploy the application:"
echo "   cd /opt/voice-description-api"
echo "   # Copy your application files here"
echo "   npm install"
echo "   npm run build"
echo "   sudo systemctl enable voice-description-api"
echo "   sudo systemctl start voice-description-api"
echo ""
echo "4. Access the application:"
echo "   http://${INSTANCE_IP}:3000"
echo ""

# Save deployment info
cat > ../deployment-info.txt << EOF
Voice Description API Deployment Information
==========================================

Date: $(date)
Environment: ${ENVIRONMENT}
AWS Region: ${AWS_REGION}
AWS Account: ${ACCOUNT_ID}

Instance Information:
- Public IP: ${INSTANCE_IP}
- Public DNS: ${INSTANCE_DNS}
- SSH Command: ${SSH_COMMAND}

S3 Buckets:
- Input Bucket: ${INPUT_BUCKET}
- Output Bucket: ${OUTPUT_BUCKET}

Application URLs:
- Main Application: http://${INSTANCE_IP}:3000
- Direct API Access: http://${INSTANCE_IP}:3000/api

Environment Variables for Application:
INPUT_S3_BUCKET=${INPUT_BUCKET}
OUTPUT_S3_BUCKET=${OUTPUT_BUCKET}
AWS_DEFAULT_REGION=${AWS_REGION}

To destroy infrastructure: cd terraform && terraform destroy
EOF

echo -e "${GREEN}💾 Deployment information saved to deployment-info.txt${NC}"
echo ""
echo -e "${GREEN}🎉 AWS infrastructure deployment completed!${NC}"

# Go back to project root
cd ..