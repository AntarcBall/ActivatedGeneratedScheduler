CREATE TABLE IF NOT EXISTS telemetry_users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_key TEXT NOT NULL UNIQUE,
  ip_hash TEXT NOT NULL,
  first_seen_ms INTEGER NOT NULL,
  last_seen_ms INTEGER NOT NULL,
  latest_session_id TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  colo TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_telemetry_users_latest
  ON telemetry_users(last_seen_ms DESC, user_id DESC);

CREATE TABLE IF NOT EXISTS telemetry_session_rollups (
  session_id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  started_at_ms INTEGER NOT NULL,
  last_seen_ms INTEGER NOT NULL,
  latest_reason TEXT NOT NULL,
  event_row_count INTEGER NOT NULL DEFAULT 0,
  year TEXT NOT NULL DEFAULT '',
  major TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT '',
  browser_context TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES telemetry_users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_rollups_user_latest
  ON telemetry_session_rollups(user_id, last_seen_ms DESC, session_id);

INSERT INTO telemetry_users (
  identity_key, ip_hash, first_seen_ms, last_seen_ms, latest_session_id,
  event_count, session_count, ip_address, country, region, city, colo
)
SELECT
  events.ip_hash || char(10) || events.user_agent,
  events.ip_hash,
  MIN(events.received_at_ms),
  MAX(events.received_at_ms),
  (
    SELECT latest.session_id FROM telemetry_events AS latest
    WHERE latest.ip_hash = events.ip_hash AND latest.user_agent = events.user_agent
    ORDER BY latest.received_at_ms DESC, latest.id DESC LIMIT 1
  ),
  COUNT(*),
  COUNT(DISTINCT events.session_id),
  COALESCE((
    SELECT latest.ip_address FROM telemetry_events AS latest
    WHERE latest.ip_hash = events.ip_hash AND latest.user_agent = events.user_agent
    ORDER BY latest.received_at_ms DESC, latest.id DESC LIMIT 1
  ), ''),
  COALESCE((
    SELECT latest.country FROM telemetry_events AS latest
    WHERE latest.ip_hash = events.ip_hash AND latest.user_agent = events.user_agent
    ORDER BY latest.received_at_ms DESC, latest.id DESC LIMIT 1
  ), ''),
  COALESCE((
    SELECT latest.region FROM telemetry_events AS latest
    WHERE latest.ip_hash = events.ip_hash AND latest.user_agent = events.user_agent
    ORDER BY latest.received_at_ms DESC, latest.id DESC LIMIT 1
  ), ''),
  COALESCE((
    SELECT latest.city FROM telemetry_events AS latest
    WHERE latest.ip_hash = events.ip_hash AND latest.user_agent = events.user_agent
    ORDER BY latest.received_at_ms DESC, latest.id DESC LIMIT 1
  ), ''),
  COALESCE((
    SELECT latest.colo FROM telemetry_events AS latest
    WHERE latest.ip_hash = events.ip_hash AND latest.user_agent = events.user_agent
    ORDER BY latest.received_at_ms DESC, latest.id DESC LIMIT 1
  ), '')
FROM telemetry_events AS events
GROUP BY events.ip_hash, events.user_agent
ON CONFLICT(identity_key) DO NOTHING;

INSERT INTO telemetry_session_rollups (
  session_id, user_id, started_at_ms, last_seen_ms,
  latest_reason, event_row_count
)
SELECT
  events.session_id,
  users.user_id,
  MIN(events.received_at_ms),
  MAX(events.received_at_ms),
  (
    SELECT latest.reason FROM telemetry_events AS latest
    WHERE latest.session_id = events.session_id
    ORDER BY latest.received_at_ms DESC, latest.id DESC LIMIT 1
  ),
  COUNT(*)
FROM telemetry_events AS events
JOIN telemetry_users AS users
  ON users.identity_key = events.ip_hash || char(10) || events.user_agent
GROUP BY events.session_id, users.user_id
ON CONFLICT(session_id) DO NOTHING;
