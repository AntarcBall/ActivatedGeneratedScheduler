const OPEN_META_URL = "/ActivatedGeneratedScheduler/assets/ags-open-course-metadata.json";
const SEMICONDUCTOR_TAGS_URL = "/ActivatedGeneratedScheduler/assets/ags-semiconductor-course-tags.json";
const OPEN_LECTURES_URL = "/ActivatedGeneratedScheduler/lectures.json";
const COURSE_ROW_SELECTOR = ".ags-lecture-main [class~='group/item']";
const SELECTED_CARD_SELECTOR = ".ags-lecture-main [class~='group/item'] > div.grid .cursor-pointer";
const SELECTED_BORDER_CLASS = "border-blue-600";
const SELECTED_KEYS = "ags_selected_lecture_keys";

let openCourseMeta = new Map();
let semiconductorTags = new Map();
let openLectures = [];
let enhancementReady = false;
let enhancementSyncScheduled = false;

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const normalizeSection = (value) => String(value || "").replace(/^S/i, "").padStart(2, "0");
const lectureSelectionKey = (lecture) => `${lecture.course_number}#${lecture.section}`;

const courseNameFromRow = (row) => normalizeText(row?.querySelector(":scope > button h4")?.textContent);

const rowLecture = (row) => {
  const name = courseNameFromRow(row);
  return openLectures.find((lecture) => normalizeText(lecture.name) === name) || null;
};

const rowTags = (row) => {
  const lecture = rowLecture(row);
  if (!lecture) return [];
  return semiconductorTags.get(String(lecture.course_number || "").toUpperCase()) || [];
};

const ensureCourseLabels = (row) => {
  const tags = rowTags(row);
  row.classList.toggle("ags-semiconductor-course", tags.length > 0);
  let wrap = row.querySelector(":scope > .ags-open-course-labels");
  if (!tags.length) {
    wrap?.remove();
    return;
  }
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "ags-open-course-labels";
    row.appendChild(wrap);
  }
  const signature = tags.join("|");
  if (wrap.dataset.agsTags === signature) return;
  wrap.dataset.agsTags = signature;
  wrap.textContent = "";
  for (const tag of tags) {
    const chip = document.createElement("span");
    chip.className = `ags-open-course-chip ags-open-course-chip-${tag.includes("선수") ? "prereq" : tag.includes("인정") ? "credit" : "semiconductor"}`;
    chip.textContent = `[${tag}]`;
    wrap.appendChild(chip);
  }
};

const selectedStorageKeys = () => {
  const keys = [];
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = storage.getItem(SELECTED_KEYS);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) keys.push(...parsed.filter((item) => typeof item === "string"));
    } catch {
      // Ignore unavailable storage.
    }
  }
  return new Set(keys);
};

const visibleSelectedKeys = () => {
  const keys = [];
  for (const card of document.querySelectorAll(SELECTED_CARD_SELECTOR)) {
    if (!String(card.className || "").includes(SELECTED_BORDER_CLASS)) continue;
    const row = card.closest(COURSE_ROW_SELECTOR);
    const lecture = rowLecture(row);
    if (!lecture) continue;
    const section = normalizeSection(card.querySelector("span")?.textContent);
    keys.push(`${lecture.course_number}#${Number(section) || section}`);
  }
  return keys;
};

const selectedLectures = () => {
  const keys = selectedStorageKeys();
  visibleSelectedKeys().forEach((key) => keys.add(key));
  return openLectures.filter((lecture) => keys.has(lectureSelectionKey(lecture)));
};

const summaryText = () => {
  const items = selectedLectures();
  const sectionCount = items.length;
  const courseCount = new Set(items.map((lecture) => lecture.name)).size;
  const credits = items.reduce((sum, lecture) => sum + (Number(lecture.credit) || 0), 0);
  return `선택 ${courseCount}과목 · ${sectionCount}분반 · ${credits.toFixed(1)}학점`;
};

const summaryCard = () => {
  return document.querySelector(".ags-lecture-sidebar .bg-gray-900.rounded-xl")
    || document.querySelector(".ags-lecture-sidebar [class*='bg-gray-900'][class*='rounded-xl']");
};

const footer = () => {
  return Array.from(document.querySelectorAll(".border-t.bg-gray-50, [class*='border-t'][class*='bg-gray-50']"))
    .find((node) => node.querySelector("button"));
};

const syncBottomSummary = () => {
  const card = summaryCard();
  if (card) {
    card.classList.add("ags-hidden-selection-summary-card");
    card.setAttribute("aria-hidden", "true");
  }

  const bar = footer();
  if (!bar || !document.querySelector(".ags-lecture-main")) return;
  let summary = bar.querySelector(":scope > .ags-bottom-selection-summary");
  if (!summary) {
    summary = document.createElement("div");
    summary.className = "ags-bottom-selection-summary";
    bar.insertBefore(summary, bar.children[Math.min(1, bar.children.length)] || null);
  }
  summary.textContent = summaryText();
};

const relabelSemiconductorFilter = () => {
  document.querySelectorAll(".ags-match-filter-grid button").forEach((button) => {
    if (normalizeText(button.textContent) === "반도체공학") button.textContent = "반도체";
  });
};

const syncEnhancements = () => {
  enhancementSyncScheduled = false;
  if (!enhancementReady) return;
  document.querySelectorAll(COURSE_ROW_SELECTOR).forEach(ensureCourseLabels);
  syncBottomSummary();
  relabelSemiconductorFilter();
};

const scheduleEnhancementSync = () => {
  if (enhancementSyncScheduled) return;
  enhancementSyncScheduled = true;
  requestAnimationFrame(syncEnhancements);
};

const initEnhancements = async () => {
  try {
    const [metadata, tags, lectures] = await Promise.all([
      fetch(OPEN_META_URL, { cache: "no-cache" }).then((response) => response.json()),
      fetch(SEMICONDUCTOR_TAGS_URL, { cache: "no-cache" }).then((response) => response.json()),
      fetch(OPEN_LECTURES_URL, { cache: "no-cache" }).then((response) => response.json()),
    ]);
    openCourseMeta = new Map((metadata.courses || []).map((course) => [`${course.course_number}#${normalizeSection(course.section)}`, course]));
    semiconductorTags = new Map(Object.entries(tags.related_course_numbers || {}).map(([code, value]) => [code.toUpperCase(), value]));
    openLectures = lectures;
    enhancementReady = true;
    window.agsOpenCourseMeta = openCourseMeta;
    scheduleEnhancementSync();
  } catch (error) {
    console.warn("AGS open course enhancements unavailable", error);
  }
};

new MutationObserver(scheduleEnhancementSync).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class"],
});

window.addEventListener("storage", scheduleEnhancementSync);
window.addEventListener("load", scheduleEnhancementSync);
void initEnhancements();
