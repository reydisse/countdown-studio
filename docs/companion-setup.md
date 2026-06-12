# Bitfocus Companion Setup — ShowStack Teleprompter

## Requirements
- Bitfocus Companion 3.x
- Stream Deck (any model)
- Internet access to `showstackapi.faithfireproduction.com` (the ShowStack Worker API)

---

## Auto Room Detection

ShowStack automatically tracks which teleprompter room is active based on who is
currently connected via WebSocket. As long as the controller or reader view is
open in a browser on any device, Companion will find and control the right room
automatically.

No room codes needed in Companion at all. Set the base URL once and all buttons
follow whatever room is currently live. When you switch rooms the buttons follow
automatically.

---

## Initial Setup

1. Open Companion and go to **Connections**
2. Add connection — search for **Generic HTTP**
3. Set base URL to: `https://showstackapi.faithfireproduction.com`
4. Save connection

---

## Button Actions — Auto Detect Mode

Use these paths for all buttons. No room code required.

| Button         | Method | Path                              | Body          |
|----------------|--------|-----------------------------------|---------------|
| Play           | POST   | `/api/prompter/active/play`       | none          |
| Pause          | POST   | `/api/prompter/active/pause`      | none          |
| Stop / Reset   | POST   | `/api/prompter/active/stop`       | none          |
| Speed Up       | POST   | `/api/prompter/active/speed/up`   | none          |
| Speed Down     | POST   | `/api/prompter/active/speed/down` | none          |
| Set Speed 3    | POST   | `/api/prompter/active/speed`      | `{"speed":3}` |
| Set Speed 5    | POST   | `/api/prompter/active/speed`      | `{"speed":5}` |
| Set Speed 8    | POST   | `/api/prompter/active/speed`      | `{"speed":8}` |
| Back to start  | POST   | `/api/prompter/active/seek`       | `{"position":0}` |
| Nudge back 5s  | POST   | `/api/prompter/active/seek/relative` | `{"seconds":-5}` |
| Nudge forward 5s | POST | `/api/prompter/active/seek/relative` | `{"seconds":5}`  |
| Jump to cue    | POST   | `/api/prompter/active/cue/[CUE_ID]` | none        |

### Jump-to-cue buttons

Cue IDs are UUIDs (e.g. `3f1c1e9e-1c2a-4b3d-9a7e-...`), not small numbers — get
them from:

```
GET https://showstackapi.faithfireproduction.com/api/rooms/[CODE]/cues
```

Each cue's `id` field is what goes in the `/active/cue/[CUE_ID]` path. Cue IDs
are stable for the life of the cue, so it's fine to hardcode one button per cue
— just re-check the ID if you delete and recreate that cue.

### Scrubbing from Companion

Two ways to scrub:

- **Absolute**: `/api/prompter/active/seek` takes `{"position": <px>}`, matching
  the `scrollPosition` value from the feedback endpoint below. Used for "Back to
  start" (`{"position":0}`).
- **Relative ("nudge")**: `/api/prompter/active/seek/relative` takes
  `{"seconds": <N>}` — positive moves forward, negative moves backward. The
  server converts seconds to pixels using the room's *current* speed, so a
  "Nudge -5s" button is just `{"seconds":-5}` — no Companion-side math needed.
  Clamped to `[0, totalHeight]`.

The in-app **scrub bar** on the controller (drag the "Position" slider, or the
◀5s / 5s▶ buttons) works the same way and is the simplest option if you're
standing at the controller rather than a Stream Deck.

### Press-and-hold scrubbing (Companion Press/Release)

For a Stream Deck button that scrubs continuously while held — like scrubbing
a video — use Companion's separate **Press** and **Release** action sets on a
single button:

| Action set | Method | Path                                   | Body                |
|------------|--------|----------------------------------------|---------------------|
| **Press**   | POST   | `/api/prompter/active/scrub/start`     | `{"direction":-1}` (back) or `{"direction":1}` (forward) |
| **Release** | POST   | `/api/prompter/active/scrub/stop`      | none                |

In the Companion button editor, the **Release Actions** section is below
**Press Actions** — add `scrub/start` there with `direction:-1` and
`scrub/stop` to the Release Actions of the same button. Make a second button
the mirror image (`direction:1`) for scrubbing forward.

While held, the script scrolls at a fixed ~500px/sec (independent of playback
speed), and stops the instant the button is released — `isPlaying` and
`speed` are untouched, so it works whether the prompter is playing, paused, or
stopped. If a Release is ever missed (e.g. Companion disconnects mid-press),
the server auto-stops the scrub after 30 seconds as a safety net.

This is separate from the tap-based "Nudge ±5s" buttons above — you can have
both: quick taps for ±5s jumps, and a press-and-hold button for free scrubbing.

---

## Live Feedback on Button Faces

Add a feedback to each button:
- **Type:** HTTP GET — poll every **2000 ms**
- **URL:** `https://showstackapi.faithfireproduction.com/api/prompter/active`

Response shape:
```json
{ "code": "AB-1234", "name": "Sunday Service", "isPlaying": true, "speed": 5, "scrollPosition": 1240, "totalHeight": 8400 }
```
When no room is active: `{ "code": null }`

Suggested feedback rules:

| Condition              | Button style                       |
|------------------------|------------------------------------|
| `isPlaying === true`   | Play button background → green     |
| `isPlaying === false`  | Play button background → grey      |
| `code === null`        | All buttons dimmed / inactive      |
| `speed` value          | Show as text overlay on speed btns |

---

## Manual Room Override (optional)

If you need to target a specific room regardless of who is connected:

| Action      | Method | Path                                              | Body              |
|-------------|--------|----------------------------------------------------|-------------------|
| Play        | POST   | `/api/rooms/[CODE]/prompter/play`                 | none              |
| Pause       | POST   | `/api/rooms/[CODE]/prompter/pause`                | none              |
| Stop        | POST   | `/api/rooms/[CODE]/prompter/stop`                 | none              |
| Speed Up    | POST   | `/api/rooms/[CODE]/prompter/speed/up`             | none              |
| Speed Down  | POST   | `/api/rooms/[CODE]/prompter/speed/down`           | none              |
| Set Speed   | POST   | `/api/rooms/[CODE]/prompter/speed`                | `{"speed":5}`     |
| Seek        | POST   | `/api/rooms/[CODE]/prompter/seek`                 | `{"position":0}`  |
| Nudge       | POST   | `/api/rooms/[CODE]/prompter/seek/relative`        | `{"seconds":5}`   |
| Scrub start (Press)   | POST | `/api/rooms/[CODE]/prompter/scrub/start` | `{"direction":1}` |
| Scrub stop (Release)  | POST | `/api/rooms/[CODE]/prompter/scrub/stop`  | none              |
| Jump to cue | POST   | `/api/rooms/[CODE]/prompter/cue/[CUE_ID]`         | none              |
| State       | GET    | `/api/rooms/[CODE]/prompter/state`                | none              |

Replace `[CODE]` with your actual room code, e.g. `FF-2847`. Prefix every path
with `https://showstackapi.faithfireproduction.com`.

State response:
```json
{
  "roomCode": "FF-2847",
  "isPlaying": false,
  "scrollPosition": 0,
  "speed": 3,
  "totalHeight": 8400
}
```

---

## List All Teleprompter Rooms

```
GET https://showstackapi.faithfireproduction.com/api/prompter/rooms
```
Returns all teleprompter rooms sorted by most recently active:
```json
[
  { "code": "AB-1234", "name": "Sunday Service", "last_active": 1716300000000 },
  { "code": "XY-5678", "name": "Evening Service", "last_active": 1716299000000 }
]
```
Useful for building a room picker in a Companion page or web dashboard.

---

## Recommended Stream Deck Layout

```
+----------+----------+----------+----------+
|          |          |          |          |
|   PLAY   |  PAUSE   |   STOP   |  STATE   |
|          |          |          |          |
+----------+----------+----------+----------+
|          |          |          |          |
| SPEED −  |  SPD 5   | SPEED +  |  SPD 3   |
|          |          |          |          |
+----------+----------+----------+----------+
|          |          |          |          |
|  CUE 1   |  CUE 2   |  CUE 3   |  CUE 4   |
|          |          |          |          |
+----------+----------+----------+----------+
|          |          |          |          |
|  CUE 5   |  CUE 6   |  RESTART |          |
|          |          |          |          |
+----------+----------+----------+----------+
```

---

## Notes

- All endpoints return JSON. HTTP 200 on success, 400 on bad input, 404 if room/cue not found.
- `/api/prompter/active/*` resolves to whichever teleprompter room has live
  WebSocket connections — if **two** teleprompter rooms are open at once,
  Companion follows whichever was touched most recently. Use the Manual Room
  Override paths if you ever run two rooms simultaneously.
- After any HTTP mutation (play, pause, speed change, seek), the server
  immediately broadcasts the updated state via WebSocket to all connected
  clients — the controller and reader UIs update in real time, and vice versa
  (dragging the in-app scrub bar updates what `/active` reports).
