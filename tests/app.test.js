const { spawn } = require('child_process');
const fetch = require('node-fetch');
const WebSocket = require('ws');

describe('CodeFlow Application', () => {
  let electronProcess;
  let mcpServerReady = false;

  beforeAll(async () => {
    // Start the Electron application
    electronProcess = spawn('npm', ['start'], {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    // Wait for MCP server to be ready
    await new Promise((resolve) => {
      const checkServer = async () => {
        try {
          const response = await fetch('http://localhost:3001/health');
          if (response.ok) {
            mcpServerReady = true;
            resolve();
          } else {
            setTimeout(checkServer, 1000);
          }
        } catch (error) {
          setTimeout(checkServer, 1000);
        }
      };
      checkServer();
    });
  }, 30000);

  afterAll(() => {
    if (electronProcess) {
      electronProcess.kill();
    }
  });

  test('MCP server health check', async () => {
    expect(mcpServerReady).toBe(true);
    
    const response = await fetch('http://localhost:3001/health');
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.status).toBe('ok');
    expect(data).toHaveProperty('timestamp');
  });

  test('MCP server tools endpoint', async () => {
    const response = await fetch('http://localhost:3001/tools');
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data).toHaveProperty('tools');
    expect(Array.isArray(data.tools)).toBe(true);
    expect(data.tools.length).toBeGreaterThan(0);
    
    // Check for expected tools
    const toolNames = data.tools.map(tool => tool.name);
    expect(toolNames).toContain('browser_navigate');
    expect(toolNames).toContain('browser_click');
    expect(toolNames).toContain('browser_screenshot');
  });

  test('Browser navigation tool', async () => {
    const response = await fetch('http://localhost:3001/tools/browser_navigate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arguments: {
          url: 'https://example.com'
        }
      }),
    });

    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
  }, 10000);

  test('Browser screenshot tool', async () => {
    // First navigate to a page
    await fetch('http://localhost:3001/tools/browser_navigate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arguments: {
          url: 'https://example.com'
        }
      }),
    });

    // Take screenshot
    const response = await fetch('http://localhost:3001/tools/browser_screenshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arguments: {}
      }),
    });

    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.result).toHaveProperty('screenshot');
  }, 15000);

  test('Browser content summary tool', async () => {
    // Navigate to a page first
    await fetch('http://localhost:3001/tools/browser_navigate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arguments: {
          url: 'https://example.com'
        }
      }),
    });

    // Get content summary
    const response = await fetch('http://localhost:3001/tools/browser_get_content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arguments: {
          summary: true
        }
      }),
    });

    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.result).toHaveProperty('summary');
    expect(data.result.summary).toHaveProperty('title');
    expect(data.result.summary).toHaveProperty('url');
    expect(data.result.summary).toHaveProperty('headings');
  }, 10000);

  test('WebSocket connection', (done) => {
    const ws = new WebSocket('ws://localhost:3001');
    
    ws.on('open', () => {
      expect(true).toBe(true);
      ws.close();
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.type === 'connected') {
        expect(message).toHaveProperty('clientId');
        expect(message).toHaveProperty('message');
        done();
      }
    });
    
    ws.on('error', (error) => {
      fail(`WebSocket error: ${error.message}`);
    });
  }, 5000);

  test('Invalid tool call handling', async () => {
    const response = await fetch('http://localhost:3001/tools/invalid_tool', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arguments: {}
      }),
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data).toHaveProperty('error');
  });

  test('MCP status endpoint', async () => {
    const response = await fetch('http://localhost:3001/status');
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.status).toBe('ready');
    expect(data).toHaveProperty('browserInitialized');
    expect(data).toHaveProperty('connectedClients');
    expect(data).toHaveProperty('timestamp');
  });
});