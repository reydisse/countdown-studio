'use strict'

const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs   = require('fs')
const { isDev, CF_API_URL, CF_WS_URL } = require('./config')

let mainWindow          = null
let outputWindow        = null
let teleprompterWindow  = null
let tray                = null

// ── Window creation ───────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1200, minHeight: 700,
    title: 'ShowStack',
    backgroundColor: '#181614',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, 'web', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    outputWindow?.close()
    teleprompterWindow?.close()
    app.quit()
  })
}

function createOutputWindow(roomCode) {
  outputWindow = new BrowserWindow({
    width: 1920, height: 1080, frame: false, alwaysOnTop: true,
    title: 'ShowStack Output', backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  })

  const query = roomCode ? `?room=${roomCode}` : ''
  if (isDev) {
    outputWindow.loadURL(`http://localhost:9876/output${query}`)
  } else {
    outputWindow.loadURL(`${CF_API_URL}/output${query}`)
  }

  outputWindow.on('closed', () => { outputWindow = null })
}

function createTeleprompterReaderWindow(roomCode) {
  teleprompterWindow = new BrowserWindow({
    width: 1920, height: 1080, frame: false,
    title: 'ShowStack Teleprompter', backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  })

  if (isDev) {
    const path_ = roomCode ? `/room/${roomCode}/read` : ''
    teleprompterWindow.loadURL(`http://localhost:5174/teleprompter${path_}`)
  } else {
    teleprompterWindow.loadFile(
      path.join(process.resourcesPath, 'teleprompter', 'index.html'),
      roomCode ? { hash: `room/${roomCode}/read` } : {}
    )
  }

  teleprompterWindow.on('closed', () => { teleprompterWindow = null })
}

// ── System tray ───────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png')
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty()

  tray = new Tray(icon)
  tray.setToolTip('ShowStack')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open ShowStack',           click: () => mainWindow ? mainWindow.show() : createMainWindow() },
    { type: 'separator' },
    { label: 'Open Output Window',       click: () => createOutputWindow(null) },
    { label: 'Open Teleprompter Reader', click: () => createTeleprompterReaderWindow(null) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]))
  tray.on('double-click', () => mainWindow ? mainWindow.show() : createMainWindow())
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('get-config', () => ({
  apiUrl: isDev ? 'http://localhost:9876' : CF_API_URL,
  wsUrl:  isDev ? 'ws://localhost:9876'   : CF_WS_URL,
  isDev,
  version: app.getVersion(),
}))

ipcMain.handle('open-file-picker', async (_e, opts = {}) => {
  const props = opts.multiple ? ['openFile', 'multiSelections'] : ['openFile']
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: props,
    filters: opts.filters ?? [{ name: 'All Files', extensions: ['*'] }],
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('read-file-base64', async (_e, filePath) => {
  try {
    const buffer   = fs.readFileSync(filePath)
    const ext      = path.extname(filePath).toLowerCase()
    const mimeMap  = {
      '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif',
      '.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm',
      '.mp3':'audio/mpeg','.wav':'audio/wav','.aac':'audio/aac',
    }
    return { data: buffer.toString('base64'), mimeType: mimeMap[ext] ?? 'application/octet-stream', name: path.basename(filePath), size: buffer.length }
  } catch (e) { return { error: String(e) } }
})

ipcMain.handle('open-output-window', (_e, roomCode) => {
  if (outputWindow && !outputWindow.isDestroyed()) { outputWindow.focus(); return }
  createOutputWindow(roomCode)
})

ipcMain.handle('open-teleprompter-reader', (_e, roomCode) => {
  if (teleprompterWindow && !teleprompterWindow.isDestroyed()) { teleprompterWindow.focus(); return }
  createTeleprompterReaderWindow(roomCode)
})

ipcMain.handle('open-external-url', (_e, url) => { shell.openExternal(url) })
ipcMain.handle('set-fullscreen',    (_e, val) => { mainWindow?.setFullScreen(val) })
ipcMain.handle('minimize-to-tray',  ()        => { mainWindow?.hide() })
ipcMain.on('install-update',        ()        => { autoUpdater.quitAndInstall() })

// ── Auto updater ──────────────────────────────────────────────────────────────

function setupAutoUpdater() {
  if (isDev) return
  autoUpdater.checkForUpdatesAndNotify()
  autoUpdater.on('update-available',  () => mainWindow?.webContents.send('update-available'))
  autoUpdater.on('update-downloaded', () => mainWindow?.webContents.send('update-downloaded'))
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000)
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createMainWindow()
  createTray()
  setupAutoUpdater()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('before-quit',        () => { tray?.destroy() })
