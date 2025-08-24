class CodeFlowApp {
    constructor() {
        this.terminal = null;
        this.fitAddon = null;
        this.currentTab = 'preview';
        this.isResizing = false;
        
        this.init();
    }

    async init() {
        await this.initializeApp();
        this.setupEventListeners();
        this.setupTerminal();
        this.setupResizer();
        this.setupTabs();
        this.loadAppInfo();
    }

    async initializeApp() {
        console.log('Initializing CodeFlow...');
    }

    setupEventListeners() {
        // Menu event listeners
        window.electronAPI.onMenuAction((event, data) => {
            switch (event.type) {
                case 'menu-toggle-terminal':
                    this.togglePanel('left');
                    break;
                case 'menu-toggle-browser':
                    this.togglePanel('right');
                    break;
                case 'menu-about':
                    this.showAbout();
                    break;
            }
        });

        // Header button listeners
        document.getElementById('toggle-terminal').addEventListener('click', () => {
            this.togglePanel('left');
        });

        document.getElementById('toggle-browser').addEventListener('click', () => {
            this.togglePanel('right');
        });

        // Terminal controls
        document.getElementById('new-terminal').addEventListener('click', () => {
            this.createNewTerminal();
        });

        document.getElementById('clear-terminal').addEventListener('click', () => {
            this.clearTerminal();
        });

        // Browser controls
        document.getElementById('navigate-btn').addEventListener('click', () => {
            this.navigateToUrl();
        });

        document.getElementById('url-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.navigateToUrl();
            }
        });

        document.getElementById('browser-refresh').addEventListener('click', () => {
            this.refreshBrowser();
        });

        document.getElementById('browser-screenshot').addEventListener('click', () => {
            this.takeScreenshot();
        });

        document.getElementById('clear-console').addEventListener('click', () => {
            this.clearConsole();
        });

        // Window resize
        window.addEventListener('resize', () => {
            if (this.fitAddon) {
                this.fitAddon.fit();
            }
        });
    }

    setupTerminal() {
        this.terminal = new Terminal({
            fontFamily: '"Cascadia Code", "Fira Code", "Monaco", "Menlo", monospace',
            fontSize: 14,
            theme: {
                background: '#000000',
                foreground: '#e5e5e5',
                cursor: '#10b981',
                selection: '#2563eb50',
                black: '#1f2937',
                red: '#ef4444',
                green: '#10b981',
                yellow: '#f59e0b',
                blue: '#3b82f6',
                magenta: '#8b5cf6',
                cyan: '#06b6d4',
                white: '#e5e5e5',
                brightBlack: '#374151',
                brightRed: '#f87171',
                brightGreen: '#34d399',
                brightYellow: '#fbbf24',
                brightBlue: '#60a5fa',
                brightMagenta: '#a78bfa',
                brightCyan: '#22d3ee',
                brightWhite: '#f9fafb'
            },
            cursorBlink: true,
            allowTransparency: true
        });

        this.fitAddon = new FitAddon.FitAddon();
        this.terminal.loadAddon(this.fitAddon);

        const terminalElement = document.getElementById('terminal');
        this.terminal.open(terminalElement);
        this.fitAddon.fit();

        // Welcome message
        this.terminal.writeln('\\x1b[1;32m╭─────────────────────────────────────╮\\x1b[0m');
        this.terminal.writeln('\\x1b[1;32m│           Welcome to CodeFlow      │\\x1b[0m');
        this.terminal.writeln('\\x1b[1;32m╰─────────────────────────────────────╯\\x1b[0m');
        this.terminal.writeln('');
        this.terminal.writeln('\\x1b[1;36mTo get started with Claude Code:\\x1b[0m');
        this.terminal.writeln('\\x1b[33m• Run: \\x1b[1mclaude\\x1b[0m\\x1b[33m to start Claude Code\\x1b[0m');
        this.terminal.writeln('\\x1b[33m• The browser panel can be controlled by Claude\\x1b[0m');
        this.terminal.writeln('\\x1b[33m• Use Ctrl+` to toggle terminal visibility\\x1b[0m');
        this.terminal.writeln('');
        this.terminal.write('\\x1b[1;32m$ \\x1b[0m');

        // Simulate terminal input/output for demo
        this.terminal.onData((data) => {
            if (data === '\\r') {
                this.terminal.write('\\r\\n\\x1b[1;32m$ \\x1b[0m');
            } else if (data === '\\u007F') { // Backspace
                this.terminal.write('\\b \\b');
            } else {
                this.terminal.write(data);
            }
        });
    }

    setupResizer() {
        const resizer = document.getElementById('resize-handle');
        const leftPanel = document.getElementById('left-panel');
        const rightPanel = document.getElementById('right-panel');

        resizer.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.addEventListener('mousemove', this.handleResize.bind(this));
            document.addEventListener('mouseup', this.stopResize.bind(this));
        });
    }

    handleResize(e) {
        if (!this.isResizing) return;

        const container = document.querySelector('.split-container');
        const containerRect = container.getBoundingClientRect();
        const leftPanel = document.getElementById('left-panel');
        const rightPanel = document.getElementById('right-panel');

        const percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        const clampedPercentage = Math.min(Math.max(percentage, 20), 80);

        leftPanel.style.width = `${clampedPercentage}%`;
        rightPanel.style.width = `${100 - clampedPercentage}%`;

        if (this.fitAddon) {
            setTimeout(() => this.fitAddon.fit(), 10);
        }
    }

    stopResize() {
        this.isResizing = false;
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', this.handleResize.bind(this));
        document.removeEventListener('mouseup', this.stopResize.bind(this));
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                
                tabs.forEach(t => t.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(`${tabId}-tab`).classList.add('active');

                this.currentTab = tabId;
            });
        });
    }

    async loadAppInfo() {
        try {
            const version = await window.electronAPI.getAppVersion();
            document.getElementById('app-version').textContent = `v${version}`;
        } catch (error) {
            console.error('Failed to load app info:', error);
        }
    }

    togglePanel(panel) {
        const element = document.getElementById(`${panel}-panel`);
        if (element.style.display === 'none') {
            element.style.display = 'flex';
        } else {
            element.style.display = 'none';
        }
    }

    createNewTerminal() {
        // Clear and reset terminal
        this.terminal.clear();
        this.terminal.write('\\x1b[1;32m$ \\x1b[0m');
        this.updateTerminalStatus('New terminal session');
    }

    clearTerminal() {
        this.terminal.clear();
        this.terminal.write('\\x1b[1;32m$ \\x1b[0m');
        this.updateTerminalStatus('Terminal cleared');
    }

    updateTerminalStatus(message) {
        const statusElement = document.getElementById('terminal-status');
        statusElement.textContent = message;
        setTimeout(() => {
            statusElement.textContent = 'Ready';
        }, 2000);
    }

    navigateToUrl() {
        const urlInput = document.getElementById('url-input');
        let url = urlInput.value.trim();
        
        if (!url) return;

        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            if (url.includes('localhost') || url.includes('127.0.0.1') || url.match(/^\\d+\\.\\d+\\.\\d+\\.\\d+/)) {
                url = `http://${url}`;
            } else {
                url = `https://${url}`;
            }
        }

        this.updateBrowserStatus(`Navigating to ${url}...`);
        this.updateCurrentUrl(url);

        // Simulate browser navigation
        const browserFrame = document.getElementById('browser-frame');
        browserFrame.innerHTML = `
            <iframe 
                src="${url}" 
                style="width: 100%; height: 100%; border: none;"
                onload="app.onBrowserLoad('${url}')"
                onerror="app.onBrowserError('${url}')">
            </iframe>
        `;
    }

    onBrowserLoad(url) {
        this.updateBrowserStatus('Page loaded');
        this.updateCurrentUrl(url);
        this.addConsoleEntry('info', `Page loaded: ${url}`);
    }

    onBrowserError(url) {
        this.updateBrowserStatus('Failed to load page');
        this.addConsoleEntry('error', `Failed to load: ${url}`);
    }

    refreshBrowser() {
        const url = document.getElementById('url-input').value;
        if (url) {
            this.navigateToUrl();
        }
    }

    async takeScreenshot() {
        this.updateBrowserStatus('Taking screenshot...');
        
        // Simulate screenshot functionality
        setTimeout(() => {
            this.updateBrowserStatus('Screenshot saved');
            this.addConsoleEntry('info', 'Screenshot captured and saved');
        }, 1000);
    }

    updateBrowserStatus(message) {
        const statusElement = document.getElementById('browser-status');
        statusElement.textContent = message;
        setTimeout(() => {
            statusElement.textContent = 'Ready';
        }, 3000);
    }

    updateCurrentUrl(url) {
        document.getElementById('current-url').textContent = url;
        document.getElementById('url-input').value = url;
    }

    addConsoleEntry(type, message) {
        const consoleOutput = document.getElementById('console-output');
        const entry = document.createElement('div');
        entry.className = `console-entry console-${type}`;
        entry.innerHTML = `
            <span class="console-timestamp">[${new Date().toLocaleTimeString()}]</span>
            <span class="console-message">${message}</span>
        `;
        consoleOutput.appendChild(entry);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    clearConsole() {
        document.getElementById('console-output').innerHTML = '';
        this.addConsoleEntry('info', 'Console cleared');
    }

    showAbout() {
        this.addConsoleEntry('info', 'CodeFlow v1.0.0 - Local development environment with Claude Code integration');
    }
}

// Initialize the application
const app = new CodeFlowApp();

// Global error handling
window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
    if (app) {
        app.addConsoleEntry('error', `Application error: ${e.message}`);
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    if (app) {
        app.addConsoleEntry('error', `Promise rejection: ${e.reason}`);
    }
});