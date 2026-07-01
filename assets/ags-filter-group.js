const BASIC_FILTER_COUNT = 4;
let frameSyncScheduled = false;

const filterGrids = () => Array.from(document.querySelectorAll(".ags-match-filter-grid"));

const setBasicFilterFrame = (grid) => {
  const buttons = Array.from(grid.querySelectorAll(":scope > button")).slice(0, BASIC_FILTER_COUNT);
  if (buttons.length < BASIC_FILTER_COUNT) return;

  const gridRect = grid.getBoundingClientRect();
  const buttonRects = buttons.map((button) => button.getBoundingClientRect());
  if (buttonRects.some((rect) => rect.width === 0 || rect.height === 0)) return;

  const inset = 5;
  const left = Math.min(...buttonRects.map((rect) => rect.left)) - gridRect.left - inset;
  const top = Math.min(...buttonRects.map((rect) => rect.top)) - gridRect.top - inset;
  const right = Math.max(...buttonRects.map((rect) => rect.right)) - gridRect.left + inset;
  const bottom = Math.max(...buttonRects.map((rect) => rect.bottom)) - gridRect.top + inset;

  grid.classList.add("ags-basic-filter-grid");
  grid.style.setProperty("--ags-basic-filter-x", `${left}px`);
  grid.style.setProperty("--ags-basic-filter-y", `${top}px`);
  grid.style.setProperty("--ags-basic-filter-w", `${right - left}px`);
  grid.style.setProperty("--ags-basic-filter-h", `${bottom - top}px`);

  buttons.forEach((button) => button.classList.add("ags-basic-filter-member"));
};

const syncBasicFilterFrames = () => {
  frameSyncScheduled = false;
  filterGrids().forEach(setBasicFilterFrame);
};

const scheduleBasicFilterFrameSync = () => {
  if (frameSyncScheduled) return;
  frameSyncScheduled = true;
  requestAnimationFrame(syncBasicFilterFrames);
};

new MutationObserver(scheduleBasicFilterFrameSync).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "style"],
});

window.addEventListener("resize", scheduleBasicFilterFrameSync);
window.addEventListener("load", scheduleBasicFilterFrameSync);
scheduleBasicFilterFrameSync();
