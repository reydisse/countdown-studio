import type { PrompterState } from '../types.js'

// Persist throttle (HARDENING Fix 2): broadcast every tick (cheap), persist at most every 2s.
const SPEED_PX: Record<number, number> = { 1:1, 2:2, 3:3, 4:4, 5:5, 6:7, 7:9, 8:11, 9:13, 10:15 }

// Continuous scrub rate while a "hold to scrub" button is held (px per 50ms tick).
const SCRUB_PX_PER_TICK = 25 // 500px/sec, independent of playback speed

export class RoomPrompter {
  private state: PrompterState = {
    scrollPosition: 0,
    totalHeight: 0,
    isPlaying: false,
    speed: 3,
  }
  private lastPersist = 0
  private readonly PERSIST_INTERVAL_MS = 2000
  // Ephemeral (not persisted) — direction of an active "hold to scrub" gesture, or null.
  private scrubDirection: -1 | 1 | null = null
  private scrubStartedAt = 0
  // Safety net: auto-release if a Companion "stop" press is ever missed (crash/disconnect).
  private readonly MAX_SCRUB_MS = 30_000

  constructor(
    private storage: DurableObjectStorage,
    private broadcast: (type: string, payload: unknown) => void
  ) {}

  async load(): Promise<void> {
    const saved = await this.storage.get<Partial<PrompterState>>('prompter')
    if (saved) {
      this.state = {
        scrollPosition: numberOr(saved.scrollPosition, 0),
        totalHeight: numberOr(saved.totalHeight, 0),
        isPlaying: saved.isPlaying === true,
        speed: Math.max(1, Math.min(10, Math.round(numberOr(saved.speed, 3)))),
      }
    }
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
    const n = Number(speed)
    if (!Number.isFinite(n)) return
    this.state.speed = Math.max(1, Math.min(10, Math.round(n)))
    await this.maybePersist(true)
    this.broadcast('prompter:tick', this.getState())
  }

  async seekTo(position: number): Promise<void> {
    const n = Number(position)
    if (!Number.isFinite(n)) return
    this.state.scrollPosition = Math.max(0, n)
    await this.maybePersist(true)
    this.broadcast('prompter:tick', this.getState())
  }

  // Nudge by a number of seconds (negative = backward), converted to pixels
  // using the current speed — lets Companion send simple "±5s" buttons.
  async nudge(seconds: number): Promise<void> {
    const n = Number(seconds)
    if (!Number.isFinite(n)) return
    const pxPerSec = (SPEED_PX[this.state.speed] ?? 3) * (1000 / 50)
    const max = this.state.totalHeight > 0 ? this.state.totalHeight : Infinity
    this.state.scrollPosition = Math.max(0, Math.min(max, Math.round(this.state.scrollPosition + n * pxPerSec)))
    await this.maybePersist(true)
    this.broadcast('prompter:tick', this.getState())
  }

  async setTotalHeight(h: number): Promise<void> {
    const n = Number(h)
    if (!Number.isFinite(n)) return
    this.state.totalHeight = n
    await this.maybePersist()
  }

  // Start a continuous "hold to scrub" gesture (Companion Press action).
  async startScrub(direction: number): Promise<void> {
    const n = Number(direction)
    this.scrubDirection = n > 0 ? 1 : n < 0 ? -1 : null
    this.scrubStartedAt = Date.now()
  }

  // End a "hold to scrub" gesture (Companion Release action).
  async stopScrub(): Promise<void> {
    if (this.scrubDirection === null) return
    this.scrubDirection = null
    await this.maybePersist(true)
    this.broadcast('prompter:tick', this.getState())
  }

  async tick(): Promise<boolean> {
    let moved = false
    const max = this.state.totalHeight > 0 ? this.state.totalHeight : Infinity

    if (this.scrubDirection !== null) {
      if (Date.now() - this.scrubStartedAt > this.MAX_SCRUB_MS) {
        this.scrubDirection = null
      } else {
        this.state.scrollPosition = Math.max(0, Math.min(max, this.state.scrollPosition + this.scrubDirection * SCRUB_PX_PER_TICK))
        moved = true
      }
    }

    if (this.state.isPlaying) {
      const px = SPEED_PX[this.state.speed] ?? 3
      this.state.scrollPosition += px

      if (this.state.totalHeight > 0 && this.state.scrollPosition >= this.state.totalHeight) {
        this.state.isPlaying = false
        this.state.scrollPosition = this.state.totalHeight
        await this.maybePersist(true)
        this.broadcast('prompter:tick', this.getState())
        this.broadcast('prompter:done', {})
        return this.needsTicking()
      }
      moved = true
    }

    if (moved) {
      await this.maybePersist()
      this.broadcast('prompter:tick', this.getState())
    }

    return this.needsTicking()
  }

  needsTicking(): boolean {
    return this.state.isPlaying || this.scrubDirection !== null
  }
}

function numberOr(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}
