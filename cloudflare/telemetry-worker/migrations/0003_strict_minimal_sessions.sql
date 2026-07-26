DROP INDEX IF EXISTS idx_telemetry_sessions_created;
DROP TABLE IF EXISTS telemetry_sessions;

CREATE TABLE telemetry_sessions (
  estimated_region TEXT NOT NULL,
  year TEXT NOT NULL,
  major TEXT NOT NULL
);
