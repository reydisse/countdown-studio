# ShowStack Hardening Fixes

> **How to use this file:**
> Open Claude Code inside the `showstack` folder and say:
> "Read HARDENING.md and fix every issue in order. Do not skip anything."
>
> **Run this AFTER MIGRATE_TO_CF.md is implemented but BEFORE relying on it in production.**
> These fixes address timing accuracy, cost, and reliability issues in the
> Durable Object engines and active-room detection.

---

## Context

The Cloudflare migration uses Durable Objects with the Alarm API to run
per-room timer and prompter engines. Three issues need fixing before this
is production-safe:

1. Timer drift when timer and prompter alarms coexist
2. Excessive DO storage writes from the 50ms prompter loop
3. Fragile "active room" detection based on last_active timestamp

Fix all three.

---

## Fix 1 — Wall-Clock Timer (eliminate drift)

### Problem
The timer currently decrements `remaining` by 1 on each alarm tick. When the
prompter is also running, alarms fire every 50ms and the timer logic can be
called at the wrong cadence, causing the countdown to drift away from real time
over a long session. Relying on tick counting for a clock is inherently lossy.

### Solution
Make the timer compute `remaining` from wall-clock time instead of counting ticks.
Store the target end timestamp, derive remaining on every tick.

### Changes to `apps/cloudflare/src/durableObjects/RoomTimer.ts`

Change the state shape to track an absolute end time:

```ts
export type TimerState = {
  remaining: number        // derived, for display/broadcast
  totalSeconds: number
  running: boolean
  endsAt: number | null    // absolute epoch ms when timer hits zero
  pausedRemaining: number  // remaining seconds captured at pause
}
```

Rewrite the methods:

```ts
play():
  if running: return
  running = true
  // endsAt is now + whatever remaining we had
  endsAt = Date.now() + (pausedRemaining * 1000)
  persist()
  broadcast TIMER_TICK with computed state

pause():
  running = false
  // capture how much is left at this instant
  pausedRemaining = computeRemaining()
  endsAt = null
  persist()
  broadcast TIMER_TICK

stop() / reset():
  running = false
  pausedRemaining = totalSeconds
  remaining = totalSeconds
  endsAt = null
  persist()
  broadcast TIMER_TICK

setTime(h, m, s):
  totalSeconds = h*3600 + m*60 + s
  pausedRemaining = totalSeconds
  remaining = totalSeconds
  running = false
  endsAt = null
  persist()
  broadcast TIMER_TICK

computeRemaining(): number
  if not running or endsAt is null: return pausedRemaining
  const ms = endsAt - Date.now()
  return Math.max(0, Math.ceil(ms / 1000))

tick(cues):
  if not running: return false
  const newRemaining = computeRemaining()
  const prevRemaining = this.state.remaining
  this.state.remaining = newRemaining

  // Fire cues for any second(s) we crossed since last tick
  // (covers the case where a tick is slightly late and skips a value)
  if (newRemaining < prevRemaining) {
    for (let sec = prevRemaining - 1; sec >= newRemaining; sec--) {
      for (const cue of cues) {
        if (cue.trigger_at === sec) {
          broadcast CUE_FIRED { cueId, triggerAt: sec, label, actions }
        }
      }
    }
  }

  if (newRemaining <= 0) {
    running = false
    endsAt = null
    pausedRemaining = 0
    persist()
    broadcast TIMER_TICK
    broadcast TIMER_DONE
    return false
  }

  // Only persist occasionally, not every tick (see Fix 2)
  broadcast TIMER_TICK
  return true
```

Key point: the broadcast always sends the wall-clock-derived `remaining`,
so even if alarms fire irregularly the displayed time stays accurate to the
real clock. Cue firing now scans the crossed range so no cue is missed if a
tick lands late.

---

## Fix 2 — Reduce DO Storage Writes

### Problem
Both engines call `persist()` on every tick. The prompter ticks every 50ms
(20x per second). Persisting that often is unnecessary cost and DO storage churn.

### Solution
Separate "broadcast" (every tick, cheap, in-memory) from "persist"
(periodic, only what's needed to survive eviction).

### Changes to both `RoomTimer.ts` and `RoomPrompter.ts`

Add a persist throttle:

```ts
private lastPersist = 0
private PERSIST_INTERVAL_MS = 2000  // persist at most every 2 seconds

private async maybePersist(force = false): Promise<void> {
  const now = Date.now()
  if (force || now - this.lastPersist >= this.PERSIST_INTERVAL_MS) {
    await this.persist()
    this.lastPersist = now
  }
}
```

Apply the rule:
- On `tick()`: call `maybePersist()` (throttled) — NOT every tick
- On `play()`, `pause()`, `stop()`, `reset()`, `setTime()`, `setSpeed()`,
  `seekTo()`: call `maybePersist(true)` (force) — state-changing user actions
  must persist immediately
- Always `broadcast()` on every tick regardless — broadcasting is in-memory
  WebSocket sends, which is cheap

For the timer specifically: because remaining is now derived from `endsAt`
(Fix 1), even if the DO is evicted mid-countdown and the last persist was 2s
ago, on reload it recomputes the correct remaining from `endsAt`. No accuracy
is lost by persisting less often.

For the prompter: persisting scrollPosition every 2s means on eviction the
scroll could jump back up to 2s of travel. To avoid a visible jump, also
persist on pause/stop/seek (already covered by force=true above). A small
backward jump only happens in the rare eviction-mid-scroll case, which is
acceptable.

---

## Fix 3 — Connection-Based Active Room Detection

### Problem
`getActivePrompterRoom` picks the teleprompter room with the most recent
`last_active` timestamp. If two teleprompter rooms are open simultaneously,
Companion controls whichever was touched most recently — unpredictable and
dangerous during a live service.

### Solution
Track live WebSocket connection counts per room in a dedicated Durable Object
(a registry), and resolve "active" by who actually has connected clients right now.

### Create `apps/cloudflare/src/durableObjects/RoomRegistry.ts`

A single global Durable Object that tracks which rooms have live connections.

```ts
export class RoomRegistry implements DurableObject {
  // Singleton — accessed via env.REGISTRY.idFromName('global')
  // Stores: Map<roomCode, { type, connections, lastHeartbeat }>

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // POST /register  body: { roomCode, type }
    //   Increment connection count for room, update lastHeartbeat
    // POST /unregister body: { roomCode }
    //   Decrement connection count, remove if zero
    // POST /heartbeat  body: { roomCode }
    //   Update lastHeartbeat for room
    // GET /active?type=teleprompter
    //   Return the room of that type with connections > 0
    //   and the most recent heartbeat. Null if none connected.
    // GET /list?type=teleprompter
    //   Return all rooms of that type with live connection counts
  }

  // Clean up stale entries: if a room hasn't heartbeat in 60s,
  // treat connections as 0 (handles ungraceful disconnects).
  // Run this check on every fetch, or via a periodic alarm.
}
```

### Wire RoomObject to the registry

In `RoomObject.ts`:

```ts
// On WebSocket accept (after JOIN_ROOM resolves roomCode):
//   call registry POST /register { roomCode, type }
//
// On webSocketClose:
//   call registry POST /unregister { roomCode }
//
// Add a heartbeat: every 30s while sessions exist, call registry
//   POST /heartbeat { roomCode }
//   (use a DO alarm or piggyback on the existing alarm loop)
//
// To call the registry from RoomObject:
//   const id = this.env.REGISTRY.idFromName('global')
//   const stub = this.env.REGISTRY.get(id)
//   await stub.fetch(new Request('http://registry/register', {
//     method: 'POST',
//     body: JSON.stringify({ roomCode, type })
//   }))
```

### Update `wrangler.toml`

Add the new Durable Object binding:

```toml
[[durable_objects.bindings]]
name = "ROOM"
class_name = "RoomObject"

[[durable_objects.bindings]]
name = "REGISTRY"
class_name = "RoomRegistry"

[[migrations]]
tag = "v2"
new_classes = ["RoomRegistry"]
```

### Update `apps/cloudflare/src/worker.ts`

```ts
export { RoomObject } from './durableObjects/RoomObject'
export { RoomRegistry } from './durableObjects/RoomRegistry'
```

### Update `apps/cloudflare/src/types.ts` Bindings

```ts
export type Bindings = {
  DB: D1Database
  MEDIA: R2Bucket
  ROOM: DurableObjectNamespace
  REGISTRY: DurableObjectNamespace   // add this
  ENVIRONMENT: string
  MEDIA_PUBLIC_URL: string
  ALLOWED_ORIGINS: string
}
```

### Update `apps/cloudflare/src/routes/prompter.ts`

Replace `getActivePrompterRoom(db)` with a registry query:

```ts
async function getActiveRoom(c): Promise<{ code: string } | null> {
  const id = c.env.REGISTRY.idFromName('global')
  const stub = c.env.REGISTRY.get(id)
  const res = await stub.fetch(new Request('http://registry/active?type=teleprompter'))
  const data = await res.json()
  if (!data || !data.code) return null
  return data
}
```

And `GET /rooms` should merge D1 room data with live connection counts from
the registry so the operator can see which rooms are actually live.

### Apply the same pattern for countdown (optional but recommended)

If you add `/api/countdown/active/*` endpoints later, use the same registry
with `type=countdown`.

---

## Fix 4 — Graceful Degradation If Registry Unavailable

### Problem
If the registry DO call fails, the whole active-room feature breaks.

### Solution
Fall back to the D1 last_active method if the registry is unreachable:

```ts
async function getActiveRoom(c): Promise<{ code: string } | null> {
  try {
    const id = c.env.REGISTRY.idFromName('global')
    const stub = c.env.REGISTRY.get(id)
    const res = await stub.fetch(new Request('http://registry/active?type=teleprompter'))
    const data = await res.json()
    if (data && data.code) return data
  } catch (e) {
    // Registry unavailable — fall back to D1
  }
  // Fallback: most recently active teleprompter room from D1
  const room = await getActivePrompterRoom(c.env.DB)
  return room ? { code: room.code } : null
}
```

---

## Verification Checklist

- [ ] Timer counts down accurately against a real stopwatch over 10 minutes (within 1s)
- [ ] Timer accuracy holds when prompter is ALSO running in the same room
- [ ] Pausing and resuming the timer preserves the correct remaining time
- [ ] No cue is skipped even if an alarm tick lands late (test with a cue at a specific second)
- [ ] DO storage writes happen at most every ~2s during a run (verify via logs)
- [ ] State-changing actions (play/pause/seek/setSpeed) persist immediately
- [ ] Timer recovers correct remaining time after simulated DO eviction
- [ ] RoomRegistry tracks connection count up on connect, down on disconnect
- [ ] Two teleprompter rooms open: /api/prompter/active returns the one with live connections
- [ ] Closing all connections to a room removes it from active within 60s
- [ ] Companion controls the correct room when only one teleprompter room is live
- [ ] If registry DO call fails, active room falls back to D1 without crashing
- [ ] Heartbeat keeps a room marked active during a long idle-but-connected session

---

## Notes

- Wall-clock timing is the single most important fix — a drifting countdown
  is unacceptable for live production. Test it with a real stopwatch.
- The registry adds one extra DO but it is tiny and only touched on
  connect/disconnect/heartbeat and active-room queries.
- Do not remove the D1 last_active fallback — it is the safety net.
- After these changes, re-run the MIGRATE_TO_CF.md verification checklist
  to confirm nothing regressed.
