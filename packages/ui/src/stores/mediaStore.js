import { create } from 'zustand';
import { getRoomAssets, uploadRoomAsset, deleteRoomAsset } from '../adapter/index.js';
import { useRoomStore } from './roomStore.js';

// API rows use snake_case (thumbnail_url); components read camelCase.
const normalize = (a) => ({ ...a, thumbnailUrl: a.thumbnailUrl ?? a.thumbnail_url ?? null });

export const useMediaStore = create((set, get) => ({
  assets:    {}, // Record<id, Asset>
  uploading: false,
  error:     null,

  // ── Fetch ──────────────────────────────────────────────────────────────────
  fetchAll: async (type) => {
    const code = useRoomStore.getState().getRoomCode();
    if (!code) return;
    set({ error: null });
    try {
      const list   = await getRoomAssets(code, type);
      const assets = Object.fromEntries(list.map(a => [a.id, normalize(a)]));
      set({ assets });
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ── Upload ─────────────────────────────────────────────────────────────────
  upload: async (fileOrPath) => {
    const code = useRoomStore.getState().getRoomCode();
    if (!code) throw new Error('No active room');
    set({ uploading: true, error: null });
    try {
      const asset = normalize(await uploadRoomAsset(code, fileOrPath));
      set(state => ({ assets: { ...state.assets, [asset.id]: asset }, uploading: false }));
      return asset;
    } catch (err) {
      set({ uploading: false, error: err.message });
      throw err;
    }
  },

  // ── Remove ─────────────────────────────────────────────────────────────────
  remove: async (id) => {
    const code = useRoomStore.getState().getRoomCode();
    if (!code) throw new Error('No active room');
    const prev = get().assets;
    set(state => { const { [id]: _, ...rest } = state.assets; return { assets: rest }; });
    try {
      await deleteRoomAsset(code, id);
    } catch (err) {
      set({ assets: prev, error: err.message });
      throw err;
    }
  },

  // ── WS push handlers ───────────────────────────────────────────────────────
  _add:    (asset) => set(state => ({ assets: { ...state.assets, [asset.id]: normalize(asset) } })),
  _remove: (id)   => set(state => {
    const { [id]: _, ...rest } = state.assets;
    return { assets: rest };
  }),
}));
