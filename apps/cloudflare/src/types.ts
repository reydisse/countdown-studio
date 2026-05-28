export type Bindings = {
  DB: D1Database
  MEDIA: R2Bucket
  ROOM: DurableObjectNamespace
  REGISTRY: DurableObjectNamespace
  ENVIRONMENT: string
  MEDIA_PUBLIC_URL: string
  ALLOWED_ORIGINS: string
}

export type Room = {
  id: string
  code: string
  name: string
  type: 'countdown' | 'teleprompter'
  settings_json: string
  is_permanent: number
  last_active: number | null
  created_at: number
  expires_at: number | null
}

export type RoomAsset = {
  id: string
  room_code: string
  name: string
  type: 'image' | 'video' | 'audio'
  url: string
  size: number
  duration: number | null
  thumbnail_url: string | null
  tags: string
  created_at: number
}

export type RoomCue = {
  id: string
  room_code: string
  trigger_at: number
  label: string
  actions_json: string
  order_index: number
  created_at: number
}

export type RoomScript = {
  id: string
  room_code: string
  name: string
  content: string
  created_at: number
  updated_at: number
}

// Wall-clock based (HARDENING Fix 1): remaining is derived from endsAt, never drift
export type TimerState = {
  remaining: number        // derived for display/broadcast
  totalSeconds: number
  running: boolean
  endsAt: number | null    // absolute epoch ms when timer hits zero
  pausedRemaining: number  // remaining seconds captured at pause
}

export type PrompterState = {
  scrollPosition: number
  totalHeight: number
  isPlaying: boolean
  speed: number
}

export type WSMessage = {
  type: string
  payload?: Record<string, unknown>
}
