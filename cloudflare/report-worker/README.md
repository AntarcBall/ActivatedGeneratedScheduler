# AGS private live report Worker

This Worker reads the current `telemetry_sessions` rows from the production D1
database and serves a live, read-only dashboard. It is deliberately separate
from the public `ags-telemetry` ingestion Worker so Cloudflare Access can protect
the entire report Worker without breaking public session collection.

The Access-protected `/people-usage-report.html` route also serves the existing
historical snapshot from `../../local-reports/people-usage-report.html`.
`precheck` and `predeploy` copy only that file into the ignored
`private-assets/` staging directory, so the geolocation cache and other local
report files are never uploaded.

The Worker fails closed unless all three values are configured:

- `TEAM_DOMAIN`: the full `https://<team>.cloudflareaccess.com` URL
- `POLICY_AUD`: the Access application's audience tag
- `ADMIN_EMAIL`: the single email address allowed by the Access policy

`ADMIN_EMAIL` should be stored as a Worker secret. The other two values may be
plain Worker variables, but keeping all three as secrets is also supported.

## Deploy and protect

1. Install and deploy:

   ```bash
   npm install
   npm test
   npm run check
   npm run deploy
   ```

2. In Cloudflare Zero Trust, create a self-hosted Access application whose
   destination is the Worker named `ags-live-report`. Protect the whole Worker,
   including every path.

3. Add one `Allow` policy with an `Emails` selector containing only the owner's
   exact email address. Do not use `Everyone`, `Emails ending in`, or a bypass
   policy. One-time PIN can be used as the login method.

4. Copy the application's audience tag and team domain, then configure:

   ```bash
   npx wrangler secret put TEAM_DOMAIN
   npx wrangler secret put POLICY_AUD
   npx wrangler secret put ADMIN_EMAIL
   ```

5. Open the deployed Worker URL in a private browser window. Before login,
   Cloudflare Access must intercept the request. After login, `/api/live` must
   return data only for the exact email configured in both the policy and the
   Worker secret.

The dashboard reads only `estimated_region`, `year`, `major`, `os`, and
`device_type`. It does not read the legacy `telemetry_events.payload_json`
column. Responses are private, uncached, non-indexable, same-origin only, and
cannot be framed.
