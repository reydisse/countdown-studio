'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('__ELECTRON__', true)

contextBridge.exposeInMainWorld('__ELECTRON_API__', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),

  // File system
  openFilePicker: (opts) => ipcRenderer.invoke('open-file-picker', opts),
  readFileBase64: (filePath) => ipcRenderer.invoke('read-file-base64', filePath),

  // Windows
  openOutputWindow:        (roomCode) => ipcRenderer.invoke('open-output-window', roomCode),
  openTeleprompterReader:  (roomCode) => ipcRenderer.invoke('open-teleprompter-reader', roomCode),
  openExternalUrl:         (url)      => ipcRenderer.invoke('open-external-url', url),
  setFullscreen:           (value)    => ipcRenderer.invoke('set-fullscreen', value),
  minimizeToTray:          ()         => ipcRenderer.invoke('minimize-to-tray'),

  // Auto updater events
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available',  cb),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', cb),
  installUpdate:      ()   => ipcRenderer.send('install-update'),
})
