const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
const PRIVACY_NOTICE = "서비스의 안정적인 운영, 오류 분석, 보안 및 이용 통계 산출을 위해  브라우저 정보, 서비스 이용 방식  등이 자동으로 수집·이용될 수 있습니다.";

let skipBusy = false;

const dispatchSkipEvent = (phase, detail = {}) => {
  window.dispatchEvent(new CustomEvent("ags-result-skip", {
    detail: { phase, ...detail },
  }));
};

const currentPage = () => {
  const heading = document.querySelector("#root h2");
  const match = normalize(heading?.textContent).match(/^Step\s+(\d+)/i);
  if (match) return Number(match[1]);
  const stored = Number(window.localStorage.getItem("ags_current_page"));
  return Number.isInteger(stored) ? stored : 0;
};

const appFooter = () => {
  return Array.from(document.querySelectorAll("#root > div > div > div")).find((node) => {
    const classes = String(node.className || "");
    return classes.includes("border-t") && classes.includes("bg-gray-50");
  }) || null;
};

const footerButtons = () => {
  const footer = appFooter();
  return footer ? Array.from(footer.querySelectorAll("button")).filter((button) => (
    !button.classList.contains("ags-result-skip-button")
    && !button.classList.contains("ags-privacy-policy-button")
  )) : [];
};

const primaryFooterButton = () => {
  const buttons = footerButtons().filter((button) => normalize(button.textContent) !== "");
  return buttons[buttons.length - 1] || null;
};

const previousFooterButton = () => {
  return footerButtons().find((button) => normalize(button.textContent) !== "") || null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForPageChange = async (fromPage, timeout = 1600) => {
  const start = performance.now();
  while (performance.now() - start < timeout) {
    await sleep(80);
    if (currentPage() !== fromPage) return true;
  }
  return false;
};

const isCompactMobile = () => window.matchMedia?.("(max-width: 640px)")?.matches;

const labelForMode = (mode) => {
  if (isCompactMobile()) return mode === "forward" ? "결과" : "선택";
  return mode === "forward" ? "결과 바로보기" : "강의 선택으로";
};

const jumpToResults = async () => {
  if (skipBusy) return;
  skipBusy = true;
  dispatchSkipEvent("start", { fromPage: currentPage() });
  try {
    for (let guard = 0; guard < 8 && currentPage() > 0 && currentPage() < 5; guard += 1) {
      const before = currentPage();
      const next = primaryFooterButton();
      if (!next || next.disabled) break;
      next.click();
      const moved = await waitForPageChange(before);
      if (!moved) break;
    }

    if (currentPage() === 5) {
      const generate = primaryFooterButton();
      if (generate && !generate.disabled) {
        generate.click();
        dispatchSkipEvent("generate", { fromPage: 5 });
      }
    }
  } finally {
    setTimeout(() => {
      skipBusy = false;
      syncSkipButtons();
      dispatchSkipEvent("done", { page: currentPage() });
    }, 300);
  }
};

const jumpBackToSelection = async () => {
  if (skipBusy) return;
  skipBusy = true;
  try {
    for (let guard = 0; guard < 8 && currentPage() > 1; guard += 1) {
      const before = currentPage();
      const previous = previousFooterButton();
      if (!previous || previous.disabled) break;
      previous.click();
      const moved = await waitForPageChange(before);
      if (!moved) break;
    }
  } finally {
    setTimeout(() => {
      skipBusy = false;
      syncSkipButtons();
    }, 300);
  }
};

const makeButton = (mode) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `ags-result-skip-button ags-result-skip-button-${mode}`;
  button.textContent = labelForMode(mode);
  button.addEventListener("click", () => {
    if (mode === "forward") dispatchSkipEvent("click", { label: button.textContent });
    window.setTimeout(() => {
      if (mode === "forward") void jumpToResults();
      else void jumpBackToSelection();
    }, 30);
  });
  return button;
};

const makePrivacyButton = () => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ags-privacy-policy-button";
  button.textContent = "개인정보처리방침";
  button.setAttribute("aria-label", "개인정보처리방침 안내 보기");
  button.addEventListener("click", () => window.alert(PRIVACY_NOTICE));
  return button;
};

const ensureFooterExtras = (footer) => {
  let extras = footer.querySelector(":scope > .ags-footer-extras");
  if (!extras) {
    extras = document.createElement("div");
    extras.className = "ags-footer-extras";
  }

  let privacyButton = extras.querySelector(".ags-privacy-policy-button");
  if (!privacyButton) {
    privacyButton = makePrivacyButton();
    extras.appendChild(privacyButton);
  }

  const primary = primaryFooterButton();
  if (extras.parentElement !== footer || extras.nextElementSibling !== primary) {
    footer.insertBefore(extras, primary || null);
  }
  return extras;
};

const syncSkipButtons = () => {
  const footer = appFooter();
  const existing = document.querySelector(".ags-result-skip-button");
  if (!footer) {
    existing?.remove();
    document.querySelector(".ags-footer-extras")?.remove();
    return;
  }
  const extras = ensureFooterExtras(footer);

  const page = currentPage();
  const mode = page === 6 ? "back" : page > 0 && page < 6 ? "forward" : null;
  if (page === 6) skipBusy = false;

  if (!mode) {
    existing?.remove();
    return;
  }

  if (existing && existing.classList.contains(`ags-result-skip-button-${mode}`)) {
    const nextLabel = labelForMode(mode);
    if (existing.textContent !== nextLabel) existing.textContent = nextLabel;
    existing.disabled = skipBusy;
    if (existing.parentElement !== extras) extras.appendChild(existing);
    return;
  }

  existing?.remove();
  const button = makeButton(mode);
  button.disabled = skipBusy;
  extras.appendChild(button);
};

new MutationObserver(() => syncSkipButtons()).observe(document.body, {
  childList: true,
  subtree: true,
});

window.setInterval(syncSkipButtons, 500);
syncSkipButtons();
