'use strict';

const { Router } = require('express');
const { projects, cues } = require('@showstack/db');
const { SERVER_EVENTS } = require('@showstack/shared');
const broadcast = require('../broadcast');

const router = Router();

router.get('/', (req, res) => {
  res.json(projects.list());
});

router.post('/', (req, res) => {
  const { name, description, settings } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  res.status(201).json(projects.create({ name, description, settings }));
});

router.get('/:id', (req, res) => {
  const project = projects.getById(req.params.id);
  if (!project) return res.status(404).json({ error: 'not found' });
  res.json(project);
});

router.patch('/:id', (req, res) => {
  if (!projects.getById(req.params.id)) return res.status(404).json({ error: 'not found' });
  const updated = projects.update(req.params.id, req.body);
  broadcast.broadcast(SERVER_EVENTS.PROJECT_SAVED, { project: updated });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  if (!projects.getById(req.params.id)) return res.status(404).json({ error: 'not found' });
  projects.remove(req.params.id);
  res.status(204).end();
});

// ── Cue sub-routes ────────────────────────────────────────────────────────────

function requireProject(req, res, next) {
  if (!projects.getById(req.params.id)) return res.status(404).json({ error: 'project not found' });
  next();
}

router.get('/:id/cues', requireProject, (req, res) => {
  res.json(cues.listByProject(req.params.id));
});

router.post('/:id/cues', requireProject, (req, res) => {
  const { trigger_at, label, actions = [], order_index = 0 } = req.body;
  if (trigger_at === undefined || !label) {
    return res.status(400).json({ error: 'trigger_at and label are required' });
  }
  res.status(201).json(cues.create({
    projectId:  req.params.id,
    triggerAt:  Number(trigger_at),
    label,
    actions,
    orderIndex: Number(order_index),
  }));
});

router.put('/:id/cues/:cueId', requireProject, (req, res) => {
  const existing = cues.getById(req.params.cueId);
  if (!existing || existing.project_id !== req.params.id) {
    return res.status(404).json({ error: 'cue not found' });
  }
  const { trigger_at, label, actions, order_index } = req.body;
  res.json(cues.update(req.params.cueId, {
    triggerAt:  trigger_at !== undefined ? Number(trigger_at) : undefined,
    label,
    actions,
    orderIndex: order_index !== undefined ? Number(order_index) : undefined,
  }));
});

router.delete('/:id/cues/:cueId', requireProject, (req, res) => {
  const existing = cues.getById(req.params.cueId);
  if (!existing || existing.project_id !== req.params.id) {
    return res.status(404).json({ error: 'cue not found' });
  }
  cues.remove(req.params.cueId);
  res.status(204).end();
});

module.exports = router;
