import { create } from 'zustand';
import { send } from '../wsClient.js';

// Client constants inlined to avoid @showstack/shared CJS import at module init.
const EV = {
  PLAY:  'timer:play',
  PAUSE: 'timer:pause',
  STOP:  'timer:stop',
  RESET: 'timer:reset',
  SET:   'timer:set',
  SEEK:  'timer:seek',
};

export const useTimerStore = create(() => ({
  status:    'stopped', // 'stopped' | 'running' | 'paused'
  remaining: 0,
  total:     0,

  // ── Internal — called by useWebSocket on TIMER_TICK / TIMER_STATE ──────────
  // Accepts Cloudflare shape ({ running, totalSeconds }) and local Express
  // shape ({ status, total }).
  _tick: (payload = {}) => {
    const remaining = payload.remaining ?? 0;
    const total = payload.totalSeconds ?? payload.total ?? 0;
    const running = payload.running ?? payload.status === 'running';

    let status = payload.status;
    if (!status) {
      if (running) {
        status = 'running';
      } else if (remaining <= 0) {
        status = 'stopped';
      } else if (total > 0 && remaining >= total) {
        status = 'stopped';
      } else {
        status = 'paused';
      }
    }

    useTimerStore.setState({ remaining, total, status });
  },

  // ── Controls — all routed through WS; server is the source of truth ────────
  play:    () => send(EV.PLAY),
  pause:   () => send(EV.PAUSE),
  stop:    () => send(EV.STOP),
  reset:   () => send(EV.RESET),
  setTime: (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    send(EV.SET, { h, m, s });
  },
  // Jump to a position without changing the total (plan-mode "play from here")
  seek: (seconds) => send(EV.SEEK, { remaining: seconds }),
}));
