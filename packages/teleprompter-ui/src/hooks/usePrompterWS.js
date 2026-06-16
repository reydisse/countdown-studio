import { useEffect, useRef } from 'react';
import { usePrompterStore, _setSend } from '../store/prompterStore.js';

function resolveWsUrl(code) {
  const base = import.meta.env.VITE_WS_URL ||
    (location.hostname === 'localhost' ? 'ws://localhost:9876' : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`);
  return code ? `${base}/ws?room=${code}` : base;
}
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
      const code = usePrompterStore.getState().room?.code;
      const ws = new WebSocket(resolveWsUrl(code));
      socketRef.current = ws;

      _setSend((type, payload = {}) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type, payload }));
        }
      });

      ws.onopen = () => {
        backoffRef.current = BASE_DELAY;
        usePrompterStore.setState({ wsConnected: true });
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
            if (payload.script) store._applyScript(payload.script);
            if (payload.display) store._applyDisplay(payload.display);
            if (Array.isArray(payload.prompterCues)) usePrompterStore.setState({ cues: payload.prompterCues });
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
          case 'prompter:script':
            store._applyScript(payload);
            break;
          case 'prompter:cues':
            if (Array.isArray(payload.cues)) usePrompterStore.setState({ cues: payload.cues });
            break;
        }
      };

      ws.onclose = () => {
        if (!aliveRef.current) return;
        _setSend(() => {});
        usePrompterStore.setState({ wsConnected: false });
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
