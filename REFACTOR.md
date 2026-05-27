# ShowStack Refactor

> **How to use this file:**
> Open Claude Code inside the `showstack` folder and say:
> "Read REFACTOR.md and execute every phase in order. Do not skip anything."

---

## Context

This is a monorepo called **showstack** — a production suite of broadcast tools for live events. It currently contains a countdown studio app built with React + Vite + Zustand + Express + WebSocket + SQLite. You are going to rename it, add a rooms system, add Cloudflare R2 media storage, and containerize it with Docker. Read every phase fully before writing a single file.

---

## Phase 1 — Rename

Rename all package references from `@countdown` to `@showstack` and from `countdown-studio` to `showstack`.

Find and replace across every file in the monorepo:

```
@countdown/ui      → @showstack/ui
@countdown/server  → @showstack/server
@countdown/db      → @showstack/db
@countdown/media   → @showstack/media
@countdown/shared  → @showstack/shared
@countdown/web     → @showstack/web
countdown-studio   → showstack
```

Update:
- Root `package.json` name field
- All workspace `package.json` name fields
- `pnpm-workspace.yaml`
- `turbo.json`
- `apps/web/vite.config.ts` aliases
- `apps/electron/package.json`
- Every import statement across all source files

Do not change any functionality. Rename only.

---

## Phase 2 — Rooms System

Replace the single-project model with a room-based multi-tenant system. No user accounts. Users create or join rooms with a short code.

### Database

Create `packages/db/src/migrations/002_rooms.sql`:

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
CREATE INDEX IF NOT EXISTS idx_room_assets_code ON room_assets(room_code);
CREATE INDEX IF NOT EXISTS idx_room_cues_code ON room_cues(room_code);
CREATE INDEX IF NOT EXISTS idx_room_scripts_code ON room_scripts(room_code);
```

Run this migration automatically on server startup alongside the existing migration.

### Room Code Generation

Create `packages/shared/src/rooms.js`:

```js
// Generate a unique 6-character alphanumeric room code formatted as XX-XXXX
// Example: "FF-2847"
// Must check DB for uniqueness before returning
// Export: generateRoomCode(db), isValidRoomCode(code)
```

### Server Routes

Create `packages/server/src/routes/rooms.js`:

```
POST   /api/rooms
  body: { name, type, isPermanent }
  generates room code, inserts into DB
  returns full room object

GET    /api/rooms/:code
  returns room or 404

DELETE /api/rooms/:code
  deletes room and all associated data

GET    /api/rooms/:code/assets
POST   /api/rooms/:code/assets       (multipart upload via multer)
DELETE /api/rooms/:code/assets/:id

GET    /api/rooms/:code/cues
POST   /api/rooms/:code/cues
PUT    /api/rooms/:code/cues/:id
DELETE /api/rooms/:code/cues/:id

GET    /api/rooms/:code/scripts
POST   /api/rooms/:code/scripts
PUT    /api/rooms/:code/scripts/:id
DELETE /api/rooms/:code/scripts/:id

GET    /api/health
  returns { status: 'ok', uptime: process.uptime() }
```

### WebSocket

Refactor `packages/server/src/ws/` to be room-aware:

```
All WS connections namespaced by room code.

On connect, client immediately sends:
  { type: 'JOIN_ROOM', payload: { code } }

Server:
  - Validates room code exists in DB
  - Adds client to room subscriber list: Map<roomCode, Set<WebSocket>>
  - Sends ROOM_JOINED with full room state (timer, settings, cues)
  - If room not found sends ROOM_NOT_FOUND and closes connection

Timer engine and cue engine are per-room instances:
  roomEngines = new Map()   // roomCode → { timer, cues }
  getEngine(roomCode): if no engine exists, create one
  loaded with that room's settings from DB

All broadcasts go only to clients in the same room.

When last client leaves a room:
  - Pause the timer engine
  - Persist current state to DB
  - Keep engine in memory for 30 minutes then clean up
```

Add to `packages/shared/src/events.js`:
```js
// CLIENT_EVENTS: JOIN_ROOM, LEAVE_ROOM
// SERVER_EVENTS: ROOM_JOINED, ROOM_NOT_FOUND
```

### UI — RoomGate Component

Create `packages/ui/src/components/RoomGate.jsx`:

```
First screen shown before the app loads.
Dark background matching app theme (surface.base #181614).
ShowStack wordmark centered.

Two cards side by side:

CREATE ROOM:
  - Room name input
  - Type selector: Countdown | Teleprompter
  - Permanent toggle (permanent rooms never expire)
  - Create button → POST /api/rooms → enter room

JOIN ROOM:
  - Code input (auto-formats as XX-XXXX)
  - Join button → GET /api/rooms/:code → enter room or show error

After entering a room:
  - Store room code in sessionStorage
  - Full app renders with room context
  - Room code shown in top bar with copy/share button
  - Share button copies http://[host]/join/[code] to clipboard

Add server route: GET /join/:code
  Redirects to / with the room code pre-filled
```

Update all stores to be room-aware:
- `timerStore`: include roomCode in JOIN_ROOM WS message
- `mediaStore`: all API calls use `/api/rooms/:code/assets`
- `cueStore`: all API calls use `/api/rooms/:code/cues`
- `settingsStore`: save uses `/api/rooms/:code` settings

---

## Phase 3 — Cloudflare R2 Media Backend

Add R2 as the media storage backend with local filesystem fallback for dev.

### Install in `packages/media/package.json`:
```
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
```

### `packages/media/src/r2.js`:

```js
// Initialize S3Client for Cloudflare R2:
// endpoint: https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
// region: 'auto'
// credentials: R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY

// Export:
// uploadToR2(buffer, key, contentType) → returns public URL
// deleteFromR2(key) → void
// getR2Url(key) → string (R2_PUBLIC_URL + '/' + key)
```

### `packages/media/src/index.js` — upload flow:

```
Check at startup:
  if R2_ACCOUNT_ID env var exists → R2 mode
  else → local file mode (./data/media/)
  Log: "[media] Using R2 storage" or "[media] Using local storage"

Upload:
  1. Receive file buffer from multer memoryStorage (not diskStorage)
  2. Generate key: rooms/{roomCode}/{type}/{uuid}-{originalname}
  3. R2 mode: uploadToR2(buffer, key, mimetype)
     Local mode: write buffer to ./data/media/{key}, serve via /media/*
  4. Generate thumbnail:
     - Image: sharp(buffer).resize(320,180) → upload as rooms/{roomCode}/thumbs/{uuid}.jpg
     - Video: thumbnailUrl = null (skip for now)
     - Audio: thumbnailUrl = null
  5. Insert into room_assets table
  6. Return full asset record with URLs

Delete:
  1. R2 mode: deleteFromR2 for asset + thumbnail
     Local mode: unlink files
  2. Remove from room_assets table
```

---

## Phase 4 — Docker

Containerize for deployment on Docker Desktop with Portainer.

### `Dockerfile` in root:

```dockerfile
FROM node:20-alpine

RUN apk add --no-cache ffmpeg python3 make g++

RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/media/package.json ./packages/media/
COPY packages/server/package.json ./packages/server/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @showstack/web build

RUN mkdir -p /app/data/db /app/data/media /app/logs

EXPOSE 9876

CMD ["node", "packages/server/src/index.js"]
```

### `.dockerignore` in root:

```
node_modules
apps/*/dist
data/
logs/
.env
*.log
.git
apps/electron
```

### `docker-compose.yml` in root:

```yaml
version: "3.9"

services:
  showstack:
    build: .
    container_name: showstack
    restart: always
    ports:
      - "9876:9876"
    volumes:
      - showstack_db:/app/data/db
      - showstack_media:/app/data/media
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - PORT=9876
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID:-}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID:-}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY:-}
      - R2_BUCKET_NAME=${R2_BUCKET_NAME:-}
      - R2_PUBLIC_URL=${R2_PUBLIC_URL:-}
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:9876/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  showstack_db:
  showstack_media:
```

### `.env.example` in root:

```
PORT=9876
NODE_ENV=production

# Cloudflare R2 — leave blank to use local file storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

### Static serving — update `packages/server/src/index.js`:

After all API routes add:

```js
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.resolve(__dirname, '../../../apps/web/dist')

app.use(express.static(distPath))

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})
```

This must come AFTER all `/api/*` routes and `/media/*` static serving.

### Root `package.json` scripts — add:

```json
"docker:build": "docker build -t showstack .",
"docker:up":    "docker compose up -d",
"docker:down":  "docker compose down",
"docker:logs":  "docker compose logs -f",
"docker:shell": "docker exec -it showstack sh"
```

---

## Verification Checklist

After all phases complete, verify:

- [ ] `pnpm install` runs clean
- [ ] `pnpm build` builds the UI with no errors
- [ ] `docker build -t showstack .` completes successfully
- [ ] `docker compose up -d` starts the container
- [ ] `GET http://localhost:9876/api/health` returns `{ status: 'ok' }`
- [ ] `GET http://localhost:9876` serves the React UI
- [ ] Creating a room via RoomGate works end to end
- [ ] WebSocket JOIN_ROOM returns ROOM_JOINED with full state
- [ ] Timer play/pause syncs across two browser tabs in the same room
- [ ] Media upload works in local mode (R2 requires env vars)
- [ ] Two different room codes are fully isolated from each other

---

## Notes

- Do not stub or skip any file. Build everything fully.
- R2 env vars are optional — local mode must work without them.
- The Electron app (`apps/electron`) is excluded from Docker but must not be broken by these changes.
- All broadcasts are room-scoped — nothing leaks between rooms.
