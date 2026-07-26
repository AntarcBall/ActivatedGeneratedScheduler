ALTER TABLE telemetry_sessions
  ADD COLUMN os TEXT NOT NULL DEFAULT 'Other';

ALTER TABLE telemetry_sessions
  ADD COLUMN device_type TEXT NOT NULL DEFAULT 'unknown';
