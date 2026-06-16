'use strict';

const http = require('http');
const path = require('path');
const fs   = require('fs');

const express   = require('express');
const cors      = require('cors');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const { WebSocketServer } = require('ws');

const { getDb, closeDb, roomDb }        = require('@showstack/db');
const { resolveMediaDir, resolveDataDir, ensureDirs } = require('@showstack/media');
const { SERVER_EVENTS, CLIENT_EVENTS }  = require('@showstack/shared');
const logger                            = require('./logger');

const PORT = process.env.PORT ? Number(process.env.PORT) : 9876;

// ── Bootstrap storage ────────────────────────────────────────────────────────
const dataDir = resolveDataDir();
fs.mkdirSync(dataDir, { recursive: true });
getDb(path.join(dataDir, 'countdown.db'));
ensureDirs();

// ── Express ──────────────────────────────────────────────────────────────────
const app = express();

// CORS — restrict to explicit origins when CORS_ORIGINS env is set
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : null;
app.use(cors({ origin: allowedOrigins ?? '*' }));

// HTTP request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (req) => req.url === '/api/health',
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Rate limiting — 300 req/min per IP across all API routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});
app.use('/api/', apiLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/media',         express.static(resolveMediaDir()));
app.use('/api/rooms',     require('./routes/rooms'));
app.use('/api/prompter',  require('./routes/prompter'));
app.use('/api/projects',  require('./routes/projects'));
app.use('/api/assets',    require('./routes/assets'));
app.use('/api/timer',     require('./routes/timer'));
app.use('/api/settings',  require('./routes/settings'));

app.get('/api/health', (_req, res) => {
  try {
    getDb().prepare('SELECT 1').get();
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()), db: 'ok' });
  } catch (err) {
    logger.error('Health check DB failure', { err: err.message });
    res.status(503).json({ status: 'error', db: 'failed', error: err.message });
  }
});

app.get('/output', (_req, res) => {
  res.sendFile(path.join(__dirname, 'output.html'));
});

app.get('/join/:code', (req, res) => {
  res.redirect(`/?join=${encodeURIComponent(req.params.code)}`);
});

// ── Static: teleprompter SPA then countdown SPA (catch-all last) ──────────────
const teleprompterDistPath = path.resolve(__dirname, '../../../apps/teleprompter/dist');
app.use('/teleprompter', express.static(teleprompterDistPath));
app.get('/teleprompter/*', (_req, res) => {
  res.sendFile(path.join(teleprompterDistPath, 'index.html'));
});

const distPath = path.resolve(__dirname, '../../../apps/web/dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── HTTP + WS server ─────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

// ── Broadcast module ─────────────────────────────────────────────────────────
const broadcast = require('./broadcast');
broadcast.init(wss);

// ── Per-room engine registry ─────────────────────────────────────────────────
const { createRoomEngine } = require('./roomEngine');
const roomEngines          = new Map();
const engineCleanupTimers  = new Map();
const ROOM_IDLE_TTL_MS     = 30 * 60 * 1000;

function getOrCreateEngine(code) {
  if (roomEngines.has(code)) return roomEngines.get(code);
  const engine = createRoomEngine((type, payload) => {
    broadcast.broadcastToRoom(code, type, payload);
  });
  engine.cue.load(roomDb.listCues(code));
  roomEngines.set(code, engine);
  return engine;
}

function scheduleEngineCleanup(code) {
  const handle = setTimeout(() => {
    const eng = roomEngines.get(code);
    if (eng) { eng.timer.destroy(); eng.prompter.destroy(); }
    roomEngines.delete(code);
    engineCleanupTimers.delete(code);
    logger.info('Room engine evicted', { code });
  }, ROOM_IDLE_TTL_MS);
  engineCleanupTimers.set(code, handle);
}

function cancelEngineCleanup(code) {
  const handle = engineCleanupTimers.get(code);
  if (handle) { clearTimeout(handle); engineCleanupTimers.delete(code); }
}

app.set('getOrCreateEngine', getOrCreateEngine);

// ── Expired room cleanup — runs every 10 min ──────────────────────────────────
setInterval(() => {
  try {
    const deleted = roomDb.deleteExpired();
    if (deleted > 0) logger.info('Expired rooms purged', { count: deleted });
  } catch (err) {
    logger.error('Room expiry cleanup failed', { err: err.message });
  }
}, 10 * 60 * 1000);

// ── WS connection handler ─────────────────────────────────────────────────────
wss.on('connection', (socket, req) => {
  const clientIp = req.socket.remoteAddress;
  let roomCode = null;

  socket.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const { type, payload = {} } = msg;

    // ── Room join handshake ──────────────────────────────────────────────────
    if (!roomCode) {
      if (type !== CLIENT_EVENTS.JOIN_ROOM) return;
      const { code } = payload;
      const room = roomDb.getByCode(code);
      if (!room) {
        broadcast.send(socket, SERVER_EVENTS.ROOM_NOT_FOUND, { code });
        socket.close();
        return;
      }

      roomCode = code;
      broadcast.addToRoom(code, socket);
      cancelEngineCleanup(code);
      roomDb.updateLastActive(code);

      const engine = getOrCreateEngine(code);
      broadcast.send(socket, SERVER_EVENTS.ROOM_JOINED, {
        room,
        timer:    engine.timer.getState(),
        settings: engine.settings.get(),
        cues:     roomDb.listCues(code),
        prompter: engine.prompter.getState(),
        prompterCues: engine.prompterCues.get(),
      });
      logger.info('Client joined room', { code, ip: clientIp });
      return;
    }

    // ── Room-scoped messages ─────────────────────────────────────────────────
    const engine = roomEngines.get(roomCode);
    if (!engine) return;

    switch (type) {
      case CLIENT_EVENTS.TIMER_PLAY:    engine.timer.play(); break;
      case CLIENT_EVENTS.TIMER_PAUSE:   engine.timer.pause(); break;
      case CLIENT_EVENTS.TIMER_STOP:    engine.timer.stop(); engine.cue.resetFired(); break;
      case CLIENT_EVENTS.TIMER_RESET:   engine.timer.reset(); engine.cue.resetFired(); break;
      case CLIENT_EVENTS.TIMER_SET: {
        let seconds = payload.seconds;
        if (typeof seconds !== 'number') {
          const { h = 0, m = 0, s = 0 } = payload;
          if (h !== undefined || m !== undefined || s !== undefined) {
            seconds = Number(h) * 3600 + Number(m) * 60 + Number(s);
          }
        }
        if (typeof seconds === 'number') engine.timer.setTime(seconds);
        break;
      }
      case 'timer:seek':
        if (typeof payload.remaining === 'number') engine.timer.seek(payload.remaining);
        break;
      case 'timer:seekAndPlay':
        if (typeof payload.remaining === 'number') {
          engine.timer.seek(payload.remaining);
          engine.timer.play();
        }
        break;
      case CLIENT_EVENTS.FIRE_CUE:
        if (payload.cue) broadcast.broadcastToRoom(roomCode, SERVER_EVENTS.CUE_FIRED, { cue: payload.cue });
        break;
      case 'settings:update':
        engine.settings.merge(payload);
        broadcast.broadcastToRoomExcept(roomCode, socket, 'settings:changed', engine.settings.get());
        break;
      case CLIENT_EVENTS.PROMPTER_PLAY:    engine.prompter.play(); break;
      case CLIENT_EVENTS.PROMPTER_PAUSE:   engine.prompter.pause(); break;
      case CLIENT_EVENTS.PROMPTER_STOP:    engine.prompter.stop(); break;
      case CLIENT_EVENTS.PROMPTER_SPEED:
        if (typeof payload.speed === 'number') engine.prompter.setSpeed(payload.speed);
        break;
      case CLIENT_EVENTS.PROMPTER_SEEK:
        if (typeof payload.position === 'number') engine.prompter.seekTo(payload.position);
        break;
      case CLIENT_EVENTS.PROMPTER_SETTINGS:
        engine.prompter.applySettings(payload);
        broadcast.broadcastToRoomExcept(roomCode, socket, 'prompter:display', engine.prompter.getState());
        break;
      case 'prompter:cues':
        if (Array.isArray(payload.cues)) {
          engine.prompterCues.set(payload.cues);
          broadcast.broadcastToRoomExcept(roomCode, socket, 'prompter:cues', { cues: payload.cues });
        }
        break;
    }
  });

  socket.on('error', (err) => {
    logger.error('WS socket error', { code: roomCode, err: err.message });
  });

  socket.on('close', () => {
    if (!roomCode) return;
    const remaining = broadcast.removeFromRoom(roomCode, socket);
    logger.info('Client left room', { code: roomCode, remaining, ip: clientIp });
    if (remaining === 0) {
      const engine = roomEngines.get(roomCode);
      if (engine) engine.timer.pause();
      scheduleEngineCleanup(roomCode);
    }
  });
});

wss.on('error', (err) => logger.error('WSS error', { err: err.message }));

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`${signal} received — shutting down`);

  // Stop accepting new connections
  server.close(() => {
    // Destroy all room engines
    for (const [code, engine] of roomEngines) {
      try { engine.timer.destroy(); engine.prompter.destroy(); } catch {}
    }
    // Close all WS connections
    for (const client of wss.clients) {
      try { client.terminate(); } catch {}
    }
    try { closeDb(); } catch {}
    logger.info('Shutdown complete');
    process.exit(0);
  });

  // Force exit after 10 s if something hangs
  setTimeout(() => { logger.warn('Forced exit after timeout'); process.exit(1); }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  logger.info(`ShowStack server listening`, { port: PORT, env: process.env.NODE_ENV ?? 'development' });
});
