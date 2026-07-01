const COURSE_GROUP_SELECTOR = ".ags-lecture-main [class~='group/item']";
const SECTION_CARD_SELECTOR = ":scope > div.grid .cursor-pointer";

let selectAllSyncScheduled = false;

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const isSelectedCard = (card) => String(card.className || "").includes("border-blue-600");

const waitForFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const sectionCards = (group) => Array.from(group.querySelectorAll(SECTION_CARD_SELECTOR));

const sectionCount = (group) => {
  const text = normalizeText(group.querySelector("p")?.textContent);
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : sectionCards(group).length;
};

const selectedCount = (group) => {
  const badge = Array.from(group.querySelectorAll("span")).find((span) => /Selected|선택/.test(normalizeText(span.textContent)));
  const match = normalizeText(badge?.textContent).match(/(\d+)/);
  if (match) return Number(match[1]);
  return sectionCards(group).filter(isSelectedCard).length;
};

const updateButtonState = (group) => {
  const button = group.querySelector(":scope > .ags-section-select-all");
  if (!button) return;
  const total = sectionCount(group);
  const selected = selectedCount(group);
  const active = total > 0 && selected >= total;
  button.classList.toggle("ags-section-select-all-active", active);
  button.setAttribute("aria-pressed", active ? "true" : "false");
};

const ensureButton = (group) => {
  if (group.querySelector(":scope > .ags-section-select-all")) {
    updateButtonState(group);
    return;
  }

  group.classList.add("ags-course-has-select-all");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ags-section-select-all";
  button.title = "분반 전체 선택";
  button.setAttribute("aria-label", "분반 전체 선택");
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = '<span class="ags-section-select-all-icon" aria-hidden="true">✓</span>';
  group.appendChild(button);
  updateButtonState(group);
};

const syncSelectAllButtons = () => {
  selectAllSyncScheduled = false;
  document.querySelectorAll(COURSE_GROUP_SELECTOR).forEach(ensureButton);
};

const scheduleSelectAllSync = () => {
  if (selectAllSyncScheduled) return;
  selectAllSyncScheduled = true;
  requestAnimationFrame(syncSelectAllButtons);
};

const selectAllSections = async (group) => {
  const header = group.querySelector(":scope > button");
  if (sectionCards(group).length === 0) {
    header?.click();
    await waitForFrame();
  }

  const cards = sectionCards(group);
  cards.filter((card) => !isSelectedCard(card)).forEach((card) => card.click());
  await waitForFrame();
  updateButtonState(group);
};

document.addEventListener("click", (event) => {
  const button = event.target.closest?.(".ags-section-select-all");
  if (!button) return;
  const group = button.closest(COURSE_GROUP_SELECTOR);
  if (!group) return;

  event.preventDefault();
  event.stopPropagation();
  void selectAllSections(group);
}, true);

document.addEventListener("keydown", (event) => {
  const button = event.target.closest?.(".ags-section-select-all");
  if (!button || (event.key !== "Enter" && event.key !== " ")) return;
  const group = button.closest(COURSE_GROUP_SELECTOR);
  if (!group) return;

  event.preventDefault();
  event.stopPropagation();
  void selectAllSections(group);
}, true);

new MutationObserver(scheduleSelectAllSync).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class"],
});

window.addEventListener("load", scheduleSelectAllSync);
scheduleSelectAllSync();
