'use strict';

const { Router } = require('express');
const multer = require('multer');
const os = require('os');
const { assets } = require('@showstack/db');
const { processUpload } = require('@showstack/media');
const { SERVER_EVENTS } = require('@showstack/shared');
const broadcast = require('../broadcast');

const router = Router();
const upload = multer({ dest: os.tmpdir() });

router.get('/', (req, res) => {
  const { type } = req.query;
  res.json(assets.list(type ? { type } : undefined));
});

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  try {
    const assetData = await processUpload(req.file);
    const asset = assets.create(assetData);
    broadcast.broadcast(SERVER_EVENTS.ASSET_ADDED, { asset });
    res.status(201).json(asset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const asset = assets.getById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'not found' });
  res.json(asset);
});

router.patch('/:id', (req, res) => {
  if (!assets.getById(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.json(assets.update(req.params.id, req.body));
});

router.delete('/:id', (req, res) => {
  const asset = assets.getById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'not found' });
  assets.remove(req.params.id);
  broadcast.broadcast(SERVER_EVENTS.ASSET_REMOVED, { id: req.params.id });
  res.status(204).end();
});

module.exports = router;
