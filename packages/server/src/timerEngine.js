'use strict';

const { SERVER_EVENTS } = require('@showstack/shared');

let _broadcast   = null;
let _cueEngine   = null;
let _interval    = null;

const state = {
  status:    'stopped', // 'stopped' | 'running' | 'paused'
  remaining: 0,
  total:     0,
};

function init(broadcastModule) {
  _broadcast = broadcastModule;
}

function setCueEngine(cueEngine) {
  _cueEngine = cueEngine;
}

function getState() {
  return { ...state };
}

function emit(type) {
  _broadcast.broadcast(type, getState());
}

function tick() {
  if (state.remaining <= 0) {
    clearInterval(_interval);
    _interval = null;
    state.status = 'stopped';
    emit(SERVER_EVENTS.TIMER_TICK);
    return;
  }
  state.remaining -= 1;
  if (_cueEngine) _cueEngine.check(state.remaining);
  emit(SERVER_EVENTS.TIMER_TICK);
}

function play() {
  if (state.status === 'running' || state.remaining <= 0) return;
  state.status = 'running';
  _interval = setInterval(tick, 1000);
  emit(SERVER_EVENTS.TIMER_STATE);
}

function pause() {
  if (state.status !== 'running') return;
  clearInterval(_interval);
  _interval = null;
  state.status = 'paused';
  emit(SERVER_EVENTS.TIMER_STATE);
}

function stop() {
  clearInterval(_interval);
  _interval = null;
  state.status    = 'stopped';
  state.remaining = state.total;
  emit(SERVER_EVENTS.TIMER_STATE);
}

function reset() {
  clearInterval(_interval);
  _interval = null;
  state.status    = 'stopped';
  state.remaining = state.total;
  emit(SERVER_EVENTS.TIMER_STATE);
}

function setTime(seconds) {
  clearInterval(_interval);
  _interval       = null;
  state.total     = seconds;
  state.remaining = seconds;
  state.status    = 'stopped';
  emit(SERVER_EVENTS.TIMER_STATE);
}

module.exports = { init, setCueEngine, getState, play, pause, stop, reset, setTime };
