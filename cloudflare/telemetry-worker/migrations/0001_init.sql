CREATE TABLE IF NOT EXISTS telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  received_at_ms INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  country TEXT,
  region TEXT,
  city TEXT,
  colo TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_received
  ON telemetry_events(received_at_ms);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_session
  ON telemetry_events(session_id, received_at_ms);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_ip
  ON telemetry_events(ip_hash, received_at_ms);
