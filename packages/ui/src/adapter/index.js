// Detect runtime and re-export the correct adapter.
// All named exports are identical across adapters so callers stay env-agnostic.

import * as webAdapter      from './web.js';
import * as electronAdapter from './electron.js';

const isElectron = typeof window !== 'undefined' && !!window.__ELECTRON__;
const adapter    = isElectron ? electronAdapter : webAdapter;

export const {
  getServerUrl,
  getProjects,
  getProject,
  saveProject,
  deleteProject,
  getAssets,
  uploadAsset,
  deleteAsset,
  openFilePicker,
  getCues,
  createCue,
  updateCue,
  deleteCue,
} = adapter;

// Room-scoped APIs come directly from http.js — shared between web and Electron.
export {
  createRoom,
  getRoom,
  getRoomAssets,
  uploadRoomAsset,
  deleteRoomAsset,
  getRoomCues,
  createRoomCue,
  updateRoomCue,
  deleteRoomCue,
  saveRoomSettings,
} from './http.js';
