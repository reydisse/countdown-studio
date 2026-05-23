'use strict';

const { Router } = require('express');
const state      = require('../settingsState');

const router = Router();

// GET — initial state fetch (used by output page on connect)
router.get('/', (_req, res) => {
  res.json(state.get());
});

// POST — kept for backward compat but does NOT broadcast.
// Real-time sync now goes through the 'settings:update' WS message
// (see server/index.js) which uses broadcastExcept to avoid echo loops.
router.post('/', (req, res) => {
  state.merge(req.body);
  res.json({ ok: true });
});

module.exports = router;
