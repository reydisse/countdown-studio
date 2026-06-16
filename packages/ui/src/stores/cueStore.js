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

// ── Scrub preview (plan mode) ────────────────────────────────────────────────
// While scrubbing, fired cue actions are replayed into the local stores only.
// AppShell skips the WS settings sync while `scrubAt` is non-null, so the
// live output and other clients never see preview state.

let scrubBaseline = null;

// Actions that are transient (sounds, animations) or control the shared
// timer — meaningless or harmful to replay while previewing.
const PREVIEW_SKIP = new Set([
  'PLAY_AUDIO', 'play_audio', 'TIMER_PLAY', 'TIMER_PAUSE',
  'FLASH_SCREEN', 'flash', 'ZOOM_IN', 'SLIDESHOW_NEXT', 'SLIDESHOW_PREV',
]);

function applyActionForPreview(action) {
  switch (action.type) {
    // Show the scrim's end state instantly — no animated transition
    case 'FADE_TO_BLACK':
    case 'CUT_TO_BLACK':
      useSettingsStore.setState({
        _scrimColor: action.payload?.color ?? '#000000',
        _scrimTransition: 0,
        _scrimOpacity: 1,
      });
      return;
    case 'FADE_FROM_BLACK':
    case 'CUT_FROM_BLACK':
      useSettingsStore.setState({ _scrimTransition: 0, _scrimOpacity: 0 });
      return;
    default:
      if (!PREVIEW_SKIP.has(action.type)) dispatchCueAction(action);
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useCueStore = create((set, get) => ({
  activeProjectId: null,
  cues: [], // Cue[] sorted by order_index
  scrubAt: null, // remaining-seconds the plan preview is parked at; null = live

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
    // Never let a live cue clobber the preview while scrubbing
    if (get().scrubAt !== null) return;
    for (const action of cue.actions ?? []) {
      dispatchCueAction(action);
    }
  },

  // ── Scrub preview ──────────────────────────────────────────────────────────
  scrubTo: (remaining) => {
    const settings = useSettingsStore.getState();
    if (scrubBaseline === null) {
      scrubBaseline = {};
      for (const [k, v] of Object.entries(settings)) {
        if (typeof v !== 'function') scrubBaseline[k] = v;
      }
    }
    // Reset to the pre-scrub baseline, then replay every cue that has
    // already fired by this point. Cues fire as `remaining` counts down to
    // `trigger_at`, so fired = trigger_at >= scrub position, in firing order.
    useSettingsStore.setState({
      ...scrubBaseline,
      _scrimTransition: 0,
      _previewRemaining: remaining,
    });
    const fired = get().cues
      .filter(c => c.trigger_at >= remaining)
      .sort((a, b) => b.trigger_at - a.trigger_at);
    for (const cue of fired) {
      for (const action of cue.actions ?? []) applyActionForPreview(action);
    }
    set({ scrubAt: remaining });
  },

  endScrub: () => {
    if (scrubBaseline !== null) {
      useSettingsStore.setState({ ...scrubBaseline, _previewRemaining: null });
      scrubBaseline = null;
    }
    set({ scrubAt: null });
  },

  // Exit scrub mode but KEEP the replayed cue state, then start the live
  // timer from the scrub position. The output looks exactly like the preview
  // did, and cues later in the plan still fire at their normal times.
  playFromScrub: () => {
    const at = get().scrubAt;
    if (at === null) return;
    scrubBaseline = null; // discard — preview state becomes the live state
    useSettingsStore.setState({ _previewRemaining: null });
    set({ scrubAt: null });
    useTimerStore.setState({ remaining: at, status: 'running' }); // optimistic; server tick confirms
    send('timer:seekAndPlay', { remaining: at });
  },
}));
