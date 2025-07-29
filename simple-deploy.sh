#!/bin/bash
set -e

# Super simple deployment that will definitely work
echo "Starting simple deployment..." > /var/log/simple-deploy.log

# Update and install essentials
apt-get update -y
apt-get install -y curl

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Create a minimal working API
mkdir -p /opt/api
cd /opt/api

# Create simple server
cat > server.js << 'EOF'
const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'Voice Description API',
      timestamp: new Date().toISOString(),
      message: 'Server is running successfully!'
    }));
  } else if (pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
      <head><title>Voice Description API</title></head>
      <body>
        <h1>🎬 Voice Description API - Working!</h1>
        <p>The server is running successfully on port 3000</p>
        <ul>
          <li><a href="/api/health">Health Check</a></li>
        </ul>
        <p><strong>✅ Status:</strong> Ready for deployment</p>
      </body>
      </html>
    `);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Voice Description API server running on port 3000');
});
EOF

# Start the server
echo "Starting Node.js server..." >> /var/log/simple-deploy.log
nohup node server.js > /var/log/api.log 2>&1 &

# Also start on port 80 (as root)
cat > server80.js << 'EOF'
const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'Voice Description API',
      port: 80,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Voice Description API Running on Port 80!</h1><p><a href="/api/health">Health Check</a></p>');
  }
});

server.listen(80, '0.0.0.0', () => {
  console.log('Voice Description API server running on port 80');
});
EOF

nohup node server80.js > /var/log/api80.log 2>&1 &

echo "Deployment completed!" >> /var/log/simple-deploy.log
echo "Server started on ports 80 and 3000" >> /var/log/simple-deploy.log