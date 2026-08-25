ALTER TABLE telemetry_sessions
  ADD COLUMN created_at_ms INTEGER NOT NULL DEFAULT 0;

WITH ranked_events AS (
  SELECT
    received_at_ms,
    ROW_NUMBER() OVER (ORDER BY received_at_ms DESC, id DESC) AS rank
  FROM telemetry_events
  WHERE reason = 'session_start'
), ranked_sessions AS (
  SELECT
    rowid AS session_rowid,
    ROW_NUMBER() OVER (ORDER BY rowid DESC) AS rank
  FROM telemetry_sessions
)
UPDATE telemetry_sessions
SET created_at_ms = COALESCE((
  SELECT ranked_events.received_at_ms
  FROM ranked_sessions
  JOIN ranked_events USING (rank)
  WHERE ranked_sessions.session_rowid = telemetry_sessions.rowid
), 0);

CREATE INDEX IF NOT EXISTS idx_telemetry_sessions_created
  ON telemetry_sessions(created_at_ms);
