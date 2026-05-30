import { useEffect, useRef } from 'react';
import { _setSend, send } from '../wsClient.js';
import { useTimerStore }    from '../stores/timerStore.js';
import { useCueStore }      from '../stores/cueStore.js';
import { useMediaStore }    from '../stores/mediaStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';
import { useRoomStore }     from '../stores/roomStore.js';
import { getWsUrl }         from '../adapter/http.js';

function buildWsUrl(roomCode) {
  // Electron: get URL from IPC config asynchronously (handled by getElectronWsUrl)
  if (typeof window !== 'undefined' && window.__ELECTRON_API__) return null; // resolved async
  const base = getWsUrl();
  // CF Worker: WebSocket URL includes ?room= to route to the correct Durable Object
  if (roomCode && !base.includes('localhost')) return `${base}/ws?room=${roomCode}`;
  return base;
}

const BASE_DELAY = 1_000;
const MAX_DELAY  = 30_000;

const EV = {
  TIMER_TICK:       'timer:tick',
  TIMER_STATE:      'timer:state',
  CUE_FIRED:        'cue:fired',
  ASSET_ADDED:      'asset:added',
  ASSET_REMOVED:    'asset:removed',
  SETTINGS_CHANGED: 'settings:changed',
  ROOM_JOINED:      'room:joined',
  ROOM_NOT_FOUND:   'room:not_found',
};

export { send };

export function useWebSocket() {
  const socketRef   = useRef(null);
  const backoffRef  = useRef(BASE_DELAY);
  const aliveRef    = useRef(true);
  const timeoutRef  = useRef(null);

  useEffect(() => {
    aliveRef.current = true;

    async function connect() {
      if (!aliveRef.current) return;

      const code = useRoomStore.getState().getRoomCode();
      let wsUrl = buildWsUrl(code);

      // Electron: resolve URL via IPC
      if (!wsUrl && typeof window !== 'undefined' && window.__ELECTRON_API__) {
        try {
          const cfg = await window.__ELECTRON_API__.getConfig();
          wsUrl = code ? `${cfg.wsUrl}/ws?room=${code}` : cfg.wsUrl;
        } catch {
          wsUrl = 'ws://localhost:9876';
        }
      }

      const ws = new WebSocket(wsUrl ?? 'ws://localhost:9876');
      socketRef.current = ws;

      _setSend((type, payload = {}) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type, payload }));
        }
      });

      ws.onopen = () => {
        backoffRef.current = BASE_DELAY;
        // Immediately join the current room
        const code = useRoomStore.getState().getRoomCode();
        if (code) {
          ws.send(JSON.stringify({ type: 'room:join', payload: { code } }));
        }
      };

      ws.onmessage = ({ data }) => {
        let msg;
        try { msg = JSON.parse(data); } catch { return; }
        const { type, payload } = msg;

        switch (type) {
          case EV.ROOM_JOINED:
            useRoomStore.getState().setJoined(true);
            useTimerStore.getState()._tick(payload.timer);
            useSettingsStore.getState().applyFromServer(payload.settings ?? {});
            useCueStore.getState().setCues(
              (payload.cues ?? []).map(c => ({
                ...c,
                actions: (() => { try { return JSON.parse(c.actions_json ?? '[]') } catch { return [] } })(),
              }))
            );
            break;
          case EV.ROOM_NOT_FOUND:
            useRoomStore.getState().leaveRoom();
            break;
          case EV.TIMER_TICK:
          case EV.TIMER_STATE:
            useTimerStore.getState()._tick(payload);
            break;
          case EV.CUE_FIRED: {
            // payload.cue should already have an `actions` array (parsed server-side).
            // Guard: if actions is missing/string, parse actions_json as a fallback.
            const firedCue = payload.cue ?? payload;
            if (!Array.isArray(firedCue.actions)) {
              try { firedCue.actions = JSON.parse(firedCue.actions_json ?? firedCue.actions ?? '[]') } catch { firedCue.actions = [] }
            }
            useCueStore.getState().executeCueActions(firedCue);
            break;
          }
          case EV.ASSET_ADDED:
            useMediaStore.getState()._add(payload.asset);
            break;
          case EV.ASSET_REMOVED:
            useMediaStore.getState()._remove(payload.id);
            break;
          case EV.SETTINGS_CHANGED:
            useSettingsStore.getState().applyFromServer(payload);
            break;
        }
      };

      ws.onclose = () => {
        if (!aliveRef.current) return;
        _setSend(() => {});
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, MAX_DELAY);
        timeoutRef.current = setTimeout(() => connect(), delay);
      };
    }

    connect();

    return () => {
      aliveRef.current = false;
      clearTimeout(timeoutRef.current);
      _setSend(() => {});
      socketRef.current?.close();
    };
  }, []);
}
