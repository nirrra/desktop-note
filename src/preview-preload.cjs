const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('imagePreview', {
  getData: () => ipcRenderer.invoke('preview:get-data'),
  close: () => ipcRenderer.invoke('preview:close'),
  copy: () => ipcRenderer.invoke('preview:copy'),
  save: () => ipcRenderer.invoke('preview:save'),
  keepHover: () => ipcRenderer.invoke('staging:keep-hover-preview'),
  releaseHover: () => ipcRenderer.invoke('staging:hide-hover-preview'),
  openFull: () => ipcRenderer.invoke('preview:open-full'),
  onRefresh: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('preview:refresh', listener);
    return () => ipcRenderer.removeListener('preview:refresh', listener);
  },
});
