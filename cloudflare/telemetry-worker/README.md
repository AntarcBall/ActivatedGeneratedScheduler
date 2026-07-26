# AGS telemetry Worker

Free-only Cloudflare Worker and D1 ingestion service for browser telemetry.

- `POST /v1/session`: exchanges an invisible Turnstile token for a signed session token.
- `POST /v1/events`: validates the signed token and writes one structured event snapshot to D1.
- `GET /health`: public health check without telemetry data.
- No public read or export endpoint is exposed.
- IP addresses are stored only as HMAC pseudonyms.
- Events are retained until manually removed.

Required Worker secrets:

- `TURNSTILE_SECRET`
- `SESSION_SIGNING_SECRET`
- `IP_HASH_SECRET`

The public Turnstile sitekey is configured in `assets/ags-usage.js`, not in the Worker.

## Free-tier operations

Check event and storage counts without exposing a public read endpoint:

```bash
npx wrangler d1 execute ags-telemetry-prod --remote \
  --command "SELECT COUNT(*) AS events, MIN(received_at_ms) AS first_ms, MAX(received_at_ms) AS last_ms FROM telemetry_events"
```

Export all retained events for local analysis:

```bash
mkdir -p exports
npx wrangler d1 export ags-telemetry-prod --remote \
  --output exports/ags-telemetry.sql
```

There is intentionally no scheduled deletion. If the D1 free storage limit is
approached, export first and remove only an explicitly chosen time range.
