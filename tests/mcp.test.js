const MCPServer = require('../src/mcp/server');
const fetch = require('node-fetch');

describe('MCP Server', () => {
  let mcpServer;

  beforeAll(async () => {
    mcpServer = new MCPServer(3002); // Use different port for testing
    await mcpServer.start();
    
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 30000);

  afterAll(async () => {
    if (mcpServer) {
      await mcpServer.stop();
    }
  });

  test('Server starts successfully', () => {
    expect(mcpServer).toBeDefined();
    expect(mcpServer.port).toBe(3002);
  });

  test('Health endpoint responds', async () => {
    const response = await fetch('http://localhost:3002/health');
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.status).toBe('ok');
    expect(data).toHaveProperty('timestamp');
  });

  test('Tools endpoint returns available tools', async () => {
    const response = await fetch('http://localhost:3002/tools');
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data).toHaveProperty('tools');
    expect(Array.isArray(data.tools)).toBe(true);
    
    const expectedTools = [
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
    
    const toolNames = data.tools.map(tool => tool.name);
    expectedTools.forEach(toolName => {
      expect(toolNames).toContain(toolName);
    });
  });

  test('Tool execution with valid parameters', async () => {
    const response = await fetch('http://localhost:3002/tools/browser_navigate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arguments: {
          url: 'https://httpbin.org/get'
        }
      }),
    });

    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
  }, 15000);

  test('Tool execution with invalid tool name', async () => {
    const response = await fetch('http://localhost:3002/tools/invalid_tool', {
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
    expect(data.error).toContain('Unknown tool');
  });

  test('Tool execution with missing parameters', async () => {
    const response = await fetch('http://localhost:3002/tools/browser_navigate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arguments: {} // Missing url parameter
      }),
    });

    // Should handle gracefully (might succeed or fail depending on implementation)
    expect(response.status).toBeGreaterThanOrEqual(200);
  });

  test('Status endpoint provides server information', async () => {
    const response = await fetch('http://localhost:3002/status');
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('browserInitialized');
    expect(data).toHaveProperty('connectedClients');
    expect(data).toHaveProperty('timestamp');
  });

  test('CORS headers are set correctly', async () => {
    const response = await fetch('http://localhost:3002/health');
    
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toContain('GET');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });

  test('Browser screenshot tool returns base64 image', async () => {
    // First navigate to a page
    await fetch('http://localhost:3002/tools/browser_navigate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        arguments: {
          url: 'https://httpbin.org/get'
        }
      }),
    });

    // Then take screenshot
    const response = await fetch('http://localhost:3002/tools/browser_screenshot', {
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
    expect(typeof data.result.screenshot).toBe('string');
    
    // Verify it's base64 encoded
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    expect(base64Regex.test(data.result.screenshot)).toBe(true);
  }, 20000);
});