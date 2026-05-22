'use strict';

const { getDb, closeDb } = require('./db');
const projects = require('./queries/projects');
const assets   = require('./queries/assets');
const cues     = require('./queries/cues');

module.exports = { getDb, closeDb, projects, assets, cues };
