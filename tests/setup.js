// Global test setup
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error // Keep error for debugging
};

// Increase timeout for browser operations
jest.setTimeout(30000);

// Mock Electron APIs if needed
global.mockElectron = {
  app: {
    getVersion: () => '1.0.0',
    getAppPath: () => '/mock/path'
  }
};