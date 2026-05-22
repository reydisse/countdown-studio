'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

const PORT = 9876;
// In production set SERVER_BASE_URL=https://countdown.yourdomain.com
// so asset URLs stored in the DB match the public host.
const MEDIA_BASE_URL = process.env.SERVER_BASE_URL
  ? `${process.env.SERVER_BASE_URL}/media`
  : `http://localhost:${PORT}/media`;

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
  return `${MEDIA_BASE_URL}/${relPath}`;
}

module.exports = { resolveMediaDir, resolveDataDir, ensureDirs, getUrl };
