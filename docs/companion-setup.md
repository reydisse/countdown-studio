# Bitfocus Companion Setup — ShowStack Teleprompter

## Requirements
- Bitfocus Companion 3.x
- ShowStack running on your network
- Stream Deck (any model)

---

## Auto Room Detection

ShowStack automatically tracks which teleprompter room is active based on who is currently connected via WebSocket. As long as the controller or reader view is open in a browser on any device, Companion will find and control the right room automatically.

No room codes needed in Companion at all. Set the server URL once and all buttons follow whatever room is currently live. When you switch rooms the buttons follow automatically.

---

## Initial Setup

1. Open Companion and go to **Connections**
2. Add connection — search for **Generic HTTP**
3. Set base URL to: `http://[YOUR-SERVER-IP]:9876`
4. Save connection

---

## Button Actions — Auto Detect Mode

Use these paths for all buttons. No room code required.

| Button       | Method | Path                            | Body          |
|--------------|--------|---------------------------------|---------------|
| Play         | POST   | /api/prompter/active/play       | none          |
| Pause        | POST   | /api/prompter/active/pause      | none          |
| Stop / Reset | POST   | /api/prompter/active/stop       | none          |
| Speed Up     | POST   | /api/prompter/active/speed/up   | none          |
| Speed Down   | POST   | /api/prompter/active/speed/down | none          |
| Set Speed 3  | POST   | /api/prompter/active/speed      | {"speed":3}   |
| Set Speed 5  | POST   | /api/prompter/active/speed      | {"speed":5}   |
| Set Speed 8  | POST   | /api/prompter/active/speed      | {"speed":8}   |
| Jump Cue 1   | POST   | /api/prompter/active/cue/1      | none          |
| Jump Cue 2   | POST   | /api/prompter/active/cue/2      | none          |
| Jump Cue 3   | POST   | /api/prompter/active/cue/3      | none          |

---

## Live Feedback on Button Faces

Add a feedback to each button:
- **Type:** HTTP GET — poll every **2000 ms**
- **URL:** `/api/prompter/active`

Response shape:
```json
{ "code": "AB-1234", "name": "Sunday Service", "isPlaying": true, "speed": 5, "scrollPosition": 1240 }
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

| Action      | Method | Path                                  | Body          |
|-------------|--------|---------------------------------------|---------------|
| Play        | POST   | /api/rooms/[CODE]/prompter/play       | none          |
| Pause       | POST   | /api/rooms/[CODE]/prompter/pause      | none          |
| Stop        | POST   | /api/rooms/[CODE]/prompter/stop       | none          |
| Speed Up    | POST   | /api/rooms/[CODE]/prompter/speed/up   | none          |
| Speed Down  | POST   | /api/rooms/[CODE]/prompter/speed/down | none          |
| Set Speed   | POST   | /api/rooms/[CODE]/prompter/speed      | {"speed":5}   |
| Seek        | POST   | /api/rooms/[CODE]/prompter/seek       | {"position":0}|
| State       | GET    | /api/rooms/[CODE]/prompter/state      | none          |

Replace `[CODE]` with your actual room code e.g. `FF-2847`

State response:
```json
{
  "roomCode": "FF-2847",
  "isPlaying": false,
  "scrollPosition": 0,
  "speed": 3,
  "totalHeight": 8400,
  "fontSize": 48,
  "bgColor": "#000000"
}
```

---

## List All Teleprompter Rooms

```
GET /api/prompter/rooms
```
Returns all teleprompter rooms sorted by most recently active:
```json
[
  { "code": "AB-1234", "name": "Sunday Service", "last_active": 1716300000000, "isPlaying": true },
  { "code": "XY-5678", "name": "Evening Service", "last_active": 1716299000000, "isPlaying": false }
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
|  CUE 5   |  CUE 6   |          |          |
|          |          |          |          |
+----------+----------+----------+----------+
```

---

## Notes

- All endpoints return JSON. HTTP 200 on success, 400 on bad input, 404 if room/cue not found.
- HTTP control works even if no WebSocket clients are connected to the room — the engine runs server-side and the state is persisted in memory until the room expires.
- Room idle timeout is 30 minutes. Permanent rooms never expire.
- After any HTTP mutation (play, pause, speed change), the server immediately broadcasts the updated state via WebSocket to all connected clients — the controller and reader UIs update in real time.
