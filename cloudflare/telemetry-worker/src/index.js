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
const ALLOWED_OS = new Set(["iOS", "Android", "Windows", "ChromeOS", "macOS", "Linux", "Other"]);
const DEVICE_TYPE_LABELS = {
  mobile: "모바일",
  tablet: "태블릿",
  desktop: "데스크톱",
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
  const os = String(body.os || "");
  const deviceType = String(body.deviceType || "");
  if (!ALLOWED_YEARS.has(year)
      || majors.length === 0
      || !ALLOWED_OS.has(os)
      || !Object.hasOwn(DEVICE_TYPE_LABELS, deviceType)) return null;
  return { year, major: majors.join(" / "), os, deviceType };
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
  const profile = normalizedProfile(body);
  if (!profile) {
    return jsonResponse({ ok: false, error: "invalid_session_summary" }, 400, origin);
  }
  if (!await verifyTurnstile(body.turnstileToken, env)) {
    return jsonResponse({ ok: false, error: "challenge_failed" }, 403, origin);
  }

  const summary = {
    estimatedRegion: estimatedRegion(request),
    year: profile.year,
    major: profile.major,
    os: profile.os,
    deviceType: profile.deviceType,
  };
  await sendTelegramSummary(env, summary);
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
  return jsonResponse({ ok: true, notified: true }, 201, origin);
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
        notification: "telegram",
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
