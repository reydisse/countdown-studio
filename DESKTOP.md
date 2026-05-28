# Desktop App - ShowStack Electron

> **How to use this file:**
> Open Claude Code inside the `showstack` folder and say:
> "Read DESKTOP.md and execute every phase in order. Do not skip anything."
>
> **Run this file AFTER MIGRATE_TO_CF.md is complete and the CF Worker is deployed.**
>
> **Prerequisites:**
> - REFACTOR.md complete
> - TELEPROMPTER.md complete
> - MIGRATE_TO_CF.md complete and Worker deployed at api.YOURDOMAIN.com
> - Electron already scaffolded in apps/electron from the original build

---

## What This File Does

Updates the Electron desktop app to work with the Cloudflare backend
instead of spawning a local Express server. The desktop app becomes
a thin, fast shell that:

- Opens the React UI in a BrowserWindow
- Talks to the CF Worker API for all data
- Connects to CF Durable Objects via WebSocket for real-time sync
- Handles native OS features: file picker, fullscreen, system tray, auto-update
- Can open multiple windows: countdown output, teleprompter reader, controller
- Works offline for display (cached) but requires internet for real-time sync

The local Express server (packages/server) is NO LONGER spawned by Electron
in production. It remains for local dev only.

---

## Architecture

```
Production:
  Electron shell
    -> BrowserWindow loads apps/web/dist (local files)
    -> UI calls https://api.YOURDOMAIN.com for API
    -> UI connects wss://api.YOURDOMAIN.com/ws for real-time

Development:
  Electron shell
    -> BrowserWindow loads http://localhost:5173 (Vite dev server)
    -> UI calls http://localhost:9876 (local Express)
    -> UI connects ws://localhost:9876 for real-time
```

---

## Phase 1 - Update Package Dependencies

### Update apps/electron/package.json

```json
{
  "name": "@showstack/electron",
  "version": "0.1.0",
  "private": true,
  "main": "src/main.js",
  "scripts": {
    "dev":        "electron .",
    "build":      "electron-builder",
    "build:win":  "electron-builder --win",
    "build:mac":  "electron-builder --mac",
    "build:linux":"electron-builder --linux"
  },
  "dependencies": {
    "electron-updater": "^6.3.0"
  },
  "devDependencies": {
    "electron": "^34.0.0",
    "electron-builder": "^25.0.0"
  },
  "build": {
    "appId": "com.showstack.desktop",
    "productName": "ShowStack",
    "copyright": "Copyright 2025 ShowStack",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "src/**/*",
      "../../apps/web/dist/**/*"
    ],
    "extraResources": [
      {
        "from": "../../apps/web/dist",
        "to": "web"
      },
      {
        "from": "../../apps/teleprompter/dist",
        "to": "teleprompter"
      }
    ],
    "win": {
      "target": ["nsis"],
      "icon": "assets/icon.ico"
    },
    "mac": {
      "target": ["dmg"],
      "icon": "assets/icon.icns",
      "category": "public.app-category.productivity"
    },
    "linux": {
      "target": ["AppImage"],
      "icon": "assets/icon.png"
    },
    "publish": {
      "provider": "github",
      "owner": "GITHUB_USERNAME",
      "repo": "showstack"
    }
  }
}
```

---

## Phase 2 - Main Process

### apps/electron/src/main.js

Complete rewrite. Remove all Express server spawning. Full implementation below:

```js
const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'
const CF_API_URL = process.env.CF_API_URL || 'https://api.YOURDOMAIN.com'
const CF_WS_URL  = process.env.CF_WS_URL  || 'wss://api.YOURDOMAIN.com'

let mainWindow = null
let outputWindow = null
let teleprompterWindow = null
let tray = null

// ── Window creation ─────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
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
    mainWindow.webContents.openDevTools()
  } else {
    // Load built UI from extraResources
    const webPath = path.join(process.resourcesPath, 'web', 'index.html')
    mainWindow.loadFile(webPath)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    outputWindow?.close()
    teleprompterWindow?.close()
    app.quit()
  })
}

function createOutputWindow(roomCode) {
  // Full screen output window for vMix/capture card capture
  outputWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,
    alwaysOnTop: true,
    title: 'ShowStack Output',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const query = roomCode ? `?room=${roomCode}` : ''

  if (isDev) {
    outputWindow.loadURL(`http://localhost:9876/output${query}`)
  } else {
    // Output page is served by the CF Worker at /output
    // In offline mode, load a bundled fallback
    outputWindow.loadURL(`${CF_API_URL}/output${query}`)
  }

  outputWindow.on('closed', () => {
    outputWindow = null
  })
}

function createTeleprompterReaderWindow(roomCode) {
  teleprompterWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,
    title: 'ShowStack Teleprompter',
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const query = roomCode ? `/room/${roomCode}/read` : ''

  if (isDev) {
    teleprompterWindow.loadURL(`http://localhost:5174/teleprompter${query}`)
  } else {
    const teleprompterPath = path.join(process.resourcesPath, 'teleprompter', 'index.html')
    teleprompterWindow.loadFile(teleprompterPath, { hash: `room/${roomCode}/read` })
  }

  teleprompterWindow.on('closed', () => {
    teleprompterWindow = null
  })
}

// ── System tray ─────────────────────────────────────────────────────────

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png')
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty()

  tray = new Tray(icon)
  tray.setToolTip('ShowStack')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open ShowStack', click: () => mainWindow?.show() ?? createMainWindow() },
    { type: 'separator' },
    { label: 'Open Output Window', click: () => createOutputWindow(null) },
    { label: 'Open Teleprompter Reader', click: () => createTeleprompterReaderWindow(null) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => mainWindow?.show() ?? createMainWindow())
}

// ── IPC handlers ─────────────────────────────────────────────────────────

ipcMain.handle('get-config', () => ({
  apiUrl: isDev ? 'http://localhost:9876' : CF_API_URL,
  wsUrl:  isDev ? 'ws://localhost:9876'   : CF_WS_URL,
  isDev,
  version: app.getVersion(),
}))

ipcMain.handle('open-file-picker', async (event, opts = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: opts.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: opts.filters ?? [{ name: 'All Files', extensions: ['*'] }],
  })
  if (result.canceled) return []
  return result.filePaths
})

ipcMain.handle('open-output-window', (event, roomCode) => {
  if (outputWindow && !outputWindow.isDestroyed()) {
    outputWindow.focus()
    return
  }
  createOutputWindow(roomCode)
})

ipcMain.handle('open-teleprompter-reader', (event, roomCode) => {
  if (teleprompterWindow && !teleprompterWindow.isDestroyed()) {
    teleprompterWindow.focus()
    return
  }
  createTeleprompterReaderWindow(roomCode)
})

ipcMain.handle('open-external-url', (event, url) => {
  shell.openExternal(url)
})

ipcMain.handle('set-fullscreen', (event, value) => {
  mainWindow?.setFullScreen(value)
})

ipcMain.handle('minimize-to-tray', () => {
  mainWindow?.hide()
})

// Read local file as base64 (for media upload from local file path)
ipcMain.handle('read-file-base64', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath)
    const mimeType = getMimeType(filePath)
    return {
      data: buffer.toString('base64'),
      mimeType,
      name: path.basename(filePath),
      size: buffer.length,
    }
  } catch (e) {
    return { error: String(e) }
  }
})

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const map = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.aac': 'audio/aac',
  }
  return map[ext] ?? 'application/octet-stream'
}

// ── Auto updater ─────────────────────────────────────────────────────────

function setupAutoUpdater() {
  if (isDev) return

  autoUpdater.checkForUpdatesAndNotify()

  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update-available')
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded')
  })

  // Check for updates every 4 hours
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000)
}

// ── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createMainWindow()
  createTray()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  tray?.destroy()
})
```

---

## Phase 3 - Preload Script

### apps/electron/src/preload.js

Complete rewrite. Expose all IPC handlers to the renderer via contextBridge:

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('__ELECTRON__', true)

contextBridge.exposeInMainWorld('__ELECTRON_API__', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),

  // File system
  openFilePicker: (opts) => ipcRenderer.invoke('open-file-picker', opts),
  readFileBase64: (filePath) => ipcRenderer.invoke('read-file-base64', filePath),

  // Windows
  openOutputWindow: (roomCode) => ipcRenderer.invoke('open-output-window', roomCode),
  openTeleprompterReader: (roomCode) => ipcRenderer.invoke('open-teleprompter-reader', roomCode),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  setFullscreen: (value) => ipcRenderer.invoke('set-fullscreen', value),
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),

  // App info
  getVersion: () => ipcRenderer.invoke('get-config').then(c => c.version),

  // Auto updater events
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', cb),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', cb),
  installUpdate: () => ipcRenderer.send('install-update'),
})
```

---

## Phase 4 - Electron Adapter

### Update packages/ui/src/adapter/electron.js

```js
const api = window.__ELECTRON_API__

let config = null
async function getConfig() {
  if (!config) config = await api.getConfig()
  return config
}

export default {
  getServerUrl: async () => (await getConfig()).apiUrl,
  getWsUrl: async () => (await getConfig()).wsUrl,

  async getProjects() {
    const { apiUrl } = await getConfig()
    const res = await fetch(`${apiUrl}/api/rooms?type=countdown`)
    return res.json()
  },

  async getProject(code) {
    const { apiUrl } = await getConfig()
    const res = await fetch(`${apiUrl}/api/rooms/${code}`)
    if (!res.ok) return null
    return res.json()
  },

  async saveProject(room) {
    const { apiUrl } = await getConfig()
    const res = await fetch(`${apiUrl}/api/rooms/${room.code}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: room.settings }),
    })
    return res.json()
  },

  async deleteProject(code) {
    const { apiUrl } = await getConfig()
    await fetch(`${apiUrl}/api/rooms/${code}`, { method: 'DELETE' })
  },

  async getAssets(roomCode) {
    const { apiUrl } = await getConfig()
    const res = await fetch(`${apiUrl}/api/rooms/${roomCode}/assets`)
    return res.json()
  },

  async uploadAsset(roomCode, filePathOrFile) {
    const { apiUrl } = await getConfig()

    let file
    if (typeof filePathOrFile === 'string') {
      // Electron: file path from dialog -> read and convert to File
      const { data, mimeType, name, size } = await api.readFileBase64(filePathOrFile)
      if (data.error) throw new Error(data.error)
      const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
      file = new File([bytes], name, { type: mimeType })
    } else {
      file = filePathOrFile
    }

    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${apiUrl}/api/rooms/${roomCode}/assets`, {
      method: 'POST',
      body: form,
    })
    return res.json()
  },

  async deleteAsset(roomCode, id) {
    const { apiUrl } = await getConfig()
    await fetch(`${apiUrl}/api/rooms/${roomCode}/assets/${id}`, { method: 'DELETE' })
  },

  openFilePicker: (opts) => api.openFilePicker(opts),
  openOutputWindow: (roomCode) => api.openOutputWindow(roomCode),
  openTeleprompterReader: (roomCode) => api.openTeleprompterReader(roomCode),
}
```

### Update packages/ui/src/adapter/index.js

```js
const isElectron = typeof window !== 'undefined' && window.__ELECTRON__ === true

let adapter

if (isElectron) {
  adapter = (await import('./electron.js')).default
} else {
  adapter = (await import('./web.js')).default
}

export default adapter
export const useAdapter = () => adapter
```

---

## Phase 5 - UI Updates for Electron

### Update packages/ui/src/hooks/useWebSocket.js

The WS URL must be fetched asynchronously in Electron since it comes from IPC:

```js
import { useAdapter } from '../adapter'

async function getWsUrl(roomCode) {
  const adapter = useAdapter()
  // adapter.getWsUrl() may be async in Electron
  const base = typeof adapter.getWsUrl === 'function'
    ? await adapter.getWsUrl()
    : adapter.getWsUrl
  return `${base}/ws?room=${roomCode}`
}
```

### Add UpdateBanner component - packages/ui/src/components/shared/UpdateBanner.jsx

```jsx
// Show a banner when update-available or update-downloaded events fire
// Only renders in Electron (check window.__ELECTRON__)
// update-available: "A new version of ShowStack is available. Downloading..."
// update-downloaded: "Update ready. Restart to install." + Install Now button
// Install Now calls window.__ELECTRON_API__.installUpdate()
```

### Add to AppShell layout

```jsx
// If window.__ELECTRON__ is true, show:
// 1. UpdateBanner at top of app
// 2. A "Open Output Window" button in the toolbar
// 3. A "Open Teleprompter" button in the toolbar
// These call window.__ELECTRON_API__.openOutputWindow(roomCode)
//   and window.__ELECTRON_API__.openTeleprompterReader(roomCode)
```

---

## Phase 6 - Build Assets

### Create apps/electron/assets/

Create placeholder icon files. Claude Code should create these directories
and placeholder files. Real icons to be added manually:

```
apps/electron/assets/
  icon.ico        - Windows icon (256x256 minimum)
  icon.icns       - macOS icon
  icon.png        - Linux icon (512x512)
  tray-icon.png   - System tray icon (16x16 or 32x32, transparent background)
```

Create a 1x1 transparent PNG as placeholder for tray-icon.png using
a base64-encoded minimal PNG written to the file.

---

## Phase 7 - Build Scripts

### Update root package.json scripts

Add these scripts:

```json
"build:electron":       "pnpm --filter @showstack/web build && pnpm --filter @showstack/teleprompter-app build && pnpm --filter @showstack/electron build",
"build:electron:win":   "pnpm --filter @showstack/web build && pnpm --filter @showstack/teleprompter-app build && pnpm --filter @showstack/electron build:win",
"build:electron:mac":   "pnpm --filter @showstack/web build && pnpm --filter @showstack/teleprompter-app build && pnpm --filter @showstack/electron build:mac",
"dev:electron":         "NODE_ENV=development electron apps/electron/src/main.js"
```

### Local dev workflow with Electron

For development, run these in parallel:
1. `pnpm --filter @showstack/server dev` - local Express on port 9876
2. `pnpm --filter @showstack/web dev` - Vite on port 5173
3. `pnpm dev:electron` - Electron loading localhost:5173

Add a convenience script:
```json
"dev:electron:full": "concurrently \"pnpm --filter @showstack/server dev\" \"pnpm --filter @showstack/web dev\" \"sleep 3 && pnpm dev:electron\""
```

Install concurrently in root devDependencies if not already there.

---

## Phase 8 - CF API URL Configuration

### Create apps/electron/src/config.js

```js
// Configuration for the Electron app
// In production, reads from environment or falls back to defaults
// In development, always uses localhost

const isDev = process.env.NODE_ENV === 'development'

module.exports = {
  isDev,
  CF_API_URL: isDev ? 'http://localhost:9876' : (process.env.CF_API_URL || 'https://api.YOURDOMAIN.com'),
  CF_WS_URL:  isDev ? 'ws://localhost:9876'   : (process.env.CF_WS_URL  || 'wss://api.YOURDOMAIN.com'),
}
```

Import and use this in main.js instead of inline constants.

---

## Verification Checklist

Run every check. Do not mark done until each passes.

- [ ] `pnpm dev:electron` launches Electron in dev mode
- [ ] Electron loads http://localhost:5173 in dev (requires Vite running)
- [ ] window.__ELECTRON__ is true in renderer console
- [ ] window.__ELECTRON_API__.getConfig() returns correct apiUrl and wsUrl
- [ ] File picker opens native OS dialog when upload button clicked
- [ ] Selected file uploads successfully to CF R2 via the Worker API
- [ ] Open Output Window IPC creates a 1920x1080 frameless window
- [ ] Output window loads the countdown display correctly
- [ ] Open Teleprompter Reader IPC creates a fullscreen window
- [ ] Teleprompter reader window connects to correct room
- [ ] System tray icon appears and context menu works
- [ ] Minimize to tray hides the main window
- [ ] Double-clicking tray icon restores main window
- [ ] Timer play/pause syncs between Electron and a browser tab in same room
- [ ] Prompter scroll syncs between Electron controller and reader window
- [ ] `pnpm build:electron:win` produces an NSIS installer in apps/electron/dist-electron
- [ ] Installer runs and installs ShowStack on Windows
- [ ] Installed app connects to CF Worker API successfully
- [ ] Auto-updater checks for updates on launch (production build only)
- [ ] App version displays correctly in UI

---

## GitHub Actions - Auto Build and Release

Create .github/workflows/build-electron.yml:

```yaml
name: Build Electron App

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build UI
        run: |
          pnpm --filter @showstack/web build
          pnpm --filter @showstack/teleprompter-app build
        env:
          VITE_API_URL: https://api.YOURDOMAIN.com
          VITE_WS_URL: wss://api.YOURDOMAIN.com

      - name: Build Electron (Windows)
        if: matrix.os == 'windows-latest'
        run: pnpm --filter @showstack/electron build:win
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CF_API_URL: https://api.YOURDOMAIN.com
          CF_WS_URL: wss://api.YOURDOMAIN.com

      - name: Build Electron (macOS)
        if: matrix.os == 'macos-latest'
        run: pnpm --filter @showstack/electron build:mac
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CF_API_URL: https://api.YOURDOMAIN.com
          CF_WS_URL: wss://api.YOURDOMAIN.com

      - name: Build Electron (Linux)
        if: matrix.os == 'ubuntu-latest'
        run: pnpm --filter @showstack/electron build:linux
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          CF_API_URL: https://api.YOURDOMAIN.com
          CF_WS_URL: wss://api.YOURDOMAIN.com

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: showstack-${{ matrix.os }}
          path: apps/electron/dist-electron/
```

To trigger a release: `git tag v1.0.0 && git push origin v1.0.0`
GitHub Actions builds installers for all platforms and publishes to GitHub Releases.
Auto-updater in the installed app checks GitHub Releases for updates.

---

## Critical Notes

- Replace YOURDOMAIN.com with your actual domain everywhere before running.
- The local Express server (packages/server) is NOT spawned by Electron in production.
  In dev mode, you run it manually alongside Electron.
- All media upload in Electron goes through CF R2 via the Worker API.
  The readFileBase64 IPC handler converts local file paths to uploadable data.
- The output window (1920x1080) is designed to be captured by a screen capture card
  or used as a browser source in vMix/OBS via a virtual display.
- electron-builder requires specific icon formats per platform. Create real icons
  before building for distribution.
- Auto-update only works in production builds signed with a code signing certificate.
  For internal use, you can disable auto-update and distribute manually.
- contextIsolation must be true. Never set nodeIntegration to true.
- The Electron adapter reads CF API URL dynamically via IPC so you can change
  the CF Worker URL without rebuilding the Electron app (env vars in the main process).
