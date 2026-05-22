'use strict';

const { Router } = require('express');
const broadcast  = require('../broadcast');
const state      = require('../settingsState');

const router = Router();

router.get('/', (_req, res) => {
  res.json(state.get());
});

router.post('/', (req, res) => {
  state.merge(req.body);
  broadcast.broadcast('settings:changed', state.get());
  res.json({ ok: true });
});

module.exports = router;
