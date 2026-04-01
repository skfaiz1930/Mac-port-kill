const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getPorts: () => ipcRenderer.invoke('get-ports'),
  killProcess: (pid) => ipcRenderer.invoke('kill-process', pid),
  getProcessInfo: (pid) => ipcRenderer.invoke('get-process-info', pid),
  hideWindow: () => ipcRenderer.send('hide-window'),
});
