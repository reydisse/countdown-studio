// Shim: maps legacy /api/projects/* → rooms + cues
// The countdown app was built against an Express "projects" API.
// Projects are 1-to-1 with countdown rooms. Project ID = room UUID.

import { Hono } from 'hono'
import type { Bindings } from '../types.js'
import { getRoomById, getRoomByCode, createRoom, updateRoomSettings, deleteRoom, listRooms } from '../db/queries/rooms.js'
import { getCuesByRoom, createCue, updateCue, deleteCue } from '../db/queries/cues.js'
import { generateRoomCode } from '../utils/roomCode.js'

const projects = new Hono<{ Bindings: Bindings }>()

function doStub(env: Bindings, code: string) {
  return env.ROOM.get(env.ROOM.idFromName(code))
}

async function reloadCues(env: Bindings, code: string): Promise<void> {
  try {
    await doStub(env, code).fetch(new Request('http://do/reload-cues', { method: 'POST' }))
  } catch { /* non-fatal — DO may not be running yet */ }
}

function roomToProject(room: { id: string; code: string; name: string; settings_json?: string; type: string; [k: string]: unknown }) {
  const settings = (() => { try { return JSON.parse(room.settings_json as string ?? '{}') } catch { return {} } })()
  return { id: room.id, code: room.code, name: room.name, type: room.type, settings }
}

function parseCue(row: { id: string; room_code: string; trigger_at: number; label: string; actions_json: string; order_index: number; created_at: number }) {
  return {
    ...row,
    actions: (() => { try { return JSON.parse(row.actions_json ?? '[]') } catch { return [] } })(),
  }
}

// ── Project CRUD ───────────────────────────────────────────────────────────────

projects.get('/', async (c) => {
  const rooms = await listRooms(c.env.DB, 'countdown')
  return c.json(rooms.map(roomToProject))
})

projects.post('/', async (c) => {
  const { name = 'Default Project', settings = {} } = await c.req.json<{ name?: string; settings?: unknown }>()
  const code = await generateRoomCode(c.env.DB)
  const id   = crypto.randomUUID()
  await createRoom(c.env.DB, { id, code, name, type: 'countdown', isPermanent: true })
  await updateRoomSettings(c.env.DB, code, JSON.stringify(settings))
  const room = await getRoomByCode(c.env.DB, code)
  return c.json(roomToProject(room!), 201)
})

projects.get('/:id', async (c) => {
  const room = await getRoomById(c.env.DB, c.req.param('id'))
  if (!room) return c.json({ error: 'project not found' }, 404)
  return c.json(roomToProject(room))
})

projects.patch('/:id', async (c) => {
  const room = await getRoomById(c.env.DB, c.req.param('id'))
  if (!room) return c.json({ error: 'project not found' }, 404)
  const body = await c.req.json<{ settings?: unknown; name?: string }>()
  if (body.settings !== undefined) {
    await updateRoomSettings(c.env.DB, room.code, JSON.stringify(body.settings))
  }
  const updated = await getRoomById(c.env.DB, c.req.param('id'))
  return c.json(roomToProject(updated!))
})

projects.delete('/:id', async (c) => {
  const room = await getRoomById(c.env.DB, c.req.param('id'))
  if (!room) return c.json({ error: 'project not found' }, 404)
  await deleteRoom(c.env.DB, room.code)
  return new Response(null, { status: 204 })
})

// ── Cues (via project ID = room UUID) ─────────────────────────────────────────

projects.get('/:id/cues', async (c) => {
  const room = await getRoomById(c.env.DB, c.req.param('id'))
  if (!room) return c.json({ error: 'project not found' }, 404)
  const cues = await getCuesByRoom(c.env.DB, room.code)
  return c.json(cues.map(parseCue))
})

projects.post('/:id/cues', async (c) => {
  const room = await getRoomById(c.env.DB, c.req.param('id'))
  if (!room) return c.json({ error: 'project not found' }, 404)
  const { trigger_at, label, actions = [], order_index = 0 } = await c.req.json<{
    trigger_at: number; label?: string; actions?: unknown[]; order_index?: number
  }>()
  const cue = await createCue(c.env.DB, {
    id: crypto.randomUUID(), roomCode: room.code,
    triggerAt: Number(trigger_at), label: label ?? '',
    actionsJson: JSON.stringify(actions), orderIndex: Number(order_index),
  })
  await reloadCues(c.env, room.code)
  return c.json(parseCue(cue), 201)
})

projects.put('/:id/cues/:cueId', async (c) => {
  const room = await getRoomById(c.env.DB, c.req.param('id'))
  if (!room) return c.json({ error: 'project not found' }, 404)
  const body = await c.req.json<{ trigger_at?: number; label?: string; actions?: unknown[]; order_index?: number }>()
  await updateCue(c.env.DB, c.req.param('cueId'), {
    triggerAt:   body.trigger_at  !== undefined ? Number(body.trigger_at)  : undefined,
    label:       body.label,
    actionsJson: body.actions !== undefined ? JSON.stringify(body.actions) : undefined,
    orderIndex:  body.order_index !== undefined ? Number(body.order_index) : undefined,
  })
  // Return the updated cue so the client can sync without an extra fetch
  const updated = await c.env.DB.prepare('SELECT * FROM room_cues WHERE id = ?')
    .bind(c.req.param('cueId')).first<{ id: string; room_code: string; trigger_at: number; label: string; actions_json: string; order_index: number; created_at: number }>()
  await reloadCues(c.env, room.code)
  return updated ? c.json(parseCue(updated)) : c.json({ ok: true })
})

projects.delete('/:id/cues/:cueId', async (c) => {
  const room = await getRoomById(c.env.DB, c.req.param('id'))
  await deleteCue(c.env.DB, c.req.param('cueId'))
  if (room) await reloadCues(c.env, room.code)
  return new Response(null, { status: 204 })
})

// ── Legacy /api/assets (non-room-scoped) ──────────────────────────────────────
// BackgroundPanel / LogoPanel upload here without a room code.
// We look up the most recent countdown room and attach the asset there.

export default projects
