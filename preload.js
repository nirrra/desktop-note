const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopNotes', {
  getWindowState: () => ipcRenderer.invoke('window:get-state'),
  setPinned: (pinned) => ipcRenderer.invoke('window:set-pinned', Boolean(pinned)),
  setWindowSize: (size) => ipcRenderer.invoke('window:set-size', size),
  restoreFromEdge: () => ipcRenderer.invoke('window:restore-edge'),
  hide: () => ipcRenderer.invoke('window:hide'),
  getLaunchAtLogin: () => ipcRenderer.invoke('system:get-launch-at-login'),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('system:set-launch-at-login', Boolean(enabled)),
  listStaging: () => ipcRenderer.invoke('staging:list'),
  createStagingText: (text) => ipcRenderer.invoke('staging:create-text', String(text ?? '')),
  updateStagingText: (id, text) => ipcRenderer.invoke('staging:update-text', {
    id: String(id ?? ''),
    text: String(text ?? ''),
  }),
  reorderStaging: (orderedIds) => ipcRenderer.invoke(
    'staging:reorder',
    Array.isArray(orderedIds) ? orderedIds.map(String) : [],
  ),
  deleteStagingItem: (id) => ipcRenderer.invoke('staging:delete', String(id ?? '')),
  clearStaging: () => ipcRenderer.invoke('staging:clear'),
  importStagingFiles: (files) => ipcRenderer.invoke(
    'staging:import-files',
    (Array.isArray(files) ? files : []).slice(0, 20).map((file) => ({
      name: String(file?.name ?? '暂存图片'),
      bytes: file?.bytes,
    })),
  ),
  chooseStagingImages: () => ipcRenderer.invoke('staging:pick-images'),
  pasteToStaging: () => ipcRenderer.invoke('staging:paste'),
  copyStagingItem: (id) => ipcRenderer.invoke('staging:copy', String(id ?? '')),
  saveStagingImage: (id) => ipcRenderer.invoke('staging:save-image', String(id ?? '')),
  openStagingPreview: (id) => ipcRenderer.invoke('staging:open-preview', String(id ?? '')),
  closeStagingPreview: () => ipcRenderer.invoke('staging:close-preview'),
  showStagingHover: (id, rect) => ipcRenderer.invoke('staging:hover-preview', String(id ?? ''), rect ?? null),
  hideStagingHover: () => ipcRenderer.invoke('staging:hide-hover-preview'),
  showStagingContextMenu: (id) => ipcRenderer.invoke('staging:context-menu', String(id ?? '')),
  onWindowStateChanged: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('window:state-changed', listener);
    return () => ipcRenderer.removeListener('window:state-changed', listener);
  },
  onCreateItemRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('items:create-request', listener);
    return () => ipcRenderer.removeListener('items:create-request', listener);
  },
});
