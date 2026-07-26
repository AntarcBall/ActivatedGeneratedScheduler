const TELEMETRY_API_URL = "https://ags-telemetry.bouncy272.workers.dev";
const TURNSTILE_SITEKEY = "0x4AAAAAAD-GenM3VpG8dMXE";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const SESSION_SENT_KEY = "ags_minimal_session_sent_v1";
const TRACK_PROFILE_KEY = "ags_track_profile";
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

const readSessionItem = (key, fallback = "") => {
  try {
    return window.sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const writeSessionItem = (key, value) => {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable in restricted browser modes.
  }
};

const readProfile = () => {
  let parsed = null;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    try {
      const raw = storage.getItem(TRACK_PROFILE_KEY);
      if (raw) {
        parsed = JSON.parse(raw);
        break;
      }
    } catch {
      // Try the next storage location.
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const year = String(parsed.year || "");
  const majors = Array.isArray(parsed.tracks)
    ? [...new Set(parsed.tracks.map(String).filter((major) => ALLOWED_MAJORS.has(major)))].slice(0, 2)
    : [];
  return ALLOWED_YEARS.has(year) && majors.length ? { year, majors } : null;
};

const loadTurnstile = () => {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
    const script = existing || document.createElement("script");
    const timeoutId = window.setTimeout(() => reject(new Error("turnstile_timeout")), 8000);
    const finish = () => {
      if (!window.turnstile) return;
      window.clearTimeout(timeoutId);
      resolve(window.turnstile);
    };
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => {
      window.clearTimeout(timeoutId);
      reject(new Error("turnstile_load_failed"));
    }, { once: true });
    if (!existing) {
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    window.setTimeout(finish, 0);
  });
};

const requestTurnstileToken = async () => {
  const turnstile = await loadTurnstile();
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden";
  document.body.appendChild(container);
  return new Promise((resolve, reject) => {
    const finish = (callback) => (value) => {
      window.clearTimeout(timeoutId);
      container.remove();
      callback(value);
    };
    const timeoutId = window.setTimeout(
      finish(() => reject(new Error("turnstile_timeout"))),
      10_000,
    );
    turnstile.render(container, {
      sitekey: TURNSTILE_SITEKEY,
      action: "telemetry_session",
      callback: finish(resolve),
      "error-callback": finish(() => reject(new Error("turnstile_failed"))),
      "expired-callback": finish(() => reject(new Error("turnstile_expired"))),
    });
  });
};

let sendPromise = null;

const sendSessionSummary = () => {
  if (readSessionItem(SESSION_SENT_KEY) === "1") return Promise.resolve(true);
  const profile = readProfile();
  if (!profile) return Promise.resolve(false);
  if (sendPromise) return sendPromise;

  sendPromise = (async () => {
    const turnstileToken = await requestTurnstileToken();
    const response = await fetch(`${TELEMETRY_API_URL}/v1/session`, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({
        turnstileToken,
        year: profile.year,
        majors: profile.majors,
      }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(result?.error || "session_failed");
    writeSessionItem(SESSION_SENT_KEY, "1");
    return true;
  })().catch(() => false).finally(() => {
    sendPromise = null;
  });
  return sendPromise;
};

window.addEventListener("ags-profile-saved", () => void sendSessionSummary());
window.addEventListener("load", () => void sendSessionSummary());

void sendSessionSummary();

window.agsUsageDebug = () => ({
  sessionSummarySent: readSessionItem(SESSION_SENT_KEY) === "1",
  profileReady: Boolean(readProfile()),
  collectedFields: ["estimated_region", "year", "major"],
});
