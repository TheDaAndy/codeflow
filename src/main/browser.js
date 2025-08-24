const { ipcMain } = require('electron');
const puppeteer = require('puppeteer');
const path = require('path');

class BrowserManager {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
        this.setupIPC();
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            this.browser = await puppeteer.launch({
                headless: false,
                defaultViewport: null,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-features=VizDisplayCompositor',
                    '--remote-debugging-port=9222',
                    '--enable-logging',
                    '--v=1'
                ]
            });

            this.page = await this.browser.newPage();
            
            // Set up console monitoring
            this.page.on('console', (msg) => {
                this.handleConsoleMessage(msg);
            });

            // Set up error monitoring
            this.page.on('pageerror', (error) => {
                this.handlePageError(error);
            });

            // Set up network monitoring
            await this.page.setRequestInterception(true);
            this.page.on('request', (request) => {
                this.handleRequest(request);
                request.continue();
            });

            this.page.on('response', (response) => {
                this.handleResponse(response);
            });

            this.isInitialized = true;
            console.log('Browser manager initialized');
        } catch (error) {
            console.error('Failed to initialize browser:', error);
            throw error;
        }
    }

    setupIPC() {
        ipcMain.handle('browser-navigate', async (event, url) => {
            try {
                await this.ensureInitialized();
                await this.page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
                
                event.sender.send('browser-navigation', {
                    url,
                    title: await this.page.title(),
                    timestamp: Date.now()
                });
                
                return { success: true, url };
            } catch (error) {
                console.error('Navigation error:', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('browser-get-content', async (event, options = {}) => {
            try {
                await this.ensureInitialized();
                
                if (options.summary) {
                    // Return lightweight summary instead of full HTML
                    const summary = await this.page.evaluate(() => {
                        const title = document.title || 'Untitled';
                        const url = window.location.href;
                        const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim()).slice(0, 10);
                        const forms = Array.from(document.querySelectorAll('form')).map(form => ({
                            action: form.action,
                            method: form.method,
                            inputs: Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
                                type: input.type || input.tagName.toLowerCase(),
                                name: input.name,
                                placeholder: input.placeholder
                            }))
                        }));
                        const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.href).slice(0, 20);
                        
                        return {
                            title,
                            url,
                            headings,
                            forms,
                            links,
                            characterCount: document.body ? document.body.textContent.length : 0
                        };
                    });
                    
                    return { success: true, summary };
                } else {
                    const content = await this.page.content();
                    return { success: true, content };
                }
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('browser-screenshot', async (event, options = {}) => {
            try {
                await this.ensureInitialized();
                const screenshot = await this.page.screenshot({
                    fullPage: options.fullPage || true,
                    type: options.type || 'png',
                    quality: options.quality || 90
                });
                
                return { success: true, screenshot: screenshot.toString('base64') };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('browser-execute-script', async (event, script) => {
            try {
                await this.ensureInitialized();
                const result = await this.page.evaluate(script);
                return { success: true, result };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('browser-click', async (event, selector) => {
            try {
                await this.ensureInitialized();
                await this.page.waitForSelector(selector, { timeout: 5000 });
                await this.page.click(selector);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('browser-type', async (event, selector, text) => {
            try {
                await this.ensureInitialized();
                await this.page.waitForSelector(selector, { timeout: 5000 });
                await this.page.type(selector, text);
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('browser-get-console', async (event) => {
            return { success: true, console: this.consoleHistory };
        });

        ipcMain.handle('browser-wait-for-selector', async (event, selector, timeout = 5000) => {
            try {
                await this.ensureInitialized();
                await this.page.waitForSelector(selector, { timeout });
                return { success: true };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('browser-evaluate', async (event, func, ...args) => {
            try {
                await this.ensureInitialized();
                const result = await this.page.evaluate(func, ...args);
                return { success: true, result };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('browser-get-metrics', async (event) => {
            try {
                await this.ensureInitialized();
                const metrics = await this.page.metrics();
                return { success: true, metrics };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('browser-get-dom', async (event, selector = 'html') => {
            try {
                await this.ensureInitialized();
                const element = await this.page.$(selector);
                if (!element) {
                    return { success: false, error: 'Element not found' };
                }
                
                const domInfo = await this.page.evaluate((el) => {
                    return {
                        tagName: el.tagName,
                        innerHTML: el.innerHTML,
                        attributes: Array.from(el.attributes).reduce((attrs, attr) => {
                            attrs[attr.name] = attr.value;
                            return attrs;
                        }, {}),
                        textContent: el.textContent,
                        children: Array.from(el.children).map(child => ({
                            tagName: child.tagName,
                            className: child.className,
                            id: child.id
                        }))
                    };
                }, element);
                
                return { success: true, dom: domInfo };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
    }

    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    handleConsoleMessage(msg) {
        const consoleEntry = {
            type: msg.type(),
            text: msg.text(),
            location: msg.location(),
            timestamp: Date.now()
        };

        // Send to renderer
        if (this.mainWindow) {
            this.mainWindow.webContents.send('browser-console', consoleEntry);
        }
    }

    handlePageError(error) {
        const errorEntry = {
            type: 'pageerror',
            message: error.message,
            stack: error.stack,
            timestamp: Date.now()
        };

        if (this.mainWindow) {
            this.mainWindow.webContents.send('browser-console', errorEntry);
        }
    }

    handleRequest(request) {
        const requestInfo = {
            type: 'request',
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            timestamp: Date.now()
        };

        if (this.mainWindow) {
            this.mainWindow.webContents.send('browser-network', requestInfo);
        }
    }

    handleResponse(response) {
        const responseInfo = {
            type: 'response',
            url: response.url(),
            status: response.status(),
            headers: response.headers(),
            timestamp: Date.now()
        };

        if (this.mainWindow) {
            this.mainWindow.webContents.send('browser-network', responseInfo);
        }
    }

    setMainWindow(mainWindow) {
        this.mainWindow = mainWindow;
    }

    async cleanup() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            this.isInitialized = false;
        } catch (error) {
            console.error('Error cleaning up browser:', error);
        }
    }
}

module.exports = BrowserManager;