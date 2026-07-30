const COURSE_GROUP_SELECTOR = ".ags-lecture-main [class~='group/item']";
const SECTION_CARD_SELECTOR = ":scope > div.grid .cursor-pointer";

let selectAllSyncScheduled = false;
const pendingSelectAllRoots = new Set();

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const isEnglish = () => {
  const button = Array.from(document.querySelectorAll("#root button")).find((item) => (
    normalizeText(item.textContent) === "English"
    && (item.getAttribute("aria-pressed") === "true" || String(item.className).includes("bg-blue-600"))
  ));
  return Boolean(button) || /^Step\s+\d+:\s*(Select|Set|Good|Bad|Schedule|View)/i.test(normalizeText(document.querySelector("#root h2")?.textContent));
};

const isSelectedCard = (card) => String(card.className || "").includes("border-blue-600");

const waitForFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

const sectionCards = (group) => Array.from(group.querySelectorAll(SECTION_CARD_SELECTOR));

const sectionCount = (group) => {
  const meta = group.querySelector("p");
  if (meta?.dataset?.agsSectionCount) return Number(meta.dataset.agsSectionCount);
  const text = normalizeText(meta?.textContent);
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
    const button = group.querySelector(":scope > .ags-section-select-all");
    const label = isEnglish() ? "Select all sections" : "분반 전체 선택";
    button.title = label;
    button.setAttribute("aria-label", label);
    updateButtonState(group);
    return;
  }

  group.classList.add("ags-course-has-select-all");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ags-section-select-all";
  const label = isEnglish() ? "Select all sections" : "분반 전체 선택";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = '<span class="ags-section-select-all-icon" aria-hidden="true">✓</span>';
  group.appendChild(button);
  updateButtonState(group);
};

const syncSelectAllButtons = () => {
  selectAllSyncScheduled = false;
  const roots = pendingSelectAllRoots.size ? Array.from(pendingSelectAllRoots) : [document];
  pendingSelectAllRoots.clear();
  const groups = new Set();
  for (const root of roots) {
    if (root !== document && (!root.isConnected || root.nodeType !== Node.ELEMENT_NODE)) continue;
    if (root !== document && root.matches?.(COURSE_GROUP_SELECTOR)) groups.add(root);
    root.querySelectorAll?.(COURSE_GROUP_SELECTOR).forEach((group) => groups.add(group));
    const closest = root !== document ? root.closest?.(COURSE_GROUP_SELECTOR) : null;
    if (closest) groups.add(closest);
  }
  groups.forEach(ensureButton);
};

const scheduleSelectAllSync = (root = document) => {
  pendingSelectAllRoots.add(root);
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

new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.target?.nodeType === Node.ELEMENT_NODE) pendingSelectAllRoots.add(mutation.target);
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) pendingSelectAllRoots.add(node);
    });
  }
  if (pendingSelectAllRoots.size) scheduleSelectAllSync(pendingSelectAllRoots.values().next().value);
}).observe(document.body, {
  childList: true,
  subtree: true,
});

document.addEventListener("click", (event) => {
  const group = event.target.closest?.(COURSE_GROUP_SELECTOR);
  if (group) scheduleSelectAllSync(group);
}, true);
window.addEventListener("load", () => scheduleSelectAllSync());
scheduleSelectAllSync();
