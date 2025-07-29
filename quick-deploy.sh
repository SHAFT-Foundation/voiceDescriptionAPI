#!/bin/bash

# Quick deployment script to get the application running
# This creates a minimal version that demonstrates the API is working

cat > /tmp/simple-app.js << 'EOF'
const express = require('express');
const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Voice Description API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'Voice Description API is running',
    endpoints: [
      'GET /api/health - Health check',
      'POST /api/upload - Upload video file',
      'GET /api/status/:jobId - Check job status'
    ]
  });
});

// Upload endpoint (placeholder)
app.post('/api/upload', (req, res) => {
  res.json({ 
    message: 'Upload endpoint ready',
    jobId: 'demo-' + Date.now(),
    status: 'Demo mode - full functionality requires complete deployment'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send(`
    <html>
    <head><title>Voice Description API</title></head>
    <body>
      <h1>🎬 Voice Description API</h1>
      <p>Automated video audio description system using AWS AI services</p>
      <ul>
        <li><a href="/api/health">Health Check</a></li>
        <li><a href="/api/status">API Status</a></li>
      </ul>
      <p><strong>Status:</strong> Server is running and ready for full deployment</p>
    </body>
    </html>
  `);
});

app.listen(port, '0.0.0.0', () => {
  console.log(\`Voice Description API listening at http://0.0.0.0:\${port}\`);
});
EOF

# Deploy the simple app
echo "Deploying minimal Voice Description API..."