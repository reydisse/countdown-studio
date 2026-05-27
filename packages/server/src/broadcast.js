'use strict';

const WS_OPEN = 1;

let _wss = null;
const _roomSubs = new Map(); // code → Set<WebSocket>

function init(wss) {
  _wss = wss;
}

function broadcast(type, payload = {}) {
  if (!_wss) return;
  const msg = JSON.stringify({ type, payload });
  for (const client of _wss.clients) {
    if (client.readyState === WS_OPEN) client.send(msg);
  }
}

function send(socket, type, payload = {}) {
  if (socket.readyState === WS_OPEN) {
    socket.send(JSON.stringify({ type, payload }));
  }
}

function broadcastExcept(origin, type, payload = {}) {
  if (!_wss) return;
  const msg = JSON.stringify({ type, payload });
  for (const client of _wss.clients) {
    if (client !== origin && client.readyState === WS_OPEN) client.send(msg);
  }
}

// ── Room-scoped helpers ───────────────────────────────────────────────────────

function addToRoom(code, socket) {
  if (!_roomSubs.has(code)) _roomSubs.set(code, new Set());
  _roomSubs.get(code).add(socket);
}

function removeFromRoom(code, socket) {
  const subs = _roomSubs.get(code);
  if (!subs) return 0;
  subs.delete(socket);
  if (subs.size === 0) _roomSubs.delete(code);
  return _roomSubs.get(code)?.size ?? 0;
}

function getRoomSize(code) {
  return _roomSubs.get(code)?.size ?? 0;
}

function broadcastToRoom(code, type, payload = {}) {
  const subs = _roomSubs.get(code);
  if (!subs) return;
  const msg = JSON.stringify({ type, payload });
  for (const ws of subs) {
    if (ws.readyState === WS_OPEN) ws.send(msg);
  }
}

function broadcastToRoomExcept(code, origin, type, payload = {}) {
  const subs = _roomSubs.get(code);
  if (!subs) return;
  const msg = JSON.stringify({ type, payload });
  for (const ws of subs) {
    if (ws !== origin && ws.readyState === WS_OPEN) ws.send(msg);
  }
}

module.exports = {
  init,
  broadcast,
  send,
  broadcastExcept,
  addToRoom,
  removeFromRoom,
  getRoomSize,
  broadcastToRoom,
  broadcastToRoomExcept,
};
