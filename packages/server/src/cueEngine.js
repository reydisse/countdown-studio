'use strict';

const { SERVER_EVENTS } = require('@countdown/shared');
const { cues } = require('@countdown/db');

let _broadcast   = null;
let _activeCues  = [];
let _fired       = new Set();

function init(broadcastModule) {
  _broadcast = broadcastModule;
}

// Loads all cues for a project into memory and clears fired state.
function load(projectId) {
  _activeCues = cues.listByProject(projectId);
  _fired      = new Set();
}

// Called by timerEngine every tick. Fires matching cues exactly once per run.
function check(remainingSeconds) {
  for (const cue of _activeCues) {
    if (!_fired.has(cue.id) && cue.trigger_at === remainingSeconds) {
      _fired.add(cue.id);
      _broadcast.broadcast(SERVER_EVENTS.CUE_FIRED, { cue });
    }
  }
}

function add(cue) {
  _activeCues.push(cue);
}

function update(updatedCue) {
  const idx = _activeCues.findIndex(c => c.id === updatedCue.id);
  if (idx !== -1) _activeCues[idx] = updatedCue;
}

function remove(id) {
  _activeCues = _activeCues.filter(c => c.id !== id);
  _fired.delete(id);
}

function resetFired() {
  _fired = new Set();
}

module.exports = { init, load, check, add, update, remove, resetFired };
