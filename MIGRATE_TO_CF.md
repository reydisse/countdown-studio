# Migrate ShowStack to Cloudflare

> **How to use this file:**
> Open Claude Code inside the `showstack` folder and say:
> "Read MIGRATE_TO_CF.md and execute every phase in order. Do not skip anything."
>
> **Run this file AFTER REFACTOR.md and TELEPROMPTER.md are complete.**
>
> **Prerequisites:**
> - Cloudflare account on paid plan (Workers Paid required for Durable Objects)
> - Wrangler CLI installed globally: `npm install -g wrangler`
> - Logged in to Cloudflare: `wrangler login`
> - Domain on Cloudflare with DNS managed by CF
> - GitHub repo connected (for Pages auto-deploy)

---

## What This Migration Does

Replaces the self-hosted Express + SQLite + Docker stack with:

```
Express server          -> Cloudflare Workers (Hono)
SQLite/better-sqlite3   -> Cloudflare D1 (same SQL syntax)
Local file storage      -> Cloudflare R2 (zero egress fees)
Per-room WS engines     -> Cloudflare Durable Objects (one DO per room)
Vite/Pages frontend     -> Cloudflare Pages (two projects)
Docker + PM2            -> gone entirely
Electron local server   -> Electron talks to CF Worker API directly
```

The existing Express server in `packages/server` stays intact for local dev.
Do not remove or modify it. Add `apps/cloudflare` as a new parallel package.

---

## New Structure to Add

```
apps/
  cloudflare/
    src/
      worker.ts
      durableObjects/
        RoomObject.ts
        RoomTimer.ts
        RoomPrompter.ts
      routes/
        rooms.ts
        prompter.ts
        health.ts
      db/
        migrations/
          0001_initial.sql
        queries/
          rooms.ts
          assets.ts
          cues.ts
          scripts.ts
      r2/
        upload.ts
        delete.ts
      utils/
        roomCode.ts
      types.ts
    wrangler.toml
    package.json
    tsconfig.json
    .dev.vars
```

---

## Phase 1 - Package Setup

### apps/cloudflare/package.json

```json
{
  "name": "@showstack/cloudflare",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev":               "wrangler dev --local",
    "deploy":            "wrangler deploy",
    "types":             "wrangler types",
    "db:create":         "wrangler d1 create showstack-db",
    "db:migrate:local":  "wrangler d1 migrations apply showstack-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply showstack-db --remote",
    "r2:create":         "wrangler r2 bucket create showstack-media"
  },
  "dependencies": {
    "hono": "^4.4.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240924.0",
    "typescript": "^5.7.0",
    "wrangler": "^3.78.0"
  }
}
```

### apps/cloudflare/tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### apps/cloudflare/wrangler.toml

```toml
name = "showstack"
main = "src/worker.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[durable_objects.bindings]]
name = "ROOM"
class_name = "RoomObject"

[[migrations]]
tag = "v1"
new_classes = ["RoomObject"]

[[d1_databases]]
binding = "DB"
database_name = "showstack-db"
database_id = "PASTE_DATABASE_ID_HERE"

[[r2_buckets]]
binding = "MEDIA"
bucket_name = "showstack-media"

[vars]
ENVIRONMENT = "production"
MEDIA_PUBLIC_URL = "https://media.YOURDOMAIN.com"
ALLOWED_ORIGINS = "https://showstack-countdown.pages.dev,https://showstack-teleprompter.pages.dev,https://YOURDOMAIN.com"

[[routes]]
pattern = "api.YOURDOMAIN.com/*"
zone_name = "YOURDOMAIN.com"
```

### apps/cloudflare/.dev.vars

```
ENVIRONMENT=development
MEDIA_PUBLIC_URL=http://localhost:8787/media-dev
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
```

### apps/cloudflare/src/types.ts

```ts
export type Bindings = {
  DB: D1Database
  MEDIA: R2Bucket
  ROOM: DurableObjectNamespace
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

export type TimerState = {
  remaining: number
  totalSeconds: number
  running: boolean
  startedAt: number | null
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
```

---

## Phase 2 - D1 Database

### apps/cloudflare/src/db/migrations/0001_initial.sql

```sql
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'countdown',
  settings_json TEXT NOT NULL DEFAULT '{}',
  is_permanent INTEGER NOT NULL DEFAULT 0,
  last_active INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS room_assets (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('image','video','audio')),
  url TEXT NOT NULL,
  size INTEGER NOT NULL,
  duration REAL,
  thumbnail_url TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS room_cues (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  trigger_at INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  actions_json TEXT NOT NULL DEFAULT '[]',
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS room_scripts (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(type);
CREATE INDEX IF NOT EXISTS idx_rooms_last_active ON rooms(last_active);
CREATE INDEX IF NOT EXISTS idx_room_assets_code ON room_assets(room_code);
CREATE INDEX IF NOT EXISTS idx_room_cues_code ON room_cues(room_code);
CREATE INDEX IF NOT EXISTS idx_room_cues_trigger ON room_cues(trigger_at);
CREATE INDEX IF NOT EXISTS idx_room_scripts_code ON room_scripts(room_code);
```

### apps/cloudflare/src/db/queries/rooms.ts

Full CRUD. Implement all of the following functions using D1Database prepared statements:

```ts
createRoom(db, room)           -> Promise<Room>
getRoomByCode(db, code)        -> Promise<Room | null>
updateRoomSettings(db, code, settings_json) -> Promise<void>
touchRoom(db, code)            -> Promise<void>   // sets last_active = Date.now()
deleteRoom(db, code)           -> Promise<void>
listRooms(db, type?)           -> Promise<Room[]> // ordered by last_active DESC
getActivePrompterRoom(db)      -> Promise<Room | null> // type=teleprompter, most recent last_active
getActiveCountdownRoom(db)     -> Promise<Room | null> // type=countdown, most recent last_active
```

### apps/cloudflare/src/db/queries/assets.ts

```ts
createAsset(db, asset)         -> Promise<RoomAsset>
getAssetsByRoom(db, roomCode)  -> Promise<RoomAsset[]>
getAssetById(db, id)           -> Promise<RoomAsset | null>
deleteAsset(db, id)            -> Promise<void>
```

### apps/cloudflare/src/db/queries/cues.ts

```ts
getCuesByRoom(db, roomCode)           -> Promise<RoomCue[]>  // ordered by trigger_at ASC
createCue(db, cue)                    -> Promise<RoomCue>
updateCue(db, id, changes)            -> Promise<void>
deleteCue(db, id)                     -> Promise<void>
```

### apps/cloudflare/src/db/queries/scripts.ts

```ts
getScriptsByRoom(db, roomCode)        -> Promise<RoomScript[]>
createScript(db, script)              -> Promise<RoomScript>
updateScript(db, id, changes)         -> Promise<void>   // updates updated_at automatically
deleteScript(db, id)                  -> Promise<void>
```

---

## Phase 3 - R2 Helpers

### apps/cloudflare/src/r2/upload.ts

```ts
// uploadToR2(bucket, key, data, contentType, mediaPublicUrl) -> Promise<string>
// Puts object in R2 with cacheControl: 'public, max-age=31536000'
// Returns: `${mediaPublicUrl}/${key}`

// generateR2Key(roomCode, type, filename, uuid) -> string
// Returns: `rooms/${roomCode}/${type}/${uuid}-${filename}`
```

### apps/cloudflare/src/r2/delete.ts

```ts
// deleteFromR2(bucket, url, mediaPublicUrl) -> Promise<void>
// Extracts key from URL, deletes object
// Also attempts to delete thumbnail (rooms/.../thumbs/...) - swallow error if not found
```

---

## Phase 4 - Room Code Utility

### apps/cloudflare/src/utils/roomCode.ts

```ts
// generateRoomCode(db) -> Promise<string>
// Format: XX-XXXX using chars ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (no ambiguous chars)
// Checks DB for uniqueness, retries up to 10 times
// Throws if cannot generate unique code after 10 attempts

// isValidRoomCode(code) -> boolean
// Validates format: /^[A-Z0-9]{2}-[A-Z0-9]{4}$/
```

---

## Phase 5 - Durable Objects

### apps/cloudflare/src/durableObjects/RoomTimer.ts

Timer engine that lives inside the RoomObject Durable Object.
Uses DO storage for persistence, not in-memory variables.
Receives a broadcast callback from RoomObject.

State shape stored in DO storage under key 'timer':
```ts
{ remaining: number, totalSeconds: number, running: boolean, startedAt: number | null }
```

Implement these methods fully:

```ts
load()                 // load state from DO storage on startup
persist()              // save state to DO storage
getState()             // return copy of current state
play()                 // set running=true, persist, broadcast TIMER_TICK
pause()                // set running=false, persist, broadcast TIMER_TICK
stop()                 // set running=false, remaining=totalSeconds, persist, broadcast TIMER_TICK
reset()                // same as stop()
setTime(h, m, s)       // set totalSeconds and remaining, persist, broadcast TIMER_TICK
tick(cues)             // decrement remaining by 1
                       // if remaining reaches 0: stop, broadcast TIMER_DONE
                       // check cues array for trigger_at === remaining, broadcast CUE_FIRED for matches
                       // persist, broadcast TIMER_TICK
                       // return true if still running, false if stopped
needsTicking()         // return this.state.running
```

### apps/cloudflare/src/durableObjects/RoomPrompter.ts

Prompter engine that lives inside RoomObject.
Same storage pattern as RoomTimer.

State shape stored under key 'prompter':
```ts
{ scrollPosition: number, totalHeight: number, isPlaying: boolean, speed: number }
```

Speed to px per tick mapping (called at 20fps / every 50ms):
```
speed 1  = 1px
speed 2  = 2px
speed 3  = 3px
speed 4  = 4px
speed 5  = 5px
speed 6  = 7px
speed 7  = 9px
speed 8  = 11px
speed 9  = 13px
speed 10 = 15px
```

Implement these methods fully:

```ts
load()
persist()
getState()
play()               // set isPlaying=true, persist, broadcast PROMPTER_TICK
pause()              // set isPlaying=false, persist, broadcast PROMPTER_TICK
stop()               // set isPlaying=false, scrollPosition=0, persist, broadcast PROMPTER_TICK
setSpeed(speed)      // clamp 1-10, persist, broadcast PROMPTER_TICK
seekTo(position)     // set scrollPosition, persist, broadcast PROMPTER_TICK
setTotalHeight(h)    // set totalHeight, persist (no broadcast needed)
tick()               // increment scrollPosition by speedToPxPerTick
                     // if scrollPosition >= totalHeight: stop, broadcast PROMPTER_DONE
                     // persist, broadcast PROMPTER_TICK
                     // return true if still playing, false if stopped
needsTicking()       // return this.state.isPlaying
```

### apps/cloudflare/src/durableObjects/RoomObject.ts

One Durable Object instance per room. Identified by room code.
Usage: `env.ROOM.idFromName(roomCode)` then `env.ROOM.get(id)`

```ts
export class RoomObject implements DurableObject {
  private sessions = new Set<WebSocket>()
  private timer: RoomTimer
  private prompter: RoomPrompter
  private roomCode: string | null = null
  private cues: RoomCue[] = []

  constructor(state: DurableObjectState, env: { DB: D1Database }) {
    // Initialize timer and prompter with storage and broadcast callback
  }

  async fetch(request: Request): Promise<Response> {
    // 1. If WebSocket upgrade: accept WS using state.acceptWebSocket()
    //    Add to sessions, load timer+prompter state, return 101
    // 2. Internal HTTP paths (called by Worker routes):
    //    /timer/play|pause|stop|reset|set|state
    //    /prompter/play|pause|stop|speed|speed/up|speed/down|seek|state
    //    /reload-cues  -- reload cues from D1
    //    /state        -- return full room state
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    // Parse JSON message, switch on type:
    // JOIN_ROOM     -> set roomCode, load cues from D1, send ROOM_JOINED with full state
    // TIMER_PLAY    -> timer.play(), then schedule alarm if not already scheduled
    // TIMER_PAUSE   -> timer.pause()
    // TIMER_STOP    -> timer.stop()
    // TIMER_RESET   -> timer.reset()
    // TIMER_SET     -> timer.setTime(h,m,s)
    // PROMPTER_PLAY -> prompter.play(), schedule alarm if not already scheduled
    // PROMPTER_PAUSE -> prompter.pause()
    // PROMPTER_STOP -> prompter.stop()
    // PROMPTER_SPEED -> prompter.setSpeed(speed)
    // PROMPTER_SEEK -> prompter.seekTo(position)
    // PROMPTER_SETTINGS -> prompter.setTotalHeight(totalHeight)
    // RELOAD_CUES   -> reload cues from D1
    // LEAVE_ROOM    -> remove from sessions
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    // Remove ws from sessions
    // If sessions.size === 0: cancel alarm via state.storage.deleteAlarm()
  }

  async alarm(): Promise<void> {
    // Tick timer if needsTicking
    // Tick prompter if needsTicking
    // Schedule next alarm:
    //   Both running:     50ms (prompter needs 50ms, timer can wait)
    //   Timer only:       1000ms
    //   Prompter only:    50ms
    //   Neither running:  no alarm
  }

  // Schedule alarm only if not already scheduled
  async scheduleAlarm(): Promise<void> {
    const existing = await this.state.storage.getAlarm()
    if (!existing) {
      const interval = this.prompter.needsTicking() ? 50 : 1000
      await this.state.storage.setAlarm(Date.now() + interval)
    }
  }

  broadcast(type: string, payload: unknown): void {
    // Send JSON to all sessions, remove dead sessions
  }
}
```

---

## Phase 6 - Hono Worker

### apps/cloudflare/src/routes/health.ts

```ts
// GET / -> { status: 'ok', uptime: Date.now(), environment: string }
```

### apps/cloudflare/src/routes/prompter.ts

Auto-detect active teleprompter room using getActivePrompterRoom(db).

```
GET  /rooms                  -> list all teleprompter rooms ordered by last_active
GET  /active                 -> { code, name, ...prompterState } or { code: null }
POST /active/play
POST /active/pause
POST /active/stop
POST /active/speed           body: { speed: 1-10 }
POST /active/speed/up
POST /active/speed/down
POST /active/seek            body: { position: number }
POST /active/cue/:cueId      -> look up cue position from D1, seekTo that position
```

All active/* endpoints:
1. Call getActivePrompterRoom(db) 
2. If null: return 404 { error: 'No active teleprompter room' }
3. Get DO stub: env.ROOM.idFromName(room.code)
4. Forward to DO internal HTTP handler
5. Return response

### apps/cloudflare/src/routes/rooms.ts

Full implementation. All routes fully functional, no stubs.

```
POST   /                       create room, generate code, return room object
GET    /                       list all rooms (optional ?type= filter)
GET    /:code                  get room or 404, touch last_active
PUT    /:code/settings         update settings_json
DELETE /:code                  delete room (cascades)

GET    /:code/assets           list assets
POST   /:code/assets           multipart upload to R2, insert into D1, return asset
DELETE /:code/assets/:id       delete from R2 + D1

GET    /:code/cues             list cues ordered by trigger_at
POST   /:code/cues             create cue, notify DO to reload cues
PUT    /:code/cues/:id         update cue, notify DO to reload cues
DELETE /:code/cues/:id         delete cue

GET    /:code/scripts          list scripts
POST   /:code/scripts          create script
PUT    /:code/scripts/:id      update script
DELETE /:code/scripts/:id      delete script

POST   /:code/timer/play
POST   /:code/timer/pause
POST   /:code/timer/stop
POST   /:code/timer/reset
POST   /:code/timer/set        body: { h, m, s }
GET    /:code/timer/state

POST   /:code/prompter/play
POST   /:code/prompter/pause
POST   /:code/prompter/stop
POST   /:code/prompter/speed   body: { speed }
POST   /:code/prompter/speed/up
POST   /:code/prompter/speed/down
POST   /:code/prompter/seek    body: { position }
GET    /:code/prompter/state
```

Timer and prompter endpoints forward to the RoomObject DO via internal HTTP:
```ts
const id = c.env.ROOM.idFromName(code)
const stub = c.env.ROOM.get(id)
return stub.fetch(new Request(`http://do${path}`, { method, body, headers }))
```

### apps/cloudflare/src/worker.ts

```ts
import { Hono } from 'hono'
export { RoomObject } from './durableObjects/RoomObject'
import roomsRoute from './routes/rooms'
import prompterRoute from './routes/prompter'
import healthRoute from './routes/health'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

// CORS middleware - read ALLOWED_ORIGINS from env, match request origin
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') ?? ''
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map(o => o.trim())
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] ?? '*'
  c.header('Access-Control-Allow-Origin', allowOrigin)
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (c.req.method === 'OPTIONS') return c.body(null, 204)
  return next()
})

app.route('/api/rooms', roomsRoute)
app.route('/api/prompter', prompterRoute)
app.route('/api/health', healthRoute)

// WebSocket upgrade route
// Client connects to: wss://api.YOURDOMAIN.com/ws?room=XX-XXXX
app.get('/ws', async (c) => {
  const roomCode = c.req.query('room')
  if (!roomCode) return c.text('room query param required', 400)
  if (c.req.header('Upgrade') !== 'websocket') return c.text('Expected WebSocket upgrade', 426)
  const id = c.env.ROOM.idFromName(roomCode)
  const stub = c.env.ROOM.get(id)
  return stub.fetch(c.req.raw)
})

// Room join shortlink
app.get('/join/:code', (c) => c.redirect(`/?room=${c.req.param('code')}`))

export default app
```

---

## Phase 7 - Frontend Updates

### Update packages/ui/src/adapter/web.js

Change all API calls and WS connections to read from environment variables:

```js
const SERVER_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:9876'
const WS_URL = (import.meta.env.VITE_WS_URL ?? 'ws://localhost:9876')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://')

export default {
  getServerUrl: () => SERVER_URL,
  getWsUrl: () => WS_URL,
  // All existing methods unchanged except they use SERVER_URL instead of hardcoded localhost
  openFilePicker: async (opts = {}) => {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      if (opts.accept) input.accept = opts.accept
      if (opts.multiple) input.multiple = true
      input.onchange = () => resolve(Array.from(input.files ?? []))
      input.click()
    })
  },
}
```

### Update packages/ui/src/hooks/useWebSocket.js

WebSocket URL must now include room code as query param to route to correct DO:

```js
// Change connect(roomCode) to build URL as:
// `${getWsUrl()}/ws?room=${roomCode}`
// instead of just `${getWsUrl()}`
```

### apps/web/.env.production

```
VITE_API_URL=https://api.YOURDOMAIN.com
VITE_WS_URL=wss://api.YOURDOMAIN.com
```

### apps/teleprompter/.env.production

```
VITE_API_URL=https://api.YOURDOMAIN.com
VITE_WS_URL=wss://api.YOURDOMAIN.com
```

---

## Phase 8 - Deployment Steps

Execute in this exact order. Do not skip any step.

### Step 1 - Login
```bash
wrangler login
```

### Step 2 - Create D1 database
```bash
cd apps/cloudflare
pnpm db:create
```
Copy the database_id from output. Paste into wrangler.toml replacing PASTE_DATABASE_ID_HERE.

### Step 3 - Run migrations
```bash
pnpm db:migrate:local
pnpm db:migrate:remote
```

### Step 4 - Create R2 bucket
```bash
pnpm r2:create
```
Then in CF dashboard: R2 -> showstack-media -> Settings -> Custom Domains
Add: media.YOURDOMAIN.com
Update MEDIA_PUBLIC_URL in wrangler.toml to match.

### Step 5 - Deploy Worker
```bash
pnpm deploy
```

### Step 6 - Set Worker route
In CF dashboard: Workers and Pages -> showstack -> Triggers -> Add route
Route: api.YOURDOMAIN.com/*
Zone: YOURDOMAIN.com

### Step 7 - Deploy Pages - Countdown Studio
In CF dashboard: Workers and Pages -> Create -> Pages -> Connect to Git
- Project name: showstack-countdown
- Build command: pnpm --filter @showstack/web build
- Build output: apps/web/dist
- Environment variables:
  VITE_API_URL = https://api.YOURDOMAIN.com
  VITE_WS_URL = wss://api.YOURDOMAIN.com

### Step 8 - Deploy Pages - Teleprompter
- Project name: showstack-teleprompter
- Build command: pnpm --filter @showstack/teleprompter-app build
- Build output: apps/teleprompter/dist
- Environment variables:
  VITE_API_URL = https://api.YOURDOMAIN.com
  VITE_WS_URL = wss://api.YOURDOMAIN.com

### Step 9 - Update ALLOWED_ORIGINS
After Pages deploy, update wrangler.toml:
```toml
ALLOWED_ORIGINS = "https://showstack-countdown.pages.dev,https://showstack-teleprompter.pages.dev,https://YOURDOMAIN.com"
```
Then: `pnpm deploy` again to apply.

### Step 10 - Test
```bash
curl https://api.YOURDOMAIN.com/api/health
# Expected: { "status": "ok" }
```

---

## Phase 9 - Root Scripts

Add to root package.json scripts:

```json
"dev":              "turbo run dev --filter=@showstack/server --filter=@showstack/web --parallel",
"dev:prompter":     "turbo run dev --filter=@showstack/server --filter=@showstack/teleprompter-app --parallel",
"dev:cf":           "pnpm --filter @showstack/cloudflare dev",
"deploy:worker":    "pnpm --filter @showstack/cloudflare deploy",
"db:migrate:local": "pnpm --filter @showstack/cloudflare db:migrate:local",
"db:migrate:prod":  "pnpm --filter @showstack/cloudflare db:migrate:remote"
```

---

## Verification Checklist

- [ ] wrangler login succeeds
- [ ] D1 database created, ID pasted into wrangler.toml
- [ ] Migrations run locally without errors
- [ ] Migrations run remotely without errors
- [ ] R2 bucket created
- [ ] Custom domain set on R2 bucket
- [ ] pnpm dev (local CF) starts on port 8787
- [ ] GET http://localhost:8787/api/health returns { status: 'ok' }
- [ ] POST http://localhost:8787/api/rooms creates a room in local D1
- [ ] GET http://localhost:8787/api/rooms/:code returns the room
- [ ] WebSocket connects to ws://localhost:8787/ws?room=XX-XXXX
- [ ] JOIN_ROOM returns ROOM_JOINED with timer and prompter state
- [ ] TIMER_PLAY starts the timer ticking via DO alarm
- [ ] TIMER_TICK broadcasts every second to all connected WS clients
- [ ] Timer stops and broadcasts TIMER_DONE when reaching zero
- [ ] CUE_FIRED broadcasts when timer matches a cue trigger_at
- [ ] PROMPTER_PLAY starts scroll ticking at 50ms via DO alarm
- [ ] PROMPTER_TICK broadcasts every 50ms with scroll position
- [ ] File upload stores in local R2 sim and returns URL
- [ ] pnpm deploy succeeds with no errors
- [ ] GET https://api.YOURDOMAIN.com/api/health returns ok
- [ ] Room created on Pages persists in CF D1
- [ ] WS connects to wss://api.YOURDOMAIN.com/ws?room=XX-XXXX
- [ ] Timer syncs across two browser tabs on different devices
- [ ] Prompter syncs across controller and reader views
- [ ] Media uploaded stores in CF R2 with public URL
- [ ] GET /api/prompter/active returns active room or { code: null }
- [ ] POST /api/prompter/active/play controls active room
- [ ] Two different rooms are fully isolated from each other
- [ ] Companion HTTP endpoints work against production URL

---

## Critical Notes

- Replace YOURDOMAIN.com with your actual domain everywhere before running.
- Durable Objects require Workers Paid plan. You have this.
- DO alarm API replaces setInterval. It survives cold starts and restarts.
- DO storage is for ephemeral state (timer position, scroll). D1 is for persistent data.
- R2 has zero egress fees. Serve media directly from R2 public URL, never proxy through Worker.
- CORS must match exactly. If Pages URL changes, update ALLOWED_ORIGINS and redeploy.
- WebSocket URL must include ?room= query param to route to correct DO.
- Do not remove packages/server. It stays for local dev.
- Both timer and prompter alarms coexist in the same DO. Use 50ms interval when prompter is running (timer can piggyback). Use 1000ms when only timer is running.
