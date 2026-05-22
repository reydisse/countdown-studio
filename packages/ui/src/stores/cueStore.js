import { create } from 'zustand';
import { send } from '../wsClient.js';
import { useSettingsStore } from './settingsStore.js';
import { useMediaStore }    from './mediaStore.js';
import { useTimerStore }    from './timerStore.js';

const LOAD_PROJECT = 'project:load';
const FIRE_CUE     = 'cue:fire';

// ── Action dispatcher ────────────────────────────────────────────────────────
// Interprets the actions_json array on a fired cue and fans out to the
// appropriate store or browser API. Add new action types here as needed.

function dispatchCueAction(action) {
  const settings = useSettingsStore.getState();

  switch (action.type) {
    case 'set_bg_color':
      settings.update({ bgMode: 'color', bgColor: action.color });
      break;
    case 'set_bg_image':
      settings.update({ bgMode: 'image', bgAssetId: action.assetId });
      break;
    case 'set_bg_video':
      settings.update({ bgMode: 'video', bgAssetId: action.assetId });
      break;
    case 'set_overlay_text':
      settings.update({ overlayText: action.text, overlayEnabled: true });
      break;
    case 'show_overlay':
      settings.update({ overlayEnabled: true });
      break;
    case 'hide_overlay':
      settings.update({ overlayEnabled: false });
      break;
    case 'set_label_main':
      settings.update({ labelMain: action.text });
      break;
    case 'set_label_sub':
      settings.update({ labelSub: action.text });
      break;
    case 'play_audio': {
      const asset = useMediaStore.getState().assets[action.assetId];
      if (asset?.url) {
        const audio = new Audio(asset.url);
        audio.play().catch(() => {});
      }
      break;
    }
    case 'flash':
      settings.triggerFlash();
      break;

    // ── CueEditor action types (UPPER_CASE) ──────────────────────────────
    case 'SWAP_BG': {
      const { assetId } = action.payload || {};
      if (assetId) settings.update({ bgAssetId: assetId, bgMode: useMediaStore.getState().assets[assetId]?.type === 'video' ? 'video' : 'image' });
      break;
    }
    case 'PLAY_AUDIO': {
      const asset = useMediaStore.getState().assets[action.payload?.assetId];
      if (asset?.url) {
        const a = new Audio(asset.url);
        a.volume = Math.max(0, Math.min(1, (action.payload?.volume ?? 80) / 100));
        a.play().catch(() => {});
      }
      break;
    }
    case 'SET_LABEL': {
      const { main = '', sub = '' } = action.payload || {};
      settings.update({ labelMain: main, labelSub: sub, labelEnabled: true });
      break;
    }
    case 'SET_OVERLAY': {
      const { text = '', overlayEnabled = true } = action.payload || {};
      settings.update({ overlayText: text, overlayEnabled });
      break;
    }
    case 'SWAP_LOGO': {
      const { assetId, position, size } = action.payload || {};
      if (assetId) settings.update({
        logoAssetId:  assetId,
        ...(position && { logoPosition: position }),
        ...(size      && { logoSize: size }),
      });
      break;
    }
    case 'TOGGLE_EFFECT': {
      const { effect, enabled } = action.payload || {};
      if (effect === 'vignette')  settings.update({ vignetteEnabled:  !!enabled });
      if (effect === 'scanlines') settings.update({ scanlinesEnabled: !!enabled });
      if (effect === 'blink')     settings.update({ blinkSeparator:   !!enabled });
      if (effect === 'flash')     settings.update({ warnFlashEnabled: !!enabled });
      break;
    }
    case 'FLASH_SCREEN':
      settings.triggerFlash();
      break;
    case 'ZOOM_IN': {
      const { scale = 1.8, duration = 1500 } = action.payload || {};
      settings.triggerZoom(scale, duration);
      break;
    }

    // ── Scrim / black-out actions ─────────────────────────────────────────
    case 'FADE_TO_BLACK': {
      const { duration = 1500, color = '#000000' } = action.payload || {};
      useSettingsStore.setState({ _scrimColor: color, _scrimTransition: duration, _scrimOpacity: 1 });
      break;
    }
    case 'FADE_FROM_BLACK': {
      const { duration = 1500 } = action.payload || {};
      // Jump to black instantly, then fade to clear
      useSettingsStore.setState({ _scrimOpacity: 1, _scrimTransition: 0 });
      setTimeout(() => useSettingsStore.setState({ _scrimTransition: duration, _scrimOpacity: 0 }), 32);
      break;
    }
    case 'CUT_TO_BLACK': {
      const { color = '#000000' } = action.payload || {};
      useSettingsStore.setState({ _scrimColor: color, _scrimTransition: 0, _scrimOpacity: 1 });
      break;
    }
    case 'CUT_FROM_BLACK':
      useSettingsStore.setState({ _scrimTransition: 0, _scrimOpacity: 0 });
      break;

    // ── Logo ─────────────────────────────────────────────────────────────
    case 'SHOW_LOGO':
      useSettingsStore.getState().update({ logoVisible: true });
      break;
    case 'HIDE_LOGO':
      useSettingsStore.getState().update({ logoVisible: false });
      break;

    // ── Background colour ────────────────────────────────────────────────
    case 'SET_BG_COLOR':
      useSettingsStore.getState().update({ bgMode: 'color', bgColor: action.payload?.color ?? '#181614' });
      break;

    // ── Slideshow navigation ─────────────────────────────────────────────
    case 'SLIDESHOW_NEXT': {
      const { _slideshowGoTo, _slideshowActiveIndex, _slideshowCount } = useSettingsStore.getState();
      if (_slideshowGoTo && _slideshowCount > 1)
        _slideshowGoTo((_slideshowActiveIndex + 1) % _slideshowCount);
      break;
    }
    case 'SLIDESHOW_PREV': {
      const { _slideshowGoTo, _slideshowActiveIndex, _slideshowCount } = useSettingsStore.getState();
      if (_slideshowGoTo && _slideshowCount > 1)
        _slideshowGoTo((_slideshowActiveIndex - 1 + _slideshowCount) % _slideshowCount);
      break;
    }

    // ── Timer control ────────────────────────────────────────────────────
    case 'TIMER_PLAY':
      useTimerStore.getState().play();
      break;
    case 'TIMER_PAUSE':
      useTimerStore.getState().pause();
      break;

    default:
      break;
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useCueStore = create((set, get) => ({
  activeProjectId: null,
  cues: [], // Cue[] sorted by order_index

  // ── Load project — syncs server cueEngine and local state ─────────────────
  load: (projectId) => {
    set({ activeProjectId: projectId, cues: [] });
    send(LOAD_PROJECT, { projectId });
  },

  // ── Local cue list management (populated from API / WS by the consumer) ───
  setCues: (cues) => set({ cues }),

  add: (cue) =>
    set(state => ({
      cues: [...state.cues, cue].sort((a, b) => a.order_index - b.order_index),
    })),

  update: (id, changes) =>
    set(state => ({
      cues: state.cues.map(c => (c.id === id ? { ...c, ...changes } : c)),
    })),

  remove: (id) =>
    set(state => ({ cues: state.cues.filter(c => c.id !== id) })),

  // ── Manual fire — sends to server which broadcasts CUE_FIRED ──────────────
  fireCue: (cue) => send(FIRE_CUE, { cue }),

  // ── Called by useWebSocket on SERVER_EVENTS.CUE_FIRED ─────────────────────
  executeCueActions: (cue) => {
    for (const action of cue.actions ?? []) {
      dispatchCueAction(action);
    }
  },
}));
