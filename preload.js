const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    // File operations
    readSolution: () => ipcRenderer.invoke('read-solution'),
    saveSolution: (content) => ipcRenderer.invoke('save-solution', content),

    // Snippets
    loadSnippets: () => ipcRenderer.invoke('load-snippets'),
    saveSnippets: (snippets) => ipcRenderer.invoke('save-snippets', snippets),

    // Python execution
    runPython: (code, input) => ipcRenderer.invoke('run-python', { code, input }),
    stopPython: () => ipcRenderer.send('stop-python'),

    // App info
    getAppInfo: () => ipcRenderer.invoke('get-app-info')
});
