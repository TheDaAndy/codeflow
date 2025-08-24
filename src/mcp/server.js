const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const uuid = require('uuid').v4;
const BrowserManager = require('../main/browser');

class MCPServer {
    constructor(port = 3001) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        this.browserManager = new BrowserManager();
        this.clients = new Map();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        // CORS middleware
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                browserInitialized: this.browserManager.isInitialized 
            });
        });

        // MCP Tools endpoint for Claude Code
        this.app.get('/tools', (req, res) => {
            res.json({
                tools: [
                    {
                        name: 'browser_navigate',
                        description: 'Navigate to a URL in the browser',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                url: { type: 'string', description: 'URL to navigate to' }
                            },
                            required: ['url']
                        }
                    },
                    {
                        name: 'browser_click',
                        description: 'Click an element in the browser',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                selector: { type: 'string', description: 'CSS selector for the element to click' }
                            },
                            required: ['selector']
                        }
                    },
                    {
                        name: 'browser_type',
                        description: 'Type text into an input field',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                selector: { type: 'string', description: 'CSS selector for the input field' },
                                text: { type: 'string', description: 'Text to type' }
                            },
                            required: ['selector', 'text']
                        }
                    },
                    {
                        name: 'browser_screenshot',
                        description: 'Take a screenshot of the current page',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                fullPage: { type: 'boolean', description: 'Capture full page or viewport only', default: true }
                            }
                        }
                    },
                    {
                        name: 'browser_get_content',
                        description: 'Get the HTML content of the current page (lightweight - use subagent for analysis)',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                summary: { type: 'boolean', description: 'Return only page summary to save context', default: true }
                            }
                        }
                    },
                    {
                        name: 'browser_execute_script',
                        description: 'Execute JavaScript in the browser context',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                script: { type: 'string', description: 'JavaScript code to execute' }
                            },
                            required: ['script']
                        }
                    },
                    {
                        name: 'browser_get_console',
                        description: 'Get browser console logs',
                        inputSchema: {
                            type: 'object',
                            properties: {}
                        }
                    },
                    {
                        name: 'browser_wait_for_selector',
                        description: 'Wait for an element to appear on the page',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                selector: { type: 'string', description: 'CSS selector to wait for' },
                                timeout: { type: 'number', description: 'Timeout in milliseconds', default: 5000 }
                            },
                            required: ['selector']
                        }
                    },
                    {
                        name: 'browser_get_dom',
                        description: 'Get DOM structure of an element',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                selector: { type: 'string', description: 'CSS selector for the element', default: 'html' }
                            }
                        }
                    }
                ]
            });
        });

        // Tool execution endpoint
        this.app.post('/tools/:toolName', async (req, res) => {
            const { toolName } = req.params;
            const { arguments: args } = req.body;

            try {
                let result;
                
                switch (toolName) {
                    case 'browser_navigate':
                        result = await this.browserManager.navigate(args.url);
                        break;
                    case 'browser_click':
                        result = await this.browserManager.click(args.selector);
                        break;
                    case 'browser_type':
                        result = await this.browserManager.type(args.selector, args.text);
                        break;
                    case 'browser_screenshot':
                        result = await this.browserManager.screenshot(args);
                        break;
                    case 'browser_get_content':
                        result = await this.browserManager.getContent();
                        break;
                    case 'browser_execute_script':
                        result = await this.browserManager.executeScript(args.script);
                        break;
                    case 'browser_get_console':
                        result = await this.browserManager.getConsole();
                        break;
                    case 'browser_wait_for_selector':
                        result = await this.browserManager.waitForSelector(args.selector, args.timeout);
                        break;
                    case 'browser_get_dom':
                        result = await this.browserManager.getDOM(args.selector);
                        break;
                    default:
                        throw new Error(`Unknown tool: ${toolName}`);
                }

                res.json({
                    success: true,
                    result,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error(`Error executing ${toolName}:`, error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Status endpoint
        this.app.get('/status', async (req, res) => {
            try {
                await this.browserManager.ensureInitialized();
                res.json({
                    status: 'ready',
                    browserInitialized: this.browserManager.isInitialized,
                    connectedClients: this.clients.size,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const clientId = uuid();
            this.clients.set(clientId, ws);

            console.log(`Client ${clientId} connected`);

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleWebSocketMessage(ws, clientId, data);
                } catch (error) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: error.message
                    }));
                }
            });

            ws.on('close', () => {
                this.clients.delete(clientId);
                console.log(`Client ${clientId} disconnected`);
            });

            // Send welcome message
            ws.send(JSON.stringify({
                type: 'connected',
                clientId,
                message: 'Connected to CodeFlow MCP Server'
            }));
        });
    }

    async handleWebSocketMessage(ws, clientId, data) {
        const { type, payload } = data;

        switch (type) {
            case 'tool_call':
                const result = await this.executeTool(payload.toolName, payload.arguments);
                ws.send(JSON.stringify({
                    type: 'tool_result',
                    id: payload.id,
                    result
                }));
                break;

            case 'subscribe':
                // Subscribe to browser events
                if (payload.events) {
                    payload.events.forEach(eventType => {
                        this.subscribeClientToEvent(clientId, eventType);
                    });
                }
                break;

            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    error: `Unknown message type: ${type}`
                }));
        }
    }

    async executeTool(toolName, args) {
        try {
            await this.browserManager.ensureInitialized();

            switch (toolName) {
                case 'browser_navigate':
                    return await this.browserManager.navigate(args.url);
                case 'browser_click':
                    return await this.browserManager.click(args.selector);
                case 'browser_type':
                    return await this.browserManager.type(args.selector, args.text);
                case 'browser_screenshot':
                    return await this.browserManager.screenshot(args);
                case 'browser_get_content':
                    return await this.browserManager.getContent();
                case 'browser_execute_script':
                    return await this.browserManager.executeScript(args.script);
                case 'browser_get_console':
                    return await this.browserManager.getConsole();
                case 'browser_wait_for_selector':
                    return await this.browserManager.waitForSelector(args.selector, args.timeout);
                case 'browser_get_dom':
                    return await this.browserManager.getDOM(args.selector);
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    subscribeClientToEvent(clientId, eventType) {
        // Implementation for event subscriptions
        console.log(`Client ${clientId} subscribed to ${eventType}`);
    }

    broadcastToClients(data) {
        const message = JSON.stringify(data);
        this.clients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }

    async start() {
        try {
            await this.browserManager.initialize();
            
            this.server.listen(this.port, () => {
                console.log(`CodeFlow MCP Server running on port ${this.port}`);
                console.log(`Browser tools available at: http://localhost:${this.port}/tools`);
                console.log(`WebSocket endpoint: ws://localhost:${this.port}`);
            });
        } catch (error) {
            console.error('Failed to start MCP server:', error);
        }
    }

    async stop() {
        try {
            await this.browserManager.cleanup();
            this.server.close();
            console.log('MCP Server stopped');
        } catch (error) {
            console.error('Error stopping MCP server:', error);
        }
    }
}

module.exports = MCPServer;