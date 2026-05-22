'use strict';

// WebSocket.OPEN === 1 (spec constant — stable across ws versions)
const WS_OPEN = 1;

let _wss = null;

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

module.exports = { init, broadcast, send };
