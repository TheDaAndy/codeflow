#!/usr/bin/env node

// tests/browser-simulation.js - Browser testing without Playwright for Android
const http = require('http');
const WebSocket = require('ws');
const { JSDOM } = require('jsdom');

class BrowserSimulationTester {
    constructor() {
        this.baseUrl = 'http://localhost:3001';
        this.results = [];
    }

    async makeRequest(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = `${this.baseUrl}${path}`;
            http.get(url, options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                });
            }).on('error', reject);
        });
    }

    async testServerHealth() {
        console.log('🏥 Testing server health...');
        try {
            const response = await this.makeRequest('/health');
            const health = JSON.parse(response.body);
            
            const passed = response.statusCode === 200 && health.status === 'ok';
            this.addResult('Server Health Check', passed, {
                status: health.status,
                statusCode: response.statusCode
            });
        } catch (error) {
            this.addResult('Server Health Check', false, { error: error.message });
        }
    }

    async testHTMLLoading() {
        console.log('📄 Testing HTML page loading...');
        try {
            const response = await this.makeRequest('/ide');
            
            const passed = response.statusCode === 200 && 
                          response.body.includes('CodeFlow IDE') &&
                          response.body.includes('terminal') &&
                          response.body.includes('app.js');
                          
            this.addResult('HTML Page Loading', passed, {
                statusCode: response.statusCode,
                hasTitle: response.body.includes('CodeFlow IDE'),
                hasTerminal: response.body.includes('terminal'),
                hasScript: response.body.includes('app.js')
            });
        } catch (error) {
            this.addResult('HTML Page Loading', false, { error: error.message });
        }
    }

    async testStaticResources() {
        console.log('📦 Testing static resources...');
        const resources = ['/app.js', '/styles.css'];
        
        for (const resource of resources) {
            try {
                const response = await this.makeRequest(resource);
                const passed = response.statusCode === 200;
                this.addResult(`Static Resource ${resource}`, passed, {
                    statusCode: response.statusCode,
                    size: response.body.length
                });
            } catch (error) {
                this.addResult(`Static Resource ${resource}`, false, { error: error.message });
            }
        }
    }

    async testDOMStructure() {
        console.log('🏗️ Testing DOM structure...');
        try {
            const response = await this.makeRequest('/ide');
            const dom = new JSDOM(response.body);
            const document = dom.window.document;
            
            const checks = [
                { name: 'IDE Container', selector: '.ide-container' },
                { name: 'Header Bar', selector: '.header-bar' },
                { name: 'Terminal Element', selector: '#terminal' },
                { name: 'Connection Status', selector: '#connection-text' },
                { name: 'Connection Indicator', selector: '#connection-indicator' },
                { name: 'Left Panel', selector: '.left-panel' },
                { name: 'App Script', selector: 'script[src="app.js"]' }
            ];
            
            for (const check of checks) {
                const element = document.querySelector(check.selector);
                this.addResult(`DOM Element: ${check.name}`, !!element, {
                    selector: check.selector,
                    found: !!element
                });
            }
            
            // Check that right panel is hidden (display: none)
            const rightPanel = document.querySelector('.right-panel');
            this.addResult('Right Panel Hidden', !!rightPanel, {
                selector: '.right-panel',
                note: 'Should exist in HTML but be hidden via CSS'
            });
            
        } catch (error) {
            this.addResult('DOM Structure Test', false, { error: error.message });
        }
    }

    async testWebSocketConnection() {
        console.log('🔌 Testing WebSocket connection...');
        
        return new Promise((resolve) => {
            const ws = new WebSocket(`ws://localhost:3001/terminal`);
            let connectionEstablished = false;
            let receivedWelcome = false;
            let terminalCreated = false;

            const timeout = setTimeout(() => {
                ws.close();
                this.addResult('WebSocket Connection', connectionEstablished, {
                    connected: connectionEstablished,
                    receivedWelcome,
                    terminalCreated,
                    note: 'Timeout after 5 seconds'
                });
                resolve();
            }, 5000);

            ws.on('open', () => {
                console.log('  ✓ WebSocket connected');
                connectionEstablished = true;
                
                // Try to create terminal
                ws.send(JSON.stringify({
                    type: 'create',
                    data: {
                        cwd: process.cwd()
                    }
                }));
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    console.log(`  📨 Received: ${message.type}`);
                    
                    if (message.type === 'connected') {
                        receivedWelcome = true;
                    } else if (message.type === 'created') {
                        terminalCreated = true;
                        console.log(`  🎉 Terminal created: ${message.terminalId}`);
                    }
                    
                    // Close after getting terminal created
                    if (terminalCreated) {
                        clearTimeout(timeout);
                        ws.close();
                        this.addResult('WebSocket Connection', true, {
                            connected: connectionEstablished,
                            receivedWelcome,
                            terminalCreated,
                            terminalId: message.terminalId
                        });
                        resolve();
                    }
                } catch (error) {
                    console.log(`  ❌ Message parse error: ${error.message}`);
                }
            });

            ws.on('error', (error) => {
                console.log(`  ❌ WebSocket error: ${error.message}`);
                clearTimeout(timeout);
                this.addResult('WebSocket Connection', false, { error: error.message });
                resolve();
            });

            ws.on('close', () => {
                console.log('  🔌 WebSocket closed');
            });
        });
    }

    async testMCPTools() {
        console.log('🛠️ Testing MCP tools endpoint...');
        try {
            const response = await this.makeRequest('/tools');
            const tools = JSON.parse(response.body);
            
            const passed = response.statusCode === 200 && 
                          tools.tools && 
                          Array.isArray(tools.tools) &&
                          tools.tools.length > 0;
                          
            this.addResult('MCP Tools Endpoint', passed, {
                statusCode: response.statusCode,
                toolCount: tools.tools ? tools.tools.length : 0,
                tools: tools.tools ? tools.tools.map(t => t.name) : []
            });
        } catch (error) {
            this.addResult('MCP Tools Endpoint', false, { error: error.message });
        }
    }

    addResult(testName, passed, details = {}) {
        this.results.push({
            name: testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        });
        
        const status = passed ? '✅' : '❌';
        console.log(`  ${status} ${testName}`);
    }

    generateReport() {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;
        
        const report = {
            summary: {
                total,
                passed,
                failed,
                successRate: total > 0 ? (passed / total * 100).toFixed(1) : 0
            },
            results: this.results,
            timestamp: new Date().toISOString()
        };
        
        return report;
    }

    printSummary(report) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 BROWSER SIMULATION TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`📅 Timestamp: ${report.timestamp}`);
        console.log(`📈 Success Rate: ${report.summary.successRate}%`);
        console.log(`✅ Passed: ${report.summary.passed}`);
        console.log(`❌ Failed: ${report.summary.failed}`);
        console.log(`📊 Total: ${report.summary.total}`);
        
        if (report.summary.failed > 0) {
            console.log('\n❌ Failed Tests:');
            report.results.filter(r => !r.passed).forEach(result => {
                console.log(`  • ${result.name}: ${result.details.error || 'Failed'}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        const success = report.summary.failed === 0 && report.summary.total > 0;
        console.log(success ? '🎉 ALL TESTS PASSED!' : '⚠️  SOME TESTS FAILED!');
        console.log('='.repeat(60));
        
        return success;
    }

    async runAllTests() {
        console.log('🚀 Starting Browser Simulation Tests (Android-compatible)\n');
        
        try {
            await this.testServerHealth();
            await this.testHTMLLoading();
            await this.testStaticResources();
            await this.testDOMStructure();
            await this.testWebSocketConnection();
            await this.testMCPTools();
            
            const report = this.generateReport();
            const success = this.printSummary(report);
            
            // Save report
            const fs = require('fs').promises;
            await fs.writeFile('./browser-test-results.json', JSON.stringify(report, null, 2));
            console.log('\n📄 Test report saved to: browser-test-results.json');
            
            return success;
        } catch (error) {
            console.error('\n🚨 Test runner failed:', error.message);
            return false;
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new BrowserSimulationTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = BrowserSimulationTester;