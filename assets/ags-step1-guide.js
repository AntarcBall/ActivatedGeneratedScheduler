const GUIDE_IMAGE_URL = "/ActivatedGeneratedScheduler/assets/ags-step1-guide.png";

let guideOpen = false;
let bypassGuide = false;
let pendingStartButton = null;

const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

const currentPage = () => {
  const heading = document.querySelector("#root h2");
  const match = normalize(heading?.textContent).match(/^Step\s+(\d+)/i);
  if (match) return Number(match[1]);
  const stored = Number(window.localStorage.getItem("ags_current_page"));
  return Number.isInteger(stored) ? stored : 0;
};

const isStartButton = (button) => {
  if (!button || currentPage() !== 0) return false;
  const text = normalize(button.textContent);
  if (!text || text === "한국어" || text === "English") return false;
  return text.includes("시작") || /^start/i.test(text);
};

const closeGuide = () => {
  guideOpen = false;
  document.querySelector(".ags-step1-guide")?.remove();
};

const continueToStepOne = () => {
  const button = pendingStartButton;
  pendingStartButton = null;
  closeGuide();
  if (!button?.isConnected) return;
  bypassGuide = true;
  button.click();
  requestAnimationFrame(() => {
    bypassGuide = false;
  });
};

const showGuide = (button) => {
  if (guideOpen) return;
  pendingStartButton = button;
  guideOpen = true;

  const guide = document.createElement("section");
  guide.className = "ags-step1-guide";
  guide.setAttribute("role", "dialog");
  guide.setAttribute("aria-modal", "true");
  guide.innerHTML = `
    <div class="ags-step1-guide-panel">
      <div class="ags-step1-guide-head">
        <div>
          <p class="ags-step1-guide-kicker">Step 1 Guide</p>
          <h3>강의 선택 화면 안내</h3>
        </div>
        <button type="button" class="ags-step1-guide-close" aria-label="닫기">×</button>
      </div>
      <div class="ags-step1-guide-update">
        <p class="ags-step1-guide-update-kicker">업데이트 사항 · 2026-07-29 (PDT)</p>
        <h4>최신 한국어 개설강좌 XLS와 수강 사이트 재조회 결과를 반영했습니다.</h4>
        <ul>
          <li><strong>Academic English: Research and Writing</strong> GC102 17·18분반 추가</li>
          <li><strong>시스템의 통합적 모델링(공)</strong> 과목번호 MECH304 → MECH304a 정정</li>
          <li><strong>폐강·삭제 분반</strong> 최신 XLS에서 제외된 8개 분반 제거</li>
          <li><strong>담당교수 변경</strong> GC102 02·14·15분반 최신 정보 반영</li>
          <li><strong>시간·과목명 변경</strong> HSS108, HSS203, HSS221, HSS222, PHY307 반영</li>
          <li><strong>디지털 논리회로(공)</strong> 월/수 16:30-18:00 → 월/수 13:00-14:30</li>
          <li><strong>디지털 영상처리(이,공)</strong> 화/목 13:00-14:30 → 화/목 10:30-12:00</li>
        </ul>
      </div>
      <div class="ags-step1-guide-image-wrap">
        <img src="${GUIDE_IMAGE_URL}" alt="Step 1 강의 선택 화면 안내" class="ags-step1-guide-image">
      </div>
      <div class="ags-step1-guide-actions">
        <button type="button" class="ags-step1-guide-secondary">닫기</button>
        <button type="button" class="ags-step1-guide-primary">Step 1로 이동</button>
      </div>
    </div>
  `;

  guide.addEventListener("click", (event) => {
    if (event.target === guide || event.target.closest(".ags-step1-guide-close") || event.target.closest(".ags-step1-guide-secondary")) {
      closeGuide();
      return;
    }
    if (event.target.closest(".ags-step1-guide-primary")) continueToStepOne();
  });

  document.body.appendChild(guide);
};

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("button");
  if (bypassGuide || !isStartButton(button)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  showGuide(button);
}, true);

document.addEventListener("keydown", (event) => {
  if (!guideOpen) return;
  if (event.key === "Escape") closeGuide();
  if (event.key === "Enter") continueToStepOne();
});
