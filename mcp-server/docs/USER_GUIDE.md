# Voice Description MCP Server User Guide

## Welcome

Welcome to the Voice Description MCP Server! This guide will help you integrate accessibility tools into your AI assistant workflows, enabling automatic generation of audio descriptions for videos and images.

## Table of Contents

- [Getting Started](#getting-started)
- [Common Workflows](#common-workflows)
- [Integration Tutorials](#integration-tutorials)
- [Use Case Examples](#use-case-examples)
- [Best Practices](#best-practices)
- [Optimization Tips](#optimization-tips)
- [Troubleshooting](#troubleshooting)

## Getting Started

### What is the Voice Description MCP Server?

The Voice Description MCP Server is a Model Context Protocol implementation that provides AI assistants with tools to:

- Generate comprehensive audio descriptions for videos
- Create detailed accessibility descriptions for images
- Convert visual content into text and audio formats
- Support multiple languages and voice options
- Process content in batch for efficiency

### Prerequisites

Before you begin, ensure you have:

1. **Access to the Voice Description API**
   - API key for authentication
   - API endpoint URL

2. **MCP-Compatible AI Assistant**
   - Claude Desktop
   - Custom MCP client
   - WebSocket-capable application

3. **Content to Process**
   - Video files (MP4, MPEG, MOV)
   - Image files (JPEG, PNG, WebP)
   - Or S3 URLs for cloud content

### Quick Setup

#### For Claude Desktop Users

1. **Install the MCP Server**
   ```bash
   git clone https://github.com/your-org/voice-description-mcp.git
   cd voice-description-mcp/mcp-server
   npm install
   npm run build
   ```

2. **Configure Claude Desktop**
   
   Edit your Claude Desktop configuration:
   ```json
   {
     "mcpServers": {
       "voice-description": {
         "command": "node",
         "args": ["/path/to/mcp-server/dist/index.js"],
         "env": {
           "API_BASE_URL": "https://api.voicedescription.com",
           "API_KEY": "your-api-key-here"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**
   
   The Voice Description tools will now be available in your conversations.

#### For Custom Integrations

1. **Start the MCP Server**
   ```bash
   # Set environment variables
   export API_BASE_URL=https://api.voicedescription.com
   export API_KEY=your-api-key-here
   export MCP_TRANSPORT=websocket
   export MCP_PORT=3001
   
   # Start server
   npm start
   ```

2. **Connect Your Application**
   ```javascript
   const ws = new WebSocket('ws://localhost:3001');
   
   ws.on('open', () => {
     console.log('Connected to Voice Description MCP Server');
   });
   ```

## Common Workflows

### Workflow 1: Single Image Description

**Goal**: Generate an accessibility description for a product photo.

**Steps**:

1. **Process the image**
   ```
   Use voice_description_process_image with:
   - image_path: "/images/product.jpg"
   - detail_level: "comprehensive"
   - generate_audio: true
   - context: "E-commerce product photo"
   ```

2. **Receive results immediately**
   - Detailed text description
   - Brief alt text for HTML
   - Audio narration file
   - Visual elements and colors
   - Usage recommendations

**Example Conversation**:
```
User: Generate an accessibility description for the laptop photo at /images/laptop-pro.jpg