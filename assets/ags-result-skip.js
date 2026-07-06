const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();

let skipBusy = false;

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
  return footer ? Array.from(footer.querySelectorAll("button")).filter((button) => !button.classList.contains("ags-result-skip-button")) : [];
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
      if (generate && !generate.disabled) generate.click();
    }
  } finally {
    setTimeout(() => {
      skipBusy = false;
      syncSkipButtons();
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
    window.setTimeout(() => {
      if (mode === "forward") void jumpToResults();
      else void jumpBackToSelection();
    }, 30);
  });
  return button;
};

const syncSkipButtons = () => {
  const footer = appFooter();
  const existing = document.querySelector(".ags-result-skip-button");
  if (!footer) {
    existing?.remove();
    return;
  }

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
    return;
  }

  existing?.remove();
  const button = makeButton(mode);
  button.disabled = skipBusy;
  document.body.appendChild(button);
};

new MutationObserver(() => syncSkipButtons()).observe(document.body, {
  childList: true,
  subtree: true,
});

window.setInterval(syncSkipButtons, 500);
syncSkipButtons();
