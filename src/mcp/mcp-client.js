#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');
const fetch = require('node-fetch');

class CodeFlowMCPClient {
  constructor() {
    this.server = new Server(
      {
        name: 'codeflow-browser',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.mcpPort = process.env.CODEFLOW_MCP_PORT || '3001';
    this.mcpHost = process.env.CODEFLOW_MCP_HOST || 'localhost';
    this.baseUrl = `http://${this.mcpHost}:${this.mcpPort}`;
    
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        const response = await fetch(`${this.baseUrl}/tools`);
        if (!response.ok) {
          throw new Error(`Failed to fetch tools: ${response.statusText}`);
        }
        
        const data = await response.json();
        return {
          tools: data.tools || []
        };
      } catch (error) {
        console.error('Error fetching tools:', error);
        return { tools: [] };
      }
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const response = await fetch(`${this.baseUrl}/tools/${name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ arguments: args }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || 'Tool execution failed');
        }

        // Handle different result types
        if (name === 'browser_screenshot' && result.result.screenshot) {
          return {
            content: [
              {
                type: 'image',
                data: result.result.screenshot,
                mimeType: 'image/png'
              }
            ]
          };
        }

        if (name === 'browser_get_content' && result.result.content) {
          return {
            content: [
              {
                type: 'text',
                text: `HTML Content:\\n${result.result.content}`
              }
            ]
          };
        }

        if (name === 'browser_get_console' && result.result.console) {
          const consoleOutput = result.result.console
            .map(entry => `[${entry.type}] ${entry.text || entry.message}`)
            .join('\\n');
            
          return {
            content: [
              {
                type: 'text',
                text: `Console Output:\\n${consoleOutput}`
              }
            ]
          };
        }

        if (name === 'browser_get_dom' && result.result.dom) {
          const domInfo = JSON.stringify(result.result.dom, null, 2);
          return {
            content: [
              {
                type: 'text',
                text: `DOM Information:\\n${domInfo}`
              }
            ]
          };
        }

        // Default response for other tools
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.result, null, 2)
            }
          ]
        };

      } catch (error) {
        console.error(`Error executing tool ${name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to execute ${name}: ${error.message}`
        );
      }
    });
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async start() {
    // Wait for MCP server to be available
    await this.waitForMCPServer();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('CodeFlow MCP Client connected and ready');
  }

  async waitForMCPServer(maxAttempts = 30, interval = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/health`);
        if (response.ok) {
          console.error(`Connected to MCP server after ${attempt} attempts`);
          return;
        }
      } catch (error) {
        // Server not ready yet
      }
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
    
    throw new Error(`Failed to connect to MCP server at ${this.baseUrl} after ${maxAttempts} attempts`);
  }
}

// Start the MCP client
const client = new CodeFlowMCPClient();
client.start().catch(console.error);