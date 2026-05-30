import type { TimerState, RoomCue } from '../types.js'

// Wall-clock timing (HARDENING Fix 1): remaining is derived from endsAt, never drift.
// Persist throttle (HARDENING Fix 2): persist at most every 2s during tick; force-persist on user actions.

export class RoomTimer {
  private state: TimerState = {
    remaining: 0,
    totalSeconds: 0,
    running: false,
    endsAt: null,
    pausedRemaining: 0,
  }
  private lastPersist = 0
  private readonly PERSIST_INTERVAL_MS = 2000

  constructor(
    private storage: DurableObjectStorage,
    private broadcast: (type: string, payload: unknown) => void
  ) {}

  async load(): Promise<void> {
    const saved = await this.storage.get<TimerState>('timer')
    if (saved) this.state = saved
  }

  private async persist(): Promise<void> {
    await this.storage.put('timer', this.state)
    this.lastPersist = Date.now()
  }

  private async maybePersist(force = false): Promise<void> {
    const now = Date.now()
    if (force || now - this.lastPersist >= this.PERSIST_INTERVAL_MS) {
      await this.persist()
    }
  }

  getState(): TimerState {
    return { ...this.state, remaining: this.computeRemaining() }
  }

  private computeRemaining(): number {
    if (!this.state.running || this.state.endsAt === null) return this.state.pausedRemaining
    const ms = this.state.endsAt - Date.now()
    return Math.max(0, Math.ceil(ms / 1000))
  }

  async play(): Promise<void> {
    if (this.state.running) return
    this.state.running = true
    this.state.endsAt = Date.now() + (this.state.pausedRemaining * 1000)
    await this.maybePersist(true)
    this.broadcast('timer:tick', this.getState())
  }

  async pause(): Promise<void> {
    this.state.running = false
    this.state.pausedRemaining = this.computeRemaining()
    this.state.endsAt = null
    await this.maybePersist(true)
    this.broadcast('timer:tick', this.getState())
  }

  async stop(): Promise<void> {
    this.state.running = false
    this.state.pausedRemaining = this.state.totalSeconds
    this.state.remaining = this.state.totalSeconds
    this.state.endsAt = null
    await this.maybePersist(true)
    this.broadcast('timer:tick', this.getState())
  }

  async reset(): Promise<void> {
    return this.stop()
  }

  async setTime(h: number, m: number, s: number): Promise<void> {
    const total = h * 3600 + m * 60 + s
    this.state.totalSeconds = total
    this.state.pausedRemaining = total
    this.state.remaining = total
    this.state.running = false
    this.state.endsAt = null
    await this.maybePersist(true)
    this.broadcast('timer:tick', this.getState())
  }

  async tick(cues: RoomCue[]): Promise<boolean> {
    if (!this.state.running) return false
    const prevRemaining = this.state.remaining
    const newRemaining = this.computeRemaining()
    this.state.remaining = newRemaining

    // Scan the crossed range so no cue is missed if a tick lands late
    if (newRemaining < prevRemaining) {
      for (let sec = prevRemaining - 1; sec >= newRemaining; sec--) {
        for (const cue of cues) {
          if (cue.trigger_at === sec) {
            // Parse actions_json into an array so the client's executeCueActions can iterate it.
            // cues are raw DB rows (actions_json = string); we must parse here before broadcast.
            let actions: unknown[]
            try { actions = JSON.parse(cue.actions_json ?? '[]') } catch { actions = [] }
            this.broadcast('cue:fired', {
              cue: { ...cue, actions },
            })
          }
        }
      }
    }

    if (newRemaining <= 0) {
      this.state.running = false
      this.state.endsAt = null
      this.state.pausedRemaining = 0
      await this.maybePersist(true)
      this.broadcast('timer:tick', this.getState())
      this.broadcast('timer:done', {})
      return false
    }

    await this.maybePersist()
    this.broadcast('timer:tick', this.getState())
    return true
  }

  needsTicking(): boolean {
    return this.state.running
  }
}
