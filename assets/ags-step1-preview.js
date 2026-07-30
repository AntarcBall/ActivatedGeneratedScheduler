const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_LABELS = { "월": "Mon", "화": "Tue", "수": "Wed", "목": "Thu", "금": "Fri" };
const EXCLUDED = /URGP|UGRP|URP|인턴|Internship/i;

let lectures = [];
let lectureSets = { ko: [], en: [] };
let activeLanguage = "";
let activeLecture = null;
let selectedLectures = [];
let pinnedLectures = [];
let renderedLectureKey = "";
let renderedAvailabilityKey = "";
let warningTimer = null;
let mutationSyncScheduled = false;

const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
const GROUP_SELECTOR = '[class~="group/item"]';
const currentLanguage = () => {
  const heading = normalize(document.querySelector("#root h2")?.textContent);
  if (/^Step\s+\d+:\s*(Select|Set|Good|Bad|Schedule|View)/i.test(heading)) return "en";
  if (/^Step\s+\d+:\s*(강의|선호|희망|기피|가중치|결과)/.test(heading)) return "ko";
  try {
    return window.localStorage.getItem("ags_language") === "en" ? "en" : "ko";
  } catch {
    return "ko";
  }
};

const slotLabel = (index) => {
  const hour = 9 + Math.floor(index / 2);
  return `${hour}:${index % 2 === 0 ? "00" : "30"}`;
};

const normalizeLecture = (lecture) => ({
  id: lecture.id,
  course_number: lecture.course_number,
  section: String(lecture.section),
  name: lecture.name,
  prof: lecture.prof,
  credit: lecture.credit || 0,
  time_slots: (lecture.time_slots || []).map((slot) => ({
    day: DAY_LABELS[String(slot.day || "").trim()] || slot.day,
    start_index: slot.start_index - 1,
    end_index: slot.end_index - 1,
  })),
});

const loadLectures = async () => {
  const [ko, en] = await Promise.all([
    fetch("/ActivatedGeneratedScheduler/lectures.json").then((res) => res.json()),
    fetch("/ActivatedGeneratedScheduler/lectures_eng.json").then((res) => res.json()),
  ]);
  lectureSets = Object.fromEntries(Object.entries({ ko, en }).map(([language, items]) => [
    language,
    items
      .filter((lecture) => !EXCLUDED.test([lecture.course_number, lecture.name, lecture.category].filter(Boolean).join(" ")))
      .map(normalizeLecture),
  ]));
  syncLectureLanguage();
};

const syncLectureLanguage = () => {
  const language = currentLanguage();
  if (activeLanguage === language && lectures === lectureSets[language]) return false;
  activeLanguage = language;
  lectures = lectureSets[language] || [];
  activeLecture = null;
  selectedLectures = [];
  pinnedLectures = [];
  renderedLectureKey = "";
  renderedAvailabilityKey = "";
  return true;
};

const currentMain = () => document.querySelector(".ags-lecture-main");

const ensurePreview = () => {
  const main = currentMain();
  if (!main) return null;
  let preview = main.querySelector(".ags-lecture-preview");
  if (!preview) {
    preview = document.createElement("aside");
    preview.className = "ags-lecture-preview";
    main.appendChild(preview);
  }
  return preview;
};

const lectureKey = (lecture) => `${lecture.id}:${lecture.course_number}:${lecture.section}`;
const selectionKey = (lecture) => lecture.course_number ? `${lecture.course_number}#${lecture.section}` : `id:${lecture.id}`;
const courseKey = (lecture) => lecture.course_number || normalize(lecture.name);

const uniqueLectures = (items) => {
  const seen = new Set();
  const result = [];
  for (const lecture of items) {
    if (!lecture) continue;
    const key = lectureKey(lecture);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(lecture);
  }
  return result;
};

const conflictSlots = (items) => {
  const slots = new Map();
  for (const item of items) {
    for (const slot of item.lecture.time_slots) {
      for (let i = slot.start_index; i <= slot.end_index; i += 1) {
        const key = `${slot.day}-${i}`;
        if (!slots.has(key)) slots.set(key, []);
        slots.get(key).push(item);
      }
    }
  }
  return new Set(
    Array.from(slots)
      .filter(([, slotItems]) => new Set(slotItems.map((item) => item.lecture.name)).size > 1)
      .map(([key]) => key)
  );
};

const lecturesOverlap = (left, right) => {
  if (!left || !right) return false;
  for (const leftSlot of left.time_slots) {
    for (const rightSlot of right.time_slots) {
      if (leftSlot.day !== rightSlot.day) continue;
      if (leftSlot.start_index <= rightSlot.end_index && rightSlot.start_index <= leftSlot.end_index) {
        return true;
      }
    }
  }
  return false;
};

const selectedLecturesByCourse = (items = selectedLectures) => {
  const selectedByCourse = new Map();
  for (const lecture of uniqueLectures(items)) {
    const key = courseKey(lecture);
    if (!selectedByCourse.has(key)) selectedByCourse.set(key, []);
    selectedByCourse.get(key).push(lecture);
  }
  return selectedByCourse;
};

const isBlockedBySelectedCourse = (candidate, selectedByCourse) => {
  if (!candidate || !candidate.time_slots.length) return false;
  const candidateCourse = courseKey(candidate);
  for (const [selectedCourse, selectedOptions] of selectedByCourse) {
    if (selectedCourse === candidateCourse || selectedOptions.length === 0) continue;
    if (selectedOptions.every((selected) => lecturesOverlap(candidate, selected))) return true;
  }
  return false;
};

const isSingleSectionLecture = (lecture) => {
  return !!lecture && lectures.filter((candidate) => candidate.name === lecture.name).length === 1;
};

const displayLectures = () => {
  const selected = [];
  const fixedLectures = uniqueLectures(pinnedLectures);
  for (const lecture of fixedLectures) selected.push({ lecture, kind: "pinned" });
  if (isSingleSectionLecture(activeLecture) && !fixedLectures.some((lecture) => lectureKey(lecture) === lectureKey(activeLecture))) {
    selected.push({ lecture: activeLecture, kind: "active" });
  }
  return selected;
};

const storedSelectionKeys = () => {
  const keys = [];
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = storage.getItem("ags_selected_lecture_keys");
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) keys.push(...parsed.filter((item) => typeof item === "string"));
    } catch {
      // Ignore malformed or inaccessible storage.
    }
  }
  return Array.from(new Set(keys));
};

const writeSelectionKeys = (keys) => {
  const uniqueKeys = Array.from(new Set(keys));
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      if (uniqueKeys.length) storage.setItem("ags_selected_lecture_keys", JSON.stringify(uniqueKeys));
      else storage.removeItem("ags_selected_lecture_keys");
    } catch {
      // Ignore malformed or inaccessible storage.
    }
  }
  return uniqueKeys;
};

const removeStoredSelectionKey = (key) => {
  return writeSelectionKeys(storedSelectionKeys().filter((item) => item !== key));
};

const lecturesFromSelectionKeys = (keys) => {
  const keySet = new Set(keys);
  return lectures.filter((lecture) => keySet.has(selectionKey(lecture)));
};

const singleSectionLectures = (items) => {
  return items.filter(isSingleSectionLecture);
};

const renderPreview = () => {
  const preview = ensurePreview();
  if (!preview) return;
  const selected = displayLectures();
  const selectedForConflicts = uniqueLectures(selected.map(({ lecture }) => lecture));
  const conflicts = conflictSlots(selectedForConflicts.map((lecture) => ({ lecture, kind: "selected" })));
  const nextKey = selected.map(({ lecture, kind }) => `${kind}:${lectureKey(lecture)}`).join("|") || "empty";
  const conflictKey = [
    Array.from(conflicts).sort().join(","),
    selectedForConflicts.map(lectureKey).sort().join("|"),
  ].join(":");
  if (!preview.hidden && renderedLectureKey === `${nextKey}:${conflictKey}`) return;
  renderedLectureKey = `${nextKey}:${conflictKey}`;
  preview.hidden = false;

  const occupied = new Map();
  const starts = new Map();
  for (const item of selected) {
    const { lecture } = item;
    for (const slot of lecture.time_slots) {
      const startKey = `${slot.day}-${slot.start_index}`;
      if (!starts.has(startKey)) starts.set(startKey, []);
      starts.get(startKey).push(item);
      for (let i = slot.start_index; i <= slot.end_index; i += 1) {
        const key = `${slot.day}-${i}`;
        if (!occupied.has(key)) occupied.set(key, []);
        occupied.get(key).push(item);
      }
    }
  }

  preview.innerHTML = `
    <div class="ags-preview-grid">
      <div class="ags-preview-cell ags-preview-header"></div>
      ${DAYS.map((day) => `<div class="ags-preview-cell ags-preview-header">${day}</div>`).join("")}
      ${Array.from({ length: 24 }).map((_, index) => `
        <div class="ags-preview-cell ags-preview-time">${slotLabel(index)}</div>
        ${DAYS.map((day) => {
          const key = `${day}-${index}`;
          const cellItems = occupied.get(key) || [];
          const startItems = starts.get(key) || [];
          const classes = [
            "ags-preview-cell",
            cellItems.length ? "ags-preview-busy" : "",
            cellItems.some((item) => item.kind === "pinned") ? "ags-preview-pinned" : "",
            cellItems.some((item) => item.kind === "active") ? "ags-preview-active" : "",
            cellItems.length > 1 ? "ags-preview-overlap" : "",
            conflicts.has(key) ? "ags-preview-conflict" : "",
          ].filter(Boolean).join(" ");
          return `<div class="${classes}">${startItems.map(({ lecture, kind }) => `<span class="ags-preview-label-${kind}">${lecture.name}</span>`).join("")}</div>`;
        }).join("")}
      `).join("")}
    </div>
  `;
};

const lectureFromCard = (card) => {
  const group = card.closest(GROUP_SELECTOR);
  const name = normalize(group?.querySelector("h4")?.textContent);
  const section = normalize(card.querySelector("span")?.textContent).replace(/^S/i, "");
  const prof = normalize(card.querySelector("p")?.textContent);
  return lectures.find((lecture) =>
    normalize(lecture.name) === name &&
    String(lecture.section) === section &&
    normalize(lecture.prof) === prof
  ) || null;
};

const lectureFromGroup = (group) => {
  const name = normalize(group?.querySelector("h4")?.textContent);
  const matches = lectures.filter((lecture) => normalize(lecture.name) === name);
  return matches.length === 1 ? matches[0] : null;
};

const targetCard = (eventTarget) => eventTarget.closest?.(".ags-lecture-main .cursor-pointer");

const targetSelectedBadge = (eventTarget) => {
  const badge = eventTarget.closest?.(".ags-lecture-sidebar span");
  if (!badge || !/^S\d+/i.test(normalize(badge.textContent))) return null;
  const badgeList = badge.parentElement;
  const row = badgeList?.parentElement;
  if (!badgeList?.classList?.contains("flex-wrap") || !row?.closest?.(".ags-lecture-sidebar")) return null;
  return badge;
};

const lectureFromSelectedBadge = (badge) => {
  const row = badge?.parentElement?.parentElement;
  const name = normalize(row?.querySelector("p")?.textContent);
  const section = normalize(badge?.textContent).replace(/^S/i, "");
  return lectures.find((lecture) => normalize(lecture.name) === name && String(lecture.section) === section) || null;
};

const visibleSelectedCardForLecture = (lecture) => {
  const main = currentMain();
  if (!main || !lecture) return null;
  const key = selectionKey(lecture);
  return Array.from(main.querySelectorAll(".cursor-pointer")).find((card) => {
    const cardLecture = lectureFromCard(card);
    return cardLecture && selectionKey(cardLecture) === key && isSelected(card);
  }) || null;
};

const targetGroupButton = (eventTarget) => {
  const button = eventTarget.closest?.(".ags-lecture-main button");
  return button?.closest(GROUP_SELECTOR) ? button : null;
};

const lectureFromTarget = (eventTarget) => {
  const card = targetCard(eventTarget);
  if (card) return lectureFromCard(card);
  const button = targetGroupButton(eventTarget);
  return button ? lectureFromGroup(button.closest(GROUP_SELECTOR)) : null;
};

const groupSectionCount = (card) => card.closest(GROUP_SELECTOR)?.querySelectorAll(".cursor-pointer").length || 0;

const isSelected = (card) => card.className.includes("border-blue-600");

const setSelectedLecture = (lecture, selected) => {
  if (!lecture) return;
  const key = lectureKey(lecture);
  selectedLectures = selected
    ? uniqueLectures([...selectedLectures, lecture])
    : selectedLectures.filter((item) => lectureKey(item) !== key);
};

const setPinnedLecture = (lecture, selected) => {
  if (!lecture) return;
  const key = lectureKey(lecture);
  pinnedLectures = selected
    ? [...pinnedLectures.filter((item) => lectureKey(item) !== key), lecture]
    : pinnedLectures.filter((item) => lectureKey(item) !== key);
};

const sameLectureSet = (left, right) => {
  const leftKeys = left.map(lectureKey).sort().join("|");
  const rightKeys = right.map(lectureKey).sort().join("|");
  return leftKeys === rightKeys;
};

const syncConflictAvailability = () => {
  const main = currentMain();
  if (!main) {
    renderedAvailabilityKey = "";
    return;
  }

  const cards = Array.from(main.querySelectorAll(".cursor-pointer"));
  const cardEntries = cards.map((card) => ({ card, lecture: lectureFromCard(card) })).filter((entry) => entry.lecture);
  const groupEntries = Array.from(main.querySelectorAll(GROUP_SELECTOR)).map((group) => ({
    group,
    lecture: lectureFromGroup(group),
  }));
  const selectionSignature = uniqueLectures(selectedLectures).map(selectionKey).sort().join("|");
  const cardSignature = cardEntries.map(({ lecture }) => selectionKey(lecture)).join("|");
  const groupSignature = groupEntries.map(({ group }) => normalize(group.querySelector("h4")?.textContent)).join("|");
  const nextKey = `${selectionSignature}::${cardSignature}::${groupSignature}`;

  const alreadySynced = renderedAvailabilityKey === nextKey &&
    cardEntries.every(({ card }) =>
      card.dataset.agsConflictKey === nextKey &&
      card.classList.contains("ags-step1-conflict-option") === (card.dataset.agsConflictBlocked === "1")
    ) &&
    groupEntries.every(({ group }) =>
      group.dataset.agsConflictKey === nextKey &&
      group.classList.contains("ags-step1-conflict-group") === (group.dataset.agsConflictBlocked === "1")
    );
  if (alreadySynced) return;
  renderedAvailabilityKey = nextKey;

  const selectedByCourse = selectedLecturesByCourse();
  const pinnedByCourse = selectedLecturesByCourse(pinnedLectures);
  const blockedCards = new Set();
  for (const { card, lecture } of cardEntries) {
    const blocked = isBlockedBySelectedCourse(lecture, selectedByCourse);
    card.classList.toggle("ags-step1-conflict-option", blocked);
    card.dataset.agsConflictKey = nextKey;
    card.dataset.agsConflictBlocked = blocked ? "1" : "0";
    if (blocked) blockedCards.add(card);
  }

  for (const { group, lecture } of groupEntries) {
    const groupCards = Array.from(group.querySelectorAll(".cursor-pointer"));
    const cardBlocked = groupCards.length > 0 && groupCards.every((card) => blockedCards.has(card));
    const foldedSingleBlocked = groupCards.length === 0 && isBlockedBySelectedCourse(lecture, pinnedByCourse);
    const blocked = cardBlocked || foldedSingleBlocked;
    group.classList.toggle("ags-step1-conflict-group", blocked);
    group.dataset.agsConflictKey = nextKey;
    group.dataset.agsConflictBlocked = blocked ? "1" : "0";
  }
};

const syncSelectionsFromDom = () => {
  const main = currentMain();
  if (!main) return false;
  const selectedCards = Array.from(main.querySelectorAll(".cursor-pointer")).filter(isSelected);
  const storedSelected = lecturesFromSelectionKeys(storedSelectionKeys());
  const domSelected = selectedCards.map(lectureFromCard);
  const nextSelected = uniqueLectures([...storedSelected, ...domSelected]);
  const nextPinned = uniqueLectures([
    ...singleSectionLectures(storedSelected),
    ...selectedCards
      .filter((card) => groupSectionCount(card) === 1)
      .map(lectureFromCard)
  ]);
  const changed = !sameLectureSet(selectedLectures, nextSelected) || !sameLectureSet(pinnedLectures, nextPinned);
  if (changed) {
    selectedLectures = nextSelected;
    pinnedLectures = nextPinned;
  }
  return changed;
};

const selectedLectureConflicts = () => conflictSlots(uniqueLectures([...pinnedLectures, ...selectedLectures]).map((lecture) => ({ lecture, kind: "selected" })));

const blockingLectureConflicts = () => conflictSlots(pinnedLectures.map((lecture) => ({ lecture, kind: "pinned" })));

const ensureWarning = () => {
  let warning = document.querySelector(".ags-conflict-warning");
  if (!warning) {
    warning = document.createElement("div");
    warning.className = "ags-conflict-warning";
    document.body.appendChild(warning);
  }
  return warning;
};

const showConflictWarning = () => {
  const warning = ensureWarning();
  const heading = normalize(document.querySelector("#root h2")?.textContent);
  const englishButton = Array.from(document.querySelectorAll("#root button")).find((button) => (
    normalize(button.textContent) === "English"
    && (button.getAttribute("aria-pressed") === "true" || String(button.className).includes("bg-blue-600"))
  ));
  const english = Boolean(englishButton) || /^Step\s+1:\s*Select/i.test(heading);
  warning.textContent = english
    ? "Some selected sections overlap. Check the red time slots and resolve the conflicts."
    : "시간이 겹치는 분반이 선택되어 있습니다. 빨간 칸을 확인한 뒤 충돌을 해제하세요.";
  warning.classList.add("ags-conflict-warning-visible");
  clearTimeout(warningTimer);
  warningTimer = setTimeout(() => {
    warning.classList.remove("ags-conflict-warning-visible");
  }, 3600);
};

const isStepOneNextButton = (button) => {
  if (!button || !currentMain()) return false;
  const text = normalize(button.textContent);
  return text === "다음" || text === "Next";
};

const isStepOneResetButton = (button) => {
  if (!button || !currentMain()) return false;
  const text = normalize(button.textContent);
  return text === "초기화" || text === "Reset";
};

const afterReactSelectionUpdate = (callback) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
};

const update = () => {
  renderPreview();
  syncConflictAvailability();
};

document.addEventListener("mouseover", (event) => {
  const lecture = lectureFromTarget(event.target);
  if (!lecture) return;
  activeLecture = lecture;
  update();
});

document.addEventListener("mouseout", (event) => {
  const target = targetCard(event.target) || targetGroupButton(event.target);
  if (!target || target.contains(event.relatedTarget)) return;
  activeLecture = null;
  update();
});

document.addEventListener("click", (event) => {
  const card = event.target.closest?.(".ags-lecture-main .cursor-pointer");
  if (!card) return;
  const lecture = lectureFromCard(card);
  const singleSection = groupSectionCount(card) === 1;
  afterReactSelectionUpdate(() => {
    const selected = isSelected(card);
    setSelectedLecture(lecture, selected);
    if (singleSection) setPinnedLecture(lecture, selected);
    syncSelectionsFromDom();
    update();
  });
});

document.addEventListener("click", (event) => {
  const badge = targetSelectedBadge(event.target);
  if (!badge) return;
  const lecture = lectureFromSelectedBadge(badge);
  if (!lecture) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const key = selectionKey(lecture);
  removeStoredSelectionKey(key);

  const card = visibleSelectedCardForLecture(lecture);
  if (card) {
    card.click();
    return;
  }

  selectedLectures = selectedLectures.filter((item) => selectionKey(item) !== key);
  pinnedLectures = pinnedLectures.filter((item) => selectionKey(item) !== key);
  if (activeLecture && selectionKey(activeLecture) === key) activeLecture = null;
  update();
  window.location.reload();
}, true);

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("button");
  if (!isStepOneNextButton(button)) return;
  if (blockingLectureConflicts().size === 0) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  activeLecture = null;
  update();
  showConflictWarning();
}, true);

document.addEventListener("click", (event) => {
  const button = event.target.closest?.("button");
  if (!isStepOneResetButton(button)) return;
  setTimeout(() => {
    activeLecture = null;
    selectedLectures = [];
    pinnedLectures = [];
    update();
  }, 0);
});

const syncFromMutation = () => {
  mutationSyncScheduled = false;
  const main = currentMain();
  if (!main) {
    activeLecture = null;
    renderedLectureKey = "";
    renderedAvailabilityKey = "";
    return;
  }
  syncLectureLanguage();
  const changed = syncSelectionsFromDom();
  if (!main.querySelector(".ags-lecture-preview") || changed) update();
  else syncConflictAvailability();
};

new MutationObserver((mutations) => {
  if (mutations.every((mutation) => mutation.target.closest?.(".ags-lecture-preview"))) return;
  if (mutationSyncScheduled) return;
  mutationSyncScheduled = true;
  requestAnimationFrame(syncFromMutation);
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

loadLectures()
  .then(() => {
    syncSelectionsFromDom();
    update();
  })
  .catch((error) => console.error("Failed to load AGS preview data:", error));
