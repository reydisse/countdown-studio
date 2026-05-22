'use strict';

const { Router } = require('express');
const timerEngine = require('../timerEngine');
const cueEngine   = require('../cueEngine');

const router = Router();

router.get('/state', (req, res) => {
  res.json(timerEngine.getState());
});

router.post('/play', (req, res) => {
  timerEngine.play();
  res.json(timerEngine.getState());
});

router.post('/pause', (req, res) => {
  timerEngine.pause();
  res.json(timerEngine.getState());
});

router.post('/stop', (req, res) => {
  timerEngine.stop();
  cueEngine.resetFired();
  res.json(timerEngine.getState());
});

router.post('/reset', (req, res) => {
  timerEngine.reset();
  cueEngine.resetFired();
  res.json(timerEngine.getState());
});

router.post('/set', (req, res) => {
  const { seconds } = req.body;
  if (typeof seconds !== 'number' || seconds < 0) {
    return res.status(400).json({ error: 'seconds must be a non-negative number' });
  }
  timerEngine.setTime(seconds);
  res.json(timerEngine.getState());
});

module.exports = router;
