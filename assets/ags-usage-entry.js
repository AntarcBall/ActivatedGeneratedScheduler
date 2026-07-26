const DATA_URL = new URL("./ags-usage-analytics.json", import.meta.url);
const USAGE_URL = new URL("../usage.html", import.meta.url);
const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

let usageDataPromise;

const usageData = () => {
  if (!usageDataPromise) {
    usageDataPromise = fetch(DATA_URL, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`usage data ${response.status}`);
        return response.json();
      })
      .catch(() => null);
  }
  return usageDataPromise;
};

const landingTitle = () => Array.from(document.querySelectorAll("#root h1")).find((heading) => {
  const text = normalize(heading.textContent);
  return text === "시간표 생성기" || /schedule generator/i.test(text);
});

const stepOneHeading = () => Array.from(document.querySelectorAll("#root h2")).find((heading) => (
  /^Step\s+1\b/i.test(normalize(heading.textContent))
));

const ensureHomeUsageLink = async () => {
  const title = landingTitle();
  if (!title) {
    document.querySelector(".ags-home-support")?.remove();
    return;
  }
  const hero = title.closest(".flex.flex-col.items-center") || title.parentElement;
  const startButton = Array.from(hero?.querySelectorAll("button") || []).find((button) => (
    normalize(button.textContent).includes("시작")
  ));
  if (!hero || !startButton) return;

  let support = hero.querySelector(".ags-home-support");
  if (!support) {
    support = document.createElement("a");
    support.className = "ags-home-support";
    support.href = USAGE_URL.href;
    support.setAttribute("aria-label", "시간표 생성기 사용 현황 보기");
    support.innerHTML = `
      <span class="ags-home-support-pulse" aria-hidden="true"></span>
      <strong>실제 이용 현황</strong>
      <span class="ags-home-support-count">데이터 보기</span>
      <span aria-hidden="true">↗</span>
    `;
    startButton.insertAdjacentElement("afterend", support);
  }

  const data = await usageData();
  const count = data?.overview?.sessions;
  const countLabel = support.querySelector(".ags-home-support-count");
  if (countLabel && Number.isFinite(count)) {
    countLabel.textContent = `${count.toLocaleString("ko-KR")}개 세션`;
  }
};

const ensureStepOneTip = async () => {
  const heading = stepOneHeading();
  if (!heading) {
    document.querySelector(".ags-step-one-usage-tip")?.remove();
    return;
  }

  let tip = document.querySelector(".ags-step-one-usage-tip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "ags-step-one-usage-tip";
    tip.innerHTML = `
      <span class="ags-step-one-usage-icon" aria-hidden="true">↯</span>
      <span>
        <strong>빠르게 만들기</strong>
        강의를 고른 뒤 하단의 <b>시간표</b>를 누르면 공강·점심 설정 없이 바로 생성해요.
      </span>
      <a href="${USAGE_URL.href}">이용 현황</a>
    `;
    heading.insertAdjacentElement("afterend", tip);
  }

  const data = await usageData();
  const share = data?.overview?.skipShare;
  const strong = tip.querySelector("strong");
  if (strong && Number.isFinite(share)) {
    strong.textContent = `이용 세션 ${share.toFixed(0)}%의 빠른 경로`;
  }
};

const ensureFooterUsageLink = () => {
  const extras = document.querySelector(".ags-footer-extras");
  if (!extras) return;
  let link = extras.querySelector(".ags-usage-link");
  if (!link) {
    link = document.createElement("a");
    link.className = "ags-usage-link";
    link.href = USAGE_URL.href;
    link.textContent = "사용 현황";
    link.setAttribute("aria-label", "시간표 생성기 사용 현황 보기");
    extras.prepend(link);
  }
};

let scheduled = false;
const syncUsageEntry = () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    void ensureHomeUsageLink();
    void ensureStepOneTip();
    ensureFooterUsageLink();
  });
};

new MutationObserver(syncUsageEntry).observe(document.body, {
  childList: true,
  subtree: true,
});
window.addEventListener("load", syncUsageEntry);
window.addEventListener("hashchange", syncUsageEntry);
window.setInterval(ensureFooterUsageLink, 750);
syncUsageEntry();
