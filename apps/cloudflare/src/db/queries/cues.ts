import type { RoomCue } from '../../types.js'

export async function getCuesByRoom(db: D1Database, roomCode: string): Promise<RoomCue[]> {
  const result = await db.prepare(
    'SELECT * FROM room_cues WHERE room_code = ? ORDER BY trigger_at ASC'
  ).bind(roomCode).all<RoomCue>()
  return result.results
}

export async function createCue(db: D1Database, cue: {
  id: string; roomCode: string; triggerAt: number; label?: string
  actionsJson?: string; orderIndex?: number
}): Promise<RoomCue> {
  const now = Date.now()
  await db.prepare(
    `INSERT INTO room_cues (id, room_code, trigger_at, label, actions_json, order_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    cue.id, cue.roomCode, cue.triggerAt,
    cue.label ?? '', cue.actionsJson ?? '[]', cue.orderIndex ?? 0, now
  ).run()
  const result = await db.prepare('SELECT * FROM room_cues WHERE id = ?').bind(cue.id).first<RoomCue>()
  return result!
}

export async function updateCue(db: D1Database, id: string, changes: {
  triggerAt?: number; label?: string; actionsJson?: string; orderIndex?: number
}): Promise<void> {
  const parts: string[] = []
  const values: unknown[] = []
  if (changes.triggerAt  !== undefined) { parts.push('trigger_at = ?');   values.push(changes.triggerAt) }
  if (changes.label      !== undefined) { parts.push('label = ?');         values.push(changes.label) }
  if (changes.actionsJson !== undefined) { parts.push('actions_json = ?'); values.push(changes.actionsJson) }
  if (changes.orderIndex !== undefined) { parts.push('order_index = ?');   values.push(changes.orderIndex) }
  if (!parts.length) return
  values.push(id)
  await db.prepare(`UPDATE room_cues SET ${parts.join(', ')} WHERE id = ?`).bind(...values).run()
}

export async function deleteCue(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM room_cues WHERE id = ?').bind(id).run()
}
