const BrowserManager = require('../src/main/browser');

describe('Browser Manager', () => {
  let browserManager;

  beforeAll(async () => {
    browserManager = new BrowserManager();
    await browserManager.initialize();
  }, 30000);

  afterAll(async () => {
    if (browserManager) {
      await browserManager.cleanup();
    }
  });

  test('Browser initialization', () => {
    expect(browserManager.isInitialized).toBe(true);
    expect(browserManager.browser).toBeDefined();
    expect(browserManager.page).toBeDefined();
  });

  test('Navigation functionality', async () => {
    const mockEvent = { sender: { send: jest.fn() } };
    
    // Mock IPC handler call
    const handler = browserManager.setupIPC.__handlers?.['browser-navigate'];
    if (handler) {
      const result = await handler(mockEvent, 'https://example.com');
      expect(result.success).toBe(true);
      expect(result.url).toBe('https://example.com');
    }
  }, 15000);

  test('Content retrieval with summary', async () => {
    // Navigate first
    if (browserManager.page) {
      await browserManager.page.goto('https://example.com', { waitUntil: 'networkidle0' });
      
      // Get content summary
      const mockEvent = { sender: { send: jest.fn() } };
      const handler = browserManager.setupIPC.__handlers?.['browser-get-content'];
      
      if (handler) {
        const result = await handler(mockEvent, { summary: true });
        expect(result.success).toBe(true);
        expect(result.summary).toHaveProperty('title');
        expect(result.summary).toHaveProperty('url');
        expect(result.summary).toHaveProperty('headings');
        expect(result.summary).toHaveProperty('forms');
        expect(result.summary).toHaveProperty('links');
      }
    }
  }, 15000);

  test('Screenshot functionality', async () => {
    if (browserManager.page) {
      await browserManager.page.goto('https://example.com', { waitUntil: 'networkidle0' });
      
      const mockEvent = { sender: { send: jest.fn() } };
      const handler = browserManager.setupIPC.__handlers?.['browser-screenshot'];
      
      if (handler) {
        const result = await handler(mockEvent, { fullPage: true });
        expect(result.success).toBe(true);
        expect(result.screenshot).toBeDefined();
        expect(typeof result.screenshot).toBe('string');
      }
    }
  }, 15000);

  test('Script execution', async () => {
    if (browserManager.page) {
      await browserManager.page.goto('https://example.com', { waitUntil: 'networkidle0' });
      
      const mockEvent = { sender: { send: jest.fn() } };
      const handler = browserManager.setupIPC.__handlers?.['browser-execute-script'];
      
      if (handler) {
        const result = await handler(mockEvent, 'document.title');
        expect(result.success).toBe(true);
        expect(result.result).toBeDefined();
      }
    }
  }, 15000);

  test('DOM information retrieval', async () => {
    if (browserManager.page) {
      await browserManager.page.goto('https://example.com', { waitUntil: 'networkidle0' });
      
      const mockEvent = { sender: { send: jest.fn() } };
      const handler = browserManager.setupIPC.__handlers?.['browser-get-dom'];
      
      if (handler) {
        const result = await handler(mockEvent, 'html');
        expect(result.success).toBe(true);
        expect(result.dom).toHaveProperty('tagName');
        expect(result.dom).toHaveProperty('innerHTML');
        expect(result.dom).toHaveProperty('attributes');
      }
    }
  }, 15000);

  test('Error handling for invalid selectors', async () => {
    if (browserManager.page) {
      await browserManager.page.goto('https://example.com', { waitUntil: 'networkidle0' });
      
      const mockEvent = { sender: { send: jest.fn() } };
      const handler = browserManager.setupIPC.__handlers?.['browser-click'];
      
      if (handler) {
        const result = await handler(mockEvent, '#nonexistent-element');
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    }
  }, 10000);
});