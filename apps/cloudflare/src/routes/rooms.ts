import { Hono } from 'hono'
import type { Bindings } from '../types.js'
import { generateRoomCode, isValidRoomCode } from '../utils/roomCode.js'
import { createRoom, getRoomByCode, updateRoomSettings, touchRoom, deleteRoom, listRooms } from '../db/queries/rooms.js'
import { createAsset, getAssetsByRoom, getAssetById, deleteAsset } from '../db/queries/assets.js'
import { getCuesByRoom, createCue, updateCue, deleteCue } from '../db/queries/cues.js'
import { getScriptsByRoom, createScript, updateScript, deleteScript } from '../db/queries/scripts.js'
import { generateR2Key, uploadToR2 } from '../r2/upload.js'
import { deleteFromR2 } from '../r2/delete.js'

const rooms = new Hono<{ Bindings: Bindings }>()

function doStub(env: Bindings, code: string) {
  return env.ROOM.get(env.ROOM.idFromName(code))
}

async function forwardToDO(env: Bindings, code: string, path: string, method = 'POST', body?: unknown) {
  const stub = doStub(env, code)
  const init: RequestInit = { method }
  if (body) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return stub.fetch(new Request(`http://do${path}`, init))
}

// ── Room CRUD ──────────────────────────────────────────────────────────────────

rooms.get('/', async (c) => {
  const type = c.req.query('type')
  return c.json(await listRooms(c.env.DB, type || undefined))
})

rooms.post('/', async (c) => {
  const { name, type = 'countdown', isPermanent = false } = await c.req.json<{
    name?: string; type?: string; isPermanent?: boolean
  }>()
  if (!name?.trim()) return c.json({ error: 'name is required' }, 400)
  if (name.length > 256) return c.json({ error: 'name must be 256 characters or fewer' }, 400)
  if (!['countdown', 'teleprompter'].includes(type)) return c.json({ error: 'invalid type' }, 400)
  const code = await generateRoomCode(c.env.DB)
  const id   = crypto.randomUUID()
  const room = await createRoom(c.env.DB, { id, code, name: name.trim(), type, isPermanent: !!isPermanent })
  return c.json(room, 201)
})

rooms.get('/:code', async (c) => {
  const { code } = c.req.param()
  if (!isValidRoomCode(code)) return c.json({ error: 'invalid room code format' }, 400)
  const room = await getRoomByCode(c.env.DB, code)
  if (!room) return c.json({ error: 'room not found' }, 404)
  await touchRoom(c.env.DB, code)
  return c.json(room)
})

rooms.put('/:code/settings', async (c) => {
  const { code } = c.req.param()
  const room = await getRoomByCode(c.env.DB, code)
  if (!room) return c.json({ error: 'room not found' }, 404)
  const { settings } = await c.req.json<{ settings: unknown }>()
  await updateRoomSettings(c.env.DB, code, JSON.stringify(settings))
  return c.json(await getRoomByCode(c.env.DB, code))
})

rooms.delete('/:code', async (c) => {
  const { code } = c.req.param()
  await deleteRoom(c.env.DB, code)
  return new Response(null, { status: 204 })
})

// ── Assets ─────────────────────────────────────────────────────────────────────

rooms.get('/:code/assets', async (c) => {
  const { code } = c.req.param()
  const room = await getRoomByCode(c.env.DB, code)
  if (!room) return c.json({ error: 'room not found' }, 404)
  return c.json(await getAssetsByRoom(c.env.DB, code))
})

rooms.post('/:code/assets', async (c) => {
  const { code } = c.req.param()
  const room = await getRoomByCode(c.env.DB, code)
  if (!room) return c.json({ error: 'room not found' }, 404)

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'file is required' }, 400)

  const uuid     = crypto.randomUUID()
  const ext      = file.name.split('.').pop() ?? ''
  const typeMap: Record<string, string> = { mp4:'video', mov:'video', webm:'video', mp3:'audio', wav:'audio', aac:'audio' }
  const assetType = typeMap[ext] ?? 'image'
  const key      = generateR2Key(code, assetType, file.name, uuid)
  const url      = await uploadToR2(c.env.MEDIA, key, await file.arrayBuffer(), file.type, c.env.MEDIA_PUBLIC_URL)
  const id       = crypto.randomUUID()
  const asset    = await createAsset(c.env.DB, {
    id, roomCode: code, name: file.name, type: assetType as 'image'|'video'|'audio',
    url, size: file.size,
  })
  await doStub(c.env, code).fetch(new Request('http://do/broadcast', {
    method: 'POST',
    body: JSON.stringify({ type: 'asset:added', payload: { asset } }),
    headers: { 'Content-Type': 'application/json' },
  }))
  return c.json(asset, 201)
})

rooms.delete('/:code/assets/:id', async (c) => {
  const { code, id } = c.req.param()
  const asset = await getAssetById(c.env.DB, id)
  if (!asset || asset.room_code !== code) return c.json({ error: 'asset not found' }, 404)
  await deleteFromR2(c.env.MEDIA, asset.url, c.env.MEDIA_PUBLIC_URL)
  await deleteAsset(c.env.DB, id)
  await doStub(c.env, code).fetch(new Request('http://do/broadcast', {
    method: 'POST',
    body: JSON.stringify({ type: 'asset:removed', payload: { id } }),
    headers: { 'Content-Type': 'application/json' },
  }))
  return new Response(null, { status: 204 })
})

// ── Cues ───────────────────────────────────────────────────────────────────────

rooms.get('/:code/cues', async (c) => {
  const { code } = c.req.param()
  const room = await getRoomByCode(c.env.DB, code)
  if (!room) return c.json({ error: 'room not found' }, 404)
  return c.json(await getCuesByRoom(c.env.DB, code))
})

rooms.post('/:code/cues', async (c) => {
  const { code } = c.req.param()
  const room = await getRoomByCode(c.env.DB, code)
  if (!room) return c.json({ error: 'room not found' }, 404)
  const { trigger_at, label, actions = [], order_index = 0 } = await c.req.json<{
    trigger_at: number; label?: string; actions?: unknown[]; order_index?: number
  }>()
  if (trigger_at === undefined) return c.json({ error: 'trigger_at is required' }, 400)
  const cue = await createCue(c.env.DB, {
    id: crypto.randomUUID(), roomCode: code,
    triggerAt: Number(trigger_at), label: label ?? '',
    actionsJson: JSON.stringify(actions), orderIndex: Number(order_index),
  })
  await doStub(c.env, code).fetch(new Request('http://do/reload-cues', { method: 'POST' }))
  return c.json(cue, 201)
})

rooms.put('/:code/cues/:id', async (c) => {
  const { code, id } = c.req.param()
  const room = await getRoomByCode(c.env.DB, code)
  if (!room) return c.json({ error: 'room not found' }, 404)
  const body = await c.req.json<{ trigger_at?: number; label?: string; actions?: unknown[]; order_index?: number }>()
  await updateCue(c.env.DB, id, {
    triggerAt:   body.trigger_at  !== undefined ? Number(body.trigger_at)  : undefined,
    label:       body.label,
    actionsJson: body.actions !== undefined ? JSON.stringify(body.actions) : undefined,
    orderIndex:  body.order_index !== undefined ? Number(body.order_index) : undefined,
  })
  await doStub(c.env, code).fetch(new Request('http://do/reload-cues', { method: 'POST' }))
  return c.json({ ok: true })
})

rooms.delete('/:code/cues/:id', async (c) => {
  const { code, id } = c.req.param()
  await deleteCue(c.env.DB, id)
  await doStub(c.env, code).fetch(new Request('http://do/reload-cues', { method: 'POST' }))
  return new Response(null, { status: 204 })
})

// ── Scripts ────────────────────────────────────────────────────────────────────

rooms.get('/:code/scripts', async (c) => {
  const { code } = c.req.param()
  const room = await getRoomByCode(c.env.DB, code)
  if (!room) return c.json({ error: 'room not found' }, 404)
  return c.json(await getScriptsByRoom(c.env.DB, code))
})

rooms.post('/:code/scripts', async (c) => {
  const { code } = c.req.param()
  const room = await getRoomByCode(c.env.DB, code)
  if (!room) return c.json({ error: 'room not found' }, 404)
  const { name, content = '' } = await c.req.json<{ name?: string; content?: string }>()
  if (!name?.trim()) return c.json({ error: 'name is required' }, 400)
  const script = await createScript(c.env.DB, { id: crypto.randomUUID(), roomCode: code, name: name.trim(), content })
  return c.json(script, 201)
})

rooms.put('/:code/scripts/:id', async (c) => {
  const { code, id } = c.req.param()
  const room = await getRoomByCode(c.env.DB, code)
  if (!room) return c.json({ error: 'room not found' }, 404)
  const { name, content } = await c.req.json<{ name?: string; content?: string }>()
  await updateScript(c.env.DB, id, { name, content })
  return c.json({ ok: true })
})

rooms.delete('/:code/scripts/:id', async (c) => {
  const { code, id } = c.req.param()
  const room = await getRoomByCode(c.env.DB, code)
  if (!room) return c.json({ error: 'room not found' }, 404)
  await deleteScript(c.env.DB, id)
  return new Response(null, { status: 204 })
})

// ── Timer control ──────────────────────────────────────────────────────────────

rooms.get('/:code/timer/state',  async (c) => forwardToDO(c.env, c.req.param('code'), '/timer/state', 'GET'))
rooms.post('/:code/timer/play',  async (c) => forwardToDO(c.env, c.req.param('code'), '/timer/play'))
rooms.post('/:code/timer/pause', async (c) => forwardToDO(c.env, c.req.param('code'), '/timer/pause'))
rooms.post('/:code/timer/stop',  async (c) => forwardToDO(c.env, c.req.param('code'), '/timer/stop'))
rooms.post('/:code/timer/reset', async (c) => forwardToDO(c.env, c.req.param('code'), '/timer/reset'))
rooms.post('/:code/timer/set',   async (c) => forwardToDO(c.env, c.req.param('code'), '/timer/set', 'POST', await c.req.json()))

// ── Prompter control ───────────────────────────────────────────────────────────

rooms.get('/:code/prompter/state',       async (c) => forwardToDO(c.env, c.req.param('code'), '/prompter/state', 'GET'))
rooms.post('/:code/prompter/play',       async (c) => forwardToDO(c.env, c.req.param('code'), '/prompter/play'))
rooms.post('/:code/prompter/pause',      async (c) => forwardToDO(c.env, c.req.param('code'), '/prompter/pause'))
rooms.post('/:code/prompter/stop',       async (c) => forwardToDO(c.env, c.req.param('code'), '/prompter/stop'))
rooms.post('/:code/prompter/speed',      async (c) => forwardToDO(c.env, c.req.param('code'), '/prompter/speed', 'POST', await c.req.json()))
rooms.post('/:code/prompter/speed/up',   async (c) => forwardToDO(c.env, c.req.param('code'), '/prompter/speed/up'))
rooms.post('/:code/prompter/speed/down', async (c) => forwardToDO(c.env, c.req.param('code'), '/prompter/speed/down'))
rooms.post('/:code/prompter/seek',       async (c) => forwardToDO(c.env, c.req.param('code'), '/prompter/seek', 'POST', await c.req.json()))
rooms.post('/:code/prompter/seek/relative', async (c) => forwardToDO(c.env, c.req.param('code'), '/prompter/seek/relative', 'POST', await c.req.json()))
rooms.post('/:code/prompter/scrub/start', async (c) => forwardToDO(c.env, c.req.param('code'), '/prompter/scrub/start', 'POST', await c.req.json()))
rooms.post('/:code/prompter/scrub/stop',  async (c) => forwardToDO(c.env, c.req.param('code'), '/prompter/scrub/stop'))
rooms.post('/:code/prompter/cue/:cueId', async (c) => {
  const { code, cueId } = c.req.param()
  return forwardToDO(c.env, code, `/prompter/cue/${cueId}`)
})

export default rooms
