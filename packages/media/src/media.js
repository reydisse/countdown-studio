'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

// Media URLs are stored as root-relative paths (/media/...) so they resolve
// against whatever domain the app is hosted on without any env var required.
// In dev Vite proxies /media → localhost:9876 (see apps/web/vite.config.ts).
const PORT = 9876; // kept for reference, no longer used in URLs

function resolveMediaDir() {
  // Electron passes this env var so both dev and packaged builds write to the same place
  if (process.env.SHOWPILOT_MEDIA_DIR) return process.env.SHOWPILOT_MEDIA_DIR;
  if (process.env.NODE_ENV === 'production') {
    return path.join(os.homedir(), 'ShowPilot', 'media');
  }
  return path.resolve(process.cwd(), 'data', 'media');
}

// Parent of the media dir — where countdown.db also lives.
function resolveDataDir() {
  return path.dirname(resolveMediaDir());
}

function ensureDirs() {
  const base = resolveMediaDir();
  for (const sub of ['images', 'videos', 'audio', 'thumbs']) {
    fs.mkdirSync(path.join(base, sub), { recursive: true });
  }
  return base;
}

function getUrl(relPath) {
  return `/media/${relPath}`;
}

module.exports = { resolveMediaDir, resolveDataDir, ensureDirs, getUrl };
