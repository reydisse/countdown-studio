import { create } from 'zustand';
import { saveProject } from '../adapter/index.js';

const DEFAULTS = {
  // ── Background ───────────────────────────────────────────────────────────
  bgMode:             'color',     // 'color' | 'image' | 'video' | 'slideshow'
  bgColor:            '#181614',
  bgAssetId:          null,
  imageSize:          'cover',     // 'cover' | 'contain'
  videoMuted:         true,
  videoLoop:          true,
  slideshowAssetIds:  [],
  slideshowTransition:'fade',      // 'fade'|'zoom'|'slide'|'cut'|'kenburns'|'crossfade'
  slideshowInterval:  5000,        // ms
  slideshowSize:      'cover',

  // ── Theme ─────────────────────────────────────────────────────────────────
  theme: 'dark',

  // ── Overlay ───────────────────────────────────────────────────────────────
  overlayEnabled:  false,
  overlayText:     '',
  overlayAssetId:  null,

  // ── Logo ──────────────────────────────────────────────────────────────────
  logoAssetId:  null,
  logoPosition: 'top-right',  // 'top-left'|'top-center'|'top-right'|'bottom-left'|'bottom-center'|'bottom-right'
  logoSize:     80,           // px
  logoVisible:  true,

  // ── Labels ────────────────────────────────────────────────────────────────
  labelMain:    '',
  labelSub:     '',
  labelEnabled: true,

  // ── Typography ────────────────────────────────────────────────────────────
  font:      'display',      // 'display' | 'sans' | 'mono'
  textColor: '#f0ede8',
  textSize:  100,            // percentage (50–200)

  // ── Effects ───────────────────────────────────────────────────────────────
  effects: {
    flashOnCue: false,
    pulse:      false,
    glow:       false,
  },
  vignetteEnabled:   false,
  vignetteIntensity: 40,     // 0–100
  scanlinesEnabled:  false,
  scanlinesIntensity:30,     // 0–100
  blinkSeparator:    false,
  warnFlashEnabled:  false,
  warnThreshold:     30,     // seconds
  dangerThreshold:   10,     // seconds

  // ── Timer end behaviour ───────────────────────────────────────────────────
  endBehavior: 'hold',   // 'hold' | 'fadeout' | 'loop'

  // ── Runtime-only (not persisted) ─────────────────────────────────────────
  _flashCount:          0,
  _slideshowActiveIndex:0,
  _slideshowCount:      0,
  _slideshowGoTo:       null,  // (idx: number) => void — set by SlideshowLayer
  // Scrim (black-out) layer — driven by cue actions
  _scrimOpacity:    0,
  _scrimColor:      '#000000',
  _scrimTransition: 0,   // ms
  // Zoom-in ease-out — driven by ZOOM_IN cue action
  _zoomCount:    0,   // incremented to trigger the animation
  _zoomScale:    1.8, // starting scale multiplier
  _zoomDuration: 2000,// ms
};

// Keys excluded from project persistence
const RUNTIME_KEYS = new Set([
  '_flashCount', '_slideshowActiveIndex', '_slideshowCount', '_slideshowGoTo',
  '_scrimOpacity', '_scrimColor', '_scrimTransition',
  '_zoomCount', '_zoomScale', '_zoomDuration',
]);

export const useSettingsStore = create((set, get) => ({
  ...DEFAULTS,

  update:        (partial) => set(partial),
  updateEffects: (partial) => set(state => ({ effects: { ...state.effects, ...partial } })),
  triggerFlash:  () => set(state => ({ _flashCount: state._flashCount + 1 })),
  triggerZoom:   (scale, duration) => set(state => ({
    _zoomCount:    state._zoomCount + 1,
    _zoomScale:    scale    ?? 1.8,
    _zoomDuration: duration ?? 1500,
  })),

  // Called when settings arrive from another studio window via WS.
  // Applies only the known settings fields — ignores the resolved URL fields
  // (bgAssetUrl, slideshowUrls, etc.) that AppShell adds for the output page.
  applyFromServer: (payload) => {
    const known = Object.fromEntries(
      Object.entries(payload).filter(([k]) => k in DEFAULTS && !k.startsWith('_'))
    );
    if (Object.keys(known).length) set(known);
  },

  loadFromProject: (project) => {
    if (!project.settings) return;
    set({ ...DEFAULTS, ...project.settings });
  },

  saveToProject: async (projectId) => {
    const state = get();
    const settings = Object.fromEntries(
      Object.entries(state).filter(([k]) =>
        !RUNTIME_KEYS.has(k) && typeof state[k] !== 'function'
      )
    );
    await saveProject({ id: projectId, settings });
  },

  reset: () => set({ ...DEFAULTS }),
}));
