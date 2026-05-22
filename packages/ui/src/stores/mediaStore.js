import { create } from 'zustand';
import { getAssets, uploadAsset as apiUpload, deleteAsset as apiDelete } from '../adapter/index.js';

export const useMediaStore = create((set, get) => ({
  assets:    {}, // Record<id, Asset>
  uploading: false,
  error:     null,

  // ── Fetch ──────────────────────────────────────────────────────────────────
  fetchAll: async (type) => {
    set({ error: null });
    try {
      const list = await getAssets(type);
      const assets = Object.fromEntries(list.map(a => [a.id, a]));
      set({ assets });
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ── Upload — file never stored in state, only the returned record ──────────
  upload: async (fileOrPath) => {
    set({ uploading: true, error: null });
    try {
      const asset = await apiUpload(fileOrPath);
      // Optimistic: add immediately. WS ASSET_ADDED will arrive shortly and be idempotent.
      set(state => ({ assets: { ...state.assets, [asset.id]: asset }, uploading: false }));
      return asset;
    } catch (err) {
      set({ uploading: false, error: err.message });
      throw err;
    }
  },

  // ── Remove ─────────────────────────────────────────────────────────────────
  remove: async (id) => {
    const prev = get().assets;
    set(state => { const { [id]: _, ...rest } = state.assets; return { assets: rest }; });
    try {
      await apiDelete(id);
    } catch (err) {
      set({ assets: prev, error: err.message }); // rollback
      throw err;
    }
  },

  // ── WS push handlers ───────────────────────────────────────────────────────
  _add:    (asset) => set(state => ({ assets: { ...state.assets, [asset.id]: asset } })),
  _remove: (id)   => set(state => {
    const { [id]: _, ...rest } = state.assets;
    return { assets: rest };
  }),
}));
