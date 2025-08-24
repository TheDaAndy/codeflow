const fs = require('fs');
const path = require('path');

describe('CodeFlow Basic Tests', () => {
  test('Project structure exists', () => {
    const projectRoot = path.join(__dirname, '..');
    
    expect(fs.existsSync(path.join(projectRoot, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'src/mcp'))).toBe(true);
  });

  test('Package.json is valid', () => {
    const packageJson = require('../package.json');
    
    expect(packageJson.name).toBe('codeflow');
    expect(packageJson.version).toBe('1.0.0');
    expect(packageJson.scripts).toHaveProperty('start');
    expect(packageJson.scripts).toHaveProperty('test');
  });

  test('Claude configuration exists', () => {
    const claudeConfigPath = path.join(__dirname, '../src/mcp/claude-config.json');
    expect(fs.existsSync(claudeConfigPath)).toBe(true);
    
    const claudeConfig = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'));
    expect(claudeConfig.mcpServers).toHaveProperty('codeflow-browser');
  });

  test('Mock MCP server functionality', async () => {
    const MockMCPServer = require('../src/mcp/mock-server');
    const server = new MockMCPServer(3004);
    
    await server.start();
    
    // Simple check that server started
    expect(server.port).toBe(3004);
    
    await server.stop();
  });

  test('Express dependencies are available', () => {
    expect(() => require('express')).not.toThrow();
    expect(() => require('ws')).not.toThrow();
    expect(() => require('uuid')).not.toThrow();
  });

  test('Server standalone script exists and is executable', () => {
    const serverPath = path.join(__dirname, '../src/mcp/server-standalone.js');
    expect(fs.existsSync(serverPath)).toBe(true);
    
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    expect(serverContent).toContain('MockBrowserManager');
    expect(serverContent).toContain('startServer');
  });

  test('Documentation contains required information', () => {
    const claudeMd = fs.readFileSync(path.join(__dirname, '../CLAUDE.md'), 'utf8');
    
    expect(claudeMd).toContain('CodeFlow');
    expect(claudeMd).toContain('MCP');
    expect(claudeMd).toContain('browser_navigate');
    expect(claudeMd).toContain('browser_screenshot');
    expect(claudeMd).toContain('Context Optimization');
    expect(claudeMd).toContain('subagents');
  });

  test('Icon assets exist', () => {
    const iconPath = path.join(__dirname, '../assets/icons/icon.svg');
    expect(fs.existsSync(iconPath)).toBe(true);
    
    const iconContent = fs.readFileSync(iconPath, 'utf8');
    expect(iconContent).toContain('<svg');
    expect(iconContent).toContain('CodeFlow');
  });
});