CREATE TABLE IF NOT EXISTS rooms (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'countdown',
  settings_json TEXT NOT NULL DEFAULT '{}',
  is_permanent  INTEGER NOT NULL DEFAULT 0,
  last_active   INTEGER,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER
);

CREATE TABLE IF NOT EXISTS room_assets (
  id            TEXT PRIMARY KEY,
  room_code     TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK(type IN ('image','video','audio')),
  url           TEXT NOT NULL,
  size          INTEGER NOT NULL,
  duration      REAL,
  thumbnail_url TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS room_cues (
  id           TEXT PRIMARY KEY,
  room_code    TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  trigger_at   INTEGER NOT NULL,
  label        TEXT NOT NULL DEFAULT '',
  actions_json TEXT NOT NULL DEFAULT '[]',
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS room_scripts (
  id         TEXT PRIMARY KEY,
  room_code  TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rooms_code          ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_room_assets_code    ON room_assets(room_code);
CREATE INDEX IF NOT EXISTS idx_room_cues_code      ON room_cues(room_code);
CREATE INDEX IF NOT EXISTS idx_room_scripts_code   ON room_scripts(room_code);
