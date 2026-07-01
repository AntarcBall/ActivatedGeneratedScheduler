const LECTURES_URL = "/ActivatedGeneratedScheduler/lectures.json";
const BASIC_FILTER_LABELS = new Set([
  "기초필수",
  "수학",
  "물리",
  "화학",
  "생명과학",
  "Basic Mandatory",
  "Math",
  "Physics",
  "Chemistry",
  "Biology",
  "Life Sciences",
]);
const TRACK_ALL_LABELS = new Set(["트랙", "트랙 전체", "Track", "All Tracks"]);

let frameSyncScheduled = false;
let trackLabels = new Set();

const filterGrids = () => Array.from(document.querySelectorAll(".ags-match-filter-grid"));

const normalizeLabel = (value) => String(value || "").replace(/\s+/g, " ").trim();

const setIfChanged = (node, property, value) => {
  if (node.style.getPropertyValue(property) !== value) node.style.setProperty(property, value);
};

const setStyleValue = (node, property, value) => {
  if (node.style[property] !== value) node.style[property] = value;
};

const ensureFrame = (grid, name) => {
  let frame = grid.querySelector(`:scope > .ags-filter-group-frame[data-ags-filter-frame="${name}"]`);
  if (!frame) {
    frame = document.createElement("span");
    frame.className = `ags-filter-group-frame ags-${name}-filter-frame`;
    frame.setAttribute("data-ags-filter-frame", name);
    frame.setAttribute("aria-hidden", "true");
    grid.appendChild(frame);
  }
  return frame;
};

const ensureSpacer = (grid) => {
  let spacer = grid.querySelector(":scope > .ags-filter-group-spacer");
  if (!spacer) {
    spacer = document.createElement("span");
    spacer.className = "ags-filter-group-spacer";
    spacer.setAttribute("aria-hidden", "true");
    grid.appendChild(spacer);
  }
  setStyleValue(spacer, "order", "23");
};

const trackLabelSet = () => new Set([...trackLabels, ...TRACK_ALL_LABELS]);

const relabelTrackAll = (button) => {
  const label = normalizeLabel(button.textContent);
  if (label === "트랙") button.textContent = "트랙 전체";
  if (label === "Track") button.textContent = "All Tracks";
};

const classifyButton = (button, index) => {
  const label = normalizeLabel(button.textContent);
  if (index < 5 && BASIC_FILTER_LABELS.has(label)) return "basic";
  if (index === 5 && trackLabelSet().has(label)) return "track";
  if (index >= 8 && trackLabels.has(label)) return "track";
  return "other";
};

const orderButtons = (buttons) => {
  const buckets = { basic: [], other: [], track: [] };
  buttons.forEach((button, index) => {
    relabelTrackAll(button);
    buckets[classifyButton(button, index)].push(button);
  });

  buckets.basic.forEach((button, index) => setStyleValue(button, "order", String(index)));
  buckets.other.forEach((button, index) => setStyleValue(button, "order", String(20 + index)));
  buckets.track.forEach((button, index) => setStyleValue(button, "order", String(50 + index)));
  return buckets;
};

const setFrame = (grid, name, buttons) => {
  const frame = ensureFrame(grid, name);
  if (!buttons.length) {
    frame.hidden = true;
    return;
  }

  const gridRect = grid.getBoundingClientRect();
  const buttonRects = buttons.map((button) => button.getBoundingClientRect());
  if (buttonRects.some((rect) => rect.width === 0 || rect.height === 0)) {
    frame.hidden = true;
    return;
  }

  const inset = 5;
  const left = Math.min(...buttonRects.map((rect) => rect.left)) - gridRect.left - inset;
  const top = Math.min(...buttonRects.map((rect) => rect.top)) - gridRect.top - inset;
  const right = Math.max(...buttonRects.map((rect) => rect.right)) - gridRect.left + inset;
  const bottom = Math.max(...buttonRects.map((rect) => rect.bottom)) - gridRect.top + inset;

  frame.hidden = false;
  setIfChanged(frame, "--ags-filter-frame-x", `${left}px`);
  setIfChanged(frame, "--ags-filter-frame-y", `${top}px`);
  setIfChanged(frame, "--ags-filter-frame-w", `${right - left}px`);
  setIfChanged(frame, "--ags-filter-frame-h", `${bottom - top}px`);
};

const syncBasicFilterFrames = () => {
  frameSyncScheduled = false;
  filterGrids().forEach((grid) => {
    const buttons = Array.from(grid.querySelectorAll(":scope > button"));
    const buckets = orderButtons(buttons);

    grid.classList.add("ags-filter-grid-grouped");
    ensureSpacer(grid);
    buttons.forEach((button) => {
      button.classList.toggle("ags-basic-filter-member", buckets.basic.includes(button));
      button.classList.toggle("ags-track-filter-member", buckets.track.includes(button));
    });

    setFrame(grid, "basic", buckets.basic);
    setFrame(grid, "track", buckets.track);
  });
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

fetch(LECTURES_URL)
  .then((response) => response.json())
  .then((lectures) => {
    const labels = new Set();
    lectures.forEach((lecture) => {
      (lecture.major_tracks || []).forEach((track) => labels.add(normalizeLabel(track)));
    });
    trackLabels = labels;
  })
  .catch(() => {
    trackLabels = new Set();
  })
  .finally(scheduleBasicFilterFrameSync);
