'use strict';

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

function parseRow(row) {
  if (!row) return null;
  const { tags, ...rest } = row;
  return { ...rest, tags: JSON.parse(tags) };
}

function create({
  name,
  type,
  path: filePath = null,
  url = null,
  size = null,
  duration = null,
  thumbnailPath = null,
  thumbnailUrl = null,
  tags = [],
}) {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO assets
      (id, name, type, path, url, size, duration, thumbnail_path, thumbnail_url, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type, filePath, url, size, duration, thumbnailPath, thumbnailUrl, JSON.stringify(tags), now);
  return getById(id);
}

function getById(id) {
  const db = getDb();
  return parseRow(db.prepare('SELECT * FROM assets WHERE id = ?').get(id));
}

function list({ type } = {}) {
  const db = getDb();
  if (type) {
    return db.prepare('SELECT * FROM assets WHERE type = ? ORDER BY created_at DESC')
      .all(type)
      .map(parseRow);
  }
  return db.prepare('SELECT * FROM assets ORDER BY created_at DESC').all().map(parseRow);
}

function update(id, {
  name,
  type,
  path: filePath,
  url,
  size,
  duration,
  thumbnailPath,
  thumbnailUrl,
  tags,
}) {
  const db = getDb();
  const fields = [];
  const values = [];

  if (name !== undefined)          { fields.push('name = ?');           values.push(name); }
  if (type !== undefined)          { fields.push('type = ?');           values.push(type); }
  if (filePath !== undefined)      { fields.push('path = ?');           values.push(filePath); }
  if (url !== undefined)           { fields.push('url = ?');            values.push(url); }
  if (size !== undefined)          { fields.push('size = ?');           values.push(size); }
  if (duration !== undefined)      { fields.push('duration = ?');       values.push(duration); }
  if (thumbnailPath !== undefined) { fields.push('thumbnail_path = ?'); values.push(thumbnailPath); }
  if (thumbnailUrl !== undefined)  { fields.push('thumbnail_url = ?');  values.push(thumbnailUrl); }
  if (tags !== undefined)          { fields.push('tags = ?');           values.push(JSON.stringify(tags)); }

  if (!fields.length) return getById(id);
  values.push(id);
  db.prepare(`UPDATE assets SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getById(id);
}

function remove(id) {
  getDb().prepare('DELETE FROM assets WHERE id = ?').run(id);
}

module.exports = { create, getById, list, update, remove };
