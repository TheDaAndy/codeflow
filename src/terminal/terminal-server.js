const { spawn } = require('child_process');
const WebSocket = require('ws');
const uuid = require('uuid').v4;
const os = require('os');
const path = require('path');
const pty = require('child_process'); // Use child_process instead of node-pty for mobile compatibility

class TerminalServer {
    constructor() {
        this.terminals = new Map();
        this.wss = null;
    }

    setupWebSocket(server) {
        this.wss = new WebSocket.Server({ 
            server,
            path: '/terminal'
        });

        this.wss.on('connection', (ws) => {
            console.log('Terminal WebSocket connected');
            
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleMessage(ws, data);
                } catch (error) {
                    console.error('Terminal WebSocket error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        data: error.message
                    }));
                }
            });

            ws.on('close', () => {
                console.log('Terminal WebSocket disconnected');
                // Clean up any terminals associated with this connection
                this.cleanupTerminals(ws);
            });

            // Send connection acknowledgment
            ws.send(JSON.stringify({
                type: 'connected',
                data: 'Terminal server connected'
            }));
        });
    }

    async handleMessage(ws, message) {
        const { type, data } = message;

        switch (type) {
            case 'create':
                await this.createTerminal(ws, data);
                break;
            case 'input':
                await this.handleInput(ws, data);
                break;
            case 'resize':
                await this.resizeTerminal(ws, data);
                break;
            case 'destroy':
                await this.destroyTerminal(ws, data);
                break;
            default:
                console.log('Unknown terminal message type:', type);
        }
    }

    async createTerminal(ws, options = {}) {
        const terminalId = uuid();
        
        try {
            // Create a mock terminal for mobile compatibility
            const mockTerminal = this.createMockTerminal(terminalId, options);
            
            // Store terminal info
            const terminalInfo = {
                id: terminalId,
                process: mockTerminal,
                ws: ws,
                shell: 'bash',
                cwd: options.cwd || process.env.HOME || '/data/data/com.termux/files/home'
            };

            this.terminals.set(terminalId, terminalInfo);

            // Send success response
            ws.send(JSON.stringify({
                type: 'created',
                terminalId,
                shell: 'bash',
                cwd: terminalInfo.cwd
            }));

            // Send welcome message
            setTimeout(() => {
                const welcomeMsg = [
                    '\\x1b[1;36m╭─────────────────────────────────────────────╮\\x1b[0m\\r\\n',
                    '\\x1b[1;36m│           CodeFlow Terminal                 │\\x1b[0m\\r\\n', 
                    '\\x1b[1;36m│  Full shell with Claude Code integration    │\\x1b[0m\\r\\n',
                    '\\x1b[1;36m╰─────────────────────────────────────────────╯\\x1b[0m\\r\\n',
                    '\\x1b[1;32mTip: Use "claude" command to start Claude Code\\x1b[0m\\r\\n',
                    '\\x1b[33mBrowser automation available via MCP server\\x1b[0m\\r\\n\\r\\n'
                ].join('');

                ws.send(JSON.stringify({
                    type: 'output',
                    terminalId,
                    data: welcomeMsg + this.getPrompt(terminalInfo.cwd)
                }));
            }, 100);

        } catch (error) {
            console.error('Failed to create terminal:', error);
            ws.send(JSON.stringify({
                type: 'error',
                data: `Failed to create terminal: ${error.message}`
            }));
        }
    }

    createMockTerminal(terminalId, options) {
        const terminal = {
            id: terminalId,
            cwd: options.cwd || process.env.HOME || '/data/data/com.termux/files/home',
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor',
                CODEFLOW_TERMINAL: '1',
                CLAUDE_CODE_AVAILABLE: '1'
            },
            
            write: (data) => {
                // Handle input to the terminal
                this.handleTerminalInput(terminalId, data);
            },
            
            kill: () => {
                // Cleanup terminal
                this.terminals.delete(terminalId);
            },
            
            resize: () => {
                // Handle resize - no-op for mock terminal
            }
        };

        return terminal;
    }

    getPrompt(cwd) {
        const dir = path.basename(cwd);
        return `\\x1b[1;32m${dir}\\x1b[0m $ `;
    }

    async handleTerminalInput(terminalId, input) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) return;

        const ws = terminal.ws;
        
        // Handle different input characters
        if (input === '\\r') {
            // Enter key - execute command
            const command = terminal.currentCommand || '';
            terminal.currentCommand = '';
            
            ws.send(JSON.stringify({
                type: 'output',
                terminalId,
                data: '\\r\\n'
            }));

            if (command.trim()) {
                await this.executeCommand(terminalId, command.trim());
            } else {
                ws.send(JSON.stringify({
                    type: 'output',
                    terminalId,
                    data: this.getPrompt(terminal.process.cwd)
                }));
            }
        } else if (input === '\\u007f' || input === '\\b') {
            // Backspace
            if (terminal.currentCommand && terminal.currentCommand.length > 0) {
                terminal.currentCommand = terminal.currentCommand.slice(0, -1);
                ws.send(JSON.stringify({
                    type: 'output',
                    terminalId,
                    data: '\\b \\b'
                }));
            }
        } else if (input === '\\u0003') {
            // Ctrl+C
            terminal.currentCommand = '';
            ws.send(JSON.stringify({
                type: 'output',
                terminalId,
                data: '\\r\\n' + this.getPrompt(terminal.process.cwd)
            }));
        } else if (input.charCodeAt(0) >= 32) {
            // Printable character
            terminal.currentCommand = (terminal.currentCommand || '') + input;
            ws.send(JSON.stringify({
                type: 'output',
                terminalId,
                data: input
            }));
        }
    }

    async executeCommand(terminalId, command) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) return;

        const ws = terminal.ws;
        
        try {
            // Handle built-in commands
            if (command.startsWith('cd ')) {
                await this.handleCdCommand(terminalId, command);
                return;
            }
            
            if (command === 'pwd') {
                ws.send(JSON.stringify({
                    type: 'output',
                    terminalId,
                    data: terminal.process.cwd + '\\r\\n'
                }));
                ws.send(JSON.stringify({
                    type: 'output',
                    terminalId,
                    data: this.getPrompt(terminal.process.cwd)
                }));
                return;
            }

            if (command === 'ls' || command === 'ls -la') {
                await this.handleLsCommand(terminalId, command);
                return;
            }

            // Execute actual command
            const child = spawn(command.split(' ')[0], command.split(' ').slice(1), {
                cwd: terminal.process.cwd,
                env: terminal.process.env,
                stdio: 'pipe'
            });

            child.stdout.on('data', (data) => {
                ws.send(JSON.stringify({
                    type: 'output',
                    terminalId,
                    data: data.toString()
                }));
            });

            child.stderr.on('data', (data) => {
                ws.send(JSON.stringify({
                    type: 'output',
                    terminalId,
                    data: '\\x1b[31m' + data.toString() + '\\x1b[0m'
                }));
            });

            child.on('close', (code) => {
                ws.send(JSON.stringify({
                    type: 'output',
                    terminalId,
                    data: this.getPrompt(terminal.process.cwd)
                }));
            });

        } catch (error) {
            ws.send(JSON.stringify({
                type: 'output',
                terminalId,
                data: `\\x1b[31m${command}: command not found\\x1b[0m\\r\\n`
            }));
            ws.send(JSON.stringify({
                type: 'output',
                terminalId,
                data: this.getPrompt(terminal.process.cwd)
            }));
        }
    }

    async handleCdCommand(terminalId, command) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) return;

        const ws = terminal.ws;
        const args = command.split(' ');
        let targetDir = args[1] || terminal.process.env.HOME;

        // Resolve relative paths
        if (!path.isAbsolute(targetDir)) {
            targetDir = path.resolve(terminal.process.cwd, targetDir);
        }

        try {
            const fs = require('fs').promises;
            const stats = await fs.stat(targetDir);
            
            if (stats.isDirectory()) {
                terminal.process.cwd = targetDir;
            } else {
                ws.send(JSON.stringify({
                    type: 'output',
                    terminalId,
                    data: `\\x1b[31mcd: not a directory: ${targetDir}\\x1b[0m\\r\\n`
                }));
            }
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'output',
                terminalId,
                data: `\\x1b[31mcd: no such file or directory: ${targetDir}\\x1b[0m\\r\\n`
            }));
        }

        ws.send(JSON.stringify({
            type: 'output',
            terminalId,
            data: this.getPrompt(terminal.process.cwd)
        }));
    }

    async handleLsCommand(terminalId, command) {
        const terminal = this.terminals.get(terminalId);
        if (!terminal) return;

        const ws = terminal.ws;
        
        try {
            const fs = require('fs').promises;
            const files = await fs.readdir(terminal.process.cwd, { withFileTypes: true });
            
            let output = '';
            for (const file of files) {
                if (file.isDirectory()) {
                    output += `\\x1b[34m${file.name}/\\x1b[0m  `;
                } else {
                    output += `${file.name}  `;
                }
            }
            output += '\\r\\n';
            
            ws.send(JSON.stringify({
                type: 'output',
                terminalId,
                data: output
            }));
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'output',
                terminalId,
                data: `\\x1b[31mls: ${error.message}\\x1b[0m\\r\\n`
            }));
        }

        ws.send(JSON.stringify({
            type: 'output',
            terminalId,
            data: this.getPrompt(terminal.process.cwd)
        }));
    }

    async handleInput(ws, data) {
        const { terminalId, input } = data;
        const terminal = this.terminals.get(terminalId);

        if (!terminal) {
            ws.send(JSON.stringify({
                type: 'error',
                data: 'Terminal not found'
            }));
            return;
        }

        // Use our mock terminal input handler
        await this.handleTerminalInput(terminalId, input);
    }

    async resizeTerminal(ws, data) {
        const { terminalId, cols, rows } = data;
        const terminal = this.terminals.get(terminalId);

        if (!terminal || !terminal.process.resize) {
            return;
        }

        try {
            terminal.process.resize(cols, rows);
        } catch (error) {
            console.error('Failed to resize terminal:', error);
        }
    }

    async destroyTerminal(ws, data) {
        const { terminalId } = data;
        const terminal = this.terminals.get(terminalId);

        if (!terminal) {
            return;
        }

        try {
            terminal.process.kill('SIGTERM');
            this.terminals.delete(terminalId);
            
            ws.send(JSON.stringify({
                type: 'destroyed',
                terminalId
            }));
        } catch (error) {
            console.error('Failed to destroy terminal:', error);
        }
    }

    cleanupTerminals(ws) {
        for (const [terminalId, terminal] of this.terminals.entries()) {
            if (terminal.ws === ws) {
                try {
                    terminal.process.kill('SIGTERM');
                } catch (error) {
                    console.error('Error killing terminal on cleanup:', error);
                }
                this.terminals.delete(terminalId);
            }
        }
    }

    cleanup() {
        for (const [terminalId, terminal] of this.terminals.entries()) {
            try {
                terminal.process.kill('SIGTERM');
            } catch (error) {
                console.error('Error killing terminal on server cleanup:', error);
            }
        }
        this.terminals.clear();

        if (this.wss) {
            this.wss.close();
        }
    }
}

module.exports = TerminalServer;