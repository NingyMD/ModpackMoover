const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),   // ← changed here
  transferConfigs: (data) => ipcRenderer.invoke('transfer:configs', data)
});