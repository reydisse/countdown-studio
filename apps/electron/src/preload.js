'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Flag read by packages/ui/src/adapter/index.js to choose the Electron adapter
contextBridge.exposeInMainWorld('__ELECTRON__', {
  // Opens the native OS file picker.
  // Returns { paths: string[], canceled: boolean }
  openFilePicker: (options = {}) =>
    ipcRenderer.invoke('dialog:open-file', options),

  // Reads the file at filePath in the main process and POSTs it to the local
  // server. Returns the created Asset record.
  uploadAsset: (filePath) =>
    ipcRenderer.invoke('media:upload', filePath),
});
