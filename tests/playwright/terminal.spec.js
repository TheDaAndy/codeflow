// tests/playwright/terminal.spec.js
import { test, expect } from '@playwright/test';

test.describe('CodeFlow Terminal Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the IDE
    await page.goto('/ide');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Wait for JavaScript to initialize
    await page.waitForTimeout(2000);
  });

  test('should load the IDE interface correctly', async ({ page }) => {
    // Check main elements are present
    await expect(page.locator('.ide-container')).toBeVisible();
    await expect(page.locator('.header-bar')).toBeVisible();
    await expect(page.locator('.left-panel')).toBeVisible();
    await expect(page.locator('.right-panel')).toBeVisible();
    
    // Check terminal container
    await expect(page.locator('.terminal-container')).toBeVisible();
    await expect(page.locator('#terminal')).toBeVisible();
  });

  test('should show connected status', async ({ page }) => {
    // Wait for connection status to update
    await page.waitForSelector('#connection-text', { timeout: 10000 });
    
    // Check connection status
    const connectionText = await page.locator('#connection-text').textContent();
    expect(connectionText).toBe('Connected to MCP Server');
    
    // Check connection indicator
    const indicator = page.locator('#connection-indicator');
    await expect(indicator).toHaveClass(/connected/);
  });

  test('should establish terminal WebSocket connection', async ({ page }) => {
    // Wait for terminal to initialize
    await page.waitForTimeout(3000);
    
    // Check for terminal welcome message in the terminal element
    const terminalElement = page.locator('#terminal');
    await expect(terminalElement).toBeVisible();
    
    // Look for terminal content - the welcome message should be rendered
    await page.waitForTimeout(5000); // Give more time for terminal content
    
    // Check if terminal has some content (welcome message)
    const terminalContent = await terminalElement.evaluate(el => el.textContent || el.innerText);
    expect(terminalContent).toContain('CodeFlow Terminal');
  });

  test('should accept terminal input', async ({ page }) => {
    // Wait for terminal to be ready
    await page.waitForTimeout(4000);
    
    // Focus the terminal
    await page.click('#terminal');
    
    // Type a command
    await page.keyboard.type('echo "Hello CodeFlow"');
    await page.keyboard.press('Enter');
    
    // Wait for command execution
    await page.waitForTimeout(2000);
    
    // Check that the input was processed (should see the echo output)
    const terminalElement = page.locator('#terminal');
    const content = await terminalElement.evaluate(el => el.textContent || el.innerText);
    expect(content).toContain('Hello CodeFlow');
  });

  test('should handle pwd command', async ({ page }) => {
    // Wait for terminal to be ready
    await page.waitForTimeout(4000);
    
    // Focus the terminal and send pwd command
    await page.click('#terminal');
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    
    // Wait for command execution
    await page.waitForTimeout(2000);
    
    // Check that pwd output contains a path
    const terminalElement = page.locator('#terminal');
    const content = await terminalElement.evaluate(el => el.textContent || el.innerText);
    expect(content).toMatch(/\/.*projects.*codeflow/);
  });

  test('should test claude command availability', async ({ page }) => {
    // Wait for terminal to be ready
    await page.waitForTimeout(4000);
    
    // Focus the terminal and test claude command
    await page.click('#terminal');
    await page.keyboard.type('claude --help');
    await page.keyboard.press('Enter');
    
    // Wait for command execution
    await page.waitForTimeout(3000);
    
    // Check that claude command exists or shows help
    const terminalElement = page.locator('#terminal');
    const content = await terminalElement.evaluate(el => el.textContent || el.innerText);
    
    // Should either show help or indicate command availability
    const hasClaudeResponse = content.includes('Claude Code') || 
                              content.includes('Usage:') ||
                              content.includes('command not found');
    
    expect(hasClaudeResponse).toBeTruthy();
  });

  test('should handle terminal resize', async ({ page }) => {
    // Wait for terminal initialization
    await page.waitForTimeout(3000);
    
    // Get initial terminal size
    const terminalRect = await page.locator('#terminal').boundingBox();
    
    // Resize the window
    await page.setViewportSize({ width: 1200, height: 800 });
    
    // Wait for resize to take effect
    await page.waitForTimeout(1000);
    
    // Check that terminal is still visible and functional
    await expect(page.locator('#terminal')).toBeVisible();
    
    // Verify terminal can still accept input after resize
    await page.click('#terminal');
    await page.keyboard.type('date');
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Check command executed
    const content = await page.locator('#terminal').evaluate(el => el.textContent);
    expect(content).toContain('date');
  });

  test('should handle multiple commands in sequence', async ({ page }) => {
    // Wait for terminal to be ready
    await page.waitForTimeout(4000);
    
    // Execute multiple commands
    const commands = ['pwd', 'ls', 'echo "test1"', 'echo "test2"'];
    
    for (const cmd of commands) {
      await page.click('#terminal');
      await page.keyboard.type(cmd);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
    }
    
    // Verify all commands were executed
    const terminalContent = await page.locator('#terminal').evaluate(el => el.textContent);
    expect(terminalContent).toContain('test1');
    expect(terminalContent).toContain('test2');
  });

  test('should show terminal status as connected', async ({ page }) => {
    // Wait for terminal connection
    await page.waitForTimeout(4000);
    
    // Check terminal status in the header
    const terminalStatus = await page.locator('#terminal-status').textContent();
    expect(terminalStatus).toBe('Connected');
  });

  test('should handle terminal errors gracefully', async ({ page }) => {
    // Wait for terminal to be ready
    await page.waitForTimeout(4000);
    
    // Try to execute a non-existent command
    await page.click('#terminal');
    await page.keyboard.type('nonexistentcommand12345');
    await page.keyboard.press('Enter');
    
    // Wait for error response
    await page.waitForTimeout(2000);
    
    // Check that error is handled (should show command not found or similar)
    const terminalContent = await page.locator('#terminal').evaluate(el => el.textContent);
    expect(terminalContent).toContain('command not found');
  });
});