# Teleprompter — ShowStack

> **How to use this file:**
> Open Claude Code inside the `showstack` folder and say:
> "Read TELEPROMPTER.md and build the teleprompter app exactly as specified. Do not skip anything."

---

## Context

A standalone broadcast teleprompter added to the **showstack** monorepo as its own Vite app and UI package. It shares the existing server, database, room system, and WebSocket infrastructure. The TD (technical director) opens the controller view and operates the prompter; the speaker or display screen opens the reader URL and sees a smooth, server-driven scroll.

Do not modify any existing packages beyond what is explicitly listed in this document. Every change to existing files is spelled out in full.

---

## Monorepo Structure — New Files

```
apps/
  teleprompter/
    index.html
    vite.config.ts
    package.json
    src/
      main.tsx

packages/
  teleprompter-ui/
    package.json
    tailwind.config.js
    postcss.config.js
    src/
      index.js
      App.jsx
      components/
        shared/
          RoomGate.jsx
          TopBar.jsx
          Toast.jsx
        reader/
          ReaderView.jsx
          FocusLine.jsx
          CueMarker.jsx
        controller/
          ControllerView.jsx
          ScriptEditor.jsx
          SpeedControl.jsx
          CueList.jsx
          ScriptImporter.jsx
      store/
        prompterStore.js
      hooks/
        usePrompterWS.js
        useScrollEngine.js
      utils/
        scriptParser.js
        exportScript.js
```

---

## Phase 1 — Scaffold

### `apps/teleprompter/package.json`

```json
{
  "name": "@showstack/teleprompter-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev":     "vite",
    "build":   "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@showstack/teleprompter-ui": "workspace:*",
    "react":        "^18.3.1",
    "react-dom":    "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.11"
  }
}
```

### `apps/teleprompter/vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/teleprompter/',
  resolve: {
    alias: {
      '@showstack/teleprompter-ui': path.resolve(__dirname, '../../packages/teleprompter-ui/src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api':   { target: 'http://localhost:9876', changeOrigin: true },
      '/media': { target: 'http://localhost:9876', changeOrigin: true },
    },
  },
  css: {
    postcss: path.resolve(__dirname, '../../packages/teleprompter-ui/postcss.config.js'),
  },
});
```

### `apps/teleprompter/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Teleprompter — ShowStack</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,400&family=DM+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `apps/teleprompter/src/main.tsx`

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@showstack/teleprompter-ui/App';
import '@showstack/teleprompter-ui/index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/teleprompter">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

### `packages/teleprompter-ui/package.json`

```json
{
  "name": "@showstack/teleprompter-ui",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.js",
  "exports": {
    ".":           "./src/index.js",
    "./App":       "./src/App.jsx",
    "./index.css": "./src/index.css"
  },
  "scripts": {
    "build": "echo 'no build step'",
    "lint":  "echo 'no lint step'"
  },
  "dependencies": {
    "react":             "^18.3.1",
    "react-dom":         "^18.3.1",
    "react-router-dom":  "^6.28.0",
    "zustand":           "^5.0.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer":         "^10.4.20",
    "postcss":              "^8.5.1",
    "tailwindcss":          "^3.4.17",
    "typescript":           "^5.7.0"
  }
}
```

### `packages/teleprompter-ui/tailwind.config.js`

Copy verbatim from `packages/ui/tailwind.config.js`. Both apps must share the same design token system — identical surface, text, accent, border, and status colors.

### `packages/teleprompter-ui/postcss.config.js`

```js
module.exports = {
  plugins: {
    tailwindcss: { config: require('./tailwind.config.js') },
    autoprefixer: {},
  },
};
```

### `packages/teleprompter-ui/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: 'DM Sans', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.font-reader { font-family: 'DM Sans', sans-serif; }
.font-reader-mono { font-family: 'DM Mono', monospace; }
```

### `packages/teleprompter-ui/src/index.js`

```js
export { default as App }            from './App.jsx';
export { usePrompterStore }          from './store/prompterStore.js';
export { usePrompterWS }             from './hooks/usePrompterWS.js';
export { useScrollEngine }           from './hooks/useScrollEngine.js';
export { parseScript }               from './utils/scriptParser.js';
export { exportScript }              from './utils/exportScript.js';
export { ReaderView }                from './components/reader/ReaderView.jsx';
export { ControllerView }            from './components/controller/ControllerView.jsx';
```

### Update `turbo.json`

Add `@showstack/teleprompter-app` to the build pipeline. The existing tasks config already covers all workspaces via glob, so no change is needed if `tasks` already covers all packages. Verify by running `pnpm build` — if `teleprompter-app` is missing, add it explicitly:

```json
"build": {
  "dependsOn": ["^build"],
  "outputs": ["dist/**", "release/**"]
}
```

---

## Phase 2 — WebSocket Events and Prompter Engine

### Add to `packages/shared/src/events.js`

Extend the existing CLIENT_EVENTS and SERVER_EVENTS objects with these keys:

```js
// Add to CLIENT_EVENTS:
PROMPTER_PLAY:     'prompter:play',
PROMPTER_PAUSE:    'prompter:pause',
PROMPTER_STOP:     'prompter:stop',
PROMPTER_SPEED:    'prompter:speed',      // payload: { speed: 1–10 }
PROMPTER_SEEK:     'prompter:seek',       // payload: { position: pixels }
PROMPTER_SETTINGS: 'prompter:settings',   // payload: { totalHeight, fontSize, ... }

// Add to SERVER_EVENTS:
PROMPTER_STATE:    'prompter:state',      // full state snapshot on join
PROMPTER_TICK:     'prompter:tick',       // { scrollPosition, isPlaying, speed }
```

### `packages/server/src/prompterEngine.js` — new file

```js
'use strict';

const { SERVER_EVENTS } = require('@showstack/shared');

const TICK_INTERVAL_MS = 50; // 20fps
const SPEED_SCALE = [0, 20, 40, 65, 90, 120, 155, 195, 240, 270, 300]; // index = speed 0–10

function createPrompterEngine(broadcast) {
  let scrollPosition = 0;
  let totalHeight    = 0;
  let isPlaying      = false;
  let speed          = 3;
  let _interval      = null;

  // Display settings — broadcast to readers on change
  const displaySettings = {
    fontSize:           48,
    lineWidth:          70,
    fontFamily:         'dm-sans',
    textColor:          '#f0ede8',
    bgColor:            '#000000',
    isMirrored:         false,
    isFlippedVertical:  false,
    showFocusLine:      true,
    focusLinePosition:  40,
  };

  function pxPerTick() {
    return (SPEED_SCALE[speed] ?? 100) / (1000 / TICK_INTERVAL_MS);
  }

  function tick() {
    if (!isPlaying) return;
    scrollPosition = Math.min(scrollPosition + pxPerTick(), Math.max(0, totalHeight));
    broadcast(SERVER_EVENTS.PROMPTER_TICK, { scrollPosition, isPlaying, speed });
    if (totalHeight > 0 && scrollPosition >= totalHeight) {
      pause();
    }
  }

  function play() {
    if (isPlaying || (totalHeight > 0 && scrollPosition >= totalHeight)) return;
    isPlaying = true;
    _interval = setInterval(tick, TICK_INTERVAL_MS);
    broadcast(SERVER_EVENTS.PROMPTER_TICK, { scrollPosition, isPlaying, speed });
  }

  function pause() {
    if (!isPlaying) return;
    clearInterval(_interval);
    _interval = null;
    isPlaying = false;
    broadcast(SERVER_EVENTS.PROMPTER_TICK, { scrollPosition, isPlaying, speed });
  }

  function stop() {
    clearInterval(_interval);
    _interval = null;
    isPlaying      = false;
    scrollPosition = 0;
    broadcast(SERVER_EVENTS.PROMPTER_TICK, { scrollPosition, isPlaying, speed });
  }

  function setSpeed(s) {
    speed = Math.max(1, Math.min(10, Number(s)));
    broadcast(SERVER_EVENTS.PROMPTER_TICK, { scrollPosition, isPlaying, speed });
  }

  function seekTo(position) {
    scrollPosition = Math.max(0, Math.min(Number(position), Math.max(0, totalHeight)));
    broadcast(SERVER_EVENTS.PROMPTER_TICK, { scrollPosition, isPlaying, speed });
  }

  function applySettings(patch) {
    Object.assign(displaySettings, patch);
    if (patch.totalHeight !== undefined) totalHeight = patch.totalHeight;
    broadcast('prompter:display', { ...displaySettings });
  }

  function getState() {
    return { scrollPosition, isPlaying, speed, totalHeight, ...displaySettings };
  }

  function destroy() {
    clearInterval(_interval);
    _interval = null;
  }

  return { play, pause, stop, setSpeed, seekTo, applySettings, getState, destroy };
}

module.exports = { createPrompterEngine };
```

### Update `packages/server/src/roomEngine.js`

Import and create a prompter engine alongside timer/cue/settings:

Change the top of the file to also require `prompterEngine`:

```js
const { createPrompterEngine } = require('./prompterEngine');
```

Then inside `createRoomEngine`, add:

```js
const prompter = createPrompterEngine(broadcast);
```

And return it:

```js
return { timer, cue, settings, prompter };
```

### Update `packages/server/src/index.js` — WS message handler

Inside the `switch (type)` block in the WS message handler, add these cases after the existing timer/settings cases:

```js
case CLIENT_EVENTS.PROMPTER_PLAY:
  engine.prompter.play();
  break;
case CLIENT_EVENTS.PROMPTER_PAUSE:
  engine.prompter.pause();
  break;
case CLIENT_EVENTS.PROMPTER_STOP:
  engine.prompter.stop();
  break;
case CLIENT_EVENTS.PROMPTER_SPEED:
  if (typeof payload.speed === 'number') engine.prompter.setSpeed(payload.speed);
  break;
case CLIENT_EVENTS.PROMPTER_SEEK:
  if (typeof payload.position === 'number') engine.prompter.seekTo(payload.position);
  break;
case CLIENT_EVENTS.PROMPTER_SETTINGS:
  engine.prompter.applySettings(payload);
  broadcast.broadcastToRoomExcept(roomCode, socket, 'prompter:display', engine.prompter.getState());
  break;
```

Also update the `ROOM_JOINED` payload to include prompter state:

```js
broadcast.send(socket, SERVER_EVENTS.ROOM_JOINED, {
  room,
  timer:    engine.timer.getState(),
  settings: engine.settings.get(),
  cues:     roomDb.listCues(code),
  prompter: engine.prompter.getState(),   // ADD THIS LINE
});
```

Also update `engine.timer.destroy()` call in `scheduleEngineCleanup` to also destroy the prompter:

```js
if (eng) {
  eng.timer.destroy();
  eng.prompter.destroy();
}
```

---

## Phase 3 — Store and Hooks

### `packages/teleprompter-ui/src/store/prompterStore.js`

```js
import { create } from 'zustand';

// WebSocket send singleton — same pattern as countdown's wsClient.js
let _send = () => {};
export function _setSend(fn) { _send = fn; }
export function send(type, payload = {}) { _send(type, payload); }

export const usePrompterStore = create((set, get) => ({
  // ── Room ──────────────────────────────────────────────────────────────────
  room:           null,
  joined:         false,

  // ── Scripts ───────────────────────────────────────────────────────────────
  scripts:        [],
  activeScriptId: null,
  content:        '',       // content of active script (local edit state)

  // ── Scroll state (server-driven) ──────────────────────────────────────────
  scrollPosition: 0,
  isPlaying:      false,
  speed:          3,
  totalHeight:    0,

  // ── Display settings (synced to all clients) ──────────────────────────────
  fontSize:           48,
  lineWidth:          70,
  fontFamily:         'dm-sans',
  textColor:          '#f0ede8',
  bgColor:            '#000000',
  isMirrored:         false,
  isFlippedVertical:  false,
  showFocusLine:      true,
  focusLinePosition:  40,

  // ── Cues ──────────────────────────────────────────────────────────────────
  cues:          [],   // { id, label, position, color }

  // ── Room ──────────────────────────────────────────────────────────────────
  setRoom: (room) => {
    sessionStorage.setItem('showstack_prompter_room', room.code);
    set({ room });
  },

  setJoined: (state) => {
    set({ joined: state.joined ?? true });
    // Seed scroll + display state from server
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
    set({ room: null, joined: false, scripts: [], content: '' });
  },

  initialize: async () => {
    const code = sessionStorage.getItem('showstack_prompter_room');
    if (!code) return;
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (res.ok) set({ room: await res.json() });
      else sessionStorage.removeItem('showstack_prompter_room');
    } catch {
      sessionStorage.removeItem('showstack_prompter_room');
    }
  },

  // ── Scripts ───────────────────────────────────────────────────────────────
  loadScripts: async () => {
    const code = get().room?.code;
    if (!code) return;
    const res = await fetch(`/api/rooms/${code}/scripts`);
    if (!res.ok) return;
    const scripts = await res.json();
    set({ scripts });
    // Auto-select first script if none active
    const { activeScriptId } = get();
    const target = scripts.find(s => s.id === activeScriptId) ?? scripts[0] ?? null;
    if (target) get().setActiveScript(target.id, target.content);
  },

  setActiveScript: (id, content) => set({ activeScriptId: id, content: content ?? '' }),

  updateContent: (text) => set({ content: text }),

  saveScript: async () => {
    const { room, activeScriptId, content, scripts } = get();
    if (!room || !activeScriptId) return;
    const res = await fetch(`/api/rooms/${room.code}/scripts/${activeScriptId}`, {
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
    const res = await fetch(`/api/rooms/${code}/scripts`, {
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
    await fetch(`/api/rooms/${code}/scripts/${id}`, { method: 'DELETE' });
    const remaining = get().scripts.filter(s => s.id !== id);
    const next      = remaining[0] ?? null;
    set({ scripts: remaining, activeScriptId: next?.id ?? null, content: next?.content ?? '' });
  },

  // ── Playback — all route through WS so server drives the reader ───────────
  play:    () => send('prompter:play'),
  pause:   () => send('prompter:pause'),
  stop:    () => send('prompter:stop'),
  setSpeed:(v) => send('prompter:speed', { speed: v }),
  seekTo:  (p) => send('prompter:seek',  { position: p }),

  // ── Display settings — update locally + broadcast via WS ──────────────────
  updateDisplay: (patch) => {
    set(patch);
    send('prompter:settings', { ...get(), ...patch });
  },

  // ── Reader reports its rendered height so server knows when to stop ────────
  reportHeight: (totalHeight) => {
    set({ totalHeight });
    send('prompter:settings', { totalHeight });
  },

  // ── Called by WS hook ─────────────────────────────────────────────────────
  _applyTick: (payload) => set({
    scrollPosition: payload.scrollPosition,
    isPlaying:      payload.isPlaying,
    speed:          payload.speed,
  }),
  _applyDisplay: (payload) => set(payload),

  // ── Cues ──────────────────────────────────────────────────────────────────
  addCue: (label, position) => {
    const id    = `cue_${Date.now()}`;
    const color = ['#e8a838', '#34d48a', '#f5464a', '#60a5fa'][
      (get().cues.length) % 4
    ];
    set(state => ({ cues: [...state.cues, { id, label, position, color }] }));
  },
  removeCue: (id) => set(state => ({ cues: state.cues.filter(c => c.id !== id) })),
  jumpToCue: (id) => {
    const cue = get().cues.find(c => c.id === id);
    if (cue) get().seekTo(cue.position);
  },
}));
```

### `packages/teleprompter-ui/src/hooks/usePrompterWS.js`

```js
import { useEffect, useRef } from 'react';
import { usePrompterStore, _setSend } from '../store/prompterStore.js';

function resolveWsUrl() {
  if (typeof window === 'undefined')    return 'ws://localhost:9876';
  if (location.hostname === 'localhost') return 'ws://localhost:9876';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}`;
}

const WS_URL     = resolveWsUrl();
const BASE_DELAY = 1_000;
const MAX_DELAY  = 30_000;

export function usePrompterWS() {
  const socketRef  = useRef(null);
  const backoffRef = useRef(BASE_DELAY);
  const aliveRef   = useRef(true);
  const timerRef   = useRef(null);

  useEffect(() => {
    aliveRef.current = true;

    function connect() {
      if (!aliveRef.current) return;
      const ws = new WebSocket(WS_URL);
      socketRef.current = ws;

      _setSend((type, payload = {}) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type, payload }));
        }
      });

      ws.onopen = () => {
        backoffRef.current = BASE_DELAY;
        const code = usePrompterStore.getState().room?.code;
        if (code) ws.send(JSON.stringify({ type: 'room:join', payload: { code } }));
      };

      ws.onmessage = ({ data }) => {
        let msg;
        try { msg = JSON.parse(data); } catch { return; }
        const { type, payload } = msg;
        const store = usePrompterStore.getState();

        switch (type) {
          case 'room:joined':
            store.setJoined({ joined: true, prompter: payload.prompter });
            break;
          case 'room:not_found':
            store.leaveRoom();
            break;
          case 'prompter:tick':
            store._applyTick(payload);
            break;
          case 'prompter:display':
            store._applyDisplay(payload);
            break;
        }
      };

      ws.onclose = () => {
        if (!aliveRef.current) return;
        _setSend(() => {});
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, MAX_DELAY);
        timerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      aliveRef.current = false;
      clearTimeout(timerRef.current);
      _setSend(() => {});
      socketRef.current?.close();
    };
  }, []);
}
```

### `packages/teleprompter-ui/src/hooks/useScrollEngine.js`

```js
import { useEffect, useRef } from 'react';
import { usePrompterStore } from '../store/prompterStore.js';

const SNAP_THRESHOLD_PX = 150;
const LERP_FACTOR       = 0.18;

// Smoothly applies server-driven scroll position to a DOM container ref.
// Interpolates to avoid jitter from 50ms WS tick intervals.
// containerRef: ref to the scrollable container element
export function useScrollEngine(containerRef) {
  const targetRef = useRef(0);
  const rafRef    = useRef(null);

  // Subscribe to store scroll position
  useEffect(() => {
    const unsub = usePrompterStore.subscribe(
      state => state.scrollPosition,
      (pos) => { targetRef.current = pos; },
    );
    return unsub;
  }, []);

  // RAF loop
  useEffect(() => {
    function loop() {
      const el = containerRef.current;
      if (el) {
        const current = el.scrollTop;
        const target  = targetRef.current;
        const delta   = target - current;

        if (Math.abs(delta) > SNAP_THRESHOLD_PX) {
          el.scrollTop = target;
        } else if (Math.abs(delta) > 0.5) {
          el.scrollTop = current + delta * LERP_FACTOR;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [containerRef]);
}
```

### `packages/teleprompter-ui/src/utils/scriptParser.js`

```js
// Parses raw script text into typed segments for rendering in ReaderView.

const CUE_RE   = /^\[CUE:\s*(.+?)\]$/i;
const BOLD_RE  = /\*\*(.+?)\*\*/g;
const BREAK_RE = /^---+$/;

export function parseScript(raw = '') {
  const lines    = raw.split('\n');
  const segments = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (BREAK_RE.test(trimmed)) {
      segments.push({ type: 'break' });
      continue;
    }

    const cueMatch = CUE_RE.exec(trimmed);
    if (cueMatch) {
      segments.push({ type: 'cue', label: cueMatch[1] });
      continue;
    }

    if (trimmed === '') {
      segments.push({ type: 'blank' });
      continue;
    }

    // Parse **bold** inline spans
    const inlineSegments = [];
    let lastIndex = 0;
    let match;
    BOLD_RE.lastIndex = 0;

    while ((match = BOLD_RE.exec(line)) !== null) {
      if (match.index > lastIndex) {
        inlineSegments.push({ bold: false, text: line.slice(lastIndex, match.index) });
      }
      inlineSegments.push({ bold: true, text: match[1] });
      lastIndex = BOLD_RE.lastIndex;
    }

    if (lastIndex < line.length) {
      inlineSegments.push({ bold: false, text: line.slice(lastIndex) });
    }

    segments.push({ type: 'line', spans: inlineSegments });
  }

  return segments;
}
```

### `packages/teleprompter-ui/src/utils/exportScript.js`

```js
export function exportScript(name, content) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${name.replace(/\s+/g, '-').toLowerCase()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## Phase 4 — App Shell and Routing

### `packages/teleprompter-ui/src/App.jsx`

```jsx
import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { usePrompterStore } from './store/prompterStore.js';
import { RoomGate }         from './components/shared/RoomGate.jsx';
import { ControllerView }   from './components/controller/ControllerView.jsx';
import { ReaderView }        from './components/reader/ReaderView.jsx';

export default function App() {
  const [ready, setReady] = useState(false);
  const room = usePrompterStore(s => s.room);

  useEffect(() => {
    usePrompterStore.getState().initialize().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={room ? <Navigate to={`/room/${room.code}`} replace /> : <RoomGate />}
      />
      <Route
        path="/room/:code"
        element={room ? <ControllerView /> : <Navigate to="/" replace />}
      />
      <Route
        path="/room/:code/read"
        element={room ? <ReaderView /> : <Navigate to="/" replace />}
      />
    </Routes>
  );
}
```

### `packages/teleprompter-ui/src/components/shared/RoomGate.jsx`

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrompterStore } from '../../store/prompterStore.js';

function formatCode(raw) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.length <= 2 ? clean : `${clean.slice(0, 2)}-${clean.slice(2, 6)}`;
}

function Logo({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="#181614"/>
      <circle cx="16" cy="16" r="11" stroke="#2c2825" strokeWidth="2.5"/>
      <circle cx="16" cy="16" r="11" stroke="#e8a838" strokeWidth="2.5"
        strokeDasharray="55.3 13.8" strokeLinecap="round" transform="rotate(-90 16 16)"/>
      <line x1="16" y1="16" x2="16" y2="7" stroke="#f0ede8" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="16" cy="16" r="2.2" fill="#e8a838"/>
    </svg>
  );
}

export function RoomGate() {
  const setRoom    = usePrompterStore(s => s.setRoom);
  const navigate   = useNavigate();

  const [createName, setCreateName]   = useState('');
  const [creating, setCreating]       = useState(false);
  const [createError, setCreateError] = useState('');

  const [joinCode, setJoinCode]   = useState('');
  const [joining, setJoining]     = useState(false);
  const [joinError, setJoinError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!createName.trim()) { setCreateError('Name is required'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim(), type: 'teleprompter' }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const room = await res.json();
      setRoom(room);
      navigate(`/room/${room.code}`);
    } catch (err) {
      setCreateError(err.message);
      setCreating(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z]{2}-[0-9]{4}$/.test(code)) { setJoinError('Enter a valid code (e.g. AB-1234)'); return; }
    setJoining(true);
    setJoinError('');
    try {
      const res = await fetch(`/api/rooms/${code}`);
      if (!res.ok) throw Object.assign(new Error('Room not found'), { status: res.status });
      const room = await res.json();
      setRoom(room);
      navigate(`/room/${room.code}`);
    } catch (err) {
      setJoinError(err.status === 404 ? 'Room not found' : err.message);
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-base text-text-primary p-6">
      <div className="flex flex-col items-center gap-3 mb-12 select-none">
        <Logo size={52} />
        <div className="text-center leading-none">
          <div className="text-xl font-semibold tracking-wide">ShowStack Teleprompter</div>
          <div className="text-xs text-text-muted tracking-widest uppercase mt-1">by Faithfire</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 w-full max-w-xl">
        <form onSubmit={handleCreate}
          className="flex-1 flex flex-col gap-4 bg-surface-raised border border-border-subtle rounded-xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted">Create Room</h2>
          <input type="text" value={createName} onChange={e => setCreateName(e.target.value)}
            placeholder="Sunday Service"
            className="bg-surface-elevated border border-border-default rounded-md px-3 py-2 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-accent" />
          {createError && <p className="text-xs text-status-danger">{createError}</p>}
          <button type="submit" disabled={creating}
            className="bg-accent text-surface-base font-semibold text-sm py-2 rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50">
            {creating ? 'Creating…' : 'Create Room'}
          </button>
        </form>

        <form onSubmit={handleJoin}
          className="flex-1 flex flex-col gap-4 bg-surface-raised border border-border-subtle rounded-xl p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted">Join Room</h2>
          <input type="text" value={joinCode} onChange={e => setJoinCode(formatCode(e.target.value))}
            placeholder="AB-1234" maxLength={7}
            className="bg-surface-elevated border border-border-default rounded-md px-3 py-2 text-sm font-mono tracking-widest text-text-primary placeholder-text-disabled focus:outline-none focus:border-accent" />
          {joinError && <p className="text-xs text-status-danger">{joinError}</p>}
          <button type="submit" disabled={joining}
            className="bg-surface-elevated border border-border-default text-text-primary font-semibold text-sm py-2 rounded-md hover:bg-surface-overlay transition-colors disabled:opacity-50">
            {joining ? 'Joining…' : 'Join Room'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

### `packages/teleprompter-ui/src/components/shared/TopBar.jsx`

```jsx
import { usePrompterStore } from '../../store/prompterStore.js';

export function TopBar({ rightSlot }) {
  const room = usePrompterStore(s => s.room);
  const code = room?.code;

  function copyReadUrl() {
    const url = `${location.origin}/teleprompter/room/${code}/read`;
    navigator.clipboard.writeText(url).catch(() => {});
  }

  return (
    <header className="flex items-center justify-between px-4 h-10 bg-surface-raised border-b border-border-subtle shrink-0 select-none">
      <span className="text-[11px] font-semibold text-text-primary tracking-wide">
        ShowStack <span className="text-text-muted font-normal">/ Teleprompter</span>
      </span>

      <div className="flex items-center gap-2">
        {code && (
          <>
            <button onClick={copyReadUrl}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-xs font-mono tracking-widest text-text-secondary hover:text-text-primary transition-colors"
              title="Copy reader URL">
              {code}
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="5" width="9" height="9" rx="1.5"/>
                <path d="M11 5V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v6.5A1.5 1.5 0 0 0 3 11H5"/>
              </svg>
            </button>
          </>
        )}
        {rightSlot}
      </div>
    </header>
  );
}
```

### `packages/teleprompter-ui/src/components/shared/Toast.jsx`

```jsx
import { useEffect, useState } from 'react';

export function Toast({ message, duration = 2500, onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDone?.(); }, duration);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-elevated border border-border-default text-text-primary text-sm px-4 py-2 rounded-lg shadow-xl z-50 pointer-events-none animate-fade-in">
      {message}
    </div>
  );
}
```

---

## Phase 5 — ReaderView

### `packages/teleprompter-ui/src/components/reader/ReaderView.jsx`

```jsx
import { useEffect, useRef } from 'react';
import { usePrompterStore } from '../../store/prompterStore.js';
import { usePrompterWS }    from '../../hooks/usePrompterWS.js';
import { useScrollEngine }  from '../../hooks/useScrollEngine.js';
import { parseScript }      from '../../utils/scriptParser.js';
import { FocusLine }        from './FocusLine.jsx';
import { CueMarker }        from './CueMarker.jsx';

export function ReaderView() {
  usePrompterWS();

  const containerRef = useRef(null);
  const contentRef   = useRef(null);
  useScrollEngine(containerRef);

  const {
    content, cues,
    fontSize, lineWidth, fontFamily, textColor, bgColor,
    isMirrored, isFlippedVertical, showFocusLine, focusLinePosition,
    play, pause, stop, setSpeed, speed, isPlaying,
    updateDisplay,
  } = usePrompterStore();

  // Report rendered height to server whenever content changes
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      usePrompterStore.getState().reportHeight(el.scrollHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':     e.preventDefault(); isPlaying ? pause() : play(); break;
        case 'r': case 'R': stop(); break;
        case 'ArrowUp':    e.preventDefault(); setSpeed(Math.min(10, speed + 1)); break;
        case 'ArrowDown':  e.preventDefault(); setSpeed(Math.max(1,  speed - 1)); break;
        case 'f': case 'F': updateDisplay({ showFocusLine: !showFocusLine }); break;
        case 'm': case 'M': updateDisplay({ isMirrored: !isMirrored }); break;
        case 'Escape': document.exitFullscreen?.(); break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, speed, showFocusLine, isMirrored]);

  const segments = parseScript(content);

  const transform = [
    isMirrored       ? 'scaleX(-1)' : '',
    isFlippedVertical ? 'scaleY(-1)' : '',
  ].filter(Boolean).join(' ') || 'none';

  const fontClass = fontFamily === 'dm-mono' ? 'font-reader-mono' : 'font-reader';

  return (
    <div
      className="relative w-screen h-screen overflow-hidden"
      style={{ background: bgColor, transform }}
    >
      {showFocusLine && <FocusLine position={focusLinePosition} />}

      {/* Scroll container — scrollTop driven by useScrollEngine */}
      <div ref={containerRef} className="w-full h-full overflow-hidden">
        <div
          ref={contentRef}
          className={`mx-auto py-[50vh] ${fontClass}`}
          style={{
            width:      `${lineWidth}%`,
            fontSize:   `${fontSize}px`,
            color:      textColor,
            lineHeight: 1.5,
          }}
        >
          {segments.map((seg, i) => {
            if (seg.type === 'break') return (
              <hr key={i} className="my-8 border-t-2 opacity-20" style={{ borderColor: textColor }} />
            );
            if (seg.type === 'blank') return <div key={i} className="h-[1em]" />;
            if (seg.type === 'cue') {
              const cue = cues.find(c => c.label === seg.label);
              return <CueMarker key={i} label={seg.label} color={cue?.color ?? '#e8a838'} />;
            }
            return (
              <p key={i} className="mb-2">
                {seg.spans.map((span, j) => (
                  <span key={j} style={span.bold ? { fontWeight: 600, opacity: 1 } : { opacity: 0.9 }}>
                    {span.text}
                  </span>
                ))}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

### `packages/teleprompter-ui/src/components/reader/FocusLine.jsx`

```jsx
export function FocusLine({ position }) {
  return (
    <div
      className="absolute inset-x-0 pointer-events-none z-10"
      style={{
        top:       `calc(${position}% - 2.5em)`,
        height:    '5em',
        background: 'rgba(232, 168, 56, 0.12)',
        borderTop:    '1px solid rgba(232, 168, 56, 0.25)',
        borderBottom: '1px solid rgba(232, 168, 56, 0.25)',
      }}
    />
  );
}
```

### `packages/teleprompter-ui/src/components/reader/CueMarker.jsx`

```jsx
export function CueMarker({ label, color }) {
  return (
    <div className="flex items-center gap-2 my-3 select-none pointer-events-none">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-xs font-semibold tracking-widest uppercase opacity-70" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
```

---

## Phase 6 — ControllerView

### `packages/teleprompter-ui/src/components/controller/ControllerView.jsx`

```jsx
import { useEffect, useState } from 'react';
import { usePrompterStore } from '../../store/prompterStore.js';
import { usePrompterWS }    from '../../hooks/usePrompterWS.js';
import { TopBar }           from '../shared/TopBar.jsx';
import { ScriptEditor }     from './ScriptEditor.jsx';
import { SpeedControl }     from './SpeedControl.jsx';
import { CueList }          from './CueList.jsx';

export function ControllerView() {
  usePrompterWS();

  const { room, isPlaying, play, pause, stop, scripts, activeScriptId,
          setActiveScript, createScript, deleteScript, updateDisplay,
          fontSize, lineWidth, fontFamily, textColor, bgColor,
          isMirrored, isFlippedVertical, showFocusLine, focusLinePosition } = usePrompterStore();

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { usePrompterStore.getState().loadScripts(); }, []);

  function openReader() {
    const url = `${location.origin}/teleprompter/room/${room?.code}/read`;
    window.open(url, '_blank', 'width=1920,height=1080');
  }

  return (
    <div className="flex flex-col h-screen bg-surface-base text-text-primary overflow-hidden">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Script area ──────────────────────────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden border-r border-border-subtle">

          {/* Script tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border-subtle bg-surface-raised overflow-x-auto shrink-0">
            {scripts.map(s => (
              <button key={s.id} onClick={() => setActiveScript(s.id, s.content)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap
                  ${s.id === activeScriptId
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-elevated'}`}>
                {s.name}
              </button>
            ))}
            <button onClick={() => {
              const name = prompt('Script name:');
              if (name) createScript(name);
            }}
              className="px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors">
              + New
            </button>
          </div>

          <ScriptEditor />
        </div>

        {/* ── RIGHT: Controls panel ──────────────────────────────────── */}
        <div className="w-72 flex flex-col gap-4 p-4 overflow-y-auto shrink-0 bg-surface-raised">

          {/* Playback controls */}
          <div className="flex flex-col gap-2">
            <button onClick={stop}
              className="w-full py-2 rounded-md bg-surface-elevated border border-border-default text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">
              RESET
            </button>
            <button onClick={isPlaying ? pause : play}
              className={`w-full py-4 rounded-lg text-lg font-bold tracking-widest transition-colors
                ${isPlaying
                  ? 'bg-status-live/20 text-status-live border border-status-live/40 hover:bg-status-live/30'
                  : 'bg-accent text-surface-base hover:bg-accent-hover'}`}>
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>
          </div>

          <SpeedControl />

          {/* Display settings (collapsible) */}
          <div className="border border-border-subtle rounded-lg overflow-hidden">
            <button onClick={() => setShowSettings(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors">
              Display Settings
              <span className="text-base leading-none">{showSettings ? '−' : '+'}</span>
            </button>

            {showSettings && (
              <div className="flex flex-col gap-3 p-3 border-t border-border-subtle text-xs">

                <label className="flex flex-col gap-1 text-text-muted">
                  Font Size — {fontSize}px
                  <input type="range" min={24} max={120} value={fontSize}
                    onChange={e => updateDisplay({ fontSize: Number(e.target.value) })}
                    className="accent-accent" />
                </label>

                <label className="flex flex-col gap-1 text-text-muted">
                  Line Width — {lineWidth}%
                  <input type="range" min={40} max={90} value={lineWidth}
                    onChange={e => updateDisplay({ lineWidth: Number(e.target.value) })}
                    className="accent-accent" />
                </label>

                <label className="flex flex-col gap-1 text-text-muted">
                  Font
                  <select value={fontFamily}
                    onChange={e => updateDisplay({ fontFamily: e.target.value })}
                    className="bg-surface-elevated border border-border-default rounded px-2 py-1 text-text-primary">
                    <option value="dm-sans">DM Sans</option>
                    <option value="dm-mono">DM Mono</option>
                  </select>
                </label>

                <div className="flex gap-2">
                  <label className="flex flex-col gap-1 text-text-muted flex-1">
                    Text
                    <input type="color" value={textColor}
                      onChange={e => updateDisplay({ textColor: e.target.value })}
                      className="h-8 w-full rounded cursor-pointer bg-transparent border-0" />
                  </label>
                  <label className="flex flex-col gap-1 text-text-muted flex-1">
                    Background
                    <input type="color" value={bgColor}
                      onChange={e => updateDisplay({ bgColor: e.target.value })}
                      className="h-8 w-full rounded cursor-pointer bg-transparent border-0" />
                  </label>
                </div>

                {/* Preset backgrounds */}
                <div className="flex gap-2">
                  {['#000000', '#ffffff', '#00b140'].map(c => (
                    <button key={c} onClick={() => updateDisplay({ bgColor: c })}
                      title={c}
                      className="w-7 h-7 rounded border-2 transition-all"
                      style={{ background: c, borderColor: bgColor === c ? '#e8a838' : 'transparent' }} />
                  ))}
                </div>

                <label className="flex flex-col gap-1 text-text-muted">
                  Focus Line Position — {focusLinePosition}%
                  <input type="range" min={20} max={80} value={focusLinePosition}
                    onChange={e => updateDisplay({ focusLinePosition: Number(e.target.value) })}
                    className="accent-accent" />
                </label>

                {[
                  ['showFocusLine',    showFocusLine,    'Focus Line'],
                  ['isMirrored',       isMirrored,       'Mirror (horizontal)'],
                  ['isFlippedVertical',isFlippedVertical,'Flip Vertical'],
                ].map(([key, val, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer text-text-secondary">
                    <input type="checkbox" checked={val}
                      onChange={e => updateDisplay({ [key]: e.target.checked })}
                      className="accent-accent" />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <CueList />

          {/* Open reader */}
          <button onClick={openReader}
            className="w-full py-2 rounded-md bg-surface-elevated border border-border-default text-sm text-text-secondary hover:text-text-primary hover:border-accent transition-colors">
            Open Reader Window ↗
          </button>
        </div>
      </div>
    </div>
  );
}
```

### `packages/teleprompter-ui/src/components/controller/ScriptEditor.jsx`

```jsx
import { useEffect, useRef, useState } from 'react';
import { usePrompterStore } from '../../store/prompterStore.js';
import { ScriptImporter }   from './ScriptImporter.jsx';
import { exportScript }     from '../../utils/exportScript.js';
import { Toast }            from '../shared/Toast.jsx';

const AUTOSAVE_DELAY_MS = 1000;

export function ScriptEditor() {
  const { content, updateContent, saveScript, activeScriptId, scripts, deleteScript } = usePrompterStore();
  const timerRef  = useRef(null);
  const [toast, setToast] = useState(null);

  // Autosave on 1s debounce
  useEffect(() => {
    if (!activeScriptId) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { saveScript(); }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [content, activeScriptId]);

  function handleChange(e) {
    updateContent(e.target.value);
  }

  function handleImport(text, words) {
    updateContent(text);
    setToast(`Script imported — ${words} words`);
  }

  function handleExport() {
    const script = scripts.find(s => s.id === activeScriptId);
    if (!script) return;
    exportScript(script.name, content);
  }

  function handleAddCue() {
    const label = prompt('Cue label:');
    if (!label) return;
    // insert [CUE: label] at cursor or end
    const textarea = document.querySelector('textarea[data-script-editor]');
    const pos      = textarea?.selectionStart ?? content.length;
    const insertion = `\n[CUE: ${label}]\n`;
    updateContent(content.slice(0, pos) + insertion + content.slice(pos));
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle bg-surface-base shrink-0">
        <ScriptImporter onImport={handleImport} />
        <button onClick={handleExport}
          className="px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors">
          Export .txt
        </button>
        <button onClick={handleAddCue}
          className="px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors">
          + Add Cue
        </button>
        <span className="ml-auto text-xs text-text-disabled">{wordCount} words</span>
      </div>

      <textarea
        data-script-editor
        value={content}
        onChange={handleChange}
        placeholder="Paste or type your script here…&#10;&#10;Use **bold** for emphasis, [CUE: Label] for cue markers, --- for section breaks."
        spellCheck
        className="flex-1 resize-none bg-surface-base text-text-primary text-sm leading-relaxed px-5 py-4 focus:outline-none font-reader placeholder-text-disabled"
      />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
```

### `packages/teleprompter-ui/src/components/controller/SpeedControl.jsx`

```jsx
import { usePrompterStore } from '../../store/prompterStore.js';

export function SpeedControl() {
  const { speed, setSpeed } = usePrompterStore();

  return (
    <div className="flex flex-col gap-2 p-3 bg-surface-elevated rounded-lg border border-border-subtle">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">Speed</span>
        <span className="text-lg font-bold text-text-primary tabular-nums">{speed}</span>
      </div>

      <input
        type="range"
        min={1}
        max={10}
        value={speed}
        onChange={e => setSpeed(Number(e.target.value))}
        className="w-full accent-accent"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-text-disabled">Slow</span>
        <div className="flex gap-2">
          <button
            onClick={() => setSpeed(Math.max(1, speed - 1))}
            className="w-6 h-6 rounded bg-surface-base border border-border-default text-text-secondary hover:text-text-primary text-sm leading-none flex items-center justify-center transition-colors">
            −
          </button>
          <button
            onClick={() => setSpeed(Math.min(10, speed + 1))}
            className="w-6 h-6 rounded bg-surface-base border border-border-default text-text-secondary hover:text-text-primary text-sm leading-none flex items-center justify-center transition-colors">
            +
          </button>
        </div>
        <span className="text-xs text-text-disabled">Fast</span>
      </div>
    </div>
  );
}
```

### `packages/teleprompter-ui/src/components/controller/CueList.jsx`

```jsx
import { usePrompterStore } from '../../store/prompterStore.js';

export function CueList() {
  const { cues, jumpToCue, removeCue } = usePrompterStore();

  if (!cues.length) return null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-widest text-text-muted px-1">
        Cues
      </span>
      {cues.map(cue => (
        <div key={cue.id}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-elevated border border-border-subtle group">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cue.color }} />
          <button
            onClick={() => jumpToCue(cue.id)}
            className="flex-1 text-left text-xs text-text-secondary hover:text-text-primary transition-colors truncate">
            {cue.label}
          </button>
          <button
            onClick={() => removeCue(cue.id)}
            className="text-text-disabled hover:text-status-danger transition-colors opacity-0 group-hover:opacity-100 text-base leading-none">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

### `packages/teleprompter-ui/src/components/controller/ScriptImporter.jsx`

```jsx
import { useRef } from 'react';

export function ScriptImporter({ onImport }) {
  const inputRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text  = ev.target.result ?? '';
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      onImport(text, words);
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,text/plain"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="px-2 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors">
        Import .txt
      </button>
    </>
  );
}
```

---

## Phase 7 — Server Integration

### Update `packages/server/src/index.js`

After the existing `app.use(express.static(distPath))` and before the `app.get('*', ...)` catch-all, add:

```js
const teleprompterDistPath = path.resolve(__dirname, '../../../apps/teleprompter/dist');
app.use('/teleprompter', express.static(teleprompterDistPath));
app.get('/teleprompter/*', (_req, res) => {
  res.sendFile(path.join(teleprompterDistPath, 'index.html'));
});
```

The order of static routes must be:

```
/media       → media files
/api/*       → API routes
/teleprompter → teleprompter SPA
/*           → countdown SPA (catch-all last)
```

### Update `Dockerfile`

After the existing `RUN pnpm --filter @showstack/web build`, add:

```dockerfile
RUN pnpm --filter @showstack/teleprompter-app build
```

Also update the `COPY packages/*/package.json` section to include teleprompter-ui:

```dockerfile
COPY packages/teleprompter-ui/package.json ./packages/teleprompter-ui/
COPY apps/teleprompter/package.json ./apps/teleprompter/
```

### Update root `package.json` scripts

Add:

```json
"dev:teleprompter": "turbo run dev --filter=@showstack/teleprompter-app --filter=@showstack/server",
"build:teleprompter": "turbo run build --filter=@showstack/teleprompter-app"
```

---

## Verification Checklist

- [ ] `pnpm install` runs clean with no errors
- [ ] `pnpm dev:teleprompter` starts both the Vite dev server (port 5174) and Express server (9876)
- [ ] `http://localhost:5174/teleprompter/` loads RoomGate
- [ ] Creating a room of type `teleprompter` returns a room code in XX-XXXX format
- [ ] Joining with an existing code navigates to ControllerView
- [ ] Joining with an invalid code shows "Room not found"
- [ ] ControllerView loads with empty script editor and controls
- [ ] Typing in the editor triggers autosave after 1 second (verify in Network tab: PUT /api/rooms/:code/scripts/:id)
- [ ] Import .txt button loads a plain text file into the editor
- [ ] Export .txt downloads the script as a .txt file
- [ ] `http://localhost:5174/teleprompter/room/:code/read` loads ReaderView full screen
- [ ] Clicking PLAY on ControllerView starts scroll on ReaderView (two separate browser tabs)
- [ ] Speed slider changes scroll pace on the ReaderView in real time
- [ ] RESET button scrolls ReaderView back to top
- [ ] Mirror toggle flips ReaderView horizontally
- [ ] Focus line appears as amber band across the reader screen
- [ ] Focus line position slider moves the band up and down
- [ ] Font size slider resizes text in the ReaderView immediately
- [ ] Background color preset buttons change the reader background
- [ ] Add Cue inserts `[CUE: label]` into the script
- [ ] Cue markers render in the ReaderView as colored dots
- [ ] Clicking a cue in CueList jumps reader to that position
- [ ] Keyboard shortcut Space → play/pause works in ReaderView
- [ ] Keyboard shortcut R → reset to top works in ReaderView
- [ ] Open Reader button opens a 1920×1080 window at the read URL
- [ ] `pnpm build:teleprompter` produces `apps/teleprompter/dist/`
- [ ] `docker build -t showstack .` completes including teleprompter build
- [ ] `http://localhost:9876/teleprompter/` serves the teleprompter SPA in production
- [ ] Countdown Studio at `http://localhost:9876/` is unaffected

---

## Notes

- The server drives all scroll position via `PROMPTER_TICK` at 20fps. The client never runs its own scroll timer — it only applies incoming position updates via the `useScrollEngine` lerp.
- All display settings (font, mirror, colors, focus line) are applied client-side from the store but also broadcast to all room members so the reader reflects TD changes instantly.
- `ReaderView` works on any device — tablet, phone, second monitor — just by opening the URL. It requires no login or room joining flow (the room code is in the URL path; the WS hook reads it and sends `room:join` automatically on connect).
- Cues are local client-state only (not persisted to DB). If persistence is needed in a future iteration, add a `cues` column to `room_scripts` or use the existing `room_cues` table.
- The teleprompter uses `basename="/teleprompter"` in BrowserRouter so all client-side routes are prefixed correctly when served from the subdirectory.
- Do not modify `packages/ui`, `apps/web`, or any countdown-specific code.
