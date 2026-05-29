import { create } from 'zustand';
import { send } from '../wsClient.js';

// Client constants inlined to avoid @showstack/shared CJS import at module init.
const EV = {
  PLAY:  'timer:play',
  PAUSE: 'timer:pause',
  STOP:  'timer:stop',
  RESET: 'timer:reset',
  SET:   'timer:set',
};

export const useTimerStore = create(() => ({
  status:    'stopped', // 'stopped' | 'running' | 'paused'
  remaining: 0,
  total:     0,

  // ── Internal — called by useWebSocket on TIMER_TICK / TIMER_STATE ──────────
  _tick: ({ remaining = 0, totalSeconds = 0, running = false }) => {
    useTimerStore.setState({
      remaining,
      total: totalSeconds,
      status: running ? 'running' : remaining > 0 ? 'paused' : 'stopped',
    });
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
}));
