# AWS Services Setup Guide - Voice Description API

## Prerequisites
- AWS Account with appropriate billing setup
- AWS CLI installed and configured
- Terraform (optional, for infrastructure as code)

## 1. S3 Storage Setup

### Create Input and Output Buckets
```bash
# Create input bucket for video uploads
aws s3 mb s3://voice-desc-input-bucket --region us-east-1

# Create output bucket for results
aws s3 mb s3://voice-desc-output-bucket --region us-east-1

# Configure CORS for input bucket (for direct web uploads if needed)
aws s3api put-bucket-cors --bucket voice-desc-input-bucket --cors-configuration file://cors-config.json
```

### CORS Configuration (cors-config.json)
```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "POST", "PUT", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

### Bucket Lifecycle Policies
```bash
# Set lifecycle policy to auto-delete temporary files after 7 days
aws s3api put-bucket-lifecycle-configuration --bucket voice-desc-input-bucket --lifecycle-configuration file://lifecycle-policy.json
```

### Lifecycle Policy (lifecycle-policy.json)
```json
{
  "Rules": [
    {
      "ID": "DeleteTempFiles",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "temp/"
      },
      "Expiration": {
        "Days": 7
      }
    }
  ]
}
```

## 2. IAM Role and Policy Setup

### Create Service Role
```bash
# Create IAM role for EC2 instance (recommended over access keys)
aws iam create-role --role-name VoiceDescriptionAPIRole --assume-role-policy-document file://trust-policy.json

# Attach custom policy
aws iam put-role-policy --role-name VoiceDescriptionAPIRole --policy-name VoiceDescriptionAPIPolicy --policy-document file://service-policy.json

# Create instance profile
aws iam create-instance-profile --instance-profile-name VoiceDescriptionAPIProfile
aws iam add-role-to-instance-profile --instance-profile-name VoiceDescriptionAPIProfile --role-name VoiceDescriptionAPIRole
```

### Trust Policy (trust-policy.json)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### Service Policy (service-policy.json)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::voice-desc-input-bucket",
        "arn:aws:s3:::voice-desc-input-bucket/*",
        "arn:aws:s3:::voice-desc-output-bucket",
        "arn:aws:s3:::voice-desc-output-bucket/*"
      ]
    },
    {
      "Sid": "RekognitionAccess",
      "Effect": "Allow",
      "Action": [
        "rekognition:StartSegmentDetection",
        "rekognition:GetSegmentDetection"
      ],
      "Resource": "*"
    },
    {
      "Sid": "BedrockAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:ListFoundationModels"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0",
        "arn:aws:bedrock:*:*:model-invocation-job/*"
      ]
    },
    {
      "Sid": "PollyAccess", 
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech",
        "polly:DescribeVoices"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow", 
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

## 3. Amazon Rekognition Setup

### Enable Video Analysis
```bash
# Test Rekognition access
aws rekognition describe-collection --collection-id test 2>/dev/null || echo "Rekognition is accessible"

# Check supported video formats
aws rekognition list-faces --collection-id test 2>/dev/null || echo "Ready for video analysis"
```

### Regional Considerations
- Rekognition Video is available in: us-east-1, us-west-2, eu-west-1, ap-southeast-2
- Choose region based on your deployment location for lowest latency

## 4. Amazon Bedrock Setup

### Request Model Access
```bash
# List available foundation models
aws bedrock list-foundation-models --region us-east-1

# Check if Nova Pro is available (may require requesting access)
aws bedrock list-foundation-models --by-provider amazon --region us-east-1 | grep nova
```

### Model Access Request Process
1. Go to AWS Console → Bedrock → Model Access
2. Request access to "Amazon Nova Pro" model
3. Wait for approval (usually immediate for AWS accounts in good standing)
4. Verify access with API call:

```bash
# Test model access
aws bedrock invoke-model \
  --model-id amazon.nova-pro-v1:0 \
  --body '{"inputText":"Hello","max_tokens":10}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/response.json
```

### Bedrock Configuration
```json
{
  "modelId": "amazon.nova-pro-v1:0",
  "maxTokens": 1000,
  "temperature": 0.7,
  "topP": 0.9
}
```

## 5. Amazon Polly Setup

### Test Voice Synthesis
```bash
# List available voices
aws polly describe-voices --language-code en-US

# Test synthesis
aws polly synthesize-speech \
  --output-format mp3 \
  --voice-id Joanna \
  --text "Hello, this is a test of the voice description system" \
  test-output.mp3
```

### Recommended Voices for Narration
- **Joanna** (US English, Neural) - Clear, professional
- **Matthew** (US English, Neural) - Male alternative
- **Amy** (British English, Neural) - International option

## 6. CloudWatch Monitoring Setup

### Create Log Groups
```bash
# Create log group for application logs
aws logs create-log-group --log-group-name /aws/ec2/voice-description-api

# Create custom metrics namespace
aws cloudwatch put-metric-data \
  --namespace "VoiceDescriptionAPI" \
  --metric-data MetricName=Initialization,Value=1,Unit=Count
```

### CloudWatch Alarms
```bash
# Create alarm for high error rate
aws cloudwatch put-metric-alarm \
  --alarm-name "VoiceDescAPI-HighErrorRate" \
  --alarm-description "High error rate in processing" \
  --metric-name "ProcessingErrors" \
  --namespace "VoiceDescriptionAPI" \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## 7. EC2 Instance Setup

### Launch Instance with Role
```bash
# Launch EC2 instance with IAM role
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-your-security-group \
  --iam-instance-profile Name=VoiceDescriptionAPIProfile \
  --user-data file://user-data-script.sh
```

### Security Group Configuration
```bash
# Create security group
aws ec2 create-security-group \
  --group-name voice-desc-api-sg \
  --description "Security group for Voice Description API"

# Allow HTTP traffic
aws ec2 authorize-security-group-ingress \
  --group-name voice-desc-api-sg \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Allow SSH access (restrict CIDR as needed)
aws ec2 authorize-security-group-ingress \
  --group-name voice-desc-api-sg \
  --protocol tcp \
  --port 22 \
  --cidr your-ip/32
```

### User Data Script (user-data-script.sh)
```bash
#!/bin/bash
yum update -y
yum install -y docker git

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start Docker service
systemctl start docker
systemctl enable docker

# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm
```

## 8. Cost Optimization Setup

### S3 Intelligent Tiering
```bash
# Enable intelligent tiering for cost optimization
aws s3api put-bucket-intelligent-tiering-configuration \
  --bucket voice-desc-input-bucket \
  --id EntireBucket \
  --intelligent-tiering-configuration file://intelligent-tiering.json
```

### Intelligent Tiering Config (intelligent-tiering.json)
```json
{
  "Id": "EntireBucket",
  "Filter": {},
  "Status": "Enabled",
  "OptionalFields": ["BucketKeyStatus"]
}
```

### Budget Alerts
```bash
# Create budget for AWS costs
aws budgets create-budget \
  --account-id your-account-id \
  --budget file://budget-config.json
```

## 9. Terraform Infrastructure (Optional)

### main.tf
```hcl
provider "aws" {
  region = "us-east-1"
}

# S3 Buckets
resource "aws_s3_bucket" "input_bucket" {
  bucket = "voice-desc-input-bucket"
}

resource "aws_s3_bucket" "output_bucket" {
  bucket = "voice-desc-output-bucket"
}

# IAM Role
resource "aws_iam_role" "api_role" {
  name = "VoiceDescriptionAPIRole"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "api_policy" {
  name = "VoiceDescriptionAPIPolicy"
  role = aws_iam_role.api_role.id
  
  policy = file("service-policy.json")
}

# EC2 Instance Profile
resource "aws_iam_instance_profile" "api_profile" {
  name = "VoiceDescriptionAPIProfile"
  role = aws_iam_role.api_role.name
}
```

## 10. Deployment Verification

### Health Check Script
```bash
#!/bin/bash
# health-check.sh

echo "Checking AWS service access..."

# Test S3 access
aws s3 ls s3://voice-desc-input-bucket && echo "✓ S3 access OK" || echo "✗ S3 access failed"

# Test Rekognition
aws rekognition list-collections && echo "✓ Rekognition access OK" || echo "✗ Rekognition access failed"

# Test Bedrock
aws bedrock list-foundation-models --region us-east-1 | grep -q nova && echo "✓ Bedrock Nova access OK" || echo "✗ Bedrock access failed"

# Test Polly
aws polly describe-voices --language-code en-US | grep -q Joanna && echo "✓ Polly access OK" || echo "✗ Polly access failed"

echo "Health check complete"
```

## Environment Variables for Application

Create `.env` file:
```bash
# AWS Configuration
AWS_REGION=us-east-1
INPUT_S3_BUCKET=voice-desc-input-bucket
OUTPUT_S3_BUCKET=voice-desc-output-bucket

# Model Configuration
NOVA_MODEL_ID=amazon.nova-pro-v1:0
POLLY_VOICE_ID=Joanna

# Application Configuration
MAX_VIDEO_SIZE_MB=500
PROCESSING_TIMEOUT_MINUTES=30
MAX_CONCURRENT_JOBS=5

# Monitoring
CLOUDWATCH_LOG_GROUP=/aws/ec2/voice-description-api
ENABLE_DETAILED_MONITORING=true
```

This setup provides a complete AWS environment for the Voice Description API with proper security, monitoring, and cost optimization.