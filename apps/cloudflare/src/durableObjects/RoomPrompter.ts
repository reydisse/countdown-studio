import type { PrompterState } from '../types.js'

// Persist throttle (HARDENING Fix 2): broadcast every tick (cheap), persist at most every 2s.
const SPEED_PX: Record<number, number> = { 1:1, 2:2, 3:3, 4:4, 5:5, 6:7, 7:9, 8:11, 9:13, 10:15 }

export class RoomPrompter {
  private state: PrompterState = {
    scrollPosition: 0,
    totalHeight: 0,
    isPlaying: false,
    speed: 3,
  }
  private lastPersist = 0
  private readonly PERSIST_INTERVAL_MS = 2000

  constructor(
    private storage: DurableObjectStorage,
    private broadcast: (type: string, payload: unknown) => void
  ) {}

  async load(): Promise<void> {
    const saved = await this.storage.get<PrompterState>('prompter')
    if (saved) this.state = saved
  }

  private async persist(): Promise<void> {
    await this.storage.put('prompter', this.state)
    this.lastPersist = Date.now()
  }

  private async maybePersist(force = false): Promise<void> {
    const now = Date.now()
    if (force || now - this.lastPersist >= this.PERSIST_INTERVAL_MS) {
      await this.persist()
    }
  }

  getState(): PrompterState {
    return { ...this.state }
  }

  async play(): Promise<void> {
    this.state.isPlaying = true
    await this.maybePersist(true)
    this.broadcast('prompter:tick', this.getState())
  }

  async pause(): Promise<void> {
    this.state.isPlaying = false
    await this.maybePersist(true)
    this.broadcast('prompter:tick', this.getState())
  }

  async stop(): Promise<void> {
    this.state.isPlaying = false
    this.state.scrollPosition = 0
    await this.maybePersist(true)
    this.broadcast('prompter:tick', this.getState())
  }

  async setSpeed(speed: number): Promise<void> {
    this.state.speed = Math.max(1, Math.min(10, Math.round(speed)))
    await this.maybePersist(true)
    this.broadcast('prompter:tick', this.getState())
  }

  async seekTo(position: number): Promise<void> {
    this.state.scrollPosition = Math.max(0, position)
    await this.maybePersist(true)
    this.broadcast('prompter:tick', this.getState())
  }

  async setTotalHeight(h: number): Promise<void> {
    this.state.totalHeight = h
    await this.maybePersist()
  }

  async tick(): Promise<boolean> {
    if (!this.state.isPlaying) return false
    const px = SPEED_PX[this.state.speed] ?? 3
    this.state.scrollPosition += px

    if (this.state.totalHeight > 0 && this.state.scrollPosition >= this.state.totalHeight) {
      this.state.isPlaying = false
      this.state.scrollPosition = this.state.totalHeight
      await this.maybePersist(true)
      this.broadcast('prompter:tick', this.getState())
      this.broadcast('prompter:done', {})
      return false
    }

    await this.maybePersist()
    this.broadcast('prompter:tick', this.getState())
    return true
  }

  needsTicking(): boolean {
    return this.state.isPlaying
  }
}
