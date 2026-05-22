// Electron adapter — the preload script must expose window.__ELECTRON__:
// {
//   openFilePicker(options) → Promise<{ paths: string[], canceled: boolean }>
//   uploadAsset(filePath)   → Promise<Asset>   (main process reads + POSTs to server)
// }

import { uploadAsset as httpUpload } from './http.js';
export * from './http.js';

// Electron always talks to the local server regardless of the web SERVER_URL
export const getServerUrl = () => 'http://localhost:9876';

export async function openFilePicker(options = {}) {
  const result = await window.__ELECTRON__.openFilePicker(options);
  if (result.canceled || !result.paths?.length) return [];
  return result.paths;
}

export async function uploadAsset(fileOrPath) {
  if (typeof fileOrPath === 'string') {
    return window.__ELECTRON__.uploadAsset(fileOrPath);
  }
  // Fallback for File objects (e.g. drag-and-drop into the web view)
  return httpUpload(fileOrPath);
}
