import type { RoomAsset } from '../../types.js'

export async function createAsset(db: D1Database, asset: {
  id: string; roomCode: string; name: string; type: string
  url: string; size: number; duration?: number | null; thumbnailUrl?: string | null; tags?: string
}): Promise<RoomAsset> {
  const now = Date.now()
  await db.prepare(
    `INSERT INTO room_assets (id, room_code, name, type, url, size, duration, thumbnail_url, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    asset.id, asset.roomCode, asset.name, asset.type,
    asset.url, asset.size, asset.duration ?? null,
    asset.thumbnailUrl ?? null, asset.tags ?? '[]', now
  ).run()
  return getAssetById(db, asset.id) as Promise<RoomAsset>
}

export async function getAssetsByRoom(db: D1Database, roomCode: string): Promise<RoomAsset[]> {
  const result = await db.prepare(
    'SELECT * FROM room_assets WHERE room_code = ? ORDER BY created_at DESC'
  ).bind(roomCode).all<RoomAsset>()
  return result.results
}

export async function getAssetById(db: D1Database, id: string): Promise<RoomAsset | null> {
  const result = await db.prepare('SELECT * FROM room_assets WHERE id = ?').bind(id).first<RoomAsset>()
  return result ?? null
}

export async function deleteAsset(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM room_assets WHERE id = ?').bind(id).run()
}
