import { useEffect, useRef } from 'react';
import { _setSend, send } from '../wsClient.js';
import { useTimerStore }    from '../stores/timerStore.js';
import { useCueStore }      from '../stores/cueStore.js';
import { useMediaStore }    from '../stores/mediaStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';

// In dev or Electron: ws://localhost:9876
// In production (behind Cloudflare Tunnel / HTTPS): wss://<same host>
function resolveWsUrl() {
  if (typeof window === 'undefined') return 'ws://localhost:9876';
  if (window.__ELECTRON__)           return 'ws://localhost:9876';
  if (location.hostname === 'localhost') return `ws://localhost:9876`;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}`;
}
const WS_URL     = resolveWsUrl();
const BASE_DELAY = 1_000;
const MAX_DELAY  = 30_000;

const EV = {
  TIMER_TICK:       'timer:tick',
  TIMER_STATE:      'timer:state',
  CUE_FIRED:        'cue:fired',
  ASSET_ADDED:      'asset:added',
  ASSET_REMOVED:    'asset:removed',
  SETTINGS_CHANGED: 'settings:changed',
};

// ── Singleton send ─────────────────────────────────────────────────────────
// Re-exported so components can import { send } from here for convenience,
// but wsClient.js is the canonical source.
export { send };

// ── Hook — mount once at the app root ─────────────────────────────────────
export function useWebSocket() {
  const socketRef   = useRef(null);
  const backoffRef  = useRef(BASE_DELAY);
  const aliveRef    = useRef(true);
  const timeroutRef = useRef(null);

  useEffect(() => {
    aliveRef.current = true;

    function connect() {
      if (!aliveRef.current) return;

      const ws = new WebSocket(WS_URL);
      socketRef.current = ws;

      // Register this socket as the active send target
      _setSend((type, payload = {}) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type, payload }));
        }
      });

      ws.onopen = () => {
        backoffRef.current = BASE_DELAY; // reset on successful connect
      };

      ws.onmessage = ({ data }) => {
        let msg;
        try { msg = JSON.parse(data); } catch { return; }
        const { type, payload } = msg;

        switch (type) {
          case EV.TIMER_TICK:
          case EV.TIMER_STATE:
            useTimerStore.getState()._tick(payload);
            break;
          case EV.CUE_FIRED:
            useCueStore.getState().executeCueActions(payload.cue);
            break;
          case EV.ASSET_ADDED:
            useMediaStore.getState()._add(payload.asset);
            break;
          case EV.ASSET_REMOVED:
            useMediaStore.getState()._remove(payload.id);
            break;
          case EV.SETTINGS_CHANGED:
            // Another studio window or the server pushed new settings.
            // applyFromServer() only touches known store fields — it does NOT
            // trigger another outgoing sync because AppShell's sync compares
            // hashes and skips when the payload matches what we last sent.
            useSettingsStore.getState().applyFromServer(payload);
            break;
        }
      };

      ws.onclose = () => {
        if (!aliveRef.current) return;

        // No-op send during reconnect window
        _setSend(() => {});

        const delay = backoffRef.current;
        // Exponential backoff: double each attempt, cap at MAX_DELAY
        backoffRef.current = Math.min(delay * 2, MAX_DELAY);
        timeroutRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      aliveRef.current = false;
      clearTimeout(timeroutRef.current);
      _setSend(() => {}); // silence any in-flight sends after unmount
      socketRef.current?.close();
    };
  }, []); // runs once — getState() calls inside handlers avoid stale-closure issues
}
