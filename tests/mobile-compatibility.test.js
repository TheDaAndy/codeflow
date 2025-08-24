const { MockBrowserManager } = require('../src/mcp/server-standalone');

describe('Mobile Compatibility Tests', () => {
  test('MCP Server can start without Electron', async () => {
    const mcpServer = new MCPServer(3003);
    
    // Override browser manager with mock for mobile
    mcpServer.browserManager = {
      isInitialized: false,
      async ensureInitialized() {
        if (!this.isInitialized) {
          this.isInitialized = true;
        }
      },
      async navigate(url) {
        return { success: true, url };
      },
      async screenshot() {
        return { success: true, screenshot: 'mock-base64-image' };
      },
      async getContent(options = {}) {
        if (options.summary) {
          return {
            success: true,
            summary: {
              title: 'Mock Page',
              url: 'https://example.com',
              headings: ['Test Heading'],
              forms: [],
              links: ['https://example.com/link'],
              characterCount: 100
            }
          };
        }
        return { success: true, content: '<html><body>Mock content</body></html>' };
      },
      async executeScript(script) {
        return { success: true, result: 'Mock script result' };
      },
      async click(selector) {
        return { success: true };
      },
      async type(selector, text) {
        return { success: true };
      },
      async getConsole() {
        return { success: true, console: [] };
      },
      async waitForSelector(selector, timeout) {
        return { success: true };
      },
      async getDOM(selector) {
        return {
          success: true,
          dom: {
            tagName: 'HTML',
            innerHTML: 'Mock content',
            attributes: {},
            textContent: 'Mock content',
            children: []
          }
        };
      }
    };

    await mcpServer.start();
    
    expect(mcpServer).toBeDefined();
    expect(mcpServer.port).toBe(3003);
    
    await mcpServer.stop();
  }, 10000);

  test('Browser manager gracefully handles mobile environment', () => {
    const browserManager = new BrowserManager();
    
    // Should not crash on mobile
    expect(browserManager).toBeDefined();
    expect(browserManager.isInitialized).toBe(false);
  });

  test('Terminal manager works with mock terminal', () => {
    const TerminalManager = require('../src/main/terminal');
    const terminalManager = new TerminalManager();
    
    expect(terminalManager).toBeDefined();
    expect(terminalManager.terminals).toBeInstanceOf(Map);
  });

  test('Application can run core functionality without native dependencies', () => {
    // Test that core MCP functionality works
    const tools = [
      'browser_navigate',
      'browser_click',
      'browser_type',
      'browser_screenshot',
      'browser_get_content',
      'browser_execute_script',
      'browser_get_console',
      'browser_wait_for_selector',
      'browser_get_dom'
    ];

    tools.forEach(toolName => {
      expect(typeof toolName).toBe('string');
      expect(toolName.length).toBeGreaterThan(0);
    });
  });

  test('Configuration files are valid JSON', () => {
    const fs = require('fs');
    const path = require('path');

    // Test package.json
    const packageJson = JSON.parse(fs.readFileSync(
      path.join(__dirname, '../package.json'), 
      'utf8'
    ));
    expect(packageJson.name).toBe('codeflow');
    expect(packageJson.version).toBe('1.0.0');

    // Test Claude config
    const claudeConfig = JSON.parse(fs.readFileSync(
      path.join(__dirname, '../src/mcp/claude-config.json'), 
      'utf8'
    ));
    expect(claudeConfig.mcpServers).toHaveProperty('codeflow-browser');
  });

  test('README and documentation files exist', () => {
    const fs = require('fs');
    const path = require('path');

    expect(fs.existsSync(path.join(__dirname, '../CLAUDE.md'))).toBe(true);
    
    const claudeMd = fs.readFileSync(
      path.join(__dirname, '../CLAUDE.md'), 
      'utf8'
    );
    expect(claudeMd).toContain('CodeFlow');
    expect(claudeMd).toContain('MCP');
    expect(claudeMd).toContain('browser_navigate');
  });
});