'use strict';

const { Router } = require('express');
const multer = require('multer');

const { getDb }                         = require('@showstack/db');
const { roomDb }                        = require('@showstack/db');
const { generateRoomCode, isValidRoomCode } = require('@showstack/shared');
const { processUpload, deleteMedia }    = require('@showstack/media');
const { SERVER_EVENTS }                 = require('@showstack/shared');
const broadcast                         = require('../broadcast');

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
});

// ── Middleware ────────────────────────────────────────────────────────────────

function requireRoom(req, res, next) {
  const room = roomDb.getByCode(req.params.code);
  if (!room) return res.status(404).json({ error: 'room not found' });
  req.room = room;
  next();
}

// ── Room CRUD ─────────────────────────────────────────────────────────────────

router.post('/', (req, res) => {
  const { name, type = 'countdown', isPermanent = false } = req.body;
  if (!name || typeof name !== 'string' || !name.trim())
    return res.status(400).json({ error: 'name is required' });
  if (name.length > 256)
    return res.status(400).json({ error: 'name must be 256 characters or fewer' });
  const validTypes = ['countdown', 'teleprompter'];
  if (!validTypes.includes(type))
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
  const db   = getDb();
  const code = generateRoomCode(db);
  const room = roomDb.createRoom({ code, name: name.trim(), type, isPermanent: !!isPermanent });
  res.status(201).json(room);
});

router.get('/:code', (req, res) => {
  if (!isValidRoomCode(req.params.code)) return res.status(400).json({ error: 'invalid room code format' });
  const room = roomDb.getByCode(req.params.code);
  if (!room) return res.status(404).json({ error: 'room not found' });
  res.json(room);
});

router.patch('/:code', requireRoom, (req, res) => {
  const { settings } = req.body;
  if (!settings) return res.status(400).json({ error: 'settings is required' });
  res.json(roomDb.updateSettings(req.params.code, settings));
});

router.delete('/:code', requireRoom, (req, res) => {
  roomDb.deleteRoom(req.params.code);
  res.status(204).end();
});

// ── Assets ────────────────────────────────────────────────────────────────────

router.get('/:code/assets', requireRoom, (req, res) => {
  const { type } = req.query;
  res.json(roomDb.listAssets(req.params.code, type || undefined));
});

router.post('/:code/assets', requireRoom, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  try {
    const assetData = await processUpload(req.file, req.params.code);
    const asset     = roomDb.createAsset({ roomCode: req.params.code, ...assetData });
    broadcast.broadcastToRoom(req.params.code, SERVER_EVENTS.ASSET_ADDED, { asset });
    res.status(201).json(asset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:code/assets/:id', requireRoom, async (req, res) => {
  const asset = roomDb.getAssetById(req.params.id);
  if (!asset || asset.room_code !== req.params.code) return res.status(404).json({ error: 'asset not found' });
  await deleteMedia(asset.url, asset.thumbnail_url).catch(() => {});
  roomDb.deleteAsset(req.params.id);
  broadcast.broadcastToRoom(req.params.code, SERVER_EVENTS.ASSET_REMOVED, { id: req.params.id });
  res.status(204).end();
});

// ── Cues ──────────────────────────────────────────────────────────────────────

router.get('/:code/cues', requireRoom, (req, res) => {
  res.json(roomDb.listCues(req.params.code));
});

router.post('/:code/cues', requireRoom, (req, res) => {
  const { trigger_at, label, actions = [], order_index = 0 } = req.body;
  if (trigger_at === undefined) return res.status(400).json({ error: 'trigger_at is required' });
  res.status(201).json(roomDb.createCue({
    roomCode:   req.params.code,
    triggerAt:  Number(trigger_at),
    label:      label ?? '',
    actions,
    orderIndex: Number(order_index),
  }));
});

router.put('/:code/cues/:id', requireRoom, (req, res) => {
  const existing = roomDb.getCueById(req.params.id);
  if (!existing || existing.room_code !== req.params.code) return res.status(404).json({ error: 'cue not found' });
  const { trigger_at, label, actions, order_index } = req.body;
  res.json(roomDb.updateCue(req.params.id, {
    triggerAt:  trigger_at  !== undefined ? Number(trigger_at)  : undefined,
    label,
    actions,
    orderIndex: order_index !== undefined ? Number(order_index) : undefined,
  }));
});

router.delete('/:code/cues/:id', requireRoom, (req, res) => {
  const existing = roomDb.getCueById(req.params.id);
  if (!existing || existing.room_code !== req.params.code) return res.status(404).json({ error: 'cue not found' });
  roomDb.deleteCue(req.params.id);
  res.status(204).end();
});

// ── Prompter control (Stream Deck / Companion) ────────────────────────────────

function requirePrompterEngine(req, res, next) {
  const getOrCreateEngine = req.app.get('getOrCreateEngine');
  if (!getOrCreateEngine) return res.status(500).json({ error: 'engine registry unavailable' });
  req.prompter = getOrCreateEngine(req.params.code).prompter;
  next();
}

router.get('/:code/prompter/state', requireRoom, requirePrompterEngine, (req, res) => {
  const state = req.prompter.getState();
  res.json({ ...state, roomCode: req.params.code });
});

router.post('/:code/prompter/play', requireRoom, requirePrompterEngine, (req, res) => {
  req.prompter.play();
  res.json({ status: 'ok', isPlaying: true });
});

router.post('/:code/prompter/pause', requireRoom, requirePrompterEngine, (req, res) => {
  req.prompter.pause();
  res.json({ status: 'ok', isPlaying: false });
});

router.post('/:code/prompter/stop', requireRoom, requirePrompterEngine, (req, res) => {
  req.prompter.stop();
  res.json({ status: 'ok', isPlaying: false, scrollPosition: 0 });
});

router.post('/:code/prompter/speed', requireRoom, requirePrompterEngine, (req, res) => {
  const speed = Number(req.body.speed);
  if (!Number.isFinite(speed) || speed < 1 || speed > 10)
    return res.status(400).json({ error: 'speed must be 1–10' });
  req.prompter.setSpeed(speed);
  res.json({ status: 'ok', speed: Math.round(speed) });
});

router.post('/:code/prompter/speed/up', requireRoom, requirePrompterEngine, (req, res) => {
  const current  = req.prompter.getState().speed;
  const newSpeed = Math.min(10, current + 1);
  req.prompter.setSpeed(newSpeed);
  res.json({ status: 'ok', speed: newSpeed });
});

router.post('/:code/prompter/speed/down', requireRoom, requirePrompterEngine, (req, res) => {
  const current  = req.prompter.getState().speed;
  const newSpeed = Math.max(1, current - 1);
  req.prompter.setSpeed(newSpeed);
  res.json({ status: 'ok', speed: newSpeed });
});

router.post('/:code/prompter/seek', requireRoom, requirePrompterEngine, (req, res) => {
  const position = Number(req.body.position);
  if (!Number.isFinite(position) || position < 0)
    return res.status(400).json({ error: 'position must be a non-negative number' });
  req.prompter.seekTo(position);
  res.json({ status: 'ok', scrollPosition: position });
});

router.post('/:code/prompter/cue/:cueId', requireRoom, requirePrompterEngine, (req, res) => {
  const cue = roomDb.getCueById(req.params.cueId);
  if (!cue || cue.room_code !== req.params.code)
    return res.status(404).json({ error: 'cue not found' });
  const position = cue.trigger_at ?? 0;
  req.prompter.seekTo(position);
  res.json({ status: 'ok', cueId: req.params.cueId, scrollPosition: position });
});

// ── Scripts ───────────────────────────────────────────────────────────────────

router.get('/:code/scripts', requireRoom, (req, res) => {
  res.json(roomDb.listScripts(req.params.code));
});

router.post('/:code/scripts', requireRoom, (req, res) => {
  const { name, content = '' } = req.body;
  if (!name || typeof name !== 'string' || !name.trim())
    return res.status(400).json({ error: 'name is required' });
  if (typeof content !== 'string' || content.length > 2_000_000)
    return res.status(400).json({ error: 'content must be a string under 2 MB' });
  res.status(201).json(roomDb.createScript({ roomCode: req.params.code, name: name.trim(), content }));
});

router.put('/:code/scripts/:id', requireRoom, (req, res) => {
  const existing = roomDb.getScriptById(req.params.id);
  if (!existing || existing.room_code !== req.params.code) return res.status(404).json({ error: 'script not found' });
  const { name, content } = req.body;
  if (content !== undefined && (typeof content !== 'string' || content.length > 2_000_000))
    return res.status(400).json({ error: 'content must be a string under 2 MB' });
  res.json(roomDb.updateScript(req.params.id, { name, content }));
});

router.delete('/:code/scripts/:id', requireRoom, (req, res) => {
  const existing = roomDb.getScriptById(req.params.id);
  if (!existing || existing.room_code !== req.params.code) return res.status(404).json({ error: 'script not found' });
  roomDb.deleteScript(req.params.id);
  res.status(204).end();
});

module.exports = router;
