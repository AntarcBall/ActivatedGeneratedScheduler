# AGS full session telemetry Worker

Cloudflare Worker and D1 ingestion service for detailed browser-session
telemetry.

- `POST /v1/session`: validates an invisible Turnstile challenge, stores a full
  `session_start` snapshot in `telemetry_events`, stores a summary row in
  `telemetry_sessions`, sends one session-start notification to Telegram, and
  returns a signed 24-hour ingestion token.
- `POST /v1/events`: validates the signed token and stores the full result or
  page-exit payload in `telemetry_events`.
- `GET /health`: public health check without telemetry data.
- No public read or export endpoint is exposed.
- Full payloads include the submitted profile, browser/device details, screen
  and viewport, language and timezone, coarse network information, navigation
  timing, category interactions, page transitions, client errors, and Web
  Vitals where supported.
- The connecting IP is HMAC-hashed before storage. Raw IP addresses are not
  stored. Cloudflare country, region, city, and colo values are stored.
- Rows are retained until manually removed.

Required Worker secrets:

- `TURNSTILE_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `IP_HASH_SECRET`
- `SESSION_SIGNING_SECRET`

The public Turnstile sitekey is configured in `assets/ags-usage.js`, not in the
Worker.

Telegram receives only one session-start summary. Detailed events are never
sent to Telegram:

```text
새 세션
추정 지역: US / California
학년: 3학년
전공: 컴퓨터공학 / 전자공학
OS: macOS
기기 종류: 데스크톱
```

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
