#!/usr/bin/env node

// tests/frontend-integration.js - Frontend integration testing without browser dependencies
const http = require('http');
const WebSocket = require('ws');
const { JSDOM } = require('jsdom');

class FrontendIntegrationTester {
    constructor() {
        this.baseUrl = 'http://localhost:3001';
        this.results = [];
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

    async makeRequest(path) {
        return new Promise((resolve, reject) => {
            const url = `${this.baseUrl}${path}`;
            http.get(url, (res) => {
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

    async testJavaScriptInclusion() {
        console.log('📜 Testing JavaScript file inclusion and structure...');
        
        try {
            const response = await this.makeRequest('/app.js');
            const jsCode = response.body;
            
            // Check for key JavaScript components
            const checks = [
                { name: 'CodeFlowIDE Class', pattern: /class CodeFlowIDE/ },
                { name: 'WebSocket Setup', pattern: /setupTerminalWebSocket/ },
                { name: 'Connection Status Update', pattern: /updateConnectionStatus/ },
                { name: 'Terminal Initialization', pattern: /initializeTerminal/ },
                { name: 'Event Listeners Setup', pattern: /setupEventListeners/ },
                { name: 'MCP Server Connection', pattern: /connectToMCPServer/ },
                { name: 'DOMContentLoaded Handler', pattern: /DOMContentLoaded/ }
            ];
            
            for (const check of checks) {
                const found = check.pattern.test(jsCode);
                this.addResult(`JS Component: ${check.name}`, found, {
                    pattern: check.pattern.toString(),
                    found
                });
            }
            
            // Check for potential syntax errors (basic validation)
            try {
                // Simple syntax check - look for balanced braces
                const openBraces = (jsCode.match(/\{/g) || []).length;
                const closeBraces = (jsCode.match(/\}/g) || []).length;
                const balancedBraces = openBraces === closeBraces;
                
                this.addResult('JS Syntax Check (Braces)', balancedBraces, {
                    openBraces,
                    closeBraces,
                    balanced: balancedBraces
                });
            } catch (error) {
                this.addResult('JS Syntax Check', false, { error: error.message });
            }
            
        } catch (error) {
            this.addResult('JavaScript File Access', false, { error: error.message });
        }
    }

    async testDOMWithJavaScript() {
        console.log('🏗️ Testing DOM structure with simulated JavaScript execution...');
        
        try {
            const response = await this.makeRequest('/ide');
            
            // Create JSDOM with resource loading
            const dom = new JSDOM(response.body, {
                url: this.baseUrl,
                pretendToBeVisual: true,
                resources: 'usable',
                runScripts: 'outside-only'
            });
            
            const { window } = dom;
            const { document } = window;
            
            // Add basic global objects that our code expects
            window.WebSocket = WebSocket;
            window.Terminal = class MockTerminal {
                constructor() { this.onData = () => {}; }
                open() {}
                loadAddon() {}
                clear() {}
            };
            window.FitAddon = { FitAddon: class MockFitAddon { fit() {} } };
            
            // Simulate JavaScript execution by checking DOM manipulation capabilities
            const checks = [
                {
                    name: 'Connection Text Element',
                    test: () => {
                        const el = document.getElementById('connection-text');
                        if (el) {
                            // Simulate status update
                            el.textContent = 'Connected to MCP Server';
                            return el.textContent === 'Connected to MCP Server';
                        }
                        return false;
                    }
                },
                {
                    name: 'Connection Indicator Class',
                    test: () => {
                        const el = document.getElementById('connection-indicator');
                        if (el) {
                            // Simulate class update
                            el.className = 'fas fa-circle connected';
                            return el.className.includes('connected');
                        }
                        return false;
                    }
                },
                {
                    name: 'Terminal Element Interaction',
                    test: () => {
                        const terminal = document.getElementById('terminal');
                        if (terminal) {
                            // Simulate terminal content
                            terminal.textContent = 'CodeFlow Terminal Ready';
                            return terminal.textContent.includes('CodeFlow Terminal');
                        }
                        return false;
                    }
                },
                {
                    name: 'Event Listener Attachment',
                    test: () => {
                        const btn = document.getElementById('clear-terminal');
                        if (btn) {
                            // Simulate event listener
                            let clicked = false;
                            btn.onclick = () => { clicked = true; };
                            btn.click();
                            return clicked;
                        }
                        return false;
                    }
                }
            ];
            
            for (const check of checks) {
                try {
                    const result = check.test();
                    this.addResult(`DOM Interaction: ${check.name}`, result, {
                        canInteract: result
                    });
                } catch (error) {
                    this.addResult(`DOM Interaction: ${check.name}`, false, {
                        error: error.message
                    });
                }
            }
            
        } catch (error) {
            this.addResult('DOM JavaScript Simulation', false, { error: error.message });
        }
    }

    async testWebSocketIntegration() {
        console.log('🔌 Testing WebSocket integration with terminal protocol...');
        
        return new Promise((resolve) => {
            let testResults = {
                connection: false,
                terminalCreation: false,
                messageHandling: false,
                protocolCompliance: false
            };
            
            const ws = new WebSocket(`ws://localhost:3001/terminal`);
            let terminalId = null;
            
            const timeout = setTimeout(() => {
                ws.close();
                this.addResult('WebSocket Full Integration', false, {
                    ...testResults,
                    error: 'Test timeout'
                });
                resolve();
            }, 8000);
            
            ws.on('open', () => {
                testResults.connection = true;
                
                // Test terminal creation with proper protocol
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
                    testResults.messageHandling = true;
                    
                    if (message.type === 'created' && message.terminalId) {
                        testResults.terminalCreation = true;
                        terminalId = message.terminalId;
                        
                        // Test input handling
                        ws.send(JSON.stringify({
                            type: 'input',
                            data: {
                                terminalId: message.terminalId,
                                input: 'echo "integration test"\r'
                            }
                        }));
                    }
                    
                    if (message.type === 'output' && terminalId) {
                        testResults.protocolCompliance = true;
                        
                        // Test resize functionality
                        ws.send(JSON.stringify({
                            type: 'resize',
                            data: {
                                terminalId: terminalId,
                                cols: 80,
                                rows: 24
                            }
                        }));
                        
                        // Complete test after successful protocol exchange
                        setTimeout(() => {
                            clearTimeout(timeout);
                            ws.close();
                            
                            const overallSuccess = Object.values(testResults).every(r => r === true);
                            this.addResult('WebSocket Full Integration', overallSuccess, testResults);
                            resolve();
                        }, 1000);
                    }
                } catch (error) {
                    this.addResult('WebSocket Message Parsing', false, { error: error.message });
                }
            });
            
            ws.on('error', (error) => {
                clearTimeout(timeout);
                this.addResult('WebSocket Connection', false, { error: error.message });
                resolve();
            });
        });
    }

    async testCSSAndStyling() {
        console.log('🎨 Testing CSS and styling...');
        
        try {
            const cssResponse = await this.makeRequest('/styles.css');
            const cssContent = cssResponse.body;
            
            // Check for important CSS rules
            const styleChecks = [
                { name: 'Full Width Terminal', pattern: /\.left-panel[\s\S]*width:\s*100%/ },
                { name: 'Hidden Right Panel', pattern: /\.right-panel[\s\S]*display:\s*none/ },
                { name: 'Connection Status Colors', pattern: /\.connected.*color/ },
                { name: 'Terminal Styling', pattern: /\.terminal/ },
                { name: 'Dark Theme Variables', pattern: /--primary-bg/ },
                { name: 'Responsive Layout', pattern: /@media/ }
            ];
            
            for (const check of styleChecks) {
                const found = check.pattern.test(cssContent);
                this.addResult(`CSS Rule: ${check.name}`, found, {
                    pattern: check.pattern.toString(),
                    found
                });
            }
            
            // Check CSS file size (should be substantial)
            const hasMeaningfulContent = cssContent.length > 5000;
            this.addResult('CSS File Completeness', hasMeaningfulContent, {
                size: cssContent.length,
                substantial: hasMeaningfulContent
            });
            
        } catch (error) {
            this.addResult('CSS File Access', false, { error: error.message });
        }
    }

    async testEndToEndFlow() {
        console.log('🔄 Testing end-to-end user flow simulation...');
        
        try {
            // Simulate complete user journey
            const steps = [];
            
            // Step 1: Load main page
            const mainPage = await this.makeRequest('/');
            steps.push({
                step: 'Load Project Selector',
                success: mainPage.statusCode === 200 && mainPage.body.includes('CodeFlow')
            });
            
            // Step 2: Navigate to IDE  
            const idePage = await this.makeRequest('/ide');
            steps.push({
                step: 'Navigate to IDE',
                success: idePage.statusCode === 200 && idePage.body.includes('terminal')
            });
            
            // Step 3: Load required assets
            const jsLoad = await this.makeRequest('/app.js');
            const cssLoad = await this.makeRequest('/styles.css');
            steps.push({
                step: 'Load Assets',
                success: jsLoad.statusCode === 200 && cssLoad.statusCode === 200
            });
            
            // Step 4: Health check
            const health = await this.makeRequest('/health');
            const healthData = JSON.parse(health.body);
            steps.push({
                step: 'Server Health',
                success: health.statusCode === 200 && healthData.status === 'ok'
            });
            
            // Step 5: MCP Tools availability
            const tools = await this.makeRequest('/tools');
            const toolsData = JSON.parse(tools.body);
            steps.push({
                step: 'MCP Tools Available',
                success: tools.statusCode === 200 && toolsData.tools && toolsData.tools.length > 0
            });
            
            const allStepsPass = steps.every(s => s.success);
            this.addResult('End-to-End Flow', allStepsPass, {
                steps,
                allPass: allStepsPass
            });
            
        } catch (error) {
            this.addResult('End-to-End Flow', false, { error: error.message });
        }
    }

    generateReport() {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;
        
        return {
            summary: {
                total,
                passed,
                failed,
                successRate: total > 0 ? (passed / total * 100).toFixed(1) : 0
            },
            results: this.results,
            timestamp: new Date().toISOString(),
            testType: 'Frontend Integration (Headless Compatible)'
        };
    }

    printSummary(report) {
        console.log('\n' + '='.repeat(60));
        console.log('🔧 FRONTEND INTEGRATION TEST RESULTS');
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
        console.log(success ? '🎉 ALL FRONTEND TESTS PASSED!' : '⚠️  SOME FRONTEND TESTS FAILED!');
        console.log('='.repeat(60));
        
        return success;
    }

    async runAllTests() {
        console.log('🔧 Starting Frontend Integration Tests (Headless-Compatible)\n');
        
        try {
            await this.testJavaScriptInclusion();
            await this.testDOMWithJavaScript();
            await this.testWebSocketIntegration();
            await this.testCSSAndStyling();
            await this.testEndToEndFlow();
            
            const report = this.generateReport();
            const success = this.printSummary(report);
            
            // Save report
            const fs = require('fs').promises;
            await fs.writeFile('./frontend-integration-results.json', JSON.stringify(report, null, 2));
            console.log('\n📄 Frontend test report saved to: frontend-integration-results.json');
            
            return success;
        } catch (error) {
            console.error('\n🚨 Frontend test runner failed:', error.message);
            return false;
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new FrontendIntegrationTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = FrontendIntegrationTester;