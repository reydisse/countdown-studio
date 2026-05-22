'use strict';

// In-memory mirror of the client's settingsStore + resolved asset URLs.
// Updated by the React app via POST /api/settings; read by the output page.
let _current = {};

module.exports = {
  get:   ()      => _current,
  merge: (patch) => { _current = { ..._current, ...patch }; },
};
