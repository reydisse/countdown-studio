'use strict';

const { SERVER_EVENTS }        = require('@showstack/shared');
const { createPrompterEngine } = require('./prompterEngine');

function createRoomEngine(broadcast) {
  const prompter = createPrompterEngine(broadcast);
  // ── Timer state ─────────────────────────────────────────────────────────────
  const timerState = { status: 'stopped', remaining: 0, total: 0 };
  let _interval    = null;

  // ── Cue state ───────────────────────────────────────────────────────────────
  let _activeCues = [];
  let _fired      = new Set();

  // ── Settings state ──────────────────────────────────────────────────────────
  let _settings = {};
  let _prompterCues = [];

  function timerPayload() {
    return {
      remaining: timerState.remaining,
      totalSeconds: timerState.total,
      total: timerState.total,
      running: timerState.status === 'running',
      status: timerState.status,
    };
  }

  function emitTimer(type) {
    broadcast(type, timerPayload());
  }

  function checkCues(remaining) {
    for (const cue of _activeCues) {
      if (!_fired.has(cue.id) && cue.trigger_at === remaining) {
        _fired.add(cue.id);
        broadcast(SERVER_EVENTS.CUE_FIRED, { cue });
      }
    }
  }

  function tick() {
    if (timerState.remaining <= 0) {
      clearInterval(_interval);
      _interval = null;
      timerState.status = 'stopped';
      emitTimer(SERVER_EVENTS.TIMER_TICK);
      return;
    }
    timerState.remaining -= 1;
    checkCues(timerState.remaining);
    emitTimer(SERVER_EVENTS.TIMER_TICK);
  }

  const timer = {
    play() {
      if (timerState.status === 'running' || timerState.remaining <= 0) return;
      timerState.status = 'running';
      _interval = setInterval(tick, 1000);
      emitTimer(SERVER_EVENTS.TIMER_STATE);
    },
    pause() {
      if (timerState.status !== 'running') return;
      clearInterval(_interval);
      _interval = null;
      timerState.status = 'paused';
      emitTimer(SERVER_EVENTS.TIMER_STATE);
    },
    stop() {
      clearInterval(_interval);
      _interval = null;
      timerState.status    = 'stopped';
      timerState.remaining = timerState.total;
      emitTimer(SERVER_EVENTS.TIMER_STATE);
    },
    reset() {
      clearInterval(_interval);
      _interval = null;
      timerState.status    = 'stopped';
      timerState.remaining = timerState.total;
      emitTimer(SERVER_EVENTS.TIMER_STATE);
    },
    setTime(seconds) {
      clearInterval(_interval);
      _interval            = null;
      timerState.total     = seconds;
      timerState.remaining = seconds;
      timerState.status    = 'stopped';
      emitTimer(SERVER_EVENTS.TIMER_STATE);
    },
    seek(seconds) {
      clearInterval(_interval);
      _interval = null;
      timerState.remaining = Math.max(0, Math.min(timerState.total, Math.floor(seconds)));
      timerState.status    = timerState.remaining > 0 ? 'paused' : 'stopped';
      emitTimer(SERVER_EVENTS.TIMER_STATE);
    },
    getState() { return timerPayload(); },
    destroy()  { clearInterval(_interval); _interval = null; },
  };

  const cue = {
    load(cues) {
      _activeCues = cues;
      _fired      = new Set();
    },
    resetFired() { _fired = new Set(); },
    add(c)       { _activeCues.push(c); },
    update(c)    {
      const i = _activeCues.findIndex(x => x.id === c.id);
      if (i !== -1) _activeCues[i] = c;
    },
    remove(id)   {
      _activeCues = _activeCues.filter(c => c.id !== id);
      _fired.delete(id);
    },
  };

  const settings = {
    get()        { return _settings; },
    merge(patch) { _settings = { ..._settings, ...patch }; },
  };

  const prompterCues = {
    get()           { return _prompterCues; },
    set(cues)       { _prompterCues = cues; },
    findById(id)    { return _prompterCues.find(c => c.id === id); },
  };

  return { timer, cue, settings, prompter, prompterCues };
}

module.exports = { createRoomEngine };
