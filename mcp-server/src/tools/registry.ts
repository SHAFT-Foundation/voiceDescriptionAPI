import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { Tool, ToolContext, ToolDefinition, MCPToolError, ErrorCode } from '../types/index.js';
import { logger, logToolExecution, logToolResult } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  
  constructor(private server: Server) {
    this.setupHandlers();
  }
  
  private setupHandlers() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(tool => this.toolToDefinition(tool));
      
      logger.info('Listed tools', { 
        count: tools.length,
        tools: tools.map(t => t.name)
      });
      
      return { tools };
    });
    
    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const requestId = uuidv4();
      const startTime = Date.now();
      
      logToolExecution(name, args, requestId);
      
      try {
        const tool = this.tools.get(name);
        if (!tool) {
          throw new MCPToolError(
            ErrorCode.INVALID_PARAMETERS,
            `Tool not found: ${name}`,
            { availableTools: Array.from(this.tools.keys()) }
          );
        }
        
        // Validate parameters
        let validatedParams: any;
        try {
          validatedParams = tool.inputSchema.parse(args || {});
        } catch (error) {
          if (error instanceof z.ZodError) {
            const issues = error.issues.map(issue => ({
              path: issue.path.join('.'),
              message: issue.message,
              code: issue.code
            }));
            
            throw new MCPToolError(
              ErrorCode.INVALID_PARAMETERS,
              'Invalid parameters provided',
              { validationErrors: issues }
            );
          }
          throw error;
        }
        
        // Create tool execution context
        const context: ToolContext = {
          requestId,
          metadata: {
            timestamp: new Date().toISOString(),
            toolName: name
          }
        };
        
        // Execute tool
        const result = await tool.execute(validatedParams, context);
        
        const duration = Date.now() - startTime;
        logToolResult(name, true, duration, requestId);
        
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        logToolResult(name, false, duration, requestId, error);
        
        // Convert error to MCP format
        if (error instanceof MCPToolError) {
          throw error.toMCPError();
        }
        
        // Handle unexpected errors
        logger.error('Unexpected error in tool execution', {
          tool: name,
          requestId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        
        throw new MCPToolError(
          ErrorCode.INTERNAL_ERROR,
          'An unexpected error occurred during tool execution',
          { originalError: error instanceof Error ? error.message : String(error) }
        ).toMCPError();
      }
    });
  }
  
  /**
   * Register a new tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    
    // Validate tool schema
    try {
      // Test that the schema can be converted to JSON schema
      this.zodToJsonSchema(tool.inputSchema);
    } catch (error) {
      throw new Error(`Invalid schema for tool ${tool.name}: ${error}`);
    }
    
    this.tools.set(tool.name, tool);
    logger.info('Registered tool', { 
      name: tool.name,
      description: tool.description 
    });
  }
  
  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      logger.info('Unregistered tool', { name });
    }
    return removed;
  }
  
  /**
   * Get tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }
  
  /**
   * List all registered tools
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }
  
  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.tools.size;
  }
  
  /**
   * Check if tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
  
  /**
   * Convert tool to MCP tool definition
   */
  private toolToDefinition(tool: Tool): ToolDefinition {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: {
        type: 'object',
        ...this.zodToJsonSchema(tool.inputSchema),
      },
    };
  }
  
  /**
   * Convert Zod schema to JSON Schema
   */
  private zodToJsonSchema(schema: z.ZodObject<any>): any {
    const shape = schema.shape;
    const properties: any = {};
    const required: string[] = [];
    
    for (const [key, value] of Object.entries(shape)) {
      const zodType = value as z.ZodTypeAny;
      
      // Check if field is required
      if (!this.isOptional(zodType)) {
        required.push(key);
      }
      
      properties[key] = this.zodTypeToJsonSchema(zodType);
    }
    
    const result: any = { properties };
    if (required.length > 0) {
      result.required = required;
    }
    
    return result;
  }
  
  /**
   * Convert individual Zod type to JSON Schema
   */
  private zodTypeToJsonSchema(zodType: z.ZodTypeAny): any {
    // Handle optional types
    if (zodType instanceof z.ZodOptional) {
      return this.zodTypeToJsonSchema(zodType.unwrap());
    }
    
    // Handle default values
    if (zodType instanceof z.ZodDefault) {
      const schema = this.zodTypeToJsonSchema(zodType.removeDefault());
      schema.default = zodType._def.defaultValue();
      return schema;
    }
    
    // Handle basic types
    if (zodType instanceof z.ZodString) {
      const schema: any = { type: 'string' };
      
      // Add string constraints
      if (zodType._def.checks) {
        for (const check of zodType._def.checks) {
          switch (check.kind) {
            case 'min':
              schema.minLength = check.value;
              break;
            case 'max':
              schema.maxLength = check.value;
              break;
            case 'regex':
              schema.pattern = check.regex.source;
              break;
            case 'email':
              schema.format = 'email';
              break;
            case 'url':
              schema.format = 'uri';
              break;
            case 'uuid':
              schema.format = 'uuid';
              break;
          }
        }
      }
      
      return schema;
    }
    
    if (zodType instanceof z.ZodNumber) {
      const schema: any = { type: 'number' };
      
      // Add number constraints
      if (zodType._def.checks) {
        for (const check of zodType._def.checks) {
          switch (check.kind) {
            case 'min':
              schema.minimum = check.value;
              if (!check.inclusive) schema.exclusiveMinimum = true;
              break;
            case 'max':
              schema.maximum = check.value;
              if (!check.inclusive) schema.exclusiveMaximum = true;
              break;
            case 'int':
              schema.type = 'integer';
              break;
          }
        }
      }
      
      return schema;
    }
    
    if (zodType instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }
    
    if (zodType instanceof z.ZodArray) {
      const schema: any = {
        type: 'array',
        items: this.zodTypeToJsonSchema(zodType.element),
      };
      
      // Add array constraints
      if (zodType._def.minLength !== null) {
        schema.minItems = zodType._def.minLength.value;
      }
      if (zodType._def.maxLength !== null) {
        schema.maxItems = zodType._def.maxLength.value;
      }
      
      return schema;
    }
    
    if (zodType instanceof z.ZodObject) {
      return {
        type: 'object',
        ...this.zodToJsonSchema(zodType),
      };
    }
    
    if (zodType instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: zodType._def.values,
      };
    }
    
    if (zodType instanceof z.ZodUnion) {
      return {
        oneOf: zodType._def.options.map((option: z.ZodTypeAny) => 
          this.zodTypeToJsonSchema(option)
        ),
      };
    }
    
    if (zodType instanceof z.ZodLiteral) {
      return {
        type: typeof zodType._def.value,
        const: zodType._def.value,
      };
    }
    
    // Fallback for unknown types
    logger.warn('Unknown Zod type encountered, using string fallback', {
      type: zodType.constructor.name
    });
    
    return { type: 'string' };
  }
  
  /**
   * Check if a Zod type is optional
   */
  private isOptional(zodType: z.ZodTypeAny): boolean {
    return zodType instanceof z.ZodOptional || 
           zodType instanceof z.ZodDefault ||
           (zodType instanceof z.ZodUnion && 
            zodType._def.options.some((option: z.ZodTypeAny) => 
              option instanceof z.ZodUndefined
            ));
  }
  
  /**
   * Get tool statistics
   */
  getStats(): {
    totalTools: number;
    toolsByCategory: Record<string, number>;
    tools: Array<{ name: string; description: string; }>;
  } {
    const tools = Array.from(this.tools.values());
    const toolsByCategory: Record<string, number> = {};
    
    // Categorize tools by prefix
    tools.forEach(tool => {
      const category = tool.name.split('_')[1] || 'other';
      toolsByCategory[category] = (toolsByCategory[category] || 0) + 1;
    });
    
    return {
      totalTools: tools.length,
      toolsByCategory,
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description
      }))
    };
  }
}