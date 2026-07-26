const encoder = new TextEncoder();
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_EVENTS_PER_MINUTE = 60;
const SESSION_ID_RE = /^[a-f0-9]{24}$/;
const EVENT_ID_RE = /^[a-zA-Z0-9:_-]{16,160}$/;
const ALLOWED_REASONS = new Set(["results", "pagehide", "pagehide_bfcache"]);

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

const hashIp = async (request, env) => {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  return base64UrlEncode(await hmac(env.IP_HASH_SECRET, ip));
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

const issueSession = async (request, env, origin) => {
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
  if (!await verifyTurnstile(body.turnstileToken, request, env)) {
    return jsonResponse({ ok: false, error: "challenge_failed" }, 403, origin);
  }
  const now = Math.floor(Date.now() / 1000);
  const ipHash = await hashIp(request, env);
  const token = await signSession({
    sid: sessionId,
    iph: ipHash,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  }, env);
  return jsonResponse({ ok: true, token, expiresIn: SESSION_TTL_SECONDS }, 200, origin);
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
  const payload = body.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonResponse({ ok: false, error: "invalid_payload" }, 400, origin);
  }
  const eventId = String(payload.eventId || "");
  const sessionId = String(payload.session || "");
  const reason = String(payload.reason || "");
  if (!EVENT_ID_RE.test(eventId)
      || sessionId !== claims.sid
      || !ALLOWED_REASONS.has(reason)
      || !Array.isArray(payload.events)
      || payload.events.length > 200) {
    return jsonResponse({ ok: false, error: "invalid_payload" }, 400, origin);
  }

  const now = Date.now();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM telemetry_events WHERE ip_hash = ? AND received_at_ms >= ?",
  ).bind(ipHash, now - 60_000).first();
  if (Number(recent?.count || 0) >= MAX_EVENTS_PER_MINUTE) {
    return jsonResponse({ ok: false, error: "rate_limited" }, 429, origin);
  }

  const cf = request.cf || {};
  try {
    await env.DB.prepare(
      `INSERT INTO telemetry_events (
        event_id, received_at_ms, session_id, reason, payload_json, ip_hash,
        country, region, city, colo, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      eventId,
      now,
      sessionId,
      reason,
      JSON.stringify(payload),
      ipHash,
      String(cf.country || ""),
      String(cf.region || ""),
      String(cf.city || ""),
      String(cf.colo || ""),
      String(request.headers.get("user-agent") || "").slice(0, 300),
    ).run();
  } catch (error) {
    if (String(error?.message || error).includes("UNIQUE")) {
      return jsonResponse({ ok: true, duplicate: true }, 200, origin);
    }
    throw error;
  }
  return jsonResponse({ ok: true }, 201, origin);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "ags-telemetry", storage: "d1" });
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
      if (url.pathname === "/v1/session") return await issueSession(request, env, origin);
      if (url.pathname === "/v1/events") return await acceptEvent(request, env, origin);
      return jsonResponse({ ok: false, error: "not_found" }, 404, origin);
    } catch {
      return jsonResponse({ ok: false, error: "internal_error" }, 500, origin);
    }
  },
};
