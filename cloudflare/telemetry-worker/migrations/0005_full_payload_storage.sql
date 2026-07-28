ALTER TABLE telemetry_events
  ADD COLUMN ip_address TEXT NOT NULL DEFAULT '';

ALTER TABLE telemetry_events
  ADD COLUMN payload_encoding TEXT NOT NULL DEFAULT 'json';
