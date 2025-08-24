const { ipcMain } = require('electron');
// const pty = require('node-pty'); // Disabled for mobile compatibility
const path = require('path');
const os = require('os');

class TerminalManager {
    constructor() {
        this.terminals = new Map();
        this.setupIPC();
    }

    setupIPC() {
        ipcMain.handle('terminal-spawn', async (event, command, args = [], options = {}) => {
            try {
                const terminalId = this.generateId();
                
                // Simulate terminal for mobile compatibility
                const mockTerminal = {
                    write: (data) => {
                        // Echo back user input
                        event.sender.send('terminal-data', { terminalId, data });
                    },
                    kill: () => {
                        event.sender.send('terminal-exit', { terminalId, exitCode: 0, signal: null });
                        this.terminals.delete(terminalId);
                    },
                    resize: () => {} // No-op
                };

                this.terminals.set(terminalId, mockTerminal);
                
                // Send welcome message
                setTimeout(() => {
                    event.sender.send('terminal-data', { 
                        terminalId, 
                        data: '\\r\\n\\x1b[1;32mCodeFlow Terminal Ready\\x1b[0m\\r\\n\\x1b[33mNote: Full terminal emulation requires desktop environment\\x1b[0m\\r\\n$ '
                    });
                }, 100);
                
                return { terminalId, success: true };
            } catch (error) {
                console.error('Failed to spawn terminal:', error);
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('terminal-write', async (event, terminalId, data) => {
            try {
                const terminal = this.terminals.get(terminalId);
                if (terminal) {
                    terminal.write(data);
                    return { success: true };
                }
                return { success: false, error: 'Terminal not found' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('terminal-resize', async (event, terminalId, cols, rows) => {
            try {
                const terminal = this.terminals.get(terminalId);
                if (terminal) {
                    terminal.resize(cols, rows);
                    return { success: true };
                }
                return { success: false, error: 'Terminal not found' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });

        ipcMain.handle('terminal-kill', async (event, terminalId) => {
            try {
                const terminal = this.terminals.get(terminalId);
                if (terminal) {
                    terminal.kill();
                    this.terminals.delete(terminalId);
                    return { success: true };
                }
                return { success: false, error: 'Terminal not found' };
            } catch (error) {
                return { success: false, error: error.message };
            }
        });
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    cleanup() {
        for (const terminal of this.terminals.values()) {
            try {
                terminal.kill();
            } catch (error) {
                console.error('Error killing terminal:', error);
            }
        }
        this.terminals.clear();
    }
}

module.exports = TerminalManager;