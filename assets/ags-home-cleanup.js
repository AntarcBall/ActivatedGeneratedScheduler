const HOME_TITLE = "시간표 생성기";

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const isSpecialRoute = () => /^#\/(?:professor|room)\//i.test(window.location.hash || "");

const addHidden = (element) => {
  if (element) element.classList.add("ags-home-hidden");
};

const clearHomeClasses = () => {
  document.body.classList.remove("ags-home-clean");
  document.querySelectorAll(".ags-home-hidden").forEach((element) => element.classList.remove("ags-home-hidden"));
  document.querySelector(".ags-home-shell")?.classList.remove("ags-home-shell");
  document.querySelector(".ags-home-hero")?.classList.remove("ags-home-hero");
  document.querySelector(".ags-home-main-title")?.classList.remove("ags-home-main-title");
  document.querySelector(".ags-home-start")?.classList.remove("ags-home-start");
};

const findLandingTitle = () => Array.from(document.querySelectorAll("#root h1")).find((title) => {
  const text = normalizeText(title.textContent);
  return text === HOME_TITLE || /(?:DGIST\s*)?(?:자동\s*)?시간표\s*생성기/i.test(text) || /schedule generator/i.test(text);
});

const findMainStartButton = (hero) => Array.from(hero?.querySelectorAll("button") || []).find((button) => normalizeText(button.textContent).includes("시작"));

const hideRouteLinks = () => {
  document.querySelectorAll('a[href*="#/professor/"], a[href*="#/room/"]').forEach(addHidden);
  document.querySelectorAll("a[href]").forEach((link) => {
    const text = normalizeText(link.textContent);
    if (/설명|guide|velog/i.test(text) || /velog\.io/.test(link.href)) {
      addHidden(link.closest(".pt-10") || link.closest("div") || link);
    }
  });
};

const hideLanguageToggle = () => {
  const languageButton = Array.from(document.querySelectorAll("button")).find((button) => {
    const text = normalizeText(button.textContent);
    return text === "한국어" || text === "English";
  });
  addHidden(languageButton?.parentElement);
};

const cleanHome = () => {
  if (isSpecialRoute()) {
    clearHomeClasses();
    return;
  }

  const title = findLandingTitle();
  if (!title) {
    if (document.body.classList.contains("ags-home-clean")) clearHomeClasses();
    return;
  }

  const hero = title.closest(".flex.flex-col.items-center") || title.parentElement;
  const shell = hero?.closest(".relative.flex-1") || document.querySelector("#root .relative.flex-1");
  const startButton = findMainStartButton(hero);

  if (!hero || !shell || !startButton) return;

  document.body.classList.add("ags-home-clean");
  shell.classList.add("ags-home-shell");
  hero.classList.add("ags-home-hero");
  title.classList.add("ags-home-main-title");
  title.textContent = HOME_TITLE;
  startButton.classList.add("ags-home-start");

  const smallTitle = shell.querySelector(":scope > h2");
  addHidden(smallTitle);
  hideLanguageToggle();
  hideRouteLinks();

  Array.from(hero.children).forEach((child) => {
    if (child === title || child === startButton || child.contains(startButton)) return;
    addHidden(child);
  });

  const routeLinkWrap = startButton.parentElement;
  if (routeLinkWrap) {
    Array.from(routeLinkWrap.children).forEach((child) => {
      if (child !== startButton) addHidden(child);
    });
  }

  const footer = document.querySelector("#root > div > div > div:last-child");
  if (footer?.classList.contains("border-t")) addHidden(footer);
};

let cleanupScheduled = false;

const scheduleCleanHome = () => {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  requestAnimationFrame(() => {
    cleanupScheduled = false;
    cleanHome();
  });
};

new MutationObserver(scheduleCleanHome).observe(document.body, { childList: true, subtree: true });
window.addEventListener("load", scheduleCleanHome);
window.addEventListener("hashchange", scheduleCleanHome);
window.addEventListener("popstate", scheduleCleanHome);
scheduleCleanHome();
