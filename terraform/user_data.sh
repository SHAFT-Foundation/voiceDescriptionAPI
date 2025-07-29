#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
set -e

echo "=== Voice Description API Deployment Started at $(date) ==="

# Update system and install essentials
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl wget awscli

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"

# Create application directory and download REAL application code
mkdir -p /opt/voice-description-api
cd /opt/voice-description-api

echo "Downloading real application code from S3..."
aws s3 cp s3://voice-description-api-input-production-pmhnxlix/deployment/voice-description-api.tar.gz . || {
    echo "Failed to download application code"
    exit 1
}

echo "Extracting application code..."
tar -xzf voice-description-api.tar.gz || {
    echo "Failed to extract application code"
    exit 1
}

echo "Installing dependencies..."
npm install || {
    echo "Failed to install dependencies"
    exit 1
}

echo "Building TypeScript application..."
npm run build || {
    echo "Build failed, but continuing with dev mode"
}

# Set environment variables for the real application
export NODE_ENV=production
export PORT=3000
export INPUT_S3_BUCKET=voice-description-api-input-production-pmhnxlix
export OUTPUT_S3_BUCKET=voice-description-api-output-production-pmhnxlix
export AWS_REGION=us-east-1

echo "Starting REAL Voice Description API application..."

# Start the real Next.js application
echo "Starting Next.js development server..."
nohup npm run dev > /var/log/voice-api.log 2>&1 &

# Wait for app to start
sleep 10

# Also create a simple proxy on port 80 for easier access
cat > proxy.js << 'EOF'
const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Proxy to Next.js app on port 3000
  proxy.web(req, res, { target: 'http://localhost:3000' }, (err) => {
    console.error('Proxy error:', err);
    res.writeHead(500);
    res.end('Proxy error');
  });
});

server.listen(80, () => {
  console.log('Proxy server running on port 80, forwarding to Next.js on port 3000');
});
EOF

# Install http-proxy for the proxy server
npm install http-proxy

# Start proxy server
nohup node proxy.js > /var/log/proxy.log 2>&1 &

# Configure nginx as backup
cat > /etc/nginx/sites-available/default << 'EOF'
server {
    listen 8080;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

systemctl restart nginx
systemctl enable nginx

# Create startup service for persistence
cat > /etc/systemd/system/voice-description-api.service << 'EOF'
[Unit]
Description=Voice Description API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/voice-description-api
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable voice-description-api

# Wait for services to fully start
sleep 15

echo "=== Deployment completed at $(date) ==="
echo "Application accessible on:"
echo "- http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):80"
echo "- http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):3000"

# Test the deployment
echo "Testing deployment..."
curl -s http://localhost/api/health && echo "✅ Port 80 working" || echo "❌ Port 80 failed"
curl -s http://localhost:3000/api/health && echo "✅ Port 3000 working" || echo "❌ Port 3000 failed"

echo "=== TERRAFORM DEPLOYMENT COMPLETE ==="

# Create systemd service for auto-restart
cat > /etc/systemd/system/voice-description-api.service << 'EOF'
[Unit]
Description=Voice Description API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/voice-description-api
Environment=NODE_ENV=production
Environment=AWS_DEFAULT_REGION=${AWS_REGION}
Environment=INPUT_S3_BUCKET=${INPUT_S3_BUCKET}
Environment=OUTPUT_S3_BUCKET=${OUTPUT_S3_BUCKET}
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable voice-description-api
systemctl start voice-description-api

# Set ownership
chown -R ubuntu:ubuntu /opt/voice-description-api

echo "Server setup complete. Application ready for deployment."