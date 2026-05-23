'use strict';

const http = require('http');
const path = require('path');
const fs   = require('fs');

const express = require('express');
const cors    = require('cors');
const { WebSocketServer } = require('ws');

const { getDb }                         = require('@countdown/db');
const { resolveMediaDir, resolveDataDir, ensureDirs } = require('@countdown/media');
const { SERVER_EVENTS, CLIENT_EVENTS }  = require('@countdown/shared');

const PORT = process.env.PORT ? Number(process.env.PORT) : 9876;

// ── Bootstrap storage ────────────────────────────────────────────────────────
const dataDir = resolveDataDir();
fs.mkdirSync(dataDir, { recursive: true });
getDb(path.join(dataDir, 'countdown.db'));
ensureDirs();

// ── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.use('/media', express.static(resolveMediaDir()));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/assets',   require('./routes/assets'));
app.use('/api/timer',    require('./routes/timer'));
app.use('/api/settings', require('./routes/settings'));

app.get('/output', (_req, res) => {
  res.sendFile(path.join(__dirname, 'output.html'));
});

// ── Serve built frontend (must come AFTER all /api/* and /media/* routes) ─────
// Build with: pnpm build:web  →  apps/web/dist/
const distPath = path.resolve(__dirname, '../../../apps/web/dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── HTTP + WS server ─────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

// ── Module init (order matters) ──────────────────────────────────────────────
const broadcast   = require('./broadcast');
broadcast.init(wss);

const timerEngine = require('./timerEngine');
timerEngine.init(broadcast);

const cueEngine   = require('./cueEngine');
cueEngine.init(broadcast);
timerEngine.setCueEngine(cueEngine);

// ── WS connection handler ────────────────────────────────────────────────────
const settingsState  = require('./settingsState');
const { broadcastExcept } = require('./broadcast');

wss.on('connection', (socket) => {
  broadcast.send(socket, SERVER_EVENTS.TIMER_STATE, timerEngine.getState());
  broadcast.send(socket, 'settings:changed', settingsState.get());

  socket.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, payload = {} } = msg;

    switch (type) {
      case CLIENT_EVENTS.TIMER_PLAY:
        timerEngine.play();
        break;
      case CLIENT_EVENTS.TIMER_PAUSE:
        timerEngine.pause();
        break;
      case CLIENT_EVENTS.TIMER_STOP:
        timerEngine.stop();
        cueEngine.resetFired();
        break;
      case CLIENT_EVENTS.TIMER_RESET:
        timerEngine.reset();
        cueEngine.resetFired();
        break;
      case CLIENT_EVENTS.TIMER_SET:
        if (typeof payload.seconds === 'number') timerEngine.setTime(payload.seconds);
        break;
      case CLIENT_EVENTS.LOAD_PROJECT:
        if (payload.projectId) cueEngine.load(payload.projectId);
        break;
      case CLIENT_EVENTS.FIRE_CUE:
        if (payload.cue) broadcast.broadcast(SERVER_EVENTS.CUE_FIRED, { cue: payload.cue });
        break;

      // Studio pushes its full settings state via WS so all other clients
      // (other studio windows, output page) stay in sync in real time.
      case 'settings:update':
        settingsState.merge(payload);
        broadcastExcept(socket, 'settings:changed', settingsState.get());
        break;
    }
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  process.stdout.write('READY\n');
});
