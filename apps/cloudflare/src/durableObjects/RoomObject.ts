import { RoomTimer }    from './RoomTimer.js'
import { RoomPrompter } from './RoomPrompter.js'
import { getCuesByRoom } from '../db/queries/cues.js'
import { getRoomByCode } from '../db/queries/rooms.js'
import type { RoomCue, Bindings } from '../types.js'

export class RoomObject implements DurableObject {
  private sessions = new Set<WebSocket>()
  private timer: RoomTimer
  private prompter: RoomPrompter
  private roomCode: string | null = null
  private cues: RoomCue[] = []
  private currentScript: { scriptId: string; content: string } | null = null
  private displaySettings: Record<string, unknown> | null = null
  private roomSettings: Record<string, unknown> | null = null
  private roomType: 'countdown' | 'teleprompter' = 'countdown'
  private prompterCues: Array<{ id: string; label: string; position: number; color?: string }> = []
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private state: DurableObjectState
  private env: Bindings

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state
    this.env = env
    this.timer    = new RoomTimer(state.storage, this.broadcast.bind(this))
    this.prompter = new RoomPrompter(state.storage, this.broadcast.bind(this))
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
      this.state.acceptWebSocket(server)
      this.sessions.add(server)
      await this.timer.load()
      await this.prompter.load()
      return new Response(null, { status: 101, webSocket: client })
    }

    // Internal HTTP from Worker routes
    const method = request.method
    const path = url.pathname

    if (path === '/timer/play')   { await this.timer.play();   await this.scheduleAlarm(); return Response.json(this.timer.getState()) }
    if (path === '/timer/pause')  { await this.timer.pause();  return Response.json(this.timer.getState()) }
    if (path === '/timer/stop')   { await this.timer.stop();   return Response.json(this.timer.getState()) }
    if (path === '/timer/reset')  { await this.timer.reset();  return Response.json(this.timer.getState()) }
    if (path === '/timer/state')  { await this.timer.load();   return Response.json(this.timer.getState()) }
    if (path === '/timer/set' && method === 'POST') {
      const { h = 0, m = 0, s = 0 } = await request.json<{ h?: number; m?: number; s?: number }>()
      await this.timer.setTime(h, m, s)
      return Response.json(this.timer.getState())
    }

    if (path === '/prompter/play')       { await this.prompter.play();    await this.scheduleAlarm(); return Response.json(this.prompter.getState()) }
    if (path === '/prompter/pause')      { await this.prompter.pause();                       return Response.json(this.prompter.getState()) }
    if (path === '/prompter/stop')       { await this.prompter.stop();                        return Response.json(this.prompter.getState()) }
    if (path === '/prompter/state')      { await this.prompter.load();                        return Response.json(this.prompter.getState()) }
    if (path === '/prompter/speed' && method === 'POST') {
      const { speed } = await request.json<{ speed: number }>()
      await this.prompter.setSpeed(speed)
      return Response.json(this.prompter.getState())
    }
    if (path === '/prompter/speed/up') {
      await this.prompter.load()
      await this.prompter.setSpeed(this.prompter.getState().speed + 1)
      return Response.json(this.prompter.getState())
    }
    if (path === '/prompter/speed/down') {
      await this.prompter.load()
      await this.prompter.setSpeed(this.prompter.getState().speed - 1)
      return Response.json(this.prompter.getState())
    }
    if (path === '/prompter/seek' && method === 'POST') {
      const { position } = await request.json<{ position: number }>()
      await this.prompter.seekTo(position)
      return Response.json(this.prompter.getState())
    }
    if (path === '/prompter/seek/relative' && method === 'POST') {
      const { seconds } = await request.json<{ seconds: number }>()
      await this.prompter.nudge(Number(seconds))
      return Response.json(this.prompter.getState())
    }
    if (path === '/prompter/scrub/start' && method === 'POST') {
      const { direction } = await request.json<{ direction: number }>()
      await this.prompter.startScrub(Number(direction))
      await this.scheduleAlarm()
      return Response.json(this.prompter.getState())
    }
    if (path === '/prompter/scrub/stop' && method === 'POST') {
      await this.prompter.stopScrub()
      return Response.json(this.prompter.getState())
    }

    if (path === '/reload-cues') {
      if (this.roomCode) {
        this.cues = await getCuesByRoom(this.env.DB, this.roomCode)
      }
      return Response.json({ ok: true })
    }

    if (path === '/broadcast' && method === 'POST') {
      const { type, payload } = await request.json<{ type: string; payload?: unknown }>()
      if (type) this.broadcast(type, payload ?? {})
      return Response.json({ ok: true })
    }

    if (path.startsWith('/prompter/cue/') && method === 'POST') {
      const cueId = path.slice('/prompter/cue/'.length)
      const cue = this.prompterCues.find(c => c.id === cueId)
        ?? this.cues.find(c => c.id === cueId)
      if (!cue) return Response.json({ error: 'cue not found' }, { status: 404 })
      const position = 'position' in cue ? Number(cue.position) : Number(cue.trigger_at)
      await this.prompter.seekTo(position)
      return Response.json({ ...this.prompter.getState(), cueId, scrollPosition: position })
    }

    if (path === '/state') {
      await this.timer.load()
      await this.prompter.load()
      return Response.json({
        timer: this.timer.getState(),
        prompter: this.prompter.getState(),
        roomCode: this.roomCode,
      })
    }

    return new Response('Not found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let msg: { type: string; payload?: Record<string, unknown> }
    try { msg = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)) }
    catch { return }

    const { type, payload = {} } = msg

    switch (type) {
      case 'room:join': {
        const code = payload.code as string
        this.roomCode = code
        await this.timer.load()
        await this.prompter.load()
        this.cues = await getCuesByRoom(this.env.DB, code)
        const room = await getRoomByCode(this.env.DB, code)
        if (room) {
          this.roomType = room.type === 'teleprompter' ? 'teleprompter' : 'countdown'
          if (room.settings_json) {
            try {
              this.roomSettings = JSON.parse(room.settings_json) as Record<string, unknown>
            } catch { /* keep existing */ }
          }
        }
        if (this.timer.needsTicking() || this.prompter.needsTicking()) {
          await this.scheduleAlarm()
        }
        this.registerWithRegistry(code)
        ws.send(JSON.stringify({
          type: 'room:joined',
          payload: {
            timer: this.timer.getState(),
            prompter: this.prompter.getState(),
            cues: this.cues,
            script: this.currentScript,
            display: this.displaySettings,
            settings: this.roomSettings,
            prompterCues: this.prompterCues,
          },
        }))
        break
      }
      case 'timer:play':    await this.timer.play();   await this.scheduleAlarm(); break
      case 'timer:pause':   await this.timer.pause();  break
      case 'timer:stop':    await this.timer.stop();   break
      case 'timer:reset':   await this.timer.reset();  break
      case 'timer:set': {
        const { h = 0, m = 0, s = 0 } = payload as { h?: number; m?: number; s?: number }
        await this.timer.setTime(Number(h), Number(m), Number(s))
        break
      }
      case 'timer:seek': {
        const { remaining = 0 } = payload as { remaining?: number }
        await this.timer.seek(Number(remaining))
        break
      }
      case 'timer:seekAndPlay': {
        const { remaining = 0 } = payload as { remaining?: number }
        await this.timer.seek(Number(remaining))
        await this.timer.play()
        await this.scheduleAlarm()
        break
      }
      case 'cue:fire': {
        const { cue } = payload as { cue?: unknown }
        if (cue) this.broadcast('cue:fired', { cue })
        break
      }
      case 'prompter:play':  await this.prompter.play();  await this.scheduleAlarm(); break
      case 'prompter:pause': await this.prompter.pause(); break
      case 'prompter:stop':  await this.prompter.stop();  break
      case 'prompter:speed': await this.prompter.setSpeed(Number(payload.speed)); break
      case 'prompter:seek':  await this.prompter.seekTo(Number(payload.position)); break
      case 'prompter:settings':
        if (payload.totalHeight !== undefined) await this.prompter.setTotalHeight(Number(payload.totalHeight))
        break
      case 'prompter:display': {
        this.displaySettings = payload as Record<string, unknown>
        this.broadcast('prompter:display', payload)
        break
      }
      case 'prompter:script': {
        const { scriptId, content } = payload as { scriptId: string; content: string }
        this.currentScript = { scriptId, content }
        this.broadcast('prompter:script', { scriptId, content })
        break
      }
      case 'prompter:cues': {
        const cues = payload.cues as typeof this.prompterCues
        if (Array.isArray(cues)) {
          this.prompterCues = cues
          this.broadcast('prompter:cues', { cues })
        }
        break
      }
      case 'settings:update': {
        this.roomSettings = payload as Record<string, unknown>
        // Broadcast to all other sessions so output pages stay in sync
        const settingsMsg = JSON.stringify({ type: 'settings:changed', payload })
        for (const s of this.sessions) {
          if (s !== ws) {
            try { s.send(settingsMsg) } catch { /* ignore dead sockets */ }
          }
        }
        break
      }
      case 'room:leave':
        this.sessions.delete(ws)
        if (this.roomCode) this.unregisterFromRegistry(this.roomCode)
        break
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws)
    if (this.roomCode) this.unregisterFromRegistry(this.roomCode)
    if (this.sessions.size === 0) {
      if (!this.timer.needsTicking() && !this.prompter.needsTicking()) {
        await this.state.storage.deleteAlarm()
      }
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    }
  }

  async alarm(): Promise<void> {
    const timerRunning    = this.timer.needsTicking()
    const prompterRunning = this.prompter.needsTicking()

    if (timerRunning)    await this.timer.tick(this.cues)
    if (prompterRunning) await this.prompter.tick()

    const stillTimer    = this.timer.needsTicking()
    const stillPrompter = this.prompter.needsTicking()

    if (stillPrompter) {
      await this.state.storage.setAlarm(Date.now() + 50)
    } else if (stillTimer) {
      await this.state.storage.setAlarm(Date.now() + 1000)
    }
    // Neither running — no alarm scheduled
  }

  async scheduleAlarm(): Promise<void> {
    const wantsFast = this.prompter.needsTicking()
    const interval  = wantsFast ? 50 : 1000
    const existing  = await this.state.storage.getAlarm()
    if (!existing) {
      await this.state.storage.setAlarm(Date.now() + interval)
      return
    }
    // Reschedule to 50ms when prompter needs smooth scroll while timer alarm exists.
    if (wantsFast) {
      const msUntil = existing - Date.now()
      if (msUntil > 50) {
        await this.state.storage.setAlarm(Date.now() + 50)
      }
    }
  }

  broadcast(type: string, payload: unknown): void {
    const msg = JSON.stringify({ type, payload })
    const dead: WebSocket[] = []
    for (const ws of this.sessions) {
      try { ws.send(msg) }
      catch { dead.push(ws) }
    }
    for (const ws of dead) this.sessions.delete(ws)
  }

  private async registerWithRegistry(roomCode: string): Promise<void> {
    try {
      const id = this.env.REGISTRY.idFromName('global')
      const stub = this.env.REGISTRY.get(id)
      await stub.fetch(new Request('http://registry/register', {
        method: 'POST',
        body: JSON.stringify({ roomCode, type: this.roomType }),
        headers: { 'Content-Type': 'application/json' },
      }))
      // Heartbeat every 30s while sessions exist
      if (!this.heartbeatTimer) {
        this.heartbeatTimer = setInterval(async () => {
          if (this.sessions.size === 0 || !this.roomCode) return
          await stub.fetch(new Request('http://registry/heartbeat', {
            method: 'POST',
            body: JSON.stringify({ roomCode: this.roomCode }),
            headers: { 'Content-Type': 'application/json' },
          })).catch(() => {})
        }, 30_000)
      }
    } catch { /* registry unavailable — non-fatal */ }
  }

  private async unregisterFromRegistry(roomCode: string): Promise<void> {
    try {
      const id = this.env.REGISTRY.idFromName('global')
      const stub = this.env.REGISTRY.get(id)
      await stub.fetch(new Request('http://registry/unregister', {
        method: 'POST',
        body: JSON.stringify({ roomCode }),
        headers: { 'Content-Type': 'application/json' },
      }))
    } catch { /* registry unavailable — non-fatal */ }
  }
}
