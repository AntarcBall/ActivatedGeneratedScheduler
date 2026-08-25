import assert from "node:assert/strict";
import test from "node:test";

import { createApp, decodeStoredPayload, readLiveSnapshot } from "../src/index.js";

const request = (path = "/", init = {}) => new Request(`https://report.example${path}`, init);

const mockDb = () => ({
  prepare(sql) {
    return {
      sql,
      values: [],
      bind(...values) {
        this.values = values;
        return this;
      },
      async all() {
        if (sql.includes("FROM telemetry_users") && !sql.includes("WHERE user_id")) {
          return { results: [{
            user_id: 7,
            first_seen_ms: 1786435100000,
            last_seen_ms: 1786435200000,
            event_count: 3,
            session_count: 1,
            ip_address: "203.0.113.7",
            country: "KR",
            region: "Daegu",
            city: "Daegu",
            colo: "ICN",
          }] };
        }
        if (sql.includes("FROM telemetry_events AS events")) {
          return { results: [{
            id: 11,
            received_at_ms: 1786435200000,
            reason: "results",
            payload_json: JSON.stringify({
              reason: "results",
              session: "a".repeat(24),
              profile: { year: "3", tracks: ["컴퓨터공학"] },
              device: { os: "macOS", browser: "Safari" },
              events: [{ seq: 1, at_ms: 100, type: "page_enter" }],
            }),
            payload_encoding: "json",
          }] };
        }
        return { results: [] };
      },
    };
  },
  async batch(statements) {
    return statements.map(({ sql }) => {
      if (sql.includes("FROM telemetry_users WHERE user_id")) {
        return { results: [{
          user_id: 7,
          first_seen_ms: 1786435100000,
          last_seen_ms: 1786435200000,
          event_count: 3,
          session_count: 1,
          ip_address: "203.0.113.7",
          country: "KR",
          region: "Daegu",
          city: "Daegu",
          colo: "ICN",
        }] };
      }
      if (sql.includes("FROM telemetry_session_rollups")) {
        return { results: [{
          session_id: "a".repeat(24),
          started_at_ms: 1786435100000,
          last_seen_ms: 1786435200000,
          latest_reason: "results",
          event_row_count: 3,
          year: "3",
          major: "컴퓨터공학",
          os: "macOS",
          device_type: "desktop",
          browser: "Safari",
          browser_context: "general_browser",
        }] };
      }
      if (sql.startsWith("SELECT COUNT(*) AS total")) {
        return { results: [{ total: 2, latest_rowid: 8 }] };
      }
      if (sql.includes("ORDER BY rowid DESC")) {
        return {
          results: [{
            sequence: 8,
            created_at_ms: 1786435200000,
            estimated_region: "KR / Seoul",
            year: "3",
            major: "컴퓨터공학",
            os: "macOS",
            device_type: "desktop",
          }],
        };
      }
      if (sql.includes("WITH RECURSIVE dates")) {
        return { results: [{ date: "2026-08-11", count: 2 }] };
      }
      if (sql.includes("created_at_ms > 0")) {
        return { results: [{ date: "2026-08-11", label: "sample", count: 2 }] };
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
  assert.match(body, /현재 개인별 상세 로그/);
  assert.match(body, /fetch\("\/api\/live"/);
  assert.match(body, /fetch\(path/);
  assert.match(body, /<style nonce="/);
  assert.match(body, /<script nonce="/);
  assert.match(
    response.headers.get("content-security-policy"),
    /connect-src 'self'/,
  );
});

test("serves bounded current people and session details", async () => {
  const app = createApp({
    verifyAccess: async () => ({ email: "owner@example.com" }),
  });
  const env = { DB: mockDb() };
  const people = await (await app.fetch(request("/api/people"), env)).json();
  assert.equal(people.people[0].ip_address, "203.0.113.7");
  assert.equal(JSON.stringify(people).includes("ip_hash"), false);

  const person = await (await app.fetch(request("/api/people/7"), env)).json();
  assert.equal(person.person.user_id, 7);
  assert.equal(person.sessions.length, 1);

  const details = await (await app.fetch(
    request(`/api/people/7/sessions/${"a".repeat(24)}`), env,
  )).json();
  assert.equal(details.snapshots[0].payload.profile.year, "3");
  assert.equal(JSON.stringify(details).includes("payload_json"), false);
});

test("decodes gzip payloads", async () => {
  const payload = { session: "b".repeat(24), reason: "pagehide", events: [] };
  const stream = new Blob([JSON.stringify(payload)]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  assert.deepEqual(await decodeStoredPayload(encoded, "gzip+base64url"), payload);
});

test("returns a live D1 snapshot without exposing payload JSON", async () => {
  const snapshot = await readLiveSnapshot(mockDb());
  assert.equal(snapshot.total, 2);
  assert.equal(snapshot.latestSequence, 8);
  assert.equal(snapshot.recent[0].major, "컴퓨터공학");
  assert.deepEqual(snapshot.daily.totals, [{ date: "2026-08-11", count: 2 }]);
  assert.equal(snapshot.daily.dimensions.majors[0].label, "sample");
  assert.equal(JSON.stringify(snapshot).includes("payload_json"), false);
});

test("dashboard includes a daily category chart", async () => {
  const app = createApp({
    verifyAccess: async () => ({ email: "owner@example.com" }),
  });
  const response = await app.fetch(request("/"), { DB: mockDb() });
  const body = await response.text();
  assert.match(body, /일별 이용자수/);
  assert.match(body, /id="daily-category"/);
  assert.match(body, /value="majors"/);
});

test("rejects writes and unknown paths", async () => {
  const app = createApp({
    verifyAccess: async () => ({ email: "owner@example.com" }),
  });
  const env = { DB: mockDb() };
  assert.equal((await app.fetch(request("/api/live", { method: "POST" }), env)).status, 405);
  assert.equal((await app.fetch(request("/missing"), env)).status, 404);
});
