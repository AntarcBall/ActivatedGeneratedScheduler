const TELEGRAM_BOT_TOKEN = "8803852488:AAGFFiDTacqqmMFHH-ahpNmYNvqomuFfHIo";
const TELEGRAM_CHAT_ID = "5635199149";
const TELEGRAM_SEND_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

const SESSION_ID_KEY = "ags_usage_session_id";
const CATEGORY_COUNTS_KEY = "ags_category_button_click_counts";
const CATEGORY_SENT_SIGNATURE_KEY = "ags_category_button_last_confirmed_signature_v2";
const CATEGORY_QUEUED_SIGNATURE_KEY = "ags_category_button_last_queued_signature_v2";
const RESULT_SKIP_USED_KEY = "ags_result_skip_used";
const TRACK_PROFILE_KEY = "ags_track_profile";
const CATEGORY_HEADER_LABEL = "카테고리";
const MAX_LABEL_LENGTH = 80;
const RESULT_SEND_CHECK_MS = 1200;

const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const clip = (value, limit = MAX_LABEL_LENGTH) => {
  const text = cleanText(value);
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
};

const randomId = () => {
  const bytes = new Uint8Array(12);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const readSessionItem = (key, fallback = null) => {
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
    // Ignore storage failures in restricted browser modes.
  }
};

const sessionId = () => {
  const stored = readSessionItem(SESSION_ID_KEY);
  if (stored) return stored;
  const next = randomId();
  writeSessionItem(SESSION_ID_KEY, next);
  return next;
};

const readJsonStorage = (storage, key) => {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readCategoryCounts = () => {
  const parsed = readJsonStorage(window.sessionStorage, CATEGORY_COUNTS_KEY);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
};

const writeCategoryCounts = (counts) => {
  writeSessionItem(CATEGORY_COUNTS_KEY, JSON.stringify(counts));
};

const readProfile = () => {
  const parsed = readJsonStorage(window.sessionStorage, TRACK_PROFILE_KEY) || readJsonStorage(window.localStorage, TRACK_PROFILE_KEY);
  if (!parsed || typeof parsed !== "object") return { year: "", tracks: [] };
  return {
    year: ["1", "2", "3", "4"].includes(String(parsed.year)) ? String(parsed.year) : "",
    tracks: Array.isArray(parsed.tracks) ? parsed.tracks.map((track) => clip(track, 60)).filter(Boolean).slice(0, 2) : [],
  };
};

const screenSize = () => {
  const screenInfo = window.screen;
  if (!screenInfo) return "unknown";
  const width = Number(screenInfo.width) || 0;
  const height = Number(screenInfo.height) || 0;
  const colorDepth = Number(screenInfo.colorDepth) || 0;
  return `${width}x${height}${colorDepth ? `x${colorDepth}` : ""}`;
};

const browserFingerprint = () => {
  const nav = window.navigator || {};
  const timezone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  })();

  return {
    userAgent: clip(nav.userAgent || "", 240),
    platform: clip(nav.userAgentData?.platform || nav.platform || "", 80),
    languages: Array.isArray(nav.languages) ? nav.languages.slice(0, 4).join(",") : clip(nav.language || "", 80),
    timezone: clip(timezone, 80),
    screen: screenSize(),
    viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
    pixelRatio: String(window.devicePixelRatio || 1),
    cores: nav.hardwareConcurrency ? String(nav.hardwareConcurrency) : "unknown",
    memory: nav.deviceMemory ? `${nav.deviceMemory}GB` : "unknown",
    touch: String(nav.maxTouchPoints || 0),
    cookies: nav.cookieEnabled === false ? "disabled" : "enabled",
    doNotTrack: nav.doNotTrack || window.doNotTrack || "unspecified",
  };
};

const currentStep = () => {
  const heading = document.querySelector("#root h2");
  const match = cleanText(heading?.textContent).match(/^Step\s+(\d+)/i);
  if (match) return Number(match[1]);

  try {
    const stored = Number(window.localStorage.getItem("ags_current_page"));
    return Number.isInteger(stored) ? stored : null;
  } catch {
    return null;
  }
};

const categoryPanel = () => {
  const sidebar = document.querySelector(".ags-lecture-sidebar");
  if (!sidebar) return null;
  return Array.from(sidebar.children).find((child) => (
    child.matches?.(".bg-white.rounded-xl.border.border-gray-100.p-2.shadow-sm.flex-1.min-h-0.flex.flex-col")
  )) || null;
};

const categoryHeaderButton = () => categoryPanel()?.querySelector(":scope > button") || null;

const syncCategoryHeaderLabel = () => {
  const button = categoryHeaderButton();
  if (button && cleanText(button.textContent) !== CATEGORY_HEADER_LABEL) {
    button.textContent = CATEGORY_HEADER_LABEL;
  }
};

const isCategoryButton = (target) => {
  const button = target.closest?.("button");
  const panel = categoryPanel();
  if (!button || !panel || !panel.contains(button)) return null;
  return button;
};

const recordCategoryClick = (button) => {
  const label = clip(button.textContent || button.getAttribute("aria-label") || "unknown");
  if (!label) return;

  const counts = readCategoryCounts();
  counts[label] = Number(counts[label] || 0) + 1;
  writeCategoryCounts(counts);
};

const categoryCountsSignature = (counts) => {
  const entries = Object.entries(counts)
    .filter(([, count]) => Number(count) > 0)
    .map(([label, count]) => [label, Number(count)])
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(entries);
};

const hasCategoryCounts = () => categoryCountsSignature(readCategoryCounts()) !== "[]";

const telegramGetUrl = (text) => {
  const params = new URLSearchParams({
    chat_id: TELEGRAM_CHAT_ID,
    text,
    disable_web_page_preview: "true",
  });
  return `${TELEGRAM_SEND_URL}?${params.toString()}`;
};

const messageFromCounts = (counts) => {
  const profile = readProfile();
  const fingerprint = browserFingerprint();
  const entries = Object.entries(counts)
    .filter(([, count]) => Number(count) > 0)
    .sort(([left], [right]) => left.localeCompare(right));
  const total = entries.reduce((sum, [, count]) => sum + Number(count || 0), 0);

  return [
    "AGS category usage",
    `session: ${sessionId()}`,
    `time: ${new Date().toISOString()}`,
    `year: ${profile.year || "unknown"}`,
    `major: ${profile.tracks.length ? profile.tracks.join(" / ") : "unknown"}`,
    `result_skip: ${readSessionItem(RESULT_SKIP_USED_KEY) === "1" ? "yes" : "no"}`,
    "device:",
    `- ua: ${fingerprint.userAgent || "unknown"}`,
    `- platform: ${fingerprint.platform || "unknown"}`,
    `- languages: ${fingerprint.languages || "unknown"}`,
    `- timezone: ${fingerprint.timezone || "unknown"}`,
    `- screen: ${fingerprint.screen}`,
    `- viewport: ${fingerprint.viewport}`,
    `- pixel_ratio: ${fingerprint.pixelRatio}`,
    `- cores: ${fingerprint.cores}`,
    `- memory: ${fingerprint.memory}`,
    `- touch_points: ${fingerprint.touch}`,
    `- cookies: ${fingerprint.cookies}`,
    `- dnt: ${fingerprint.doNotTrack}`,
    `total_clicks: ${total}`,
    "category_clicks:",
    ...entries.map(([label, count]) => `- ${label}: ${Number(count)}`),
  ].join("\n");
};

let sendInFlight = false;

const postTelegram = async (text) => {
  const body = new URLSearchParams({
    chat_id: TELEGRAM_CHAT_ID,
    text,
    disable_web_page_preview: "true",
  });

  try {
    const response = await fetch(TELEGRAM_SEND_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      keepalive: true,
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok === true) return "confirmed";
  } catch {
    // Browser extensions or privacy settings can block direct API fetches.
  }

  const beaconBody = new Blob([body.toString()], { type: "application/x-www-form-urlencoded;charset=UTF-8" });
  if (navigator.sendBeacon?.(TELEGRAM_SEND_URL, beaconBody)) return "queued";

  return new Promise((resolve) => {
    const image = new Image();
    const done = () => resolve("queued");
    image.onload = done;
    image.onerror = done;
    image.src = telegramGetUrl(text);
    window.setTimeout(done, 1800);
  });
};

const maybeSendOnResults = async () => {
  if (sendInFlight || currentStep() !== 6) return;

  const counts = readCategoryCounts();
  const signature = categoryCountsSignature(counts);
  if (
    signature === "[]" ||
    signature === readSessionItem(CATEGORY_SENT_SIGNATURE_KEY) ||
    signature === readSessionItem(CATEGORY_QUEUED_SIGNATURE_KEY)
  ) return;

  sendInFlight = true;
  try {
    const result = await postTelegram(messageFromCounts(counts));
    if (result === "confirmed") {
      writeSessionItem(CATEGORY_SENT_SIGNATURE_KEY, signature);
    } else if (result === "queued") {
      writeSessionItem(CATEGORY_QUEUED_SIGNATURE_KEY, signature);
    }
  } finally {
    sendInFlight = false;
  }
};

const scheduleResultChecks = () => {
  window.setTimeout(() => void maybeSendOnResults(), 250);
  window.setTimeout(() => void maybeSendOnResults(), 900);
  window.setTimeout(() => void maybeSendOnResults(), 1800);
  window.setTimeout(() => void maybeSendOnResults(), 3200);
  window.setTimeout(() => void maybeSendOnResults(), 5200);
  window.setTimeout(() => void maybeSendOnResults(), 8000);
};

document.addEventListener("click", (event) => {
  const button = isCategoryButton(event.target);
  if (button) {
    recordCategoryClick(button);
    return;
  }

  const clickedButton = event.target.closest?.("button");
  if (clickedButton?.classList?.contains("ags-result-skip-button-forward")) {
    writeSessionItem(RESULT_SKIP_USED_KEY, "1");
    scheduleResultChecks();
  } else if (hasCategoryCounts() && clickedButton) {
    scheduleResultChecks();
  }
}, { capture: true });

window.addEventListener("ags-result-skip", (event) => {
  if (event.detail?.phase !== "back") writeSessionItem(RESULT_SKIP_USED_KEY, "1");
  scheduleResultChecks();
});

new MutationObserver(() => {
  syncCategoryHeaderLabel();
  void maybeSendOnResults();
}).observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

window.addEventListener("load", () => {
  syncCategoryHeaderLabel();
  window.setTimeout(() => void maybeSendOnResults(), 400);
});

window.setInterval(() => {
  void maybeSendOnResults();
}, RESULT_SEND_CHECK_MS);

window.agsUsageDebug = () => ({
  step: currentStep(),
  counts: readCategoryCounts(),
  confirmedSignature: readSessionItem(CATEGORY_SENT_SIGNATURE_KEY),
  queuedSignature: readSessionItem(CATEGORY_QUEUED_SIGNATURE_KEY),
  resultSkip: readSessionItem(RESULT_SKIP_USED_KEY) === "1",
  fingerprint: browserFingerprint(),
});
