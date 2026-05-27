import { useEffect, useRef } from 'react';
import { _setSend, send } from '../wsClient.js';
import { useTimerStore }    from '../stores/timerStore.js';
import { useCueStore }      from '../stores/cueStore.js';
import { useMediaStore }    from '../stores/mediaStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';
import { useRoomStore }     from '../stores/roomStore.js';

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
            useCueStore.getState().setCues(payload.cues ?? []);
            break;
          case EV.ROOM_NOT_FOUND:
            useRoomStore.getState().leaveRoom();
            break;
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
            useSettingsStore.getState().applyFromServer(payload);
            break;
        }
      };

      ws.onclose = () => {
        if (!aliveRef.current) return;
        _setSend(() => {});
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, MAX_DELAY);
        timeoutRef.current = setTimeout(connect, delay);
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
