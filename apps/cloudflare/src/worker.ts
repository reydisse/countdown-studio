import { Hono } from 'hono'
import type { Bindings } from './types.js'
import roomsRoute    from './routes/rooms.js'
import prompterRoute from './routes/prompter.js'
import healthRoute   from './routes/health.js'

export { RoomObject }   from './durableObjects/RoomObject.js'
export { RoomRegistry } from './durableObjects/RoomRegistry.js'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', async (c, next) => {
  const origin  = c.req.header('Origin') ?? ''
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map(o => o.trim())
  const allowOrigin = allowed.includes(origin) ? origin : (allowed[0] ?? '*')
  c.header('Access-Control-Allow-Origin', allowOrigin)
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (c.req.method === 'OPTIONS') return c.body(null, 204)
  return next()
})

app.route('/api/rooms',    roomsRoute)
app.route('/api/prompter', prompterRoute)
app.route('/api/health',   healthRoute)

// WebSocket upgrade — routes to the correct RoomObject DO
app.get('/ws', async (c) => {
  const roomCode = c.req.query('room')
  if (!roomCode) return c.text('room query param required', 400)
  if (c.req.header('Upgrade') !== 'websocket') return c.text('Expected WebSocket upgrade', 426)
  const id   = c.env.ROOM.idFromName(roomCode)
  const stub = c.env.ROOM.get(id)
  return stub.fetch(c.req.raw)
})

app.get('/join/:code', (c) => c.redirect(`/?room=${c.req.param('code')}`))

export default app
