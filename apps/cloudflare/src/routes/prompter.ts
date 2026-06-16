import { Hono } from 'hono'
import type { Bindings } from '../types.js'
import { getActivePrompterRoom, listRooms, touchRoom } from '../db/queries/rooms.js'

const prompter = new Hono<{ Bindings: Bindings }>()

// HARDENING Fix 3+4: registry-first with D1 fallback
async function getActiveRoom(c: { env: Bindings }): Promise<{ code: string } | null> {
  try {
    const id = c.env.REGISTRY.idFromName('global')
    const stub = c.env.REGISTRY.get(id)
    const res = await stub.fetch(new Request('http://registry/active?type=teleprompter'))
    const data = await res.json<{ code: string } | null>()
    if (data && data.code) return data
  } catch { /* registry unavailable — fall through to D1 */ }
  const room = await getActivePrompterRoom(c.env.DB)
  return room ? { code: room.code } : null
}

function doStub(env: Bindings, code: string) {
  return env.ROOM.get(env.ROOM.idFromName(code))
}

prompter.get('/rooms', async (c) => {
  const rooms = await listRooms(c.env.DB, 'teleprompter')
  return c.json(rooms)
})

prompter.get('/active', async (c) => {
  const room = await getActiveRoom(c)
  if (!room) return c.json({ code: null })
  const stub = doStub(c.env, room.code)
  const res  = await stub.fetch(new Request('http://do/state'))
  const state = await res.json<{ prompter: Record<string, unknown> }>()
  return c.json({ code: room.code, ...state.prompter })
})

async function forwardActive(c: { env: Bindings }, path: string, method = 'POST', body?: unknown) {
  const room = await getActiveRoom(c)
  if (!room) return Response.json({ error: 'No active teleprompter room' }, { status: 404 })
  await touchRoom(c.env.DB, room.code)
  const stub = doStub(c.env, room.code)
  const init: RequestInit = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return stub.fetch(new Request(`http://do${path}`, init))
}

prompter.post('/active/play',         (c) => forwardActive(c, '/prompter/play'))
prompter.post('/active/pause',        (c) => forwardActive(c, '/prompter/pause'))
prompter.post('/active/stop',         (c) => forwardActive(c, '/prompter/stop'))
prompter.post('/active/speed',        async (c) => forwardActive(c, '/prompter/speed', 'POST', await c.req.json()))
prompter.post('/active/speed/up',     (c) => forwardActive(c, '/prompter/speed/up'))
prompter.post('/active/speed/down',   (c) => forwardActive(c, '/prompter/speed/down'))
prompter.post('/active/seek',         async (c) => forwardActive(c, '/prompter/seek', 'POST', await c.req.json()))
prompter.post('/active/seek/relative', async (c) => forwardActive(c, '/prompter/seek/relative', 'POST', await c.req.json()))
prompter.post('/active/scrub/start',   async (c) => forwardActive(c, '/prompter/scrub/start', 'POST', await c.req.json()))
prompter.post('/active/scrub/stop',    (c) => forwardActive(c, '/prompter/scrub/stop'))

prompter.post('/active/cue/:cueId', async (c) => {
  const room = await getActiveRoom(c)
  if (!room) return c.json({ error: 'No active teleprompter room' }, 404)
  const stub = doStub(c.env, room.code)
  return stub.fetch(new Request(`http://do/prompter/cue/${c.req.param('cueId')}`, { method: 'POST' }))
})

export default prompter
