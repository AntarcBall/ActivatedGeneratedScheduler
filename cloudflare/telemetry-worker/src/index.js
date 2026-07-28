const encoder = new TextEncoder();
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_EVENTS_PER_MINUTE = 60;
const SESSION_ID_RE = /^[a-f0-9]{24}$/;
const EVENT_ID_RE = /^[a-zA-Z0-9:_-]{16,160}$/;
const ALLOWED_REASONS = new Set(["session_start", "results", "pagehide", "pagehide_bfcache"]);
const ALLOWED_YEARS = new Set(["1", "2", "3", "4"]);
const ALLOWED_MAJORS = new Set([
  "물리학",
  "화학",
  "생명과학",
  "뇌과학",
  "기계공학",
  "재료공학",
  "전자공학",
  "컴퓨터공학",
  "화학공학",
  "반도체공학",
]);
const ALLOWED_OS = new Set(["iOS", "Android", "Windows", "ChromeOS", "macOS", "Linux", "Other"]);
const DEVICE_TYPE_LABELS = {
  mobile: "모바일",
  tablet: "태블릿",
  desktop: "데스크톱",
};

const base64UrlEncode = (bytes) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

const base64UrlDecode = (value) => {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/")
    + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const importHmacKey = (secret) => crypto.subtle.importKey(
  "raw",
  encoder.encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign", "verify"],
);

const hmac = async (secret, value) => {
  const key = await importHmacKey(secret);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
};

const connectingIp = (request) => (
  String(request.headers.get("cf-connecting-ip") || "unknown").slice(0, 45)
);

const hashIp = async (request, env) => {
  return base64UrlEncode(await hmac(env.IP_HASH_SECRET, connectingIp(request)));
};

const encodePayload = async (payload) => {
  const json = JSON.stringify(payload);
  const gzipStream = new Blob([json])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const gzip = new Uint8Array(await new Response(gzipStream).arrayBuffer());
  const compressed = base64UrlEncode(gzip);
  return compressed.length < json.length
    ? { value: compressed, encoding: "gzip+base64url" }
    : { value: json, encoding: "json" };
};

const signSession = async (claims, env) => {
  const encodedClaims = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
  const signature = base64UrlEncode(await hmac(env.SESSION_SIGNING_SECRET, encodedClaims));
  return `${encodedClaims}.${signature}`;
};

const verifySession = async (token, env) => {
  if (typeof token !== "string" || token.length > 2048) return null;
  const [encodedClaims, encodedSignature, extra] = token.split(".");
  if (!encodedClaims || !encodedSignature || extra) return null;
  try {
    const key = await importHmacKey(env.SESSION_SIGNING_SECRET);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(encodedSignature),
      encoder.encode(encodedClaims),
    );
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedClaims)));
    if (!SESSION_ID_RE.test(claims.sid || "")) return null;
    if (!Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    if (typeof claims.iph !== "string" || claims.iph.length < 32) return null;
    return claims;
  } catch {
    return null;
  }
};

const jsonResponse = (body, status = 200, origin = "") => {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "Origin";
  }
  return new Response(JSON.stringify(body), { status, headers });
};

const allowedOrigin = (request, env) => {
  const origin = request.headers.get("origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : "";
};

const readJson = async (request) => {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("body_too_large");
  const text = await request.text();
  if (encoder.encode(text).byteLength > MAX_BODY_BYTES) throw new Error("body_too_large");
  return JSON.parse(text);
};

const verifyTurnstile = async (token, request, env) => {
  if (typeof token !== "string" || token.length < 20 || token.length > 2048) return false;
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET);
  form.set("response", token);
  const remoteIp = request.headers.get("cf-connecting-ip");
  if (remoteIp) form.set("remoteip", remoteIp);
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true
    && result.action === "telemetry_session"
    && ["antarcball.github.io", "localhost", "127.0.0.1"].includes(result.hostname);
};

const normalizedProfile = (body) => {
  const year = String(body.year || "");
  const majors = Array.isArray(body.majors)
    ? [...new Set(body.majors.map(String).filter((major) => ALLOWED_MAJORS.has(major)))].slice(0, 2)
    : [];
  const os = String(body.os || "");
  const deviceType = String(body.deviceType || "");
  if (!ALLOWED_YEARS.has(year)
      || majors.length === 0
      || !ALLOWED_OS.has(os)
      || !Object.hasOwn(DEVICE_TYPE_LABELS, deviceType)) return null;
  return { year, major: majors.join(" / "), os, deviceType };
};

const validPayload = (payload, sessionId, reason) => (
  payload
  && typeof payload === "object"
  && !Array.isArray(payload)
  && String(payload.session || "") === sessionId
  && String(payload.reason || "") === reason
  && EVENT_ID_RE.test(String(payload.eventId || ""))
  && Array.isArray(payload.events)
  && payload.events.length <= 200
);

const insertEvent = async (request, env, payload, ipHash) => {
  const now = Date.now();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM telemetry_events WHERE ip_hash = ? AND received_at_ms >= ?",
  ).bind(ipHash, now - 60_000).first();
  if (Number(recent?.count || 0) >= MAX_EVENTS_PER_MINUTE) {
    throw new Error("rate_limited");
  }
  const cf = request.cf || {};
  const encodedPayload = await encodePayload(payload);
  try {
    await env.DB.prepare(
      `INSERT INTO telemetry_events (
        event_id, received_at_ms, session_id, reason, payload_json, ip_hash,
        country, region, city, colo, user_agent, ip_address, payload_encoding
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      String(payload.eventId),
      now,
      String(payload.session),
      String(payload.reason),
      encodedPayload.value,
      ipHash,
      String(cf.country || ""),
      String(cf.region || ""),
      String(cf.city || ""),
      String(cf.colo || ""),
      String(request.headers.get("user-agent") || "").slice(0, 300),
      connectingIp(request),
      encodedPayload.encoding,
    ).run();
    return false;
  } catch (error) {
    if (String(error?.message || error).includes("UNIQUE")) return true;
    throw error;
  }
};

const estimatedRegion = (request) => {
  const cf = request.cf || {};
  const values = [cf.country, cf.region]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return [...new Set(values)].join(" / ") || "unknown";
};

const sendTelegramSummary = async (env, summary) => {
  const token = String(env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(env.TELEGRAM_CHAT_ID || "").trim();
  if (!/^[0-9]+:[A-Za-z0-9_-]+$/.test(token) || !/^(?:-?[0-9]+|@[A-Za-z0-9_]+)$/.test(chatId)) {
    throw new Error("telegram_secret_invalid");
  }
  const text = [
    "새 세션",
    `추정 지역: ${summary.estimatedRegion}`,
    `학년: ${summary.year}학년`,
    `전공: ${summary.major}`,
    `OS: ${summary.os}`,
    `기기 종류: ${DEVICE_TYPE_LABELS[summary.deviceType]}`,
  ].join("\n");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) throw new Error("telegram_send_failed");
};

const recordSession = async (request, env, origin) => {
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error.message === "body_too_large" ? "body_too_large" : "invalid_json" },
      error.message === "body_too_large" ? 413 : 400,
      origin,
    );
  }
  const sessionId = String(body.sessionId || "");
  if (!SESSION_ID_RE.test(sessionId)) {
    return jsonResponse({ ok: false, error: "invalid_session" }, 400, origin);
  }
  const profile = normalizedProfile(body);
  if (!profile) {
    return jsonResponse({ ok: false, error: "invalid_session_summary" }, 400, origin);
  }
  if (!await verifyTurnstile(body.turnstileToken, request, env)) {
    return jsonResponse({ ok: false, error: "challenge_failed" }, 403, origin);
  }
  if (!validPayload(body.payload, sessionId, "session_start")) {
    return jsonResponse({ ok: false, error: "invalid_payload" }, 400, origin);
  }

  const summary = {
    estimatedRegion: estimatedRegion(request),
    year: profile.year,
    major: profile.major,
    os: profile.os,
    deviceType: profile.deviceType,
  };
  const now = Math.floor(Date.now() / 1000);
  const ipHash = await hashIp(request, env);
  const duplicate = await insertEvent(request, env, body.payload, ipHash);
  if (!duplicate) {
    await env.DB.prepare(
      `INSERT INTO telemetry_sessions (
        estimated_region, year, major, os, device_type
      ) VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      summary.estimatedRegion,
      summary.year,
      summary.major,
      summary.os,
      summary.deviceType,
    ).run();
    await sendTelegramSummary(env, summary);
  }
  const token = await signSession({
    sid: sessionId,
    iph: ipHash,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  }, env);
  return jsonResponse({
    ok: true,
    token,
    expiresIn: SESSION_TTL_SECONDS,
    notified: !duplicate,
    duplicate,
  }, duplicate ? 200 : 201, origin);
};

const acceptEvent = async (request, env, origin) => {
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error.message === "body_too_large" ? "body_too_large" : "invalid_json" },
      error.message === "body_too_large" ? 413 : 400,
      origin,
    );
  }
  const claims = await verifySession(body.token, env);
  const ipHash = await hashIp(request, env);
  if (!claims || claims.iph !== ipHash) {
    return jsonResponse({ ok: false, error: "invalid_token" }, 401, origin);
  }
  const reason = String(body.payload?.reason || "");
  if (!ALLOWED_REASONS.has(reason)
      || reason === "session_start"
      || !validPayload(body.payload, claims.sid, reason)) {
    return jsonResponse({ ok: false, error: "invalid_payload" }, 400, origin);
  }
  try {
    const duplicate = await insertEvent(request, env, body.payload, ipHash);
    return jsonResponse({ ok: true, duplicate }, duplicate ? 200 : 201, origin);
  } catch (error) {
    if (error.message === "rate_limited") {
      return jsonResponse({ ok: false, error: "rate_limited" }, 429, origin);
    }
    throw error;
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: "ags-telemetry",
        storage: "d1",
        collection: "full_session_events",
        notification: "telegram_session_start_only",
      });
    }
    const origin = allowedOrigin(request, env);
    if (!origin) return jsonResponse({ ok: false, error: "origin_denied" }, 403);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          "access-control-max-age": "86400",
          vary: "Origin",
        },
      });
    }
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, origin);
    }
    try {
      if (url.pathname === "/v1/session") return await recordSession(request, env, origin);
      if (url.pathname === "/v1/events") return await acceptEvent(request, env, origin);
      return jsonResponse({ ok: false, error: "not_found" }, 404, origin);
    } catch (error) {
      if (error.message === "rate_limited") {
        return jsonResponse({ ok: false, error: "rate_limited" }, 429, origin);
      }
      return jsonResponse({ ok: false, error: "internal_error" }, 500, origin);
    }
  },
};
