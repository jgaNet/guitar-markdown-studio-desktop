const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gmsDesktop', {
  openMarkdown: () => ipcRenderer.invoke('document:open'),
  saveMarkdown: (payload) => ipcRenderer.invoke('document:save', payload),
  exportPdf: () => ipcRenderer.invoke('document:export-pdf'),
});
