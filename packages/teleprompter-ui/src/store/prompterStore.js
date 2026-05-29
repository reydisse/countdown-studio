import { create } from 'zustand';

const API = import.meta.env.VITE_API_URL || '';

let _send = () => {};
export function _setSend(fn) { _send = fn; }
export function send(type, payload = {}) { _send(type, payload); }

export const usePrompterStore = create((set, get) => ({
  room:           null,
  joined:         false,
  wsConnected:    false,

  scripts:        [],
  activeScriptId: null,
  content:        '',

  scrollPosition: 0,
  isPlaying:      false,
  speed:          3,
  totalHeight:    0,

  fontSize:           48,
  lineWidth:          70,
  fontFamily:         'dm-sans',
  textColor:          '#ffffff',
  bgColor:            '#000000',
  isMirrored:         false,
  isFlippedVertical:  false,
  showFocusLine:      true,
  focusLinePosition:  40,

  cues: [],

  setRoom: (room) => {
    sessionStorage.setItem('showstack_prompter_room', room.code);
    set({ room });
  },

  setJoined: (state) => {
    set({ joined: state.joined ?? true });
    if (state.prompter) {
      const { scrollPosition, isPlaying, speed, totalHeight,
              fontSize, lineWidth, fontFamily, textColor, bgColor,
              isMirrored, isFlippedVertical, showFocusLine, focusLinePosition } = state.prompter;
      set({ scrollPosition, isPlaying, speed, totalHeight,
            fontSize, lineWidth, fontFamily, textColor, bgColor,
            isMirrored, isFlippedVertical, showFocusLine, focusLinePosition });
    }
  },

  leaveRoom: () => {
    sessionStorage.removeItem('showstack_prompter_room');
    set({ room: null, joined: false, wsConnected: false, scripts: [], content: '' });
  },

  initialize: async () => {
    const code = sessionStorage.getItem('showstack_prompter_room');
    if (!code) return;
    try {
      const res = await fetch(`${API}/api/rooms/${code}`);
      if (res.ok) set({ room: await res.json() });
      else sessionStorage.removeItem('showstack_prompter_room');
    } catch {
      sessionStorage.removeItem('showstack_prompter_room');
    }
  },

  loadScripts: async () => {
    const code = get().room?.code;
    if (!code) return;
    const res = await fetch(`${API}/api/rooms/${code}/scripts`);
    if (!res.ok) return;
    let scripts = await res.json();

    // Auto-create a default script so the editor always has somewhere to save
    if (scripts.length === 0) {
      const created = await fetch(`${API}/api/rooms/${code}/scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Script 1', content: '' }),
      });
      if (created.ok) scripts = [await created.json()];
    }

    set({ scripts });
    const { activeScriptId } = get();
    const target = scripts.find(s => s.id === activeScriptId) ?? scripts[0] ?? null;
    if (target) get().setActiveScript(target.id, target.content);
  },

  setActiveScript: (id, content) => set({ activeScriptId: id, content: content ?? '' }),

  updateContent: (text) => set({ content: text }),

  saveScript: async () => {
    const { room, activeScriptId, content, scripts } = get();
    if (!room) return;
    if (!activeScriptId) {
      // No script yet — create one then save
      await get().loadScripts();
      if (!get().activeScriptId) return;
    }
    const res = await fetch(`${API}/api/rooms/${room.code}/scripts/${activeScriptId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      const updated = await res.json();
      set({ scripts: scripts.map(s => s.id === updated.id ? updated : s) });
    }
  },

  createScript: async (name) => {
    const code = get().room?.code;
    if (!code || !name) return;
    const res = await fetch(`${API}/api/rooms/${code}/scripts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content: '' }),
    });
    if (!res.ok) return;
    const script = await res.json();
    set(state => ({ scripts: [...state.scripts, script] }));
    get().setActiveScript(script.id, '');
  },

  deleteScript: async (id) => {
    const code = get().room?.code;
    if (!code) return;
    await fetch(`${API}/api/rooms/${code}/scripts/${id}`, { method: 'DELETE' });
    const remaining = get().scripts.filter(s => s.id !== id);
    const next      = remaining[0] ?? null;
    set({ scripts: remaining, activeScriptId: next?.id ?? null, content: next?.content ?? '' });
  },

  play:     () => send('prompter:play'),
  pause:    () => send('prompter:pause'),
  stop:     () => send('prompter:stop'),
  setSpeed: (v) => send('prompter:speed', { speed: v }),
  seekTo:   (p) => send('prompter:seek',  { position: p }),

  updateDisplay: (patch) => {
    set(patch);
    send('prompter:settings', { ...get(), ...patch });
  },

  reportHeight: (totalHeight) => {
    set({ totalHeight });
    send('prompter:settings', { totalHeight });
  },

  _applyTick:    (payload) => set({ scrollPosition: payload.scrollPosition, isPlaying: payload.isPlaying, speed: payload.speed }),
  _applyDisplay: (payload) => set(payload),

  addCue: (label, position) => {
    const id    = `cue_${Date.now()}`;
    const color = ['#e8a838', '#34d48a', '#f5464a', '#60a5fa'][get().cues.length % 4];
    set(state => ({ cues: [...state.cues, { id, label, position, color }] }));
  },
  removeCue: (id) => set(state => ({ cues: state.cues.filter(c => c.id !== id) })),
  jumpToCue: (id) => {
    const cue = get().cues.find(c => c.id === id);
    if (cue) get().seekTo(cue.position);
  },
}));
