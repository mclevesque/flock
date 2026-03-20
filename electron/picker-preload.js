const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronPicker', {
  onSources: (cb) => ipcRenderer.on('picker-sources', (_, sources) => cb(sources)),
  selectSource: (id, audio) => ipcRenderer.send('picker-source-selected', { id, audio }),
  cancel: () => ipcRenderer.send('picker-cancelled'),
});
