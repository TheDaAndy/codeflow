class CodeFlowIDE {
    constructor() {
        this.mcpServerUrl = 'http://localhost:3001';
        this.websocket = null;
        this.terminal = null;
        this.fitAddon = null;
        this.currentUrl = 'about:blank';
        this.isConnected = false;
        this.isAIControlling = false;
        this.consoleEntries = [];
        this.networkRequests = [];
        this.activityLog = [];
        
        this.init();
    }

    async init() {
        this.loadSelectedProject();
        this.setupEventListeners();
        this.initializeTerminal();
        this.setupResizers();
        this.setupTabs();
        await this.connectToMCPServer();
        this.startHeartbeat();
        
        this.logActivity('system', 'CodeFlow IDE initialized');
    }

    loadSelectedProject() {
        try {
            const selectedProject = localStorage.getItem('selectedProject');
            if (selectedProject) {
                const project = JSON.parse(selectedProject);
                this.currentProject = project;
                
                // Update UI to show current project
                const projectDisplay = document.getElementById('project-name');
                if (projectDisplay) {
                    const projectName = project.path.split('/').pop();
                    projectDisplay.textContent = projectName;
                }
                
                this.logActivity('project', `Loaded project: ${project.path.split('/').pop()}`);
            }
        } catch (error) {
            console.error('Failed to load selected project:', error);
        }
    }

    setupEventListeners() {
        // Header controls
        document.getElementById('toggle-layout').addEventListener('click', () => this.toggleLayout());
        document.getElementById('clear-terminal').addEventListener('click', () => this.clearTerminal());
        document.getElementById('settings-btn').addEventListener('click', () => this.openSettings());

        // Terminal controls
        document.getElementById('new-terminal-session').addEventListener('click', () => this.newTerminalSession());

        // Browser controls
        document.getElementById('browser-back').addEventListener('click', () => this.browserBack());
        document.getElementById('browser-forward').addEventListener('click', () => this.browserForward());
        document.getElementById('browser-refresh').addEventListener('click', () => this.browserRefresh());
        document.getElementById('navigate-btn').addEventListener('click', () => this.navigateToUrl());
        document.getElementById('url-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.navigateToUrl();
        });
        document.getElementById('take-screenshot').addEventListener('click', () => this.takeScreenshot());
        document.getElementById('browser-devtools').addEventListener('click', () => this.toggleInspectMode());

        // Tab controls
        document.getElementById('clear-console').addEventListener('click', () => this.clearConsole());
        document.getElementById('clear-network').addEventListener('click', () => this.clearNetwork());
        document.getElementById('refresh-elements').addEventListener('click', () => this.refreshElements());

        // Activity log
        document.getElementById('toggle-activity').addEventListener('click', () => this.toggleActivityPanel());
        document.getElementById('clear-activity').addEventListener('click', () => this.clearActivity());

        // Settings modal
        document.querySelector('.modal-close').addEventListener('click', () => this.closeSettings());
        document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());
        document.getElementById('cancel-settings').addEventListener('click', () => this.closeSettings());

        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    initializeTerminal() {
        this.terminal = new Terminal({
            fontFamily: '"Cascadia Code", "Fira Code", "Monaco", "Menlo", monospace',
            fontSize: 14,
            theme: {
                background: '#0c0c0c',
                foreground: '#cccccc',
                cursor: '#007acc',
                selection: 'rgba(0, 122, 204, 0.3)',
                black: '#2d2d2d',
                red: '#f44336',
                green: '#4caf50',
                yellow: '#ff9800',
                blue: '#2196f3',
                magenta: '#9c27b0',
                cyan: '#00bcd4',
                white: '#cccccc',
                brightBlack: '#969696',
                brightRed: '#f87171',
                brightGreen: '#81c784',
                brightYellow: '#ffb74d',
                brightBlue: '#64b5f6',
                brightMagenta: '#ba68c8',
                brightCyan: '#4dd0e1',
                brightWhite: '#ffffff'
            },
            cursorBlink: true,
            allowTransparency: false,
            rows: 24,
            cols: 80
        });

        this.fitAddon = new FitAddon.FitAddon();
        this.terminal.loadAddon(this.fitAddon);

        const terminalElement = document.getElementById('terminal');
        this.terminal.open(terminalElement);
        this.fitAddon.fit();

        // Setup terminal WebSocket connection
        this.setupTerminalWebSocket();

        // Handle terminal input
        this.terminal.onData((data) => {
            if (this.terminalWs && this.terminalWs.readyState === WebSocket.OPEN) {
                this.terminalWs.send(JSON.stringify({
                    type: 'input',
                    terminalId: this.terminalId,
                    input: data
                }));
            }
        });
    }

    setupTerminalWebSocket() {
        const wsUrl = 'ws://localhost:3001/terminal';
        this.terminalWs = new WebSocket(wsUrl);

        this.terminalWs.onopen = () => {
            console.log('Terminal WebSocket connected');
            // Create a new terminal session with project directory
            const terminalOptions = {};
            if (this.currentProject) {
                terminalOptions.cwd = this.currentProject.path;
            }
            
            this.terminalWs.send(JSON.stringify({
                type: 'create',
                data: terminalOptions
            }));
        };

        this.terminalWs.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleTerminalMessage(message);
            } catch (error) {
                console.error('Terminal WebSocket message error:', error);
            }
        };

        this.terminalWs.onclose = () => {
            console.log('Terminal WebSocket disconnected');
            setTimeout(() => this.setupTerminalWebSocket(), 3000);
        };

        this.terminalWs.onerror = (error) => {
            console.error('Terminal WebSocket error:', error);
        };
    }

    handleTerminalMessage(message) {
        const { type, terminalId, data } = message;

        switch (type) {
            case 'connected':
                this.logActivity('terminal', 'Terminal server connected');
                break;
                
            case 'created':
                this.terminalId = terminalId;
                this.logActivity('terminal', `Terminal session created: ${terminalId}`);
                
                // Update status
                document.getElementById('terminal-status').textContent = 'Connected';
                
                // Send terminal resize
                this.resizeTerminal();
                break;
                
            case 'output':
                if (terminalId === this.terminalId) {
                    this.terminal.write(data);
                }
                break;
                
            case 'exit':
                if (terminalId === this.terminalId) {
                    this.terminal.write(`\\r\\n\\x1b[1;31mProcess exited with code: ${data.code}\\x1b[0m\\r\\n`);
                    this.logActivity('terminal', `Process exited: ${data.code}`);
                }
                break;
                
            case 'error':
                this.terminal.write(`\\r\\n\\x1b[1;31mError: ${data}\\x1b[0m\\r\\n`);
                this.logActivity('error', `Terminal error: ${data}`);
                break;
                
            default:
                console.log('Unknown terminal message:', message);
        }
    }

    resizeTerminal() {
        if (this.fitAddon) {
            this.fitAddon.fit();
        }
        
        if (this.terminalWs && this.terminalWs.readyState === WebSocket.OPEN && this.terminalId) {
            this.terminalWs.send(JSON.stringify({
                type: 'resize',
                data: {
                    terminalId: this.terminalId,
                    cols: this.terminal.cols,
                    rows: this.terminal.rows
                }
            }));
        }
    }

    setupResizers() {
        const resizer = document.getElementById('vertical-resizer');
        const leftPanel = document.querySelector('.left-panel');
        const rightPanel = document.querySelector('.right-panel');
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
        });

        const handleResize = (e) => {
            if (!isResizing) return;
            const container = document.querySelector('.main-content');
            const containerRect = container.getBoundingClientRect();
            const percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            const clampedPercentage = Math.min(Math.max(percentage, 25), 75);

            leftPanel.style.width = `${clampedPercentage}%`;
            rightPanel.style.width = `${100 - clampedPercentage}%`;

            setTimeout(() => this.resizeTerminal(), 10);
        };

        const stopResize = () => {
            isResizing = false;
            document.body.style.cursor = '';
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
        };
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
            });
        });
    }

    async connectToMCPServer() {
        try {
            // Test HTTP connection first
            const response = await fetch(`${this.mcpServerUrl}/health`);
            if (!response.ok) throw new Error('MCP Server not responding');

            this.isConnected = true;
            this.updateConnectionStatus('connected', 'Connected to MCP Server');

            // Setup WebSocket for real-time communication
            this.setupWebSocket();
            
            this.logActivity('connection', 'Connected to MCP Server');
        } catch (error) {
            this.isConnected = false;
            this.updateConnectionStatus('disconnected', 'MCP Server not available');
            this.logActivity('error', `Connection failed: ${error.message}`);
            
            // Retry connection in 5 seconds
            setTimeout(() => this.connectToMCPServer(), 5000);
        }
    }

    setupWebSocket() {
        const wsUrl = this.mcpServerUrl.replace('http', 'ws');
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
            this.logActivity('connection', 'WebSocket connected');
        };

        this.websocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };

        this.websocket.onclose = () => {
            this.logActivity('connection', 'WebSocket disconnected');
            // Attempt to reconnect
            setTimeout(() => this.setupWebSocket(), 3000);
        };

        this.websocket.onerror = (error) => {
            this.logActivity('error', 'WebSocket error');
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'browser_action':
                this.handleBrowserAction(data);
                break;
            case 'console_message':
                this.addConsoleEntry(data.level, data.message);
                break;
            case 'network_request':
                this.addNetworkRequest(data);
                break;
            default:
                console.log('Unknown WebSocket message:', data);
        }
    }

    handleBrowserAction(data) {
        this.showAIControl(data.action);
        this.logActivity('ai-action', `AI ${data.action}: ${data.details || ''}`);
        
        if (data.action === 'navigate') {
            this.updateCurrentUrl(data.url);
        }
    }

    updateConnectionStatus(status, text) {
        const indicator = document.getElementById('connection-indicator');
        const statusText = document.getElementById('connection-text');
        
        indicator.className = `fas fa-circle ${status}`;
        statusText.textContent = text;
    }

    newTerminalSession() {
        if (this.terminalWs && this.terminalWs.readyState === WebSocket.OPEN) {
            this.terminalWs.send(JSON.stringify({
                type: 'create',
                data: {}
            }));
        }
        this.logActivity('terminal', 'New terminal session requested');
    }

    showAIControl(action) {
        const overlay = document.getElementById('ai-control-overlay');
        const actionText = document.getElementById('ai-action-text');
        
        actionText.textContent = action;
        overlay.classList.add('visible');
        
        // Hide after 3 seconds
        setTimeout(() => {
            overlay.classList.remove('visible');
        }, 3000);
    }

    async navigateToUrl(url = null) {
        if (!url) {
            url = document.getElementById('url-input').value.trim();
        }
        
        if (!url) return;
        
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = url.startsWith('localhost') ? `http://${url}` : `https://${url}`;
        }
        
        try {
            this.showBrowserLoading(true);
            
            // Call MCP server to navigate
            const response = await fetch(`${this.mcpServerUrl}/tools/browser_navigate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ arguments: { url } })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.updateCurrentUrl(url);
                // In a real implementation, this would load the page in a controlled browser
                // For demo, we'll load it in the iframe
                document.getElementById('browser-frame').src = url;
                this.logActivity('navigation', `Navigated to ${url}`);
            } else {
                this.logActivity('error', `Navigation failed: ${result.error}`);
            }
            
        } catch (error) {
            this.logActivity('error', `Navigation error: ${error.message}`);
        } finally {
            this.showBrowserLoading(false);
        }
    }

    updateCurrentUrl(url) {
        this.currentUrl = url;
        document.getElementById('current-page-url').textContent = url;
        document.getElementById('url-input').value = url;
    }

    showBrowserLoading(show) {
        const overlay = document.getElementById('browser-overlay');
        if (show) {
            overlay.classList.add('visible');
        } else {
            overlay.classList.remove('visible');
        }
    }

    async takeScreenshot() {
        try {
            this.showAIControl('Taking screenshot...');
            
            const response = await fetch(`${this.mcpServerUrl}/tools/browser_screenshot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ arguments: {} })
            });
            
            const result = await response.json();
            
            if (result.success && result.result.screenshot) {
                // Display screenshot in terminal
                this.terminal.writeln('\\x1b[1;36m📸 Screenshot captured\\x1b[0m');
                this.logActivity('screenshot', 'Screenshot taken');
                
                // In a real implementation, you might want to display the screenshot
                // or save it somewhere accessible
            } else {
                this.logActivity('error', 'Screenshot failed');
            }
            
        } catch (error) {
            this.logActivity('error', `Screenshot error: ${error.message}`);
        }
    }

    browserBack() {
        const iframe = document.getElementById('browser-frame');
        try {
            iframe.contentWindow.history.back();
            this.logActivity('navigation', 'Browser back');
        } catch (error) {
            this.logActivity('error', 'Cannot go back - cross-origin restriction');
        }
    }

    browserForward() {
        const iframe = document.getElementById('browser-frame');
        try {
            iframe.contentWindow.history.forward();
            this.logActivity('navigation', 'Browser forward');
        } catch (error) {
            this.logActivity('error', 'Cannot go forward - cross-origin restriction');
        }
    }

    browserRefresh() {
        const iframe = document.getElementById('browser-frame');
        iframe.src = iframe.src;
        this.logActivity('navigation', 'Browser refresh');
    }

    addConsoleEntry(level, message) {
        const consoleOutput = document.getElementById('console-output');
        const entry = document.createElement('div');
        entry.className = `console-entry ${level}`;
        
        const timestamp = new Date().toLocaleTimeString();
        entry.innerHTML = `<span class="console-timestamp">[${timestamp}]</span> ${message}`;
        
        consoleOutput.appendChild(entry);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
        
        this.consoleEntries.push({ level, message, timestamp });
    }

    addNetworkRequest(request) {
        const networkRequests = document.getElementById('network-requests');
        const row = document.createElement('div');
        row.className = 'table-row';
        
        row.innerHTML = `
            <div class="col-method">${request.method}</div>
            <div class="col-url" title="${request.url}">${request.url}</div>
            <div class="col-status">${request.status || '-'}</div>
            <div class="col-size">${request.size || '0'} B</div>
            <div class="col-time">${request.time || '0'} ms</div>
        `;
        
        networkRequests.appendChild(row);
        this.networkRequests.push(request);
        
        // Update stats
        document.getElementById('request-count').textContent = this.networkRequests.length;
    }

    logActivity(type, message) {
        const activityLog = document.getElementById('activity-log');
        const entry = document.createElement('div');
        entry.className = 'activity-entry';
        
        const timestamp = new Date().toLocaleTimeString();
        entry.innerHTML = `
            <span class="activity-timestamp">${timestamp}</span>
            <span class="activity-action">${type}</span>
            <span class="activity-details">${message}</span>
        `;
        
        activityLog.appendChild(entry);
        activityLog.scrollTop = activityLog.scrollHeight;
        
        this.activityLog.push({ type, message, timestamp });
        
        // Keep only last 100 entries
        if (this.activityLog.length > 100) {
            this.activityLog.shift();
            activityLog.removeChild(activityLog.firstChild);
        }
    }

    clearTerminal() {
        this.terminal.clear();
        this.logActivity('terminal', 'Terminal cleared');
    }

    clearConsole() {
        document.getElementById('console-output').innerHTML = '';
        this.consoleEntries = [];
    }

    clearNetwork() {
        document.getElementById('network-requests').innerHTML = '';
        this.networkRequests = [];
        document.getElementById('request-count').textContent = '0';
        document.getElementById('data-transferred').textContent = '0 KB';
    }

    clearActivity() {
        document.getElementById('activity-log').innerHTML = '';
        this.activityLog = [];
    }


    toggleLayout() {
        // Toggle between horizontal and vertical layouts
        const mainContent = document.querySelector('.main-content');
        const isVertical = mainContent.style.flexDirection === 'column';
        
        if (isVertical) {
            mainContent.style.flexDirection = 'row';
            this.logActivity('ui', 'Switched to horizontal layout');
        } else {
            mainContent.style.flexDirection = 'column';
            this.logActivity('ui', 'Switched to vertical layout');
        }
        
        setTimeout(() => this.resizeTerminal(), 100);
    }

    toggleActivityPanel() {
        const panel = document.getElementById('activity-panel');
        const button = document.getElementById('toggle-activity');
        const icon = button.querySelector('i');
        
        if (panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            icon.className = 'fas fa-chevron-up';
        } else {
            panel.classList.add('collapsed');
            icon.className = 'fas fa-chevron-down';
        }
    }

    toggleInspectMode() {
        // Toggle element inspection mode
        this.logActivity('dev-tools', 'Inspect mode toggled');
        this.addConsoleEntry('info', 'Inspect mode: Click elements to inspect them');
    }

    refreshElements() {
        // Refresh DOM tree
        this.logActivity('dev-tools', 'DOM tree refreshed');
        this.addConsoleEntry('info', 'DOM tree refreshed');
    }

    openSettings() {
        document.getElementById('settings-modal').classList.remove('hidden');
    }

    closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
    }

    saveSettings() {
        const newUrl = document.getElementById('mcp-server-url').value;
        const theme = document.getElementById('terminal-theme').value;
        const autoScreenshot = document.getElementById('auto-screenshot').checked;
        
        this.mcpServerUrl = newUrl;
        
        this.logActivity('settings', `Settings saved - Server: ${newUrl}, Theme: ${theme}`);
        this.closeSettings();
    }

    handleResize() {
        setTimeout(() => this.resizeTerminal(), 100);
    }

    async connectToMCPServer() {
        try {
            const response = await fetch(`${this.mcpServerUrl}/health`);
            if (response.ok) {
                this.isConnected = true;
                this.updateConnectionStatus('connected', 'Connected to MCP Server');
                this.logActivity('system', 'Connected to MCP server');
            } else {
                throw new Error('MCP server not available');
            }
        } catch (error) {
            console.error('Failed to connect to MCP server:', error);
            this.updateConnectionStatus('disconnected', 'MCP Server offline');
            this.logActivity('system', 'Failed to connect to MCP server');
        }
    }

    updateConnectionStatus(status, text) {
        console.log('🔄 Updating connection status:', status, text);
        const indicator = document.getElementById('connection-indicator');
        const textElement = document.getElementById('connection-text');
        
        console.log('📍 Elements found - indicator:', !!indicator, 'text:', !!textElement);
        
        if (indicator) {
            indicator.className = `fas fa-circle ${status}`;
            console.log('✅ Updated indicator class to:', status);
        }
        if (textElement) {
            textElement.textContent = text;
            console.log('✅ Updated text to:', text);
        }
    }

    startHeartbeat() {
        setInterval(async () => {
            try {
                await fetch(`${this.mcpServerUrl}/health`);
                if (!this.isConnected) {
                    this.isConnected = true;
                    this.updateConnectionStatus('connected', 'Connected to MCP Server');
                }
            } catch (error) {
                if (this.isConnected) {
                    this.isConnected = false;
                    this.updateConnectionStatus('disconnected', 'MCP Server disconnected');
                }
            }
        }, 5000);
    }
}

// Initialize the IDE when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.codeFlowIDE = new CodeFlowIDE();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.codeFlowIDE) {
        window.codeFlowIDE.handleResize();
    }
});