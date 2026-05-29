import type { Room } from '../../types.js'

const ROOM_TTL_MS = 30 * 60 * 1000

export async function createRoom(db: D1Database, room: {
  id: string; code: string; name: string; type: string; isPermanent?: boolean
}): Promise<Room> {
  const now = Date.now()
  const expiresAt = room.isPermanent ? null : now + ROOM_TTL_MS
  await db.prepare(
    `INSERT INTO rooms (id, code, name, type, settings_json, is_permanent, last_active, created_at, expires_at)
     VALUES (?, ?, ?, ?, '{}', ?, ?, ?, ?)`
  ).bind(room.id, room.code, room.name, room.type, room.isPermanent ? 1 : 0, now, now, expiresAt).run()
  return getRoomByCode(db, room.code) as Promise<Room>
}

export async function getRoomByCode(db: D1Database, code: string): Promise<Room | null> {
  const result = await db.prepare('SELECT * FROM rooms WHERE code = ?').bind(code).first<Room>()
  return result ?? null
}

export async function getRoomById(db: D1Database, id: string): Promise<Room | null> {
  const result = await db.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first<Room>()
  return result ?? null
}

export async function updateRoomSettings(db: D1Database, code: string, settingsJson: string): Promise<void> {
  await db.prepare('UPDATE rooms SET settings_json = ? WHERE code = ?').bind(settingsJson, code).run()
}

export async function touchRoom(db: D1Database, code: string): Promise<void> {
  const now = Date.now()
  await db.prepare(
    `UPDATE rooms SET last_active = ?,
     expires_at = CASE WHEN is_permanent = 0 THEN ? ELSE expires_at END
     WHERE code = ?`
  ).bind(now, now + ROOM_TTL_MS, code).run()
}

export async function deleteRoom(db: D1Database, code: string): Promise<void> {
  await db.prepare('DELETE FROM rooms WHERE code = ?').bind(code).run()
}

export async function listRooms(db: D1Database, type?: string): Promise<Room[]> {
  const query = type
    ? 'SELECT * FROM rooms WHERE type = ? ORDER BY last_active DESC'
    : 'SELECT * FROM rooms ORDER BY last_active DESC'
  const result = await (type
    ? db.prepare(query).bind(type)
    : db.prepare(query)
  ).all<Room>()
  return result.results
}

export async function getActivePrompterRoom(db: D1Database): Promise<Room | null> {
  const result = await db.prepare(
    `SELECT * FROM rooms WHERE type = 'teleprompter' ORDER BY last_active DESC LIMIT 1`
  ).first<Room>()
  return result ?? null
}

export async function getActiveCountdownRoom(db: D1Database): Promise<Room | null> {
  const result = await db.prepare(
    `SELECT * FROM rooms WHERE type = 'countdown' ORDER BY last_active DESC LIMIT 1`
  ).first<Room>()
  return result ?? null
}
