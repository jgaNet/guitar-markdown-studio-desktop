const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gmsDesktop', {
  openMarkdown: () => ipcRenderer.invoke('document:open'),
  saveMarkdown: (payload) => ipcRenderer.invoke('document:save', payload),
  exportPdf: (suggestedFileName) => ipcRenderer.invoke('document:export-pdf', suggestedFileName),
  exportHtml: (html, suggestedFileName) => ipcRenderer.invoke('document:export-html', html, suggestedFileName),
});
