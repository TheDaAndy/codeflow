const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-new-project', callback);
    ipcRenderer.on('menu-open-project', callback);
    ipcRenderer.on('menu-toggle-terminal', callback);
    ipcRenderer.on('menu-toggle-browser', callback);
    ipcRenderer.on('menu-about', callback);
  },
  
  removeMenuListeners: () => {
    ipcRenderer.removeAllListeners('menu-new-project');
    ipcRenderer.removeAllListeners('menu-open-project');
    ipcRenderer.removeAllListeners('menu-toggle-terminal');
    ipcRenderer.removeAllListeners('menu-toggle-browser');
    ipcRenderer.removeAllListeners('menu-about');
  }
});

contextBridge.exposeInMainWorld('terminalAPI', {
  spawn: (command, args, options) => ipcRenderer.invoke('terminal-spawn', command, args, options),
  write: (data) => ipcRenderer.invoke('terminal-write', data),
  resize: (cols, rows) => ipcRenderer.invoke('terminal-resize', cols, rows),
  kill: () => ipcRenderer.invoke('terminal-kill'),
  onData: (callback) => ipcRenderer.on('terminal-data', callback),
  onExit: (callback) => ipcRenderer.on('terminal-exit', callback)
});

contextBridge.exposeInMainWorld('browserAPI', {
  navigate: (url) => ipcRenderer.invoke('browser-navigate', url),
  getContent: () => ipcRenderer.invoke('browser-get-content'),
  screenshot: () => ipcRenderer.invoke('browser-screenshot'),
  executeScript: (script) => ipcRenderer.invoke('browser-execute-script', script),
  click: (selector) => ipcRenderer.invoke('browser-click', selector),
  type: (selector, text) => ipcRenderer.invoke('browser-type', selector, text),
  getConsole: () => ipcRenderer.invoke('browser-get-console'),
  onConsole: (callback) => ipcRenderer.on('browser-console', callback),
  onNavigation: (callback) => ipcRenderer.on('browser-navigation', callback)
});