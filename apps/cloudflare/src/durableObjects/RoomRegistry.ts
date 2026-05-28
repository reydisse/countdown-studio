// Singleton Durable Object — accessed via env.REGISTRY.idFromName('global')
// Tracks live WebSocket connection counts per room for accurate active-room detection.
// (HARDENING Fix 3)

type RoomEntry = {
  type: string
  connections: number
  lastHeartbeat: number
}

const STALE_MS = 60_000  // treat as disconnected if no heartbeat in 60s

export class RoomRegistry implements DurableObject {
  private rooms = new Map<string, RoomEntry>()
  private state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
    this.state.blockConcurrencyWhile(async () => {
      const saved = await this.state.storage.get<[string, RoomEntry][]>('rooms')
      if (saved) this.rooms = new Map(saved)
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    this.pruneStale()

    if (request.method === 'POST') {
      const body = await request.json<{ roomCode: string; type?: string }>()
      const { roomCode, type } = body

      if (url.pathname === '/register') {
        const entry = this.rooms.get(roomCode) ?? { type: type ?? 'unknown', connections: 0, lastHeartbeat: Date.now() }
        entry.connections = Math.max(0, entry.connections) + 1
        entry.lastHeartbeat = Date.now()
        this.rooms.set(roomCode, entry)
        await this.save()
        return Response.json({ ok: true })
      }

      if (url.pathname === '/unregister') {
        const entry = this.rooms.get(roomCode)
        if (entry) {
          entry.connections = Math.max(0, entry.connections - 1)
          if (entry.connections === 0) this.rooms.delete(roomCode)
          else this.rooms.set(roomCode, entry)
          await this.save()
        }
        return Response.json({ ok: true })
      }

      if (url.pathname === '/heartbeat') {
        const entry = this.rooms.get(roomCode)
        if (entry) {
          entry.lastHeartbeat = Date.now()
          this.rooms.set(roomCode, entry)
          await this.save()
        }
        return Response.json({ ok: true })
      }
    }

    if (request.method === 'GET') {
      const type = url.searchParams.get('type')

      if (url.pathname === '/active') {
        let best: { code: string; entry: RoomEntry } | null = null
        for (const [code, entry] of this.rooms) {
          if (type && entry.type !== type) continue
          if (entry.connections <= 0) continue
          if (!best || entry.lastHeartbeat > best.entry.lastHeartbeat) {
            best = { code, entry }
          }
        }
        return Response.json(best ? { code: best.code, type: best.entry.type, connections: best.entry.connections } : null)
      }

      if (url.pathname === '/list') {
        const list = []
        for (const [code, entry] of this.rooms) {
          if (type && entry.type !== type) continue
          list.push({ code, ...entry })
        }
        list.sort((a, b) => b.lastHeartbeat - a.lastHeartbeat)
        return Response.json(list)
      }
    }

    return new Response('Not found', { status: 404 })
  }

  private pruneStale(): void {
    const cutoff = Date.now() - STALE_MS
    for (const [code, entry] of this.rooms) {
      if (entry.lastHeartbeat < cutoff) this.rooms.delete(code)
    }
  }

  private async save(): Promise<void> {
    await this.state.storage.put('rooms', [...this.rooms.entries()])
  }
}
