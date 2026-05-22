'use strict';

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

function parseRow(row) {
  if (!row) return null;
  const { settings_json, ...rest } = row;
  return { ...rest, settings: JSON.parse(settings_json) };
}

function create({ name, description = null, settings = {} }) {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO projects (id, name, description, settings_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, description, JSON.stringify(settings), now, now);
  return getById(id);
}

function getById(id) {
  const db = getDb();
  return parseRow(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
}

function list() {
  const db = getDb();
  return db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all().map(parseRow);
}

function update(id, { name, description, settings }) {
  const db = getDb();
  const fields = ['updated_at = ?'];
  const values = [new Date().toISOString()];

  if (name !== undefined)        { fields.push('name = ?');          values.push(name); }
  if (description !== undefined) { fields.push('description = ?');   values.push(description); }
  if (settings !== undefined)    { fields.push('settings_json = ?'); values.push(JSON.stringify(settings)); }

  values.push(id);
  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getById(id);
}

function remove(id) {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
}

module.exports = { create, getById, list, update, remove };
