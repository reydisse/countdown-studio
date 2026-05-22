'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const PORT      = 9876;
const MEDIA_DIR = path.join(os.homedir(), 'ShowPilot', 'media');
const IS_DEV    = !app.isPackaged;

// ── Paths ─────────────────────────────────────────────────────────────────────
function serverEntry() {
  if (IS_DEV) {
    // apps/electron/src/main.js → ../../../packages/server/src/index.js
    return path.join(__dirname, '..', '..', '..', 'packages', 'server', 'src', 'index.js');
  }
  return path.join(process.resourcesPath, 'server', 'index.js');
}

// ── Server child process ──────────────────────────────────────────────────────
let serverProc = null;

function startServer() {
  return new Promise((resolve, reject) => {
    serverProc = spawn(process.execPath, [serverEntry()], {
      env: {
        ...process.env,
        NODE_ENV:            IS_DEV ? 'development' : 'production',
        SHOWPILOT_MEDIA_DIR: MEDIA_DIR,
        PORT:                String(PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProc.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('READY')) resolve();
    });

    serverProc.stderr.on('data', (chunk) => {
      console.error('[server]', chunk.toString().trimEnd());
    });

    serverProc.on('error', reject);
    serverProc.on('exit', (code) => {
      if (code !== 0 && code !== null) console.error(`[server] exited with code ${code}`);
    });

    setTimeout(() => reject(new Error('Server startup timed out')), 20_000);
  });
}

// ── Window ────────────────────────────────────────────────────────────────────
let mainWindow = null;

async function loadWithRetry(win, url, attempts = 25, delay = 400) {
  for (let i = 0; i < attempts; i++) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(800) });
      win.loadURL(url);
      return;
    } catch {
      await new Promise(r => setTimeout(r, delay));
    }
  }
  win.loadURL(url); // final attempt regardless
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1440,
    height: 900,
    minWidth:  1024,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#181614',
    show: false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
  });

  const appUrl = IS_DEV
    ? 'http://localhost:5173'
    : `http://localhost:${PORT}`;

  loadWithRetry(mainWindow, appUrl);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (IS_DEV) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
const MIME_MAP = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png':  'image/png',
  '.gif': 'image/gif',  '.webp': 'image/webp', '.svg':  'image/svg+xml',
  '.mp4': 'video/mp4',  '.mov':  'video/quicktime', '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg', '.wav':  'audio/wav',  '.ogg':  'audio/ogg',
  '.m4a': 'audio/mp4',  '.aac':  'audio/aac',  '.flac': 'audio/flac',
};

function parseFilters(accept = '') {
  if (!accept) return [];
  const exts = [];
  for (const part of accept.split(',').map(s => s.trim())) {
    if (part === 'image/*') exts.push('jpg','jpeg','png','gif','webp','svg');
    else if (part === 'video/*') exts.push('mp4','mov','webm','avi');
    else if (part === 'audio/*') exts.push('mp3','wav','ogg','m4a','aac','flac');
    else if (part.includes('/')) exts.push(part.split('/')[1].replace('jpeg','jpg'));
  }
  return exts.length ? [{ name: 'Media Files', extensions: exts }] : [];
}

ipcMain.handle('dialog:open-file', async (_event, options = {}) => {
  const props = ['openFile'];
  if (options.multiple) props.push('multiSelections');

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: props,
    filters:    parseFilters(options.accept),
  });

  return { paths: result.filePaths, canceled: result.canceled };
});

ipcMain.handle('media:upload', async (_event, filePath) => {
  const buffer   = fs.readFileSync(filePath);
  const ext      = path.extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext] ?? 'application/octet-stream';
  const filename = path.basename(filePath);

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: mimeType }), filename);

  const res = await fetch(`http://localhost:${PORT}/api/assets`, {
    method: 'POST',
    body:   formData,
  });
  return res.json();
});

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (err) {
    console.error('Failed to start server:', err.message);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (serverProc) {
    serverProc.kill('SIGTERM');
    serverProc = null;
  }
});
