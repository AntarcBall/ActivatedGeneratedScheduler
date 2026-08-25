UPDATE telemetry_session_rollups
SET
  started_at_ms = (
    SELECT MIN(events.received_at_ms)
    FROM telemetry_events AS events
    WHERE events.session_id = telemetry_session_rollups.session_id
  ),
  last_seen_ms = (
    SELECT MAX(events.received_at_ms)
    FROM telemetry_events AS events
    WHERE events.session_id = telemetry_session_rollups.session_id
  ),
  latest_reason = (
    SELECT events.reason
    FROM telemetry_events AS events
    WHERE events.session_id = telemetry_session_rollups.session_id
    ORDER BY events.received_at_ms DESC, events.id DESC
    LIMIT 1
  ),
  event_row_count = (
    SELECT COUNT(*)
    FROM telemetry_events AS events
    WHERE events.session_id = telemetry_session_rollups.session_id
  );
