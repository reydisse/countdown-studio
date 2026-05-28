import type { RoomScript } from '../../types.js'

export async function getScriptsByRoom(db: D1Database, roomCode: string): Promise<RoomScript[]> {
  const result = await db.prepare(
    'SELECT * FROM room_scripts WHERE room_code = ? ORDER BY created_at ASC'
  ).bind(roomCode).all<RoomScript>()
  return result.results
}

export async function createScript(db: D1Database, script: {
  id: string; roomCode: string; name: string; content?: string
}): Promise<RoomScript> {
  const now = Date.now()
  await db.prepare(
    `INSERT INTO room_scripts (id, room_code, name, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(script.id, script.roomCode, script.name, script.content ?? '', now, now).run()
  const result = await db.prepare('SELECT * FROM room_scripts WHERE id = ?').bind(script.id).first<RoomScript>()
  return result!
}

export async function updateScript(db: D1Database, id: string, changes: {
  name?: string; content?: string
}): Promise<void> {
  const parts: string[] = ['updated_at = ?']
  const values: unknown[] = [Date.now()]
  if (changes.name    !== undefined) { parts.push('name = ?');    values.push(changes.name) }
  if (changes.content !== undefined) { parts.push('content = ?'); values.push(changes.content) }
  values.push(id)
  await db.prepare(`UPDATE room_scripts SET ${parts.join(', ')} WHERE id = ?`).bind(...values).run()
}

export async function deleteScript(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM room_scripts WHERE id = ?').bind(id).run()
}
