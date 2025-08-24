// tests/playwright/ui.spec.js
import { test, expect } from '@playwright/test';

test.describe('CodeFlow UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ide');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('should have proper page title and meta', async ({ page }) => {
    await expect(page).toHaveTitle('CodeFlow IDE - Local Development Environment');
  });

  test('should load all required CSS and JS resources', async ({ page }) => {
    // Check if main CSS is loaded
    const styleSheets = await page.evaluate(() => 
      Array.from(document.styleSheets).map(sheet => sheet.href).filter(Boolean)
    );
    
    expect(styleSheets.some(href => href.includes('styles.css'))).toBeTruthy();
    expect(styleSheets.some(href => href.includes('xterm.css'))).toBeTruthy();
    expect(styleSheets.some(href => href.includes('font-awesome'))).toBeTruthy();

    // Check if main JS is loaded
    const scripts = await page.evaluate(() =>
      Array.from(document.scripts).map(script => script.src).filter(Boolean)
    );
    
    expect(scripts.some(src => src.includes('app.js'))).toBeTruthy();
    expect(scripts.some(src => src.includes('xterm.js'))).toBeTruthy();
  });

  test('should show logo and branding', async ({ page }) => {
    await expect(page.locator('.logo')).toBeVisible();
    await expect(page.locator('.logo span')).toHaveText('CodeFlow IDE');
    await expect(page.locator('.logo i')).toHaveClass(/fa-code-branch/);
  });

  test('should have functional header buttons', async ({ page }) => {
    // Check all header buttons are present
    await expect(page.locator('#toggle-layout')).toBeVisible();
    await expect(page.locator('#clear-terminal')).toBeVisible();
    await expect(page.locator('#settings-btn')).toBeVisible();
    
    // Test clear terminal button
    await page.click('#clear-terminal');
    // Should not throw error
  });

  test('should show terminal as full width', async ({ page }) => {
    // Check that left panel takes full width
    const leftPanel = page.locator('.left-panel');
    const rightPanel = page.locator('.right-panel');
    
    await expect(leftPanel).toBeVisible();
    await expect(rightPanel).toBeHidden();
    
    // Check terminal container takes full width
    const terminalContainer = page.locator('.terminal-container');
    const containerWidth = await terminalContainer.evaluate(el => el.offsetWidth);
    const viewportWidth = page.viewportSize()?.width || 1280;
    
    // Terminal should be close to full viewport width (accounting for padding/margins)
    expect(containerWidth).toBeGreaterThan(viewportWidth * 0.9);
  });

  test('should display connection status indicators', async ({ page }) => {
    // Check connection status elements exist
    await expect(page.locator('.connection-status')).toBeVisible();
    await expect(page.locator('#connection-indicator')).toBeVisible();
    await expect(page.locator('#connection-text')).toBeVisible();
    
    // Check status updates to connected
    await page.waitForTimeout(3000);
    const connectionText = await page.locator('#connection-text').textContent();
    expect(connectionText).toBe('Connected to MCP Server');
  });

  test('should handle window resize gracefully', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
      { width: 800, height: 600 },
      { width: 1024, height: 768 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      
      // Check UI elements remain visible and functional
      await expect(page.locator('.header-bar')).toBeVisible();
      await expect(page.locator('.left-panel')).toBeVisible();
      await expect(page.locator('#terminal')).toBeVisible();
      
      // Check terminal container adapts to new size
      const terminalWidth = await page.locator('.terminal-container').evaluate(el => el.offsetWidth);
      expect(terminalWidth).toBeGreaterThan(viewport.width * 0.8);
    }
  });

  test('should have accessible terminal interface', async ({ page }) => {
    const terminal = page.locator('#terminal');
    
    // Check terminal is focusable
    await terminal.click();
    const isFocused = await terminal.evaluate(el => document.activeElement === el || el.contains(document.activeElement));
    expect(isFocused).toBeTruthy();
    
    // Check terminal can receive keyboard input
    await page.keyboard.type('test');
    // Should not throw error
  });

  test('should show activity log panel', async ({ page }) => {
    // Check if activity panel elements exist
    await expect(page.locator('#activity-log')).toBeVisible();
    
    // Should show some activity after initialization
    await page.waitForTimeout(3000);
    const activityEntries = page.locator('.activity-entry');
    expect(await activityEntries.count()).toBeGreaterThan(0);
  });

  test('should handle theme and colors correctly', async ({ page }) => {
    // Check CSS variables are applied
    const rootStyles = await page.evaluate(() => {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      return {
        primaryBg: styles.getPropertyValue('--primary-bg'),
        secondaryBg: styles.getPropertyValue('--secondary-bg'),
        textPrimary: styles.getPropertyValue('--text-primary')
      };
    });
    
    expect(rootStyles.primaryBg.trim()).toBeTruthy();
    expect(rootStyles.secondaryBg.trim()).toBeTruthy();
    expect(rootStyles.textPrimary.trim()).toBeTruthy();
  });

  test('should show proper loading states', async ({ page }) => {
    // Reload page to test loading states
    await page.reload();
    
    // Initially should show "Connecting..."
    await expect(page.locator('#connection-text')).toHaveText('Connecting...');
    
    // Should update to "Connected" after connection
    await page.waitForFunction(
      () => document.querySelector('#connection-text')?.textContent === 'Connected to MCP Server',
      { timeout: 10000 }
    );
  });
});