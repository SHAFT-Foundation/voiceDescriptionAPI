# Voice Description MCP Server Documentation

Welcome to the comprehensive documentation for the Voice Description MCP Server. This documentation covers everything you need to integrate, use, and extend the MCP server for accessibility content generation.

## 📚 Documentation Overview

### For Users

#### [🚀 Main README](../README.md)
Complete overview, installation, configuration, and quick start guide for the MCP server.

#### [📖 User Guide](./USER_GUIDE.md)
Step-by-step tutorials and workflows for common use cases, including integration with AI assistants.

#### [💡 Examples](./EXAMPLES.md)
Real-world code examples and complete workflows for various scenarios including e-commerce, education, and social media.

#### [🔧 Troubleshooting](./TROUBLESHOOTING.md)
Solutions to common problems, error messages, and debugging techniques.

### For Developers

#### [📘 API Reference](./API_REFERENCE.md)
Complete API documentation for all 8 MCP tools, including parameters, responses, and error codes.

#### [👩‍💻 Developer Guide](./DEVELOPER_GUIDE.md)
Architecture overview, development setup, testing strategies, and contribution guidelines.

## 🎯 Quick Navigation

### By Task

| I want to... | Go to... |
|-------------|----------|
| **Get started quickly** | [Quick Start](../README.md#quick-start) |
| **Process a single image** | [Image Processing Examples](./EXAMPLES.md#single-image-processing) |
| **Process a video** | [Video Processing Examples](./EXAMPLES.md#video-processing) |
| **Set up batch processing** | [Batch Processing](./EXAMPLES.md#batch-image-processing) |
| **Integrate with Claude Desktop** | [Integration Guide](../README.md#integration-guide) |
| **Debug an issue** | [Troubleshooting](./TROUBLESHOOTING.md) |
| **Add a new tool** | [Adding New Tools](./DEVELOPER_GUIDE.md#adding-new-tools) |
| **Understand the architecture** | [Architecture Overview](./DEVELOPER_GUIDE.md#architecture) |

### By Tool

| Tool | Purpose | Documentation |
|------|---------|---------------|
| `voice_description_upload_video` | Upload and process videos | [API Docs](./API_REFERENCE.md#voice_description_upload_video) |
| `voice_description_process_video_url` | Process videos from S3 | [API Docs](./API_REFERENCE.md#voice_description_process_video_url) |
| `voice_description_process_image` | Process single images | [API Docs](./API_REFERENCE.md#voice_description_process_image) |
| `voice_description_batch_images` | Batch process images | [API Docs](./API_REFERENCE.md#voice_description_batch_images) |
| `voice_description_check_status` | Check job status | [API Docs](./API_REFERENCE.md#voice_description_check_status) |
| `voice_description_download_results` | Download results | [API Docs](./API_REFERENCE.md#voice_description_download_results) |
| `voice_description_health_check` | System health check | [API Docs](./API_REFERENCE.md#voice_description_health_check) |
| `voice_description_aws_status` | AWS service status | [API Docs](./API_REFERENCE.md#voice_description_aws_status) |

## 🏗️ Architecture Summary

The MCP server follows a modular architecture with clear separation of concerns:

```
MCP Protocol Layer (Handles communication)
    ↓
Tool Registry (Manages tool lifecycle)
    ↓
Tools Layer (Business logic)
    ↓
Adapters Layer (External services)
    ↓
Voice Description API → AWS Services
```

**Key Components:**
- **8 MCP Tools** for video, image, and job management
- **TypeScript** with strict typing and Zod validation
- **Comprehensive error handling** with retry logic
- **90%+ test coverage** across unit, integration, and performance tests
- **Production-ready** with Docker, logging, and monitoring

## 📊 Feature Matrix

| Feature | Status | Documentation |
|---------|--------|---------------|
| **Video Processing** | ✅ Ready | [Video Tools](./API_REFERENCE.md#video-processing-tools) |
| **Image Processing** | ✅ Ready | [Image Tools](./API_REFERENCE.md#image-processing-tools) |
| **Batch Processing** | ✅ Ready | [Batch Examples](./EXAMPLES.md#batch-image-processing) |
| **Multi-language** | ✅ Ready | [Languages](./API_REFERENCE.md#language-codes) |
| **Audio Generation** | ✅ Ready | [AWS Polly Integration](./API_REFERENCE.md#voice_description_process_image) |
| **WebSocket Support** | ✅ Ready | [WebSocket Protocol](./API_REFERENCE.md#websocket-protocol) |
| **Docker Deployment** | ✅ Ready | [Deployment](../README.md#deployment) |
| **Health Monitoring** | ✅ Ready | [Monitoring](./EXAMPLES.md#health-monitoring) |
| **Rate Limiting** | ✅ Ready | [Rate Limits](./API_REFERENCE.md#rate-limiting) |
| **Caching** | ✅ Ready | [Performance](./DEVELOPER_GUIDE.md#performance-optimization) |

## 🚦 Getting Started Path

### For AI Assistant Users

1. **Install the server** → [Installation Guide](../README.md#installation)
2. **Configure your AI assistant** → [Integration Guide](../README.md#integration-guide)
3. **Try your first image** → [Basic Example](./EXAMPLES.md#basic-image-description)
4. **Explore workflows** → [Common Workflows](./USER_GUIDE.md#common-workflows)

### For Developers

1. **Set up development environment** → [Development Setup](./DEVELOPER_GUIDE.md#development-setup)
2. **Understand the architecture** → [Architecture](./DEVELOPER_GUIDE.md#architecture)
3. **Run the tests** → [Testing Strategy](./DEVELOPER_GUIDE.md#testing-strategy)
4. **Make your first contribution** → [Contributing](./DEVELOPER_GUIDE.md#contributing)

### For Production Deployment

1. **Review requirements** → [Prerequisites](../README.md#prerequisites)
2. **Configure environment** → [Configuration](../README.md#configuration)
3. **Deploy with Docker** → [Docker Deployment](../README.md#docker-deployment)
4. **Set up monitoring** → [Health Monitoring](./EXAMPLES.md#health-monitoring)

## 📈 Performance Benchmarks

| Operation | Average Time | Throughput | Details |
|-----------|-------------|------------|---------|
| Single Image | 1.2s | 50/min | [Benchmarks](../README.md#benchmarks) |
| Batch (10 images) | 8s | 75/min | [Optimization](./DEVELOPER_GUIDE.md#performance-optimization) |
| Video (5 min) | 2-3 min | 20/hour | [Video Processing](./API_REFERENCE.md#video-processing-tools) |
| Health Check | 20ms | 3000/min | [System Tools](./API_REFERENCE.md#system-tools) |

## 🔒 Security & Compliance

- **Authentication**: API key-based with header validation
- **Input Validation**: Zod schemas for all parameters
- **File Security**: Path traversal protection, type validation
- **Standards**: WCAG 2.1 AA, Section 508, GDPR compliant
- **Best Practices**: OWASP Top 10 mitigation

See [Security Considerations](./DEVELOPER_GUIDE.md#security-considerations) for details.

## 📞 Support Resources

### Documentation
- **This Guide**: Comprehensive documentation hub
- **API Reference**: [Complete API documentation](./API_REFERENCE.md)
- **Examples**: [Working code examples](./EXAMPLES.md)
- **Troubleshooting**: [Problem-solving guide](./TROUBLESHOOTING.md)

### Community
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Questions and community support
- **Stack Overflow**: Tag with `voice-description-mcp`

### Direct Support
- **Email**: support@voicedescription.com
- **Enterprise**: Contact for dedicated support

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2024 | Initial release with 8 MCP tools |
| | | Full video and image processing |
| | | WebSocket and STDIO transport |
| | | Docker deployment ready |
| | | 90%+ test coverage |

## 📝 License

MIT License - See [LICENSE](../LICENSE) file for details.

## 🙏 Acknowledgments

Built with:
- **Model Context Protocol (MCP)** by Anthropic
- **AWS AI/ML Services** (Rekognition, Bedrock, Polly)
- **Node.js** and **TypeScript**
- Open source community contributions

---

**Need help?** Start with the [Quick Start](../README.md#quick-start) or explore the [Examples](./EXAMPLES.md) to see the MCP server in action!