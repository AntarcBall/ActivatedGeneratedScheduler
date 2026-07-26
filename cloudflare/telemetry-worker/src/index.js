const encoder = new TextEncoder();
const MAX_BODY_BYTES = 8 * 1024;
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

const verifyTurnstile = async (token, env) => {
  if (typeof token !== "string" || token.length < 20 || token.length > 2048) return false;
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET);
  form.set("response", token);
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
  if (!ALLOWED_YEARS.has(year) || majors.length === 0) return null;
  return { year, major: majors.join(" / ") };
};

const estimatedRegion = (request) => {
  const cf = request.cf || {};
  const values = [cf.country, cf.region]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return [...new Set(values)].join(" / ") || "unknown";
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
  const profile = normalizedProfile(body);
  if (!profile) {
    return jsonResponse({ ok: false, error: "invalid_session_summary" }, 400, origin);
  }
  if (!await verifyTurnstile(body.turnstileToken, env)) {
    return jsonResponse({ ok: false, error: "challenge_failed" }, 403, origin);
  }

  await env.DB.prepare(
    `INSERT INTO telemetry_sessions (
      estimated_region, year, major
    ) VALUES (?, ?, ?)`,
  ).bind(
    estimatedRegion(request),
    profile.year,
    profile.major,
  ).run();
  return jsonResponse({ ok: true }, 201, origin);
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: "ags-telemetry",
        storage: "d1",
        collection: "session_summary",
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
      return jsonResponse({ ok: false, error: "not_found" }, 404, origin);
    } catch {
      return jsonResponse({ ok: false, error: "internal_error" }, 500, origin);
    }
  },
};
