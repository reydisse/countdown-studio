// Zero-dependency WS send singleton.
// wsClient ← stores (stores call send)
// useWebSocket → wsClient (hook updates _setSend on connect/disconnect)
// This file has no imports so neither direction creates a cycle.

let _send = () => {};

export function send(type, payload = {}) {
  _send(type, payload);
}

// Called exclusively by useWebSocket when the socket state changes.
export function _setSend(fn) {
  _send = fn;
}
