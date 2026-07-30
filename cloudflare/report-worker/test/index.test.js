import assert from "node:assert/strict";
import test from "node:test";

import { createApp, readLiveSnapshot } from "../src/index.js";

const request = (path = "/", init = {}) => new Request(`https://report.example${path}`, init);

const mockDb = () => ({
  prepare(sql) {
    return { sql };
  },
  async batch(statements) {
    return statements.map(({ sql }) => {
      if (sql.startsWith("SELECT COUNT(*) AS total")) {
        return { results: [{ total: 2, latest_rowid: 8 }] };
      }
      if (sql.includes("ORDER BY rowid DESC")) {
        return {
          results: [{
            sequence: 8,
            estimated_region: "KR / Seoul",
            year: "3",
            major: "컴퓨터공학",
            os: "macOS",
            device_type: "desktop",
          }],
        };
      }
      return { results: [{ label: "sample", count: 2 }] };
    });
  },
});

const mockAssets = () => ({
  async fetch() {
    return new Response(
      "<!doctype html><html><head><style>body{color:black}</style></head>"
      + "<body><h1>AGS 개인별 이용 추적 보고서</h1><script>window.ready=true</script></body></html>",
      { headers: { "content-type": "text/html" } },
    );
  },
});

test("denies every route when Access verification fails", async () => {
  const app = createApp({
    verifyAccess: async () => {
      throw new Error("invalid");
    },
  });
  const response = await app.fetch(request("/api/live"), { DB: mockDb() });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store, private, max-age=0");
});

test("accepts a root team-domain URL as valid Access configuration", async () => {
  const app = createApp();
  const response = await app.fetch(request("/"), {
    DB: mockDb(),
    TEAM_DOMAIN: "https://example.cloudflareaccess.com",
    POLICY_AUD: "test-audience",
    ADMIN_EMAIL: "owner@example.com",
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "access_token_missing",
  });
});

test("serves the dashboard only after authentication", async () => {
  const app = createApp({
    verifyAccess: async () => ({ email: "owner@example.com" }),
  });
  const response = await app.fetch(request("/"), { DB: mockDb() });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.match(await response.text(), /실시간 이용 현황/);
});

test("serves the unchanged historical report only after authentication", async () => {
  const app = createApp({
    verifyAccess: async () => ({ email: "owner@example.com" }),
  });
  const response = await app.fetch(request("/people-usage-report.html"), {
    DB: mockDb(),
    REPORT_ASSETS: mockAssets(),
  });
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /AGS 개인별 이용 추적 보고서/);
  assert.match(body, /Cloudflare 최신 세션 데이터/);
  assert.match(body, /fetch\("\/api\/live"/);
  assert.match(body, /<style nonce="/);
  assert.match(body, /<script nonce="/);
  assert.match(
    response.headers.get("content-security-policy"),
    /connect-src 'self'/,
  );
});

test("returns a live D1 snapshot without exposing payload JSON", async () => {
  const snapshot = await readLiveSnapshot(mockDb());
  assert.equal(snapshot.total, 2);
  assert.equal(snapshot.latestSequence, 8);
  assert.equal(snapshot.recent[0].major, "컴퓨터공학");
  assert.equal(JSON.stringify(snapshot).includes("payload_json"), false);
});

test("rejects writes and unknown paths", async () => {
  const app = createApp({
    verifyAccess: async () => ({ email: "owner@example.com" }),
  });
  const env = { DB: mockDb() };
  assert.equal((await app.fetch(request("/api/live", { method: "POST" }), env)).status, 405);
  assert.equal((await app.fetch(request("/missing"), env)).status, 404);
});
