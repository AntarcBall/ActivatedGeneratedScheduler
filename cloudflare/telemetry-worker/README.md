# AGS minimal session telemetry Worker

Free-only Cloudflare Worker and D1 ingestion service for one summary per browser
session.

- `POST /v1/session`: validates an invisible Turnstile challenge and stores one
  row containing estimated region, year, and major.
- `GET /health`: public health check without telemetry data.
- No public read or export endpoint is exposed.
- IP addresses, IP hashes, user agents, city, device data, screens, clicks,
  performance metrics, and navigation events are not stored.
- The estimated region is Cloudflare's country and first-level region only.
- The active table has exactly three columns: `estimated_region`, `year`, and
  `major`.
- Rows are retained until manually removed.

Required Worker secret:

- `TURNSTILE_SECRET`

The public Turnstile sitekey is configured in `assets/ags-usage.js`, not in the
Worker. The earlier `telemetry_events` table is retained for history but the
current Worker never writes to it.

## Free-tier operations

Check session and storage counts without exposing a public read endpoint:

```bash
npx wrangler d1 execute ags-telemetry-prod --remote \
  --command "SELECT COUNT(*) AS sessions FROM telemetry_sessions"
```

Export all retained sessions for local analysis:

```bash
mkdir -p exports
npx wrangler d1 export ags-telemetry-prod --remote \
  --output exports/ags-telemetry.sql
```

There is intentionally no scheduled deletion. If the D1 free storage limit is
approached, export first and remove only an explicitly chosen time range.
