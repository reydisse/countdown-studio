'use strict';

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

function parseRow(row) {
  if (!row) return null;
  const { actions_json, ...rest } = row;
  return { ...rest, actions: JSON.parse(actions_json) };
}

function create({ projectId, triggerAt, label, actions = [], orderIndex = 0 }) {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO cues (id, project_id, trigger_at, label, actions_json, order_index, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, projectId, triggerAt, label, JSON.stringify(actions), orderIndex, now);
  return getById(id);
}

function getById(id) {
  const db = getDb();
  return parseRow(db.prepare('SELECT * FROM cues WHERE id = ?').get(id));
}

function listByProject(projectId) {
  const db = getDb();
  return db
    .prepare('SELECT * FROM cues WHERE project_id = ? ORDER BY order_index ASC, created_at ASC')
    .all(projectId)
    .map(parseRow);
}

function update(id, { triggerAt, label, actions, orderIndex }) {
  const db = getDb();
  const fields = [];
  const values = [];

  if (triggerAt !== undefined)   { fields.push('trigger_at = ?');    values.push(triggerAt); }
  if (label !== undefined)       { fields.push('label = ?');         values.push(label); }
  if (actions !== undefined)     { fields.push('actions_json = ?');  values.push(JSON.stringify(actions)); }
  if (orderIndex !== undefined)  { fields.push('order_index = ?');   values.push(orderIndex); }

  if (!fields.length) return getById(id);
  values.push(id);
  db.prepare(`UPDATE cues SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getById(id);
}

function remove(id) {
  getDb().prepare('DELETE FROM cues WHERE id = ?').run(id);
}

// Reorders all cues in a project in a single transaction.
// orderedIds: cue ids in the desired display order (index 0 = top).
function reorder(projectId, orderedIds) {
  const db = getDb();
  const stmt = db.prepare(
    'UPDATE cues SET order_index = ? WHERE id = ? AND project_id = ?',
  );
  db.transaction(() => {
    orderedIds.forEach((id, index) => stmt.run(index, id, projectId));
  })();
}

module.exports = { create, getById, listByProject, update, remove, reorder };
