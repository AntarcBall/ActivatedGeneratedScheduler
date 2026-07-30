const BASE_PATH = "/ActivatedGeneratedScheduler/";

let routeDirectory = null;
let routeDirectoryPromise = null;
let routeLinkSyncScheduled = false;

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const baseUrl = () => {
  const path = BASE_PATH.endsWith("/") ? BASE_PATH : `${BASE_PATH}/`;
  return `${window.location.origin}${path}`;
};

const routeHref = (kind, value) => `${baseUrl()}#/${kind}/${encodeURIComponent(value)}`;

const professorNames = (value) => normalizeText(value)
  .split(",")
  .map((name) => normalizeText(name))
  .filter(Boolean)
  .filter((name) => !/^(미배정|unassigned)$/i.test(name));

const readMainBundleUrl = () => {
  const script = Array.from(document.scripts).find((item) => /\/assets\/index-[^/]+\.js$/.test(item.src));
  return script?.src || `${baseUrl()}assets/index-BOaucdDA.js`;
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((csvRow) => csvRow.some((cell) => normalizeText(cell)));
};

const unescapeTemplateCsv = (value) => value
  .replace(/\\uFEFF/g, "\ufeff")
  .replace(/\\r/g, "\r")
  .replace(/\\n/g, "\n")
  .replace(/\\`/g, "`")
  .replace(/\\\\/g, "\\");

const topBySessions = (items) => Array.from(items.values())
  .sort((left, right) => right.sessionCount - left.sessionCount
    || right.courseCount - left.courseCount
    || left.name.localeCompare(right.name))[0] || null;

const loadDefaultProfessor = async (language) => {
  const lectures = await fetch(`${baseUrl()}${language === "en" ? "lectures_eng.json" : "lectures.json"}`).then((response) => response.json());
  const stats = new Map();

  for (const lecture of lectures) {
    const names = Array.isArray(lecture.professors) && lecture.professors.length
      ? lecture.professors.map(normalizeText).filter(Boolean)
      : professorNames(lecture.prof);
    for (const name of names) {
      const existing = stats.get(name) || { name, courseKeys: new Set(), sessionCount: 0 };
      existing.courseKeys.add(`${lecture.course_number || lecture.name}-${lecture.section}`);
      existing.sessionCount += Math.max((lecture.time_slots || []).length, 1);
      stats.set(name, existing);
    }
  }

  for (const entry of stats.values()) entry.courseCount = entry.courseKeys.size;
  return topBySessions(stats);
};

const loadDefaultRoom = async () => {
  const source = await fetch(readMainBundleUrl()).then((response) => response.text());
  const courseMatch = source.match(/Vh=`([\s\S]*?)`,Kh=/);
  const demandMatch = source.match(/Kh=`([\s\S]*?)`,yi=/);
  if (!courseMatch || !demandMatch) return null;

  const rows = parseCsv(unescapeTemplateCsv(courseMatch[1]).replace(/^\ufeff/, ""));
  const demandRows = parseCsv(unescapeTemplateCsv(demandMatch[1]).replace(/^\ufeff/, ""));
  const header = rows[0]?.map((cell) => normalizeText(cell)) || [];
  const demandHeader = demandRows[0]?.map((cell) => normalizeText(cell)) || [];
  const roomIndex = header.indexOf("Day/Time/Class Room");
  const codeIndex = header.indexOf("Course Number");
  const sectionIndex = header.indexOf("Section");
  const demandCodeIndex = demandHeader.indexOf("과목코드");
  const demandSectionIndex = demandHeader.indexOf("분반");
  if (roomIndex === -1) return null;
  if (demandCodeIndex === -1 || demandSectionIndex === -1) return null;

  const demandKeys = new Set(demandRows.slice(1)
    .map((row) => `${row[demandCodeIndex] || ""}-${row[demandSectionIndex] || ""}`));

  const roomStats = new Map();
  const sessionPattern = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\d{2}:\d{2}-\d{2}:\d{2}\(([^)]+)\)/g;

  for (const row of rows.slice(1)) {
    const courseKey = `${row[codeIndex] || ""}-${row[sectionIndex] || ""}`;
    if (!demandKeys.has(courseKey)) continue;
    for (const matchItem of String(row[roomIndex] || "").matchAll(sessionPattern)) {
      if (!["Mon", "Tue", "Wed", "Thu", "Fri"].includes(matchItem[1])) continue;
      const name = normalizeText(matchItem[2]);
      if (!name) continue;
      const existing = roomStats.get(name) || { name, courseKeys: new Set(), sessionCount: 0 };
      existing.courseKeys.add(courseKey);
      existing.sessionCount += 1;
      roomStats.set(name, existing);
    }
  }

  for (const entry of roomStats.values()) entry.courseCount = entry.courseKeys.size;
  return topBySessions(roomStats);
};

const loadRouteDirectory = () => {
  if (routeDirectory) return Promise.resolve(routeDirectory);
  if (!routeDirectoryPromise) {
    routeDirectoryPromise = Promise.all([loadDefaultProfessor("ko"), loadDefaultProfessor("en"), loadDefaultRoom()])
      .then(([professorKo, professorEn, room]) => {
        routeDirectory = { professorKo, professorEn, room };
        return routeDirectory;
      })
      .catch((error) => {
        console.error("Failed to load AGS route directory:", error);
        return { professorKo: null, professorEn: null, room: null };
      });
  }
  return routeDirectoryPromise;
};

const hintSpanFor = (link) => link.querySelector("span.text-left span:last-child");

const currentLanguage = () => {
  const active = Array.from(document.querySelectorAll("#root button")).find((button) => (
    /^(한국어|English)$/.test(normalizeText(button.textContent))
    && (button.getAttribute("aria-pressed") === "true" || String(button.className).includes("bg-blue-600"))
  ));
  if (normalizeText(active?.textContent) === "English") return "en";
  if (normalizeText(active?.textContent) === "한국어") return "ko";
  return /^Step\s+\d+:\s*(Select|Set|Good|Bad|Schedule|View)/i.test(normalizeText(document.querySelector("#root h2")?.textContent)) ? "en" : "ko";
};

const updateLink = (link, kind, item) => {
  if (!link || !item?.name) return;
  const nextHref = routeHref(kind, item.name);
  if (link.href !== nextHref) link.href = nextHref;
  const hint = hintSpanFor(link);
  if (!hint) return;
  const isKorean = currentLanguage() === "ko";
  const countLabel = isKorean ? `${item.courseCount}과목 · ${item.sessionCount}회` : `${item.courseCount} courses · ${item.sessionCount} sessions`;
  const nextText = kind === "professor"
    ? `${item.name} · ${countLabel}`
    : `${item.name} · ${countLabel}`;
  if (hint.textContent !== nextText) hint.textContent = nextText;
};

const syncRouteLinks = async () => {
  routeLinkSyncScheduled = false;
  const directory = await loadRouteDirectory();
  const professor = currentLanguage() === "en" ? directory.professorEn : directory.professorKo;
  updateLink(document.querySelector('a[href*="#/professor/"]'), "professor", professor);
  updateLink(document.querySelector('a[href*="#/room/"]'), "room", directory.room);
};

const scheduleRouteLinkSync = () => {
  if (routeLinkSyncScheduled) return;
  routeLinkSyncScheduled = true;
  requestAnimationFrame(syncRouteLinks);
};

const redirectLegacyProfessorRoute = async () => {
  const route = decodeURIComponent(window.location.hash.replace(/^#\/?/, ""));
  const lowerRoute = route.toLowerCase();
  if (lowerRoute !== "professor/kim-sohee" && route !== "professor/김소희") return;
  const directory = await loadRouteDirectory();
  const professor = currentLanguage() === "en" ? directory.professorEn : directory.professorKo;
  if (professor?.name) window.location.replace(routeHref("professor", professor.name));
};

new MutationObserver(scheduleRouteLinkSync).observe(document.body, { childList: true, subtree: true });
window.addEventListener("load", scheduleRouteLinkSync);
scheduleRouteLinkSync();
void redirectLegacyProfessorRoute();
