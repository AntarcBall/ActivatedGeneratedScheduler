const COURSE_ROW_SELECTOR = ".ags-lecture-main [class~='group/item']";

let rowMetaSyncScheduled = false;

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const readSectionCount = (meta) => {
  const stored = meta?.dataset?.agsSectionCount;
  if (stored) return stored;
  const text = normalizeText(meta?.textContent);
  const match = text.match(/(\d+)\s*Sections?/i) || text.match(/\((\d+)\)/);
  return match ? match[1] : "";
};

const setText = (element, value) => {
  element.textContent = value;
};

const syncCourseRowMeta = () => {
  rowMetaSyncScheduled = false;

  for (const group of document.querySelectorAll(COURSE_ROW_SELECTOR)) {
    const header = group.querySelector(":scope > button");
    const meta = header?.querySelector("p");
    if (!meta) continue;

    const count = readSectionCount(meta);
    if (!count) continue;

    const label = normalizeText(group.getAttribute("data-ags-track-label"));
    const signature = `${count}|${label}`;
    if (meta.dataset.agsMetaSignature === signature) continue;

    meta.dataset.agsSectionCount = count;
    meta.dataset.agsMetaSignature = signature;
    meta.classList.add("ags-course-row-meta");
    meta.textContent = "";

    const labelSpan = document.createElement("span");
    labelSpan.className = "ags-course-row-label";
    setText(labelSpan, label);

    const countSpan = document.createElement("span");
    countSpan.className = "ags-course-row-count";
    setText(countSpan, `(${count})`);

    if (label) meta.append(labelSpan, countSpan);
    else meta.append(countSpan);

    group.classList.toggle("ags-course-row-has-label", Boolean(label));
  }
};

const scheduleCourseRowMetaSync = () => {
  if (rowMetaSyncScheduled) return;
  rowMetaSyncScheduled = true;
  requestAnimationFrame(syncCourseRowMeta);
};

new MutationObserver(scheduleCourseRowMetaSync).observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "data-ags-track-label"],
});

window.addEventListener("load", scheduleCourseRowMetaSync);
scheduleCourseRowMetaSync();
