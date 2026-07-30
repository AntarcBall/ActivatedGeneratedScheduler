const COURSE_GROUP_SELECTOR = ".ags-lecture-main [class~='group/item']";
const SECTION_CARD_GLOBAL_SELECTOR = ".ags-lecture-main [class~='group/item'] > div.grid .cursor-pointer";
const BASE_PATH = "/ActivatedGeneratedScheduler/";

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const currentLanguage = () => {
  const active = Array.from(document.querySelectorAll("#root button")).find((button) => (
    /^(한국어|English)$/.test(normalizeText(button.textContent))
    && (button.getAttribute("aria-pressed") === "true" || String(button.className).includes("bg-blue-600"))
  ));
  if (normalizeText(active?.textContent) === "English") return "en";
  if (normalizeText(active?.textContent) === "한국어") return "ko";
  return /^Step\s+\d+:\s*(Select|Set|Good|Bad|Schedule|View)/i.test(normalizeText(document.querySelector("#root h2")?.textContent)) ? "en" : "ko";
};
const DETAIL_COPY = {
  ko: {
    title: "강의 상세정보", close: "닫기", open: "강의 상세정보 열기", unavailable: "상세정보 없음",
    summary: "강의 개요", objectives: "학습 목표", method: "수업 방법", assessment: "평가/운영",
    audience: "수강 대상 및 유의사항", notes: "비고", weekly: "주차별 계획",
  },
  en: {
    title: "Course Details", close: "Close", open: "Open course details", unavailable: "No details available",
    summary: "Course Overview", objectives: "Learning Objectives", method: "Teaching Methods", assessment: "Assessment and Course Policies",
    audience: "Intended Students and Notes", notes: "Additional Notes", weekly: "Weekly Plan",
  },
};
const sectionText = (value) => String(value || "").replace(/^S/i, "").padStart(2, "0");
const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

let lectures = [];
let detailMap = new Map();
let openCourseMeta = new Map();
let lectureMap = new Map();
let ratingLowerHalfCutoff = null;
let detailSyncScheduled = false;
let detailDataReady = false;
const pendingDetailRoots = new Set();

const loadJson = async (path) => {
  const response = await fetch(`${BASE_PATH}${path}`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
};

const rebuildLectureMap = () => {
  lectureMap = new Map();
  for (const lecture of lectures) {
    const key = `${normalizeText(lecture.name)}#${sectionText(lecture.section)}`;
    lectureMap.set(key, lecture);
  }
};

const detailKey = (lecture) => `${lecture.course_number}#${sectionText(lecture.section)}`;

const lectureRate = (lecture) => {
  const rate = Number(lecture?.everytime?.lecture_rate);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
};

const formattedLectureRate = (rate) => (
  Math.round((rate + Number.EPSILON) * 10) / 10
).toFixed(1);

const lowerHalfCutoff = (lectureData) => {
  const rates = lectureData.map(lectureRate).filter((rate) => rate > 0).sort((a, b) => a - b);
  if (!rates.length) return null;
  return rates[Math.ceil(rates.length * 0.5) - 1];
};

const fallbackDetailRecord = (lecture) => {
  const meta = openCourseMeta.get(detailKey(lecture));
  if (!meta) return null;
  const english = currentLanguage() === "en";
  const localized = (field) => english ? meta[`${field}_en`] || meta[field] : meta[field];
  return {
    key: detailKey(lecture),
    detail: {
      SBJT_NO: meta.course_number,
      CLSS_NO: meta.section,
      SBJT_NM: localized("name"),
      CPTN_DCD: localized("classification"),
      TMCNT: String(meta.credit || ""),
      PROF_NM: localized("professor"),
      DEPT_NM: localized("department"),
      EMAIL: "",
      LT_SUMA: [
        localized("field") ? `${english ? "Subject field" : "교과분야"}: ${localized("field")}` : "",
        localized("area") ? `${english ? "Subject area" : "교과영역"}: ${localized("area")}` : "",
        localized("lecture_type") ? `${english ? "Class format" : "강의/실습"}: ${localized("lecture_type")}` : "",
        meta.english ? (english ? "Taught in English" : "영어강의") : "",
      ].filter(Boolean).join("\n"),
      LT_PURO: "",
      ETC: localized("notes"),
      LABRM_NM: "",
      INFO: localized("schedule_text"),
      LRN_ITGT: localized("prerequisites") ? `${english ? "Prerequisites" : "선수과목"}: ${localized("prerequisites")}` : "",
      LT_POLY: "",
      LSN_MTHD: "",
      SCHETCHUL: "",
      ALL_CNTN: "",
    },
  };
};

const courseNameFromGroup = (group) => {
  const header = group?.querySelector(":scope > button");
  const heading = normalizeText(header?.querySelector("h4")?.textContent);
  if (heading) return heading;
  const title = normalizeText(header?.textContent);
  return title.replace(/\s*(?:\(\d+\)|\d+\s+Sections?)\s*$/i, "").trim();
};

const lectureFromCard = (card) => {
  const group = card.closest(COURSE_GROUP_SELECTOR);
  const name = courseNameFromGroup(group);
  const section = sectionText(card.querySelector("span")?.textContent);
  return lectureMap.get(`${name}#${section}`) || null;
};

const hideSchedule = (card) => {
  const schedulePattern = /^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|월|화|수|목|금|토|일)\s+)?\d{1,2}:\d{2}\s*[~–-]\s*\d{1,2}:\d{2}$/i;
  Array.from(card.children).forEach((container) => {
    if (container.tagName !== "DIV") return;
    const lines = Array.from(container.children);
    if (!lines.some((line) => schedulePattern.test(normalizeText(line.textContent)))) return;
    container.classList.add("ags-section-schedule-hidden");
  });
};

const ensureRating = (card, lecture) => {
  const rate = lectureRate(lecture);
  const existing = card.querySelector(":scope > div:first-child > .ags-section-rating");
  if (!rate) {
    existing?.remove();
    return;
  }

  const meta = card.querySelector(":scope > div:first-child");
  if (!meta) return;
  const rating = existing || document.createElement("span");
  const language = currentLanguage();
  if (!existing) rating.className = "ags-section-rating";
  rating.classList.toggle(
    "ags-section-rating-low",
    ratingLowerHalfCutoff !== null && rate <= ratingLowerHalfCutoff,
  );
  const formattedRate = formattedLectureRate(rate);
  const ratingText = `★ ${formattedRate}`;
  if (rating.textContent !== ratingText) rating.textContent = ratingText;
  rating.title = language === "en"
    ? `Average course rating: ${formattedRate} out of 5`
    : `강의평 평균: 5점 만점에 ${formattedRate}`;
  rating.setAttribute("aria-label", rating.title);
  if (!existing) meta.insertBefore(rating, meta.lastElementChild);
};

const paragraph = (label, value) => {
  const text = normalizeText(value);
  if (!text) return "";
  return `
    <section class="ags-detail-section">
      <h4>${escapeHtml(label)}</h4>
      <p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>
    </section>
  `;
};
const localizedDetailValue = (value, language) => {
  const text = normalizeText(value);
  if (language === "en" && /[가-힣]/.test(text)) return "";
  return text;
};

const weeklyPlanText = (value) => {
  const text = normalizeText(value);
  if (!text) return "";
  const insertBreak = (match, prefix, offset) => {
    if (offset === 0) return "";
    return /\s/.test(prefix) ? "\n" : `${prefix}\n`;
  };
  return text
    .replace(/(^|[^\d])(?=\d+\s*주차\s*:)/g, insertBreak)
    .replace(/(^|[^A-Za-z])(?=Weeks?\s*\d+(?:\s*[–-]\s*\d+)?\s*:)/gi, insertBreak)
    .trim();
};

const openDetailModal = (lecture, record) => {
  const previous = document.querySelector(".ags-detail-modal-backdrop");
  previous?.remove();

  const detail = record.detail || {};
  const language = currentLanguage();
  const copy = DETAIL_COPY[language];
  const displayName = language === "en" ? lecture.name : detail.SBJT_NM || lecture.name;
  const officialProfessors = Array.isArray(lecture.professors) ? lecture.professors.filter(Boolean) : [];
  const displayProfessor = language === "en"
    ? officialProfessors.join(", ") || lecture.prof
    : detail.PROF_NM || lecture.prof || "";
  const info = localizedDetailValue(detail.INFO, language);
  const department = localizedDetailValue(detail.DEPT_NM, language);
  const detailBody = [
    paragraph(copy.summary, localizedDetailValue(detail.LT_SUMA, language)),
    paragraph(copy.objectives, localizedDetailValue(detail.LT_PURO, language)),
    paragraph(copy.method, localizedDetailValue(detail.LSN_MTHD, language)),
    paragraph(copy.assessment, localizedDetailValue(detail.LT_POLY, language)),
    paragraph(copy.audience, localizedDetailValue(detail.LRN_ITGT, language)),
    paragraph(copy.notes, localizedDetailValue(detail.ETC, language)),
    paragraph(copy.weekly, weeklyPlanText(localizedDetailValue(detail.SCHETCHUL || detail.ALL_CNTN, language))),
  ].join("");
  const backdrop = document.createElement("div");
  backdrop.className = "ags-detail-modal-backdrop";
  backdrop.innerHTML = `
    <div class="ags-detail-modal" role="dialog" aria-modal="true" aria-label="${copy.title}">
      <div class="ags-detail-modal-head">
        <div>
          <p class="ags-detail-kicker">${copy.title}</p>
          <h3>${escapeHtml(displayName)}</h3>
          <p>${escapeHtml(lecture.course_number)} · S${escapeHtml(sectionText(lecture.section))} · ${escapeHtml(displayProfessor)}</p>
        </div>
        <button type="button" class="ags-detail-close" aria-label="${copy.close}">×</button>
      </div>
      <div class="ags-detail-meta">
        ${info ? `<span>${escapeHtml(info)}</span>` : ""}
        ${detail.TMCNT ? `<span>${escapeHtml(detail.TMCNT)}C</span>` : ""}
        ${department ? `<span>${escapeHtml(department)}</span>` : ""}
        ${detail.EMAIL ? `<span>${escapeHtml(detail.EMAIL)}</span>` : ""}
      </div>
      <div class="ags-detail-modal-body">
        ${detailBody || (language === "en" ? '<p class="ags-detail-empty">No English course description is available.</p>' : "")}
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector(".ags-detail-close")?.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", function onKeydown(event) {
    if (event.key !== "Escape") return;
    close();
    document.removeEventListener("keydown", onKeydown);
  });
};

const ensureButton = (card) => {
  const lecture = lectureFromCard(card);
  hideSchedule(card);
  ensureRating(card, lecture);
  const record = lecture
    ? currentLanguage() === "en"
      ? fallbackDetailRecord(lecture)
      : detailMap.get(detailKey(lecture)) || fallbackDetailRecord(lecture)
    : null;
  const available = Boolean(record);
  const copy = DETAIL_COPY[currentLanguage()];

  card.classList.add("ags-section-detail-card");
  const existing = card.querySelector(":scope > .ags-section-detail-button");
  if (existing) {
    existing.title = available ? copy.title : copy.unavailable;
    existing.setAttribute("aria-label", available ? copy.open : copy.unavailable);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ags-section-detail-button";
  button.innerHTML = '<span aria-hidden="true">i</span>';
  button.title = available ? copy.title : copy.unavailable;
  button.setAttribute("aria-label", available ? copy.open : copy.unavailable);
  button.setAttribute("aria-disabled", available ? "false" : "true");
  button.classList.toggle("ags-section-detail-unavailable", !available);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!available) return;
    openDetailModal(lecture, record);
  });
  card.appendChild(button);
};

const syncDetailButtons = () => {
  detailSyncScheduled = false;
  if (!detailDataReady) return;
  const roots = pendingDetailRoots.size ? Array.from(pendingDetailRoots) : [document];
  pendingDetailRoots.clear();
  const cards = new Set();
  for (const root of roots) {
    if (root !== document && (!root.isConnected || root.nodeType !== Node.ELEMENT_NODE)) continue;
    if (root !== document && root.matches?.(SECTION_CARD_GLOBAL_SELECTOR)) cards.add(root);
    root.querySelectorAll?.(SECTION_CARD_GLOBAL_SELECTOR).forEach((card) => cards.add(card));
  }
  cards.forEach(ensureButton);
};

const scheduleDetailSync = (root = document) => {
  if (!detailDataReady) return;
  pendingDetailRoots.add(root);
  if (detailSyncScheduled) return;
  detailSyncScheduled = true;
  requestAnimationFrame(syncDetailButtons);
};

const init = async () => {
  try {
    const [lectureDataKo, lectureDataEn, detailData, metadata] = await Promise.all([
      loadJson("lectures.json"),
      loadJson("lectures_eng.json"),
      loadJson("assets/ags-section-details.json"),
      loadJson("assets/ags-open-course-metadata.json"),
    ]);
    ratingLowerHalfCutoff = lowerHalfCutoff(lectureDataKo);
    lectures = [...lectureDataKo, ...lectureDataEn];
    rebuildLectureMap();
    detailMap = new Map((detailData.records || []).map((record) => [record.key, record]));
    openCourseMeta = new Map((metadata.courses || []).map((course) => [`${course.course_number}#${sectionText(course.section)}`, course]));
    detailDataReady = true;
    scheduleDetailSync();
  } catch (error) {
    console.warn("AGS section details unavailable", error);
  }
};

new MutationObserver((mutations) => {
  if (!detailDataReady) return;
  for (const mutation of mutations) {
    if (mutation.target?.nodeType === Node.ELEMENT_NODE) pendingDetailRoots.add(mutation.target);
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) pendingDetailRoots.add(node);
    });
  }
  if (pendingDetailRoots.size) scheduleDetailSync(pendingDetailRoots.values().next().value);
}).observe(document.body, {
  childList: true,
  subtree: true,
});

document.addEventListener("click", (event) => {
  const group = event.target.closest?.(COURSE_GROUP_SELECTOR);
  if (!group) return;
  requestAnimationFrame(() => {
    if (group.isConnected) scheduleDetailSync(group);
  });
}, true);

window.addEventListener("load", () => {
  void init();
});
void init();
