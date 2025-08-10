import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServer } from 'ws';
import { ToolRegistry } from './tools/registry.js';
import { registerAllTools } from './tools/index.js';
import { logger, createLogger } from './utils/logger.js';
import { config, serverConfig } from './config/index.js';
import process from 'process';

const mainLogger = createLogger('main');

/**
 * WebSocket transport for MCP server
 */
class WebSocketServerTransport {
  private wss: WebSocketServer;
  
  constructor(private port: number, private host: string = 'localhost') {
    this.wss = new WebSocketServer({
      port,
      host,
      perMessageDeflate: false
    });
  }
  
  async start() {
    return new Promise<void>((resolve, reject) => {
      this.wss.on('listening', () => {
        mainLogger.info('WebSocket server listening', {
          port: this.port,
          host: this.host
        });
        resolve();
      });
      
      this.wss.on('error', (error) => {
        mainLogger.error('WebSocket server error', { error: error.message });
        reject(error);
      });
      
      this.wss.on('connection', (ws, request) => {
        const clientInfo = {
          remoteAddress: request.socket.remoteAddress,
          userAgent: request.headers['user-agent']
        };
        
        mainLogger.info('WebSocket client connected', clientInfo);
        
        ws.on('close', (code, reason) => {
          mainLogger.info('WebSocket client disconnected', {
            ...clientInfo,
            code,
            reason: reason.toString()
          });
        });
        
        ws.on('error', (error) => {
          mainLogger.error('WebSocket client error', {
            ...clientInfo,
            error: error.message
          });
        });
      });
    });
  }
  
  async close() {
    return new Promise<void>((resolve) => {
      this.wss.close(() => {
        mainLogger.info('WebSocket server closed');
        resolve();
      });
    });
  }
  
  getWebSocketServer(): WebSocketServer {
    return this.wss;
  }
}

/**
 * Main MCP server class
 */
class MCPServer {
  private server: Server;
  private toolRegistry: ToolRegistry;
  private transport: StdioServerTransport | WebSocketServerTransport;
  private isRunning = false;
  
  constructor() {
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'voice-description-mcp',
        version: '1.0.0',
        description: 'MCP server for Voice Description API - provides tools for video and image accessibility processing',
        author: 'Voice Description Team',
        license: 'MIT'
      },
      {
        capabilities: {
          tools: {},
          // Add other capabilities as needed
          resources: {},
          prompts: {}
        },
      }
    );
    
    // Initialize tool registry
    this.toolRegistry = new ToolRegistry(this.server);
    
    // Set up transport based on configuration
    if (serverConfig.transport === 'stdio') {
      this.transport = new StdioServerTransport();
      mainLogger.info('Using stdio transport');
    } else {
      if (!serverConfig.port) {
        throw new Error('Port is required for WebSocket transport');
      }
      this.transport = new WebSocketServerTransport(
        serverConfig.port,
        serverConfig.host || 'localhost'
      );
      mainLogger.info('Using WebSocket transport', {
        port: serverConfig.port,
        host: serverConfig.host
      });
    }
  }
  
  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    try {
      mainLogger.info('Starting MCP server', {
        transport: serverConfig.transport,
        config: {
          apiBaseUrl: config.api.baseUrl,
          features: config.features,
          logging: config.logging.level
        }
      });
      
      // Register all tools
      const toolsRegistered = await registerAllTools(this.toolRegistry);
      mainLogger.info('Registered tools', {
        count: toolsRegistered,
        tools: this.toolRegistry.listTools()
      });
      
      // Start transport if it's WebSocket
      if (this.transport instanceof WebSocketServerTransport) {
        await this.transport.start();
      }
      
      // Connect server to transport
      await this.server.connect(this.transport);
      
      this.isRunning = true;
      
      mainLogger.info('MCP server started successfully', {
        transport: serverConfig.transport,
        toolCount: this.toolRegistry.getToolCount(),
        pid: process.pid
      });
      
      // Log server statistics
      const stats = this.toolRegistry.getStats();
      mainLogger.info('Server ready', stats);
      
    } catch (error) {
      mainLogger.error('Failed to start MCP server', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
  
  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      mainLogger.warn('Server is not running');
      return;
    }
    
    try {
      mainLogger.info('Stopping MCP server');
      
      // Close server connection
      await this.server.close();
      
      // Close transport if it's WebSocket
      if (this.transport instanceof WebSocketServerTransport) {
        await this.transport.close();
      }
      
      this.isRunning = false;
      
      mainLogger.info('MCP server stopped successfully');
    } catch (error) {
      mainLogger.error('Error stopping MCP server', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Get server status
   */
  getStatus(): {
    running: boolean;
    transport: string;
    toolCount: number;
    pid: number;
    uptime: number;
    memory: NodeJS.MemoryUsage;
  } {
    return {
      running: this.isRunning,
      transport: serverConfig.transport,
      toolCount: this.toolRegistry.getToolCount(),
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
  
  /**
   * Get tool registry
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }
}

/**
 * Handle graceful shutdown
 */
async function setupGracefulShutdown(server: MCPServer) {
  const shutdown = async (signal: string) => {
    mainLogger.info(`Received ${signal}, shutting down gracefully`);
    
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      mainLogger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    }
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    mainLogger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack
    });
    
    // Give time for logs to flush, then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    mainLogger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined
    });
    
    // Give time for logs to flush, then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Create and start server
    const server = new MCPServer();
    
    // Set up graceful shutdown
    await setupGracefulShutdown(server);
    
    // Start the server
    await server.start();
    
    // Keep the process running for stdio transport
    if (serverConfig.transport === 'stdio') {
      // For stdio, the process should stay alive until stdin closes
      process.stdin.on('end', async () => {
        mainLogger.info('stdin closed, shutting down');
        await server.stop();
      });
    }
    
  } catch (error) {
    mainLogger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Handle ES module execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { MCPServer, WebSocketServerTransport };
export default main;