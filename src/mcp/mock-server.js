const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const uuid = require('uuid').v4;
const TerminalServer = require('../terminal/terminal-server');
const ProjectManager = require('../projects/project-manager');

class MockMCPServer {
    constructor(port = 3001) {
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.clients = new Map();
        this.terminalServer = new TerminalServer();
        this.projectManager = new ProjectManager();
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupTerminal();
    }

    setupMiddleware() {
        this.app.use(express.json());
        
        // Serve static files from web directory
        const path = require('path');
        this.app.use(express.static(path.join(__dirname, '../web')));
        
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
        // Serve project selector at root path
        this.app.get('/', (req, res) => {
            const path = require('path');
            res.sendFile(path.join(__dirname, '../web/project-selector.html'));
        });

        // Serve IDE at /ide path
        this.app.get('/ide', (req, res) => {
            const path = require('path');
            res.sendFile(path.join(__dirname, '../web/index.html'));
        });

        // Test page for debugging
        this.app.get('/test', (req, res) => {
            const path = require('path');
            res.sendFile(path.join(__dirname, '../web/test.html'));
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                timestamp: new Date().toISOString(),
                platform: 'mobile-mock'
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
                        result = { success: true, url: args.url, message: 'Mock navigation completed' };
                        break;
                    case 'browser_click':
                        result = { success: true, selector: args.selector, message: 'Mock click completed' };
                        break;
                    case 'browser_screenshot':
                        // Return a small base64 encoded 1x1 pixel PNG
                        const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
                        result = { success: true, screenshot: mockBase64 };
                        break;
                    case 'browser_get_content':
                        if (args.summary) {
                            result = {
                                success: true,
                                summary: {
                                    title: 'Mock Page Title',
                                    url: 'https://example.com',
                                    headings: ['Mock Heading 1', 'Mock Heading 2'],
                                    forms: [],
                                    links: ['https://example.com/link1'],
                                    characterCount: 150
                                }
                            };
                        } else {
                            result = { 
                                success: true, 
                                content: '<html><body><h1>Mock Content</h1></body></html>' 
                            };
                        }
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

        // Projects API
        this.app.post('/api/projects', async (req, res) => {
            try {
                const { action, ...params } = req.body;

                switch (action) {
                    case 'list':
                        const projects = await this.projectManager.getAllProjects();
                        res.json({ success: true, projects });
                        break;

                    case 'create':
                        const createResult = await this.projectManager.createProject(params);
                        res.json(createResult);
                        break;

                    case 'import':
                        const importResult = await this.projectManager.importProject(params);
                        res.json(importResult);
                        break;

                    case 'toggle-favorite':
                        this.projectManager.toggleFavorite(params.path);
                        res.json({ success: true });
                        break;

                    default:
                        res.status(400).json({ success: false, error: 'Unknown action' });
                }
            } catch (error) {
                console.error('Projects API error:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Status endpoint
        this.app.get('/status', async (req, res) => {
            res.json({
                status: 'ready',
                browserInitialized: true,
                connectedClients: this.clients.size,
                timestamp: new Date().toISOString(),
                platform: 'mobile-mock'
            });
        });
    }

    setupWebSocket() {
        // WebSocket routing is now handled by the terminal server
        // This method is kept for compatibility but doesn't create a conflicting server
        console.log('WebSocket routing delegated to terminal server');
    }

    setupTerminal() {
        // Setup terminal WebSocket server
        this.terminalServer.setupWebSocket(this.server);
    }

    async start() {
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`Mock MCP Server running on port ${this.port}`);
                resolve();
            });
        });
    }

    async stop() {
        // Cleanup terminal server
        if (this.terminalServer) {
            this.terminalServer.cleanup();
        }
        
        return new Promise((resolve) => {
            this.server.close(() => {
                console.log('Mock MCP Server stopped');
                resolve();
            });
        });
    }
}

module.exports = MockMCPServer;