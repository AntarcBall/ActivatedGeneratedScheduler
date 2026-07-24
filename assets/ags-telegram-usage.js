const TELEGRAM_BOT_TOKEN = "8803852488:AAGFFiDTacqqmMFHH-ahpNmYNvqomuFfHIo";
const TELEGRAM_CHAT_ID = "5635199149";
const TELEGRAM_SEND_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

const SESSION_ID_KEY = "ags_usage_session_id";
const SESSION_STARTED_AT_KEY = "ags_usage_session_started_at_v3";
const CATEGORY_COUNTS_KEY = "ags_category_button_click_counts";
const EVENT_LOG_KEY = "ags_usage_event_log_v3";
const EVENT_SEQUENCE_KEY = "ags_usage_event_sequence_v3";
const CATEGORY_SENT_SIGNATURE_KEY = "ags_category_button_last_confirmed_signature_v3";
const CATEGORY_QUEUED_SIGNATURE_KEY = "ags_category_button_last_queued_signature_v3";
const LAST_EXIT_SEQUENCE_KEY = "ags_usage_last_exit_sequence_v3";
const RESULT_SKIP_USED_KEY = "ags_result_skip_used";
const ERROR_COUNT_KEY = "ags_usage_error_count_v3";
const TRACK_PROFILE_KEY = "ags_track_profile";
const CATEGORY_HEADER_LABEL = "카테고리";
const MAX_LABEL_LENGTH = 80;
const MAX_EVENT_COUNT = 200;
const MAX_TELEGRAM_MESSAGE_LENGTH = 3900;
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

const readJsonStorage = (storage, key) => {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const sessionId = () => {
  const stored = readSessionItem(SESSION_ID_KEY);
  if (stored) return stored;
  const next = randomId();
  writeSessionItem(SESSION_ID_KEY, next);
  return next;
};

const sessionStartedAt = () => {
  const stored = Number(readSessionItem(SESSION_STARTED_AT_KEY));
  if (Number.isFinite(stored) && stored > 0) return stored;
  const next = Date.now();
  writeSessionItem(SESSION_STARTED_AT_KEY, String(next));
  return next;
};

const readCategoryCounts = () => {
  const parsed = readJsonStorage(window.sessionStorage, CATEGORY_COUNTS_KEY);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
};

const writeCategoryCounts = (counts) => {
  writeSessionItem(CATEGORY_COUNTS_KEY, JSON.stringify(counts));
};

const readEvents = () => {
  const parsed = readJsonStorage(window.sessionStorage, EVENT_LOG_KEY);
  return Array.isArray(parsed) ? parsed : [];
};

const writeEvents = (events) => {
  writeSessionItem(EVENT_LOG_KEY, JSON.stringify(events.slice(-MAX_EVENT_COUNT)));
};

const nextEventSequence = () => {
  const next = Math.max(0, Number(readSessionItem(EVENT_SEQUENCE_KEY)) || 0) + 1;
  writeSessionItem(EVENT_SEQUENCE_KEY, String(next));
  return next;
};

const recordEvent = (type, details = {}) => {
  const event = {
    seq: nextEventSequence(),
    at_ms: Math.max(0, Date.now() - sessionStartedAt()),
    type: clip(type, 40),
    ...Object.fromEntries(
      Object.entries(details)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => [clip(key, 30), typeof value === "number" ? value : clip(value, 100)]),
    ),
  };
  const events = readEvents();
  events.push(event);
  writeEvents(events);
  return event;
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

const deviceClassification = (userAgent) => {
  const ua = userAgent || "";
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Other";
  const browser = /KAKAOTALK/i.test(ua)
    ? "KakaoTalk"
    : /SamsungBrowser/i.test(ua)
      ? "Samsung Internet"
      : /Edg\//i.test(ua)
        ? "Edge"
        : /CriOS|Chrome/i.test(ua)
          ? "Chrome"
          : /FxiOS|Firefox/i.test(ua)
            ? "Firefox"
            : /Safari/i.test(ua)
              ? "Safari"
              : "Other";
  return {
    deviceType: /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || window.innerWidth <= 768 ? "mobile" : "desktop",
    os,
    browser,
    browserContext: browser === "KakaoTalk" ? "kakao_in_app" : "general_browser",
  };
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
  const classification = deviceClassification(nav.userAgent || "");
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

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
    network: connection?.effectiveType || "unknown",
    networkRtt: Number.isFinite(connection?.rtt) ? `${connection.rtt}ms` : "unknown",
    saveData: connection?.saveData ? "yes" : "no",
    ...classification,
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

const currentPageId = () => {
  const step = currentStep();
  return step === 0 || step === null ? "landing" : `step_${step}`;
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

const selectedCategoryLabels = () => {
  const panel = categoryPanel();
  const header = categoryHeaderButton();
  if (!panel) return [];
  return Array.from(panel.querySelectorAll("button"))
    .filter((button) => button !== header)
    .filter((button) => button.classList.contains("bg-blue-600") || button.classList.contains("bg-gray-900"))
    .map((button) => clip(button.textContent || button.getAttribute("aria-label") || "unknown"))
    .filter(Boolean);
};

const recordCategoryClick = (button) => {
  const label = clip(button.textContent || button.getAttribute("aria-label") || "unknown");
  if (!label) return;

  const counts = readCategoryCounts();
  counts[label] = Number(counts[label] || 0) + 1;
  writeCategoryCounts(counts);

  if (button === categoryHeaderButton()) {
    recordEvent("category_panel_click", { page_id: currentPageId(), label });
    return;
  }

  const before = selectedCategoryLabels();
  recordEvent("category_click", { page_id: currentPageId(), label });
  window.setTimeout(() => {
    const after = selectedCategoryLabels();
    const removed = before.filter((item) => !after.includes(item));
    const added = after.filter((item) => !before.includes(item));
    let action = "no_change";
    if (removed.length && added.length) action = "switch";
    else if (added.length) action = "select";
    else if (removed.length) action = "deselect";
    recordEvent("category_change", {
      page_id: currentPageId(),
      action,
      from: removed.join("|"),
      to: added.join("|"),
    });
  }, 50);
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

const pageMetrics = new Map();
const clsWindows = new Map();
const inpInteractions = new Map();
let generationStartedAt = null;

const readErrorCount = () => Math.max(0, Number(readSessionItem(ERROR_COUNT_KEY)) || 0);

const incrementErrorCount = () => {
  const next = readErrorCount() + 1;
  writeSessionItem(ERROR_COUNT_KEY, String(next));
  return next;
};

const metricsForPage = (pageId) => {
  if (!pageMetrics.has(pageId)) {
    pageMetrics.set(pageId, { lcp: null, cls: 0, inp: null });
  }
  return pageMetrics.get(pageId);
};

const updateCls = (pageId, entry) => {
  if (entry.hadRecentInput) return;
  const previous = clsWindows.get(pageId);
  const canExtend = previous
    && entry.startTime - previous.lastEntryTime < 1000
    && entry.startTime - previous.firstEntryTime < 5000;
  const windowState = canExtend
    ? { ...previous, value: previous.value + entry.value, lastEntryTime: entry.startTime }
    : { value: entry.value, firstEntryTime: entry.startTime, lastEntryTime: entry.startTime };
  clsWindows.set(pageId, windowState);
  metricsForPage(pageId).cls = Math.max(metricsForPage(pageId).cls, windowState.value);
};

const updateInp = (pageId, entry) => {
  if (!entry.interactionId) return;
  const key = `${pageId}:${entry.interactionId}`;
  inpInteractions.set(key, Math.max(inpInteractions.get(key) || 0, entry.duration || 0));
  const values = Array.from(inpInteractions.entries())
    .filter(([interactionKey]) => interactionKey.startsWith(`${pageId}:`))
    .map(([, duration]) => duration)
    .sort((left, right) => right - left);
  const percentileIndex = Math.min(values.length - 1, Math.floor(values.length / 50));
  metricsForPage(pageId).inp = values[percentileIndex] ?? null;
};

const observePerformance = () => {
  if (!window.PerformanceObserver) return;
  const observe = (type, callback, options = {}) => {
    try {
      const observer = new PerformanceObserver((list) => list.getEntries().forEach(callback));
      observer.observe({ type, buffered: true, ...options });
    } catch {
      // Unsupported metric or observer options.
    }
  };
  observe("largest-contentful-paint", (entry) => {
    metricsForPage(currentPageId()).lcp = Math.round(entry.startTime);
  });
  observe("layout-shift", (entry) => updateCls(currentPageId(), entry));
  observe("event", (entry) => updateInp(currentPageId(), entry), { durationThreshold: 40 });
};

const metricLines = () => {
  const pageIds = Array.from(pageMetrics.keys()).sort();
  if (!pageIds.length) return ["- unavailable"];
  return pageIds.map((pageId) => {
    const metric = metricsForPage(pageId);
    return `- ${pageId}: LCP=${metric.lcp === null ? "n/a" : `${metric.lcp}ms`} INP=${metric.inp === null ? "n/a" : `${Math.round(metric.inp)}ms`} CLS=${metric.cls.toFixed(3)}`;
  });
};

let pageState = null;

const startPageState = (pageId, reason = "initial") => {
  const now = performance.now();
  pageState = {
    pageId,
    enteredAt: now,
    activeStartedAt: document.hidden ? null : now,
    activeMs: 0,
  };
  metricsForPage(pageId);
  recordEvent("page_enter", { page_id: pageId, reason, tab: document.hidden ? "hidden" : "visible" });
};

const pageActiveMs = () => {
  if (!pageState) return 0;
  const running = pageState.activeStartedAt === null ? 0 : performance.now() - pageState.activeStartedAt;
  return Math.max(0, Math.round(pageState.activeMs + running));
};

const finishPageState = (reason) => {
  if (!pageState) return;
  recordEvent("page_exit", {
    page_id: pageState.pageId,
    reason,
    duration_ms: Math.max(0, Math.round(performance.now() - pageState.enteredAt)),
    active_ms: pageActiveMs(),
    tab: document.hidden ? "hidden" : "visible",
  });
};

const checkPageTransition = () => {
  const pageId = currentPageId();
  if (!pageState) {
    startPageState(pageId);
    return;
  }
  if (pageId === pageState.pageId) return;
  const previousPageId = pageState.pageId;
  finishPageState("navigation");
  startPageState(pageId, `from_${previousPageId}`);
  if (pageId === "step_6" && generationStartedAt !== null) {
    recordEvent("result_generate_complete", {
      page_id: pageId,
      duration_ms: Math.max(0, Math.round(performance.now() - generationStartedAt)),
    });
    generationStartedAt = null;
  }
};

const navigationTiming = () => {
  const entry = performance.getEntriesByType?.("navigation")?.[0];
  if (!entry) return "unavailable";
  return `ttfb=${Math.round(entry.responseStart)}ms dcl=${Math.round(entry.domContentLoadedEventEnd)}ms load=${Math.round(entry.loadEventEnd || 0)}ms`;
};

const eventLine = (event) => {
  const details = Object.entries(event)
    .filter(([key]) => !["seq", "at_ms", "type"].includes(key))
    .map(([key, value]) => `${key}=${clip(value, 70)}`)
    .join(" ");
  return `- #${event.seq} +${event.at_ms}ms ${event.type}${details ? ` ${details}` : ""}`;
};

const messageHeaderLines = (reason) => {
  const counts = readCategoryCounts();
  const profile = readProfile();
  const fingerprint = browserFingerprint();
  const entries = Object.entries(counts)
    .filter(([, count]) => Number(count) > 0)
    .sort(([left], [right]) => left.localeCompare(right));
  const total = entries.reduce((sum, [, count]) => sum + Number(count || 0), 0);

  return [
    "AGS usage telemetry v3",
    `reason: ${reason}`,
    `session: ${sessionId()}`,
    `time: ${new Date().toISOString()}`,
    `page_id: ${currentPageId()}`,
    `tab_state: ${document.hidden ? "hidden" : "visible"}`,
    `page_active_ms: ${pageActiveMs()}`,
    `year: ${profile.year || "unknown"}`,
    `major: ${profile.tracks.length ? profile.tracks.join(" / ") : "unknown"}`,
    `result_skip: ${readSessionItem(RESULT_SKIP_USED_KEY) === "1" ? "yes" : "no"}`,
    `result_errors: ${readErrorCount()}`,
    "device:",
    `- type: ${fingerprint.deviceType}`,
    `- os: ${fingerprint.os}`,
    `- browser: ${fingerprint.browser}`,
    `- context: ${fingerprint.browserContext}`,
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
    `- network: ${fingerprint.network}`,
    `- network_rtt: ${fingerprint.networkRtt}`,
    `- save_data: ${fingerprint.saveData}`,
    `- cookies: ${fingerprint.cookies}`,
    `- dnt: ${fingerprint.doNotTrack}`,
    `navigation: ${navigationTiming()}`,
    `total_clicks: ${total}`,
    "category_clicks:",
    ...(entries.length ? entries.map(([label, count]) => `- ${label}: ${Number(count)}`) : ["- none"]),
    "web_vitals_by_page:",
    ...metricLines(),
  ];
};

const messagesForTelemetry = (reason) => {
  const events = readEvents();
  const header = messageHeaderLines(reason);
  const messages = [];
  let lines = [...header, "events:"];

  events.forEach((event) => {
    const line = eventLine(event);
    if ([...lines, line].join("\n").length > MAX_TELEGRAM_MESSAGE_LENGTH) {
      messages.push(lines.join("\n"));
      lines = [
        "AGS usage telemetry v3 (events continued)",
        `reason: ${reason}`,
        `session: ${sessionId()}`,
        "events:",
        line,
      ];
    } else {
      lines.push(line);
    }
  });
  if (lines.length > 4 || !messages.length) messages.push(lines.join("\n"));
  return messages;
};

const telegramGetFallback = (text) => new Promise((resolve) => {
  const image = new Image();
  const done = () => resolve("queued");
  image.onload = done;
  image.onerror = done;
  image.src = telegramGetUrl(text);
  window.setTimeout(done, 1800);
});

const postTelegram = async (text, preferBeacon = false) => {
  const body = new URLSearchParams({
    chat_id: TELEGRAM_CHAT_ID,
    text,
    disable_web_page_preview: "true",
  });
  const beaconBody = new Blob([body.toString()], { type: "application/x-www-form-urlencoded;charset=UTF-8" });

  if (preferBeacon && navigator.sendBeacon?.(TELEGRAM_SEND_URL, beaconBody)) return "queued";

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

  if (navigator.sendBeacon?.(TELEGRAM_SEND_URL, beaconBody)) return "queued";
  return telegramGetFallback(text);
};

const postTelemetry = async (reason, preferBeacon = false) => {
  let result = "confirmed";
  for (const message of messagesForTelemetry(reason)) {
    const messageResult = await postTelegram(message, preferBeacon);
    if (messageResult !== "confirmed") result = messageResult;
  }
  return result;
};

let sendInFlight = false;

const deliverySignature = () => {
  const counts = categoryCountsSignature(readCategoryCounts());
  return `telemetry_v3|${counts}`;
};

const maybeSendOnResults = async () => {
  if (sendInFlight || currentStep() !== 6) return;

  const signature = deliverySignature();
  if (
    signature === readSessionItem(CATEGORY_SENT_SIGNATURE_KEY)
    || signature === readSessionItem(CATEGORY_QUEUED_SIGNATURE_KEY)
  ) return;

  sendInFlight = true;
  try {
    const result = await postTelemetry("results");
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
  if (!clickedButton) return;

  if (clickedButton.classList.contains("ags-result-skip-button-forward")) {
    writeSessionItem(RESULT_SKIP_USED_KEY, "1");
    recordEvent("result_skip_click", { page_id: currentPageId(), direction: "forward" });
    scheduleResultChecks();
  } else if (clickedButton.classList.contains("ags-result-skip-button-back")) {
    recordEvent("result_skip_click", { page_id: currentPageId(), direction: "back_to_category" });
  } else if (currentStep() === 5 && /생성|generat/i.test(cleanText(clickedButton.textContent))) {
    generationStartedAt = performance.now();
    recordEvent("result_generate_start", { page_id: currentPageId(), source: "button" });
  } else if (hasCategoryCounts()) {
    scheduleResultChecks();
  }
}, { capture: true });

window.addEventListener("ags-result-skip", (event) => {
  const phase = clip(event.detail?.phase || "unknown", 30);
  if (phase !== "back") writeSessionItem(RESULT_SKIP_USED_KEY, "1");
  if (phase === "generate" && generationStartedAt === null) generationStartedAt = performance.now();
  recordEvent("result_skip_phase", {
    page_id: currentPageId(),
    phase,
    from_page: event.detail?.fromPage,
  });
  scheduleResultChecks();
});

document.addEventListener("visibilitychange", () => {
  if (!pageState) return;
  if (document.hidden) {
    if (pageState.activeStartedAt !== null) {
      pageState.activeMs += performance.now() - pageState.activeStartedAt;
      pageState.activeStartedAt = null;
    }
    recordEvent("tab_hidden", { page_id: pageState.pageId, active_ms: pageActiveMs() });
  } else {
    pageState.activeStartedAt = performance.now();
    recordEvent("tab_visible", { page_id: pageState.pageId });
  }
});

window.addEventListener("error", (event) => {
  incrementErrorCount();
  recordEvent("client_error", {
    page_id: currentPageId(),
    message: clip(event.message || "resource error", 100),
  });
}, { capture: true });

window.addEventListener("unhandledrejection", (event) => {
  incrementErrorCount();
  recordEvent("unhandled_rejection", {
    page_id: currentPageId(),
    message: clip(event.reason?.message || event.reason || "unknown", 100),
  });
});

window.addEventListener("pagehide", (event) => {
  finishPageState(event.persisted ? "bfcache" : "pagehide");
  const sequence = Number(readSessionItem(EVENT_SEQUENCE_KEY)) || 0;
  if (sequence <= (Number(readSessionItem(LAST_EXIT_SEQUENCE_KEY)) || 0)) return;
  writeSessionItem(LAST_EXIT_SEQUENCE_KEY, String(sequence));
  void postTelemetry(event.persisted ? "pagehide_bfcache" : "pagehide", true);
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) startPageState(currentPageId(), "bfcache_restore");
});

new MutationObserver(() => {
  syncCategoryHeaderLabel();
  checkPageTransition();
  void maybeSendOnResults();
}).observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

window.addEventListener("load", () => {
  syncCategoryHeaderLabel();
  checkPageTransition();
  window.setTimeout(() => void maybeSendOnResults(), 400);
});

sessionId();
sessionStartedAt();
observePerformance();
checkPageTransition();

window.setInterval(() => {
  checkPageTransition();
  void maybeSendOnResults();
}, RESULT_SEND_CHECK_MS);

window.agsUsageDebug = () => ({
  step: currentStep(),
  pageId: currentPageId(),
  counts: readCategoryCounts(),
  events: readEvents(),
  metrics: Object.fromEntries(pageMetrics),
  activeMs: pageActiveMs(),
  confirmedSignature: readSessionItem(CATEGORY_SENT_SIGNATURE_KEY),
  queuedSignature: readSessionItem(CATEGORY_QUEUED_SIGNATURE_KEY),
  resultSkip: readSessionItem(RESULT_SKIP_USED_KEY) === "1",
  fingerprint: browserFingerprint(),
  messages: messagesForTelemetry("debug"),
});
