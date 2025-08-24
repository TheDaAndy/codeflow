#!/usr/bin/env node

// const MCPServer = require('./server'); // Disabled for mobile compatibility

// Mock browser manager for mobile compatibility
class MockBrowserManager {
    constructor() {
        this.isInitialized = false;
    }

    async ensureInitialized() {
        if (!this.isInitialized) {
            console.log('Initializing mock browser manager for mobile compatibility...');
            this.isInitialized = true;
        }
    }

    async navigate(url) {
        console.log(`Mock navigation to: ${url}`);
        return { success: true, url };
    }

    async screenshot(options = {}) {
        console.log('Mock screenshot taken');
        // Return a small base64 encoded 1x1 pixel PNG
        const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
        return { success: true, screenshot: mockBase64 };
    }

    async getContent(options = {}) {
        if (options.summary) {
            return {
                success: true,
                summary: {
                    title: 'Mock Page Title',
                    url: 'https://example.com',
                    headings: ['Mock Heading 1', 'Mock Heading 2'],
                    forms: [{
                        action: '/mock-form',
                        method: 'POST',
                        inputs: [
                            { type: 'text', name: 'username', placeholder: 'Username' },
                            { type: 'password', name: 'password', placeholder: 'Password' }
                        ]
                    }],
                    links: ['https://example.com/link1', 'https://example.com/link2'],
                    characterCount: 150
                }
            };
        }
        return { 
            success: true, 
            content: '<html><body><h1>Mock Content</h1><p>This is a mock page for mobile compatibility.</p></body></html>' 
        };
    }

    async executeScript(script) {
        console.log(`Mock script execution: ${script.substring(0, 50)}...`);
        return { success: true, result: `Mock result for: ${script}` };
    }

    async click(selector) {
        console.log(`Mock click on: ${selector}`);
        return { success: true };
    }

    async type(selector, text) {
        console.log(`Mock type "${text}" into: ${selector}`);
        return { success: true };
    }

    async getConsole() {
        return {
            success: true,
            console: [
                { type: 'log', text: 'Mock console log entry', timestamp: Date.now() },
                { type: 'info', text: 'Mock info entry', timestamp: Date.now() }
            ]
        };
    }

    async waitForSelector(selector, timeout = 5000) {
        console.log(`Mock wait for selector: ${selector} (timeout: ${timeout}ms)`);
        return { success: true };
    }

    async getDOM(selector = 'html') {
        return {
            success: true,
            dom: {
                tagName: 'HTML',
                innerHTML: '<body><h1>Mock DOM</h1></body>',
                attributes: { lang: 'en' },
                textContent: 'Mock DOM Content',
                children: [
                    { tagName: 'BODY', className: 'mock-body', id: 'main' }
                ]
            }
        };
    }

    setMainWindow() {
        // No-op for standalone mode
    }

    async cleanup() {
        console.log('Mock browser cleanup');
        this.isInitialized = false;
    }
}

async function startServer() {
    console.log('🚀 Starting CodeFlow MCP Server (Standalone Mode)');
    console.log('📱 Running in mobile-compatible mode with mock browser');
    
    const MockMCPServer = require('./mock-server');
    const server = new MockMCPServer(3001);
    
    try {
        await server.start();
        
        console.log('');
        console.log('✅ CodeFlow MCP Server is running!');
        console.log('');
        console.log('🔧 Claude Code Integration:');
        console.log('   Add this to your Claude Code MCP configuration:');
        console.log('   {');
        console.log('     "mcpServers": {');
        console.log('       "codeflow-browser": {');
        console.log('         "command": "node",');
        console.log(`         "args": ["${__filename}"],`);
        console.log('         "env": {');
        console.log('           "CODEFLOW_MCP_PORT": "3001",');
        console.log('           "CODEFLOW_MCP_HOST": "localhost"');
        console.log('         }');
        console.log('       }');
        console.log('     }');
        console.log('   }');
        console.log('');
        console.log('🌐 Endpoints:');
        console.log('   Health Check: http://localhost:3001/health');
        console.log('   Tools List:   http://localhost:3001/tools');
        console.log('   WebSocket:    ws://localhost:3001');
        console.log('');
        console.log('🛠️  Available Browser Tools:');
        console.log('   • browser_navigate     - Navigate to URLs');
        console.log('   • browser_click        - Click elements');
        console.log('   • browser_type         - Type into inputs');
        console.log('   • browser_screenshot   - Take screenshots');
        console.log('   • browser_get_content  - Get page content');
        console.log('   • browser_execute_script - Run JavaScript');
        console.log('   • browser_get_console  - Get console logs');
        console.log('   • browser_wait_for_selector - Wait for elements');
        console.log('   • browser_get_dom      - Get DOM structure');
        console.log('');
        console.log('📖 Documentation: See CLAUDE.md for full usage guide');
        console.log('');
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\\n🛑 Shutting down CodeFlow MCP Server...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\\n🛑 Shutting down CodeFlow MCP Server...');
    process.exit(0);
});

// Start the server
if (require.main === module) {
    startServer().catch(console.error);
}

module.exports = { MockBrowserManager };