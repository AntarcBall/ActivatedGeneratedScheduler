const COURSE_GROUP_SELECTOR = ".ags-lecture-main [class~='group/item']";
const SECTION_CARD_SELECTOR = ":scope > div.grid .cursor-pointer";
const BASE_PATH = "/ActivatedGeneratedScheduler/";

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const sectionText = (value) => String(value || "").replace(/^S/i, "").padStart(2, "0");
const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

let lectures = [];
let detailMap = new Map();
let lectureMap = new Map();
let detailSyncScheduled = false;
let detailDataReady = false;

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

const courseNameFromGroup = (group) => {
  const title = normalizeText(group?.querySelector(":scope > button")?.textContent);
  return title.replace(/\s*\d+\s+Sections?\s*$/i, "").trim();
};

const lectureFromCard = (card) => {
  const group = card.closest(COURSE_GROUP_SELECTOR);
  const name = courseNameFromGroup(group);
  const section = sectionText(card.querySelector("span")?.textContent);
  return lectureMap.get(`${name}#${section}`) || null;
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

const openDetailModal = (lecture, record) => {
  const previous = document.querySelector(".ags-detail-modal-backdrop");
  previous?.remove();

  const detail = record.detail || {};
  const backdrop = document.createElement("div");
  backdrop.className = "ags-detail-modal-backdrop";
  backdrop.innerHTML = `
    <div class="ags-detail-modal" role="dialog" aria-modal="true" aria-label="강의 상세정보">
      <div class="ags-detail-modal-head">
        <div>
          <p class="ags-detail-kicker">강의 상세정보</p>
          <h3>${escapeHtml(detail.SBJT_NM || lecture.name)}</h3>
          <p>${escapeHtml(lecture.course_number)} · S${escapeHtml(sectionText(lecture.section))} · ${escapeHtml(detail.PROF_NM || lecture.prof || "")}</p>
        </div>
        <button type="button" class="ags-detail-close" aria-label="닫기">×</button>
      </div>
      <div class="ags-detail-meta">
        ${detail.INFO ? `<span>${escapeHtml(detail.INFO)}</span>` : ""}
        ${detail.TMCNT ? `<span>${escapeHtml(detail.TMCNT)}C</span>` : ""}
        ${detail.DEPT_NM ? `<span>${escapeHtml(detail.DEPT_NM)}</span>` : ""}
        ${detail.EMAIL ? `<span>${escapeHtml(detail.EMAIL)}</span>` : ""}
      </div>
      <div class="ags-detail-modal-body">
        ${paragraph("강의 개요", detail.LT_SUMA)}
        ${paragraph("학습 목표", detail.LT_PURO)}
        ${paragraph("수업 방법", detail.LSN_MTHD)}
        ${paragraph("평가/운영", detail.LT_POLY)}
        ${paragraph("수강 대상 및 유의사항", detail.LRN_ITGT)}
        ${paragraph("비고", detail.ETC)}
        ${paragraph("주차별 계획", detail.SCHETCHUL || detail.ALL_CNTN)}
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
  if (card.querySelector(":scope > .ags-section-detail-button")) return;

  const lecture = lectureFromCard(card);
  const record = lecture ? detailMap.get(detailKey(lecture)) : null;
  const available = Boolean(record);

  card.classList.add("ags-section-detail-card");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ags-section-detail-button";
  button.innerHTML = '<span aria-hidden="true">i</span>';
  button.title = available ? "강의 상세정보" : "상세정보 없음";
  button.setAttribute("aria-label", available ? "강의 상세정보 열기" : "상세정보 없음");
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
  document.querySelectorAll(COURSE_GROUP_SELECTOR).forEach((group) => {
    group.querySelectorAll(SECTION_CARD_SELECTOR).forEach(ensureButton);
  });
};

const scheduleDetailSync = () => {
  if (detailSyncScheduled) return;
  detailSyncScheduled = true;
  requestAnimationFrame(syncDetailButtons);
};

const init = async () => {
  try {
    const [lectureData, detailData] = await Promise.all([
      loadJson("lectures.json"),
      loadJson("assets/ags-section-details.json"),
    ]);
    lectures = lectureData;
    rebuildLectureMap();
    detailMap = new Map((detailData.records || []).map((record) => [record.key, record]));
    detailDataReady = true;
    scheduleDetailSync();
  } catch (error) {
    console.warn("AGS section details unavailable", error);
  }
};

new MutationObserver(scheduleDetailSync).observe(document.body, {
  childList: true,
  subtree: true,
});

window.addEventListener("load", () => {
  void init();
});
void init();
