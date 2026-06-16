'use strict';

const { Router }   = require('express');
const { roomDb }   = require('@showstack/db');
const broadcast    = require('../broadcast');

const router = Router();

// ── Active room resolution ────────────────────────────────────────────────────
// 1. Teleprompter rooms with at least one connected WS client → most recent
// 2. Fallback: most recently active teleprompter room in DB
// 3. None → null

function resolveActiveRoom() {
  const rooms = roomDb.listByType('teleprompter');
  if (!rooms.length) return null;

  const connected = rooms.filter(r => broadcast.getRoomSize(r.code) > 0);
  if (connected.length) return connected[0]; // already sorted by last_active DESC

  return rooms[0]; // DB fallback, also sorted by last_active DESC
}

function requireActiveRoom(req, res, next) {
  const room = resolveActiveRoom();
  if (!room) return res.status(404).json({ error: 'No active teleprompter room' });
  req.room = room;
  next();
}

function requireActiveEngine(req, res, next) {
  const getOrCreateEngine = req.app.get('getOrCreateEngine');
  if (!getOrCreateEngine) return res.status(500).json({ error: 'engine registry unavailable' });
  req.prompter = getOrCreateEngine(req.room.code).prompter;
  next();
}

// ── GET /api/prompter/active ──────────────────────────────────────────────────

router.get('/active', (req, res) => {
  const room = resolveActiveRoom();
  if (!room) return res.json({ code: null });

  const getOrCreateEngine = req.app.get('getOrCreateEngine');
  const state = getOrCreateEngine ? getOrCreateEngine(room.code).prompter.getState() : {};
  res.json({
    code:           room.code,
    name:           room.name,
    isPlaying:      state.isPlaying   ?? false,
    speed:          state.speed       ?? 3,
    scrollPosition: state.scrollPosition ?? 0,
  });
});

// ── GET /api/prompter/rooms ───────────────────────────────────────────────────

router.get('/rooms', (req, res) => {
  const getOrCreateEngine = req.app.get('getOrCreateEngine');
  const rooms = roomDb.listByType('teleprompter').map(r => {
    const state = getOrCreateEngine ? getOrCreateEngine(r.code).prompter.getState() : {};
    return {
      code:        r.code,
      name:        r.name,
      last_active: r.last_active,
      isPlaying:   state.isPlaying ?? false,
    };
  });
  res.json(rooms);
});

// ── Active-room mutation endpoints ────────────────────────────────────────────

router.post('/active/play', requireActiveRoom, requireActiveEngine, (req, res) => {
  req.prompter.play();
  res.json({ status: 'ok', roomCode: req.room.code, isPlaying: true });
});

router.post('/active/pause', requireActiveRoom, requireActiveEngine, (req, res) => {
  req.prompter.pause();
  res.json({ status: 'ok', roomCode: req.room.code, isPlaying: false });
});

router.post('/active/stop', requireActiveRoom, requireActiveEngine, (req, res) => {
  req.prompter.stop();
  res.json({ status: 'ok', roomCode: req.room.code, isPlaying: false, scrollPosition: 0 });
});

router.post('/active/speed', requireActiveRoom, requireActiveEngine, (req, res) => {
  const speed = Number(req.body.speed);
  if (!Number.isFinite(speed) || speed < 1 || speed > 10)
    return res.status(400).json({ error: 'speed must be 1–10' });
  req.prompter.setSpeed(speed);
  res.json({ status: 'ok', roomCode: req.room.code, speed: Math.round(speed) });
});

router.post('/active/speed/up', requireActiveRoom, requireActiveEngine, (req, res) => {
  const current  = req.prompter.getState().speed;
  const newSpeed = Math.min(10, current + 1);
  req.prompter.setSpeed(newSpeed);
  res.json({ status: 'ok', roomCode: req.room.code, speed: newSpeed });
});

router.post('/active/speed/down', requireActiveRoom, requireActiveEngine, (req, res) => {
  const current  = req.prompter.getState().speed;
  const newSpeed = Math.max(1, current - 1);
  req.prompter.setSpeed(newSpeed);
  res.json({ status: 'ok', roomCode: req.room.code, speed: newSpeed });
});

router.post('/active/seek', requireActiveRoom, requireActiveEngine, (req, res) => {
  const position = Number(req.body.position);
  if (!Number.isFinite(position) || position < 0)
    return res.status(400).json({ error: 'position must be a non-negative number' });
  req.prompter.seekTo(position);
  res.json({ status: 'ok', roomCode: req.room.code, scrollPosition: position });
});

router.post('/active/cue/:cueId', requireActiveRoom, requireActiveEngine, (req, res) => {
  const engine = req.app.get('getOrCreateEngine')(req.room.code);
  const prompterCue = engine.prompterCues.findById(req.params.cueId);
  if (prompterCue) {
    req.prompter.seekTo(prompterCue.position);
    return res.json({ status: 'ok', roomCode: req.room.code, cueId: req.params.cueId, scrollPosition: prompterCue.position });
  }
  const cue = roomDb.getCueById(req.params.cueId);
  if (!cue || cue.room_code !== req.room.code)
    return res.status(404).json({ error: 'cue not found' });
  const position = cue.trigger_at ?? 0;
  req.prompter.seekTo(position);
  res.json({ status: 'ok', roomCode: req.room.code, cueId: req.params.cueId, scrollPosition: position });
});

module.exports = router;
