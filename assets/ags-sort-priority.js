const LECTURES_URL = "/ActivatedGeneratedScheduler/lectures.json";
const REQUIREMENTS_URL = "/ActivatedGeneratedScheduler/assets/ags-track-requirements.json";
const SORT_ORDER_KEY = "ags_sort_priority_order";
const COURSE_GROUP_SELECTOR = ".ags-lecture-main [class~='group/item']";
const DEFAULT_ORDER = ["year", "korean", "fridayOff"];

const CRITERIA = {
  year: { label: "학년순", shortLabel: "학년" },
  korean: { label: "한글순", shortLabel: "한글" },
  fridayOff: { label: "금공강", shortLabel: "금공강" },
};

let lecturesByName = new Map();
let requiredYearByCourse = new Map();
let syncScheduled = false;
let dragKey = null;

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const normalizeCourseName = (value) => normalizeText(value)
  .replace(/\s*-\s*영어강의\s*$/i, "")
  .replace(/Ⅰ/g, "1")
  .replace(/Ⅱ/g, "2")
  .replace(/Ⅲ/g, "3")
  .replace(/Ⅳ/g, "4")
  .replace(/[()\[\]{}.,·:;*＊\s-]/g, "")
  .replace(/이공/g, "")
  .replace(/공이/g, "")
  .toLowerCase();

const readJsonStorage = (storage, key) => {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    const serialized = JSON.stringify(value);
    window.localStorage.setItem(key, serialized);
    window.sessionStorage.setItem(key, serialized);
  } catch {
    // Sorting still works for the current render even if storage is unavailable.
  }
};

const cleanOrder = (value) => {
  const items = Array.isArray(value) ? value : [];
  const order = items
    .map((item) => item === "recommended" ? "year" : item)
    .filter((item) => Object.hasOwn(CRITERIA, item));
  for (const key of DEFAULT_ORDER) {
    if (!order.includes(key)) order.push(key);
  }
  return order.slice(0, DEFAULT_ORDER.length);
};

const readSortOrder = () => {
  return cleanOrder(readJsonStorage(window.sessionStorage, SORT_ORDER_KEY) || readJsonStorage(window.localStorage, SORT_ORDER_KEY) || DEFAULT_ORDER);
};

const saveSortOrder = (order) => {
  writeStorage(SORT_ORDER_KEY, cleanOrder(order));
};

const courseNameFromGroup = (group) => normalizeText(group.querySelector(":scope > button h4")?.textContent);

const hasFridayFreeOption = (name) => {
  const lectures = lecturesByName.get(name) || [];
  if (!lectures.length) return false;
  return lectures.some((lecture) => !(lecture.time_slots || []).some((slot) => slot.day === "금" || slot.day === "Fri"));
};

const requiredYear = (name) => requiredYearByCourse.get(normalizeCourseName(name)) || Number.POSITIVE_INFINITY;

const buildRequiredYearMap = (requirements) => {
  const next = new Map();
  const tracks = Array.isArray(requirements?.tracks) ? requirements.tracks : [];
  const byTrack = requirements?.requirements && typeof requirements.requirements === "object" ? requirements.requirements : {};

  for (const track of tracks) {
    const yearGroups = byTrack[track] && typeof byTrack[track] === "object" ? byTrack[track] : {};
    for (const [year, courses] of Object.entries(yearGroups)) {
      const numericYear = Number(year);
      if (!Number.isFinite(numericYear)) continue;
      for (const course of Array.isArray(courses) ? courses : []) {
        const key = normalizeCourseName(course);
        if (!key) continue;
        next.set(key, Math.min(next.get(key) || Number.POSITIVE_INFINITY, numericYear));
      }
    }
  }

  return next;
};

const criterionCompare = (left, right, key) => {
  if (key === "year") {
    const leftYear = requiredYear(left.name);
    const rightYear = requiredYear(right.name);
    if (leftYear === rightYear) return 0;
    return leftYear - rightYear;
  }

  if (key === "korean") {
    return left.name.localeCompare(right.name, "ko", { numeric: true, sensitivity: "base" });
  }

  if (key === "fridayOff") {
    return Number(hasFridayFreeOption(right.name)) - Number(hasFridayFreeOption(left.name));
  }

  return 0;
};

const sortGroups = () => {
  const groups = Array.from(document.querySelectorAll(COURSE_GROUP_SELECTOR));
  if (!groups.length) return;

  const parent = groups[0].parentElement;
  parent?.classList.add("ags-sort-priority-list");

  const order = readSortOrder();
  const decorated = groups.map((group, index) => ({
    group,
    index,
    name: courseNameFromGroup(group),
  }));

  decorated.sort((left, right) => {
    for (const key of order) {
      const result = criterionCompare(left, right, key);
      if (result !== 0) return result;
    }
    return left.index - right.index;
  });

  decorated.forEach((entry, index) => {
    entry.group.style.order = String(index);
  });
};

const oldAlphabeticalControl = (footer) => {
  return Array.from(footer.querySelectorAll("label")).find((label) => {
    const text = normalizeText(label.textContent);
    return /가나다|alphabet/i.test(text);
  });
};

const setButtonPosition = (order, key, direction) => {
  const index = order.indexOf(key);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return order;
  const next = [...order];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
};

const renderSortControl = (control) => {
  const order = readSortOrder();
  control.querySelectorAll(".ags-sort-chip").forEach((chip) => chip.remove());

  const chips = document.createElement("div");
  chips.className = "ags-sort-chips";

  for (const [index, key] of order.entries()) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.draggable = true;
    chip.className = "ags-sort-chip";
    chip.dataset.agsSortKey = key;
    chip.title = `${index + 1}순위: ${CRITERIA[key].label}`;
    chip.innerHTML = `<span class="ags-sort-rank">${index + 1}</span><span>${CRITERIA[key].shortLabel}</span>`;

    chip.addEventListener("dragstart", (event) => {
      dragKey = key;
      event.dataTransfer?.setData("text/plain", key);
      event.dataTransfer?.setDragImage?.(chip, 12, 12);
      chip.classList.add("ags-sort-chip-dragging");
    });

    chip.addEventListener("dragend", () => {
      dragKey = null;
      chip.classList.remove("ags-sort-chip-dragging");
    });

    chip.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    chip.addEventListener("drop", (event) => {
      event.preventDefault();
      const sourceKey = event.dataTransfer?.getData("text/plain") || dragKey;
      if (!sourceKey || sourceKey === key) return;
      const next = readSortOrder().filter((item) => item !== sourceKey);
      next.splice(next.indexOf(key), 0, sourceKey);
      saveSortOrder(next);
      renderSortControl(control);
      scheduleSortSync();
    });

    chip.addEventListener("click", (event) => {
      if (event.altKey || event.shiftKey) {
        saveSortOrder(setButtonPosition(readSortOrder(), key, event.shiftKey ? -1 : 1));
        renderSortControl(control);
        scheduleSortSync();
      }
    });

    chips.appendChild(chip);
  }

  control.appendChild(chips);
};

const ensureSortControl = () => {
  const footer = document.querySelector(".ags-app-footer");
  if (!footer || !document.querySelector(".ags-lecture-main")) return;

  oldAlphabeticalControl(footer)?.classList.add("ags-sort-hidden-old-control");

  let control = footer.querySelector(":scope > .ags-sort-priority-control");
  if (!control) {
    control = document.createElement("div");
    control.className = "ags-sort-priority-control";
    control.setAttribute("aria-label", "강의 정렬 우선순위");
    const label = document.createElement("span");
    label.className = "ags-sort-label";
    label.textContent = "정렬";
    control.appendChild(label);
    footer.insertBefore(control, footer.querySelector(".ags-bottom-selection-summary")?.nextSibling || footer.children[1] || null);
    renderSortControl(control);
  }
};

const scheduleSortSync = () => {
  if (syncScheduled) return;
  syncScheduled = true;
  requestAnimationFrame(() => {
    syncScheduled = false;
    ensureSortControl();
    sortGroups();
  });
};

new MutationObserver(scheduleSortSync).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class"],
});

window.addEventListener("load", scheduleSortSync);
window.addEventListener("resize", scheduleSortSync);
window.addEventListener("storage", (event) => {
  if (event.key === SORT_ORDER_KEY) scheduleSortSync();
});

Promise.all([
  fetch(LECTURES_URL).then((response) => response.json()),
  fetch(REQUIREMENTS_URL).then((response) => response.json()),
])
  .then(([lectures, requirements]) => {
    const byName = new Map();
    for (const lecture of lectures) {
      const name = normalizeText(lecture.name);
      if (!name) continue;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(lecture);
    }
    lecturesByName = byName;
    requiredYearByCourse = buildRequiredYearMap(requirements);
  })
  .catch(() => {
    lecturesByName = new Map();
    requiredYearByCourse = new Map();
  })
  .finally(() => {
    saveSortOrder(readSortOrder());
    scheduleSortSync();
  });
