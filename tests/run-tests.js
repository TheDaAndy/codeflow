#!/usr/bin/env node

// tests/run-tests.js - Node.js test runner for CodeFlow
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class CodeFlowTestRunner {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.testResults = {
            playwright: null,
            jest: null,
            overall: null
        };
    }

    async runCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            console.log(`\n🚀 Running: ${command} ${args.join(' ')}`);
            
            const child = spawn(command, args, {
                cwd: this.projectRoot,
                stdio: 'inherit',
                shell: true,
                ...options
            });

            child.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ ${command} completed successfully`);
                    resolve(code);
                } else {
                    console.log(`❌ ${command} failed with code ${code}`);
                    resolve(code); // Don't reject, just return code
                }
            });

            child.on('error', (error) => {
                console.error(`🚨 Error running ${command}:`, error.message);
                reject(error);
            });
        });
    }

    async checkDependencies() {
        console.log('\n🔍 Checking dependencies...');
        
        try {
            const packageJson = JSON.parse(
                await fs.readFile(path.join(this.projectRoot, 'package.json'), 'utf8')
            );

            const requiredDeps = ['playwright', 'jest', 'nodemon'];
            const installedDeps = {
                ...packageJson.dependencies || {},
                ...packageJson.devDependencies || {}
            };

            const missingDeps = requiredDeps.filter(dep => !installedDeps[dep]);
            
            if (missingDeps.length > 0) {
                console.log(`⚠️  Missing dependencies: ${missingDeps.join(', ')}`);
                console.log('Installing missing dependencies...');
                await this.runCommand('npm', ['install', '--save-dev', ...missingDeps]);
            } else {
                console.log('✅ All required dependencies are installed');
            }

            return true;
        } catch (error) {
            console.error('❌ Failed to check dependencies:', error.message);
            return false;
        }
    }

    async waitForServer(url = 'http://localhost:3001/health', timeout = 30000) {
        console.log(`\n⏳ Waiting for server at ${url}...`);
        
        const start = Date.now();
        while (Date.now() - start < timeout) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    console.log('✅ Server is ready!');
                    return true;
                }
            } catch (error) {
                // Server not ready yet
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('❌ Server failed to start within timeout');
        return false;
    }

    async runJestTests() {
        console.log('\n📋 Running Jest unit tests...');
        
        try {
            const exitCode = await this.runCommand('npm', ['test', '--', '--verbose']);
            this.testResults.jest = {
                passed: exitCode === 0,
                exitCode
            };
            return exitCode === 0;
        } catch (error) {
            console.error('Jest tests failed:', error.message);
            this.testResults.jest = {
                passed: false,
                error: error.message
            };
            return false;
        }
    }

    async runPlaywrightTests() {
        console.log('\n🎭 Running Playwright browser tests...');
        
        try {
            // Install Playwright browsers if needed
            console.log('Installing Playwright browsers...');
            await this.runCommand('npx', ['playwright', 'install', '--with-deps']);
            
            // Run Playwright tests
            const exitCode = await this.runCommand('npx', ['playwright', 'test']);
            
            this.testResults.playwright = {
                passed: exitCode === 0,
                exitCode
            };
            
            return exitCode === 0;
        } catch (error) {
            console.error('Playwright tests failed:', error.message);
            this.testResults.playwright = {
                passed: false,
                error: error.message
            };
            return false;
        }
    }

    async generateReport() {
        console.log('\n📊 Generating test report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            results: this.testResults,
            summary: {
                total: 0,
                passed: 0,
                failed: 0
            }
        };

        // Count results
        Object.values(this.testResults).forEach(result => {
            if (result && typeof result === 'object') {
                report.summary.total++;
                if (result.passed) {
                    report.summary.passed++;
                } else {
                    report.summary.failed++;
                }
            }
        });

        // Save report
        const reportPath = path.join(this.projectRoot, 'test-results.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`📄 Test report saved to: ${reportPath}`);
        return report;
    }

    printSummary(report) {
        console.log('\n' + '='.repeat(60));
        console.log('🎯 TEST SUMMARY');
        console.log('='.repeat(60));
        
        console.log(`📅 Timestamp: ${report.timestamp}`);
        console.log(`📊 Total Test Suites: ${report.summary.total}`);
        console.log(`✅ Passed: ${report.summary.passed}`);
        console.log(`❌ Failed: ${report.summary.failed}`);
        
        console.log('\nDetailed Results:');
        
        if (report.results.jest) {
            const status = report.results.jest.passed ? '✅' : '❌';
            console.log(`${status} Jest Unit Tests`);
        }
        
        if (report.results.playwright) {
            const status = report.results.playwright.passed ? '✅' : '❌';
            console.log(`${status} Playwright Browser Tests`);
        }

        const overallSuccess = report.summary.failed === 0 && report.summary.total > 0;
        console.log('\n' + '='.repeat(60));
        console.log(overallSuccess ? '🎉 ALL TESTS PASSED!' : '💥 SOME TESTS FAILED!');
        console.log('='.repeat(60));
        
        return overallSuccess;
    }

    async run() {
        console.log('🚀 Starting CodeFlow Test Runner');
        console.log('🎯 Running comprehensive test suite...\n');

        try {
            // Check dependencies
            const depsOk = await this.checkDependencies();
            if (!depsOk) {
                process.exit(1);
            }

            // Wait for server (in case it's starting)
            await this.waitForServer();

            // Run Jest tests
            await this.runJestTests();

            // Run Playwright tests
            await this.runPlaywrightTests();

            // Generate report
            const report = await this.generateReport();
            
            // Print summary
            const success = this.printSummary(report);
            
            // Exit with appropriate code
            process.exit(success ? 0 : 1);

        } catch (error) {
            console.error('\n🚨 Test runner failed:', error.message);
            process.exit(1);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const runner = new CodeFlowTestRunner();
    runner.run();
}

module.exports = CodeFlowTestRunner;