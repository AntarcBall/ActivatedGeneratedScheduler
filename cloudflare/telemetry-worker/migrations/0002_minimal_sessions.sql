CREATE TABLE IF NOT EXISTS telemetry_sessions (
  session_id TEXT PRIMARY KEY,
  created_at_ms INTEGER NOT NULL,
  estimated_region TEXT NOT NULL,
  year TEXT NOT NULL,
  major TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_sessions_created
  ON telemetry_sessions(created_at_ms);
