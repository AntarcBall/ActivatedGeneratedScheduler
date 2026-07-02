const FRIDAY_COURSE_ROW_SELECTOR = ".ags-lecture-main [class~='group/item']";
const FRIDAY_LECTURES_URL = "/ActivatedGeneratedScheduler/lectures.json";

let fridayCourseNames = new Set();
let fridaySyncScheduled = false;
let fridayDataReady = false;

const normalizeFridayText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const fridayCourseName = (group) => normalizeFridayText(group?.querySelector(":scope > button h4")?.textContent);

const hasFridaySlot = (lecture) => {
  return (lecture.time_slots || []).some((slot) => slot.day === "금" || String(slot.day).toLowerCase() === "fri");
};

const ensureFridayLabel = (group, enabled) => {
  let label = group.querySelector(":scope > .ags-friday-course-label");
  if (!enabled) {
    label?.remove();
    return;
  }
  if (!label) {
    label = document.createElement("span");
    label.className = "ags-friday-course-label";
    label.textContent = "[금]";
    group.appendChild(label);
  }
};

const compareRows = (left, right) => {
  const leftFriday = left.dataset.agsHasFriday === "1";
  const rightFriday = right.dataset.agsHasFriday === "1";
  if (leftFriday !== rightFriday) return Number(leftFriday) - Number(rightFriday);
  return fridayCourseName(left).localeCompare(fridayCourseName(right), "ko");
};

const syncFridayRows = () => {
  fridaySyncScheduled = false;
  if (!fridayDataReady) return;

  const rows = Array.from(document.querySelectorAll(FRIDAY_COURSE_ROW_SELECTOR));
  for (const row of rows) {
    const isFriday = fridayCourseNames.has(fridayCourseName(row));
    row.dataset.agsHasFriday = isFriday ? "1" : "0";
    row.classList.toggle("ags-friday-course", isFriday);
    ensureFridayLabel(row, isFriday);
  }

  const parents = Array.from(new Set(rows.map((row) => row.parentElement).filter(Boolean)));
  for (const parent of parents) {
    const childRows = Array.from(parent.children).filter((child) => child.matches?.(FRIDAY_COURSE_ROW_SELECTOR));
    const sortedRows = [...childRows].sort(compareRows);
    const signature = sortedRows.map((row) => `${row.dataset.agsHasFriday}:${fridayCourseName(row)}`).join("|");
    if (parent.dataset.agsFridayOrderSignature === signature) continue;
    parent.dataset.agsFridayOrderSignature = signature;
    for (const row of sortedRows) parent.appendChild(row);
  }
};

const scheduleFridaySync = () => {
  if (fridaySyncScheduled) return;
  fridaySyncScheduled = true;
  requestAnimationFrame(syncFridayRows);
};

const initFridayRows = async () => {
  try {
    const lectures = await fetch(FRIDAY_LECTURES_URL, { cache: "no-cache" }).then((response) => response.json());
    fridayCourseNames = new Set(
      lectures
        .filter(hasFridaySlot)
        .map((lecture) => normalizeFridayText(lecture.name))
        .filter(Boolean),
    );
    fridayDataReady = true;
    scheduleFridaySync();
  } catch (error) {
    console.warn("AGS Friday course ordering unavailable", error);
  }
};

new MutationObserver(scheduleFridaySync).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class"],
});

window.addEventListener("load", scheduleFridaySync);
void initFridayRows();
