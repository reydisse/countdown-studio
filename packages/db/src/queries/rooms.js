'use strict';

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

function parseRoom(row) {
  if (!row) return null;
  const { settings_json, ...rest } = row;
  return { ...rest, settings: JSON.parse(settings_json) };
}

function parseAsset(row) {
  if (!row) return null;
  const { tags, ...rest } = row;
  return { ...rest, tags: JSON.parse(tags) };
}

function parseCue(row) {
  if (!row) return null;
  const { actions_json, ...rest } = row;
  return { ...rest, actions: JSON.parse(actions_json) };
}

// ── Rooms ─────────────────────────────────────────────────────────────────────

const ROOM_TTL_MS = 30 * 60 * 1000; // 30 min

function createRoom({ code, name, type = 'countdown', isPermanent = false }) {
  const db       = getDb();
  const id       = uuidv4();
  const now      = Date.now();
  const expiresAt = isPermanent ? null : now + ROOM_TTL_MS;
  db.prepare(`
    INSERT INTO rooms (id, code, name, type, settings_json, is_permanent, last_active, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, code, name, type, '{}', isPermanent ? 1 : 0, now, now, expiresAt);
  return getByCode(code);
}

function getByCode(code) {
  return parseRoom(getDb().prepare('SELECT * FROM rooms WHERE code = ?').get(code));
}

function updateSettings(code, settings) {
  getDb().prepare('UPDATE rooms SET settings_json = ? WHERE code = ?')
    .run(JSON.stringify(settings), code);
  return getByCode(code);
}

function updateLastActive(code) {
  const now = Date.now();
  getDb().prepare(
    'UPDATE rooms SET last_active = ?, expires_at = CASE WHEN is_permanent = 0 THEN ? ELSE NULL END WHERE code = ?'
  ).run(now, now + ROOM_TTL_MS, code);
}

function deleteExpired() {
  return getDb()
    .prepare('DELETE FROM rooms WHERE is_permanent = 0 AND expires_at IS NOT NULL AND expires_at < ?')
    .run(Date.now()).changes;
}

function listByType(type) {
  return getDb()
    .prepare('SELECT * FROM rooms WHERE type = ? ORDER BY last_active DESC')
    .all(type)
    .map(parseRoom);
}

function deleteRoom(code) {
  getDb().prepare('DELETE FROM rooms WHERE code = ?').run(code);
}

// ── Room Assets ───────────────────────────────────────────────────────────────

function createAsset({ roomCode, name, type, url, size, duration = null, thumbnailUrl = null, tags = [] }) {
  const db  = getDb();
  const id  = uuidv4();
  const now = Date.now();
  db.prepare(`
    INSERT INTO room_assets (id, room_code, name, type, url, size, duration, thumbnail_url, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, roomCode, name, type, url, size, duration, thumbnailUrl, JSON.stringify(tags), now);
  return getAssetById(id);
}

function getAssetById(id) {
  return parseAsset(getDb().prepare('SELECT * FROM room_assets WHERE id = ?').get(id));
}

function listAssets(roomCode, type) {
  const db = getDb();
  if (type) {
    return db.prepare('SELECT * FROM room_assets WHERE room_code = ? AND type = ? ORDER BY created_at DESC')
      .all(roomCode, type).map(parseAsset);
  }
  return db.prepare('SELECT * FROM room_assets WHERE room_code = ? ORDER BY created_at DESC')
    .all(roomCode).map(parseAsset);
}

function deleteAsset(id) {
  getDb().prepare('DELETE FROM room_assets WHERE id = ?').run(id);
}

// ── Room Cues ─────────────────────────────────────────────────────────────────

function createCue({ roomCode, triggerAt, label = '', actions = [], orderIndex = 0 }) {
  const db  = getDb();
  const id  = uuidv4();
  const now = Date.now();
  db.prepare(`
    INSERT INTO room_cues (id, room_code, trigger_at, label, actions_json, order_index, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, roomCode, triggerAt, label, JSON.stringify(actions), orderIndex, now);
  return getCueById(id);
}

function getCueById(id) {
  return parseCue(getDb().prepare('SELECT * FROM room_cues WHERE id = ?').get(id));
}

function listCues(roomCode) {
  return getDb()
    .prepare('SELECT * FROM room_cues WHERE room_code = ? ORDER BY order_index ASC, created_at ASC')
    .all(roomCode)
    .map(parseCue);
}

function updateCue(id, { triggerAt, label, actions, orderIndex }) {
  const db     = getDb();
  const fields = [];
  const values = [];
  if (triggerAt   !== undefined) { fields.push('trigger_at = ?');   values.push(triggerAt); }
  if (label       !== undefined) { fields.push('label = ?');        values.push(label); }
  if (actions     !== undefined) { fields.push('actions_json = ?'); values.push(JSON.stringify(actions)); }
  if (orderIndex  !== undefined) { fields.push('order_index = ?');  values.push(orderIndex); }
  if (!fields.length) return getCueById(id);
  values.push(id);
  db.prepare(`UPDATE room_cues SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getCueById(id);
}

function deleteCue(id) {
  getDb().prepare('DELETE FROM room_cues WHERE id = ?').run(id);
}

// ── Room Scripts ──────────────────────────────────────────────────────────────

function createScript({ roomCode, name, content = '' }) {
  const db  = getDb();
  const id  = uuidv4();
  const now = Date.now();
  db.prepare(`
    INSERT INTO room_scripts (id, room_code, name, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, roomCode, name, content, now, now);
  return getScriptById(id);
}

function getScriptById(id) {
  return getDb().prepare('SELECT * FROM room_scripts WHERE id = ?').get(id);
}

function listScripts(roomCode) {
  return getDb()
    .prepare('SELECT * FROM room_scripts WHERE room_code = ? ORDER BY created_at ASC')
    .all(roomCode);
}

function updateScript(id, { name, content }) {
  const db     = getDb();
  const fields = ['updated_at = ?'];
  const values = [Date.now()];
  if (name    !== undefined) { fields.push('name = ?');    values.push(name); }
  if (content !== undefined) { fields.push('content = ?'); values.push(content); }
  values.push(id);
  db.prepare(`UPDATE room_scripts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getScriptById(id);
}

function deleteScript(id) {
  getDb().prepare('DELETE FROM room_scripts WHERE id = ?').run(id);
}

module.exports = {
  createRoom, getByCode, updateSettings, updateLastActive, deleteRoom, listByType, deleteExpired,
  createAsset, getAssetById, listAssets, deleteAsset,
  createCue, getCueById, listCues, updateCue, deleteCue,
  createScript, getScriptById, listScripts, updateScript, deleteScript,
};
