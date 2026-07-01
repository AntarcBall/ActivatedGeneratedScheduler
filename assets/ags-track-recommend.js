const PROFILE_KEY = "ags_track_profile";
const REQUIREMENTS_URL = "/ActivatedGeneratedScheduler/assets/ags-track-requirements.json";
const SPECIAL_ROUTE = /^#\/(?:professor|room)\//i;

let requirements = null;
let profilePage = null;
let profileTrigger = null;

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

const readProfile = () => {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!["1", "2", "3", "4"].includes(String(parsed.year))) return null;
    const tracks = Array.isArray(parsed.tracks) ? parsed.tracks.filter((track) => requirements?.tracks.includes(track)) : [];
    return tracks.length ? { year: String(parsed.year), tracks: tracks.slice(0, 2) } : null;
  } catch {
    return null;
  }
};

const writeProfile = (profile) => {
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  window.sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

const isSpecialRoute = () => SPECIAL_ROUTE.test(window.location.hash);

const requirementsFor = (track, year) => {
  return requirements?.requirements?.[track]?.[year] || [];
};

const matchedTracksForCourse = (courseName, profile) => {
  if (!requirements || !profile) return [];
  const key = normalizeCourseName(courseName);
  return profile.tracks.filter((track) => requirementsFor(track, profile.year)
    .some((course) => normalizeCourseName(course) === key));
};

const requirementEntriesForCourse = (courseName, profile) => {
  if (!requirements || !profile) return [];
  const key = normalizeCourseName(courseName);
  const entries = [];
  for (const track of profile.tracks) {
    for (const year of requirements.years || []) {
      if (requirementsFor(track, year).some((course) => normalizeCourseName(course) === key)) {
        entries.push({ track, year });
      }
    }
  }
  return entries;
};

const unique = (items) => Array.from(new Set(items));

const yearLabelFor = (entries) => {
  const years = unique(entries.map((entry) => entry.year)).sort((left, right) => Number(left) - Number(right));
  return years.map((year) => `${year}학년`).join(", ");
};

const stepOneMain = () => document.querySelector(".ags-lecture-main");

const clearRecommendations = () => {
  document.querySelectorAll(".ags-track-year-known, .ags-track-recommended, .ags-track-recommended-strong").forEach((group) => {
    group.classList.remove("ags-track-year-known", "ags-track-recommended", "ags-track-recommended-strong");
    group.removeAttribute("data-ags-track-label");
  });
  document.querySelectorAll(".ags-track-card-recommended, .ags-track-card-recommended-strong").forEach((card) => {
    card.classList.remove("ags-track-card-recommended", "ags-track-card-recommended-strong");
  });
};

const syncRecommendations = () => {
  const profile = readProfile();
  const main = stepOneMain();
  if (!main || !profile) {
    clearRecommendations();
    return;
  }

  for (const group of main.querySelectorAll('[class~="group/item"]')) {
    const name = normalizeText(group.querySelector("h4")?.textContent);
    const entries = requirementEntriesForCourse(name, profile);
    const matches = matchedTracksForCourse(name, profile);
    const strong = matches.length > 1;
    const yearLabel = yearLabelFor(entries);

    group.classList.toggle("ags-track-year-known", entries.length > 0);
    group.classList.toggle("ags-track-recommended", matches.length > 0);
    group.classList.toggle("ags-track-recommended-strong", strong);
    if (entries.length) {
      const requirementLabel = matches.length ? (strong ? `공통 필수: ${matches.join(", ")}` : `필수: ${matches[0]}`) : "";
      const label = [yearLabel, requirementLabel].filter(Boolean).join(" · ");
      if (group.getAttribute("data-ags-track-label") !== label) group.setAttribute("data-ags-track-label", label);
    } else {
      group.removeAttribute("data-ags-track-label");
    }

    group.querySelectorAll(".cursor-pointer").forEach((card) => {
      card.classList.toggle("ags-track-card-recommended", matches.length > 0);
      card.classList.toggle("ags-track-card-recommended-strong", strong);
    });
  }
};

const selectedTrackButtons = (root) => {
  return Array.from(root.querySelectorAll("[data-track].ags-track-choice-selected"))
    .map((button) => button.getAttribute("data-track"))
    .filter(Boolean);
};

const updateProfileSubmit = () => {
  if (!profilePage) return;
  const year = profilePage.querySelector("[data-year].ags-track-choice-selected")?.getAttribute("data-year");
  const tracks = selectedTrackButtons(profilePage);
  const submit = profilePage.querySelector(".ags-track-profile-submit");
  if (submit) {
    const disabled = !year || tracks.length === 0;
    if (submit.disabled !== disabled) submit.disabled = disabled;
  }
  profilePage.querySelectorAll("[data-track]").forEach((button) => {
    const disabled = tracks.length >= 2 && !button.classList.contains("ags-track-choice-selected");
    if (button.disabled !== disabled) button.disabled = disabled;
  });
};

const profileMarkup = () => {
  const profile = readProfile();
  const years = requirements?.years || ["1", "2", "3", "4"];
  const tracks = requirements?.tracks || [];
  return `
    <div class="ags-track-profile-panel">
      <div class="ags-track-profile-head">
        <p class="ags-track-profile-kicker">Track Recommendation</p>
        <h1>학년과 전공 트랙 선택</h1>
      </div>
      <div class="ags-track-profile-section">
        <p class="ags-track-profile-label">현재 학년</p>
        <div class="ags-track-choice-grid ags-track-year-grid">
          ${years.map((year) => `<button type="button" data-year="${year}" class="ags-track-choice ${profile?.year === year ? "ags-track-choice-selected" : ""}">${year}학년</button>`).join("")}
        </div>
      </div>
      <div class="ags-track-profile-section">
        <p class="ags-track-profile-label">전공 트랙 <span>최대 2개</span></p>
        <div class="ags-track-choice-grid ags-track-major-grid">
          ${tracks.map((track) => `<button type="button" data-track="${track}" class="ags-track-choice ${profile?.tracks.includes(track) ? "ags-track-choice-selected" : ""}">${track}</button>`).join("")}
        </div>
      </div>
      <div class="ags-track-profile-actions">
        <button type="button" class="ags-track-profile-submit">저장하고 시작</button>
      </div>
    </div>
  `;
};

const showProfilePage = () => {
  if (!requirements || isSpecialRoute()) return;
  if (profilePage) {
    updateProfileSubmit();
    return;
  }
  profilePage?.remove();
  profilePage = document.createElement("section");
  profilePage.className = "ags-track-profile-page";
  profilePage.innerHTML = profileMarkup();
  document.body.appendChild(profilePage);

  profilePage.addEventListener("click", (event) => {
    const yearButton = event.target.closest?.("[data-year]");
    if (yearButton) {
      profilePage.querySelectorAll("[data-year]").forEach((button) => button.classList.remove("ags-track-choice-selected"));
      yearButton.classList.add("ags-track-choice-selected");
      updateProfileSubmit();
      return;
    }

    const trackButton = event.target.closest?.("[data-track]");
    if (trackButton) {
      const selected = trackButton.classList.contains("ags-track-choice-selected");
      if (selected) {
        trackButton.classList.remove("ags-track-choice-selected");
      } else if (selectedTrackButtons(profilePage).length < 2) {
        trackButton.classList.add("ags-track-choice-selected");
      }
      updateProfileSubmit();
      return;
    }

    if (event.target.closest?.(".ags-track-profile-submit")) {
      const year = profilePage.querySelector("[data-year].ags-track-choice-selected")?.getAttribute("data-year");
      const tracks = selectedTrackButtons(profilePage);
      if (!year || !tracks.length) return;
      writeProfile({ year, tracks });
      profilePage.remove();
      profilePage = null;
      syncProfileTrigger();
      syncRecommendations();
    }
  });

  updateProfileSubmit();
};

const syncProfileTrigger = () => {
  if (isSpecialRoute() || !stepOneMain()) {
    profilePage?.remove();
    profilePage = null;
    profileTrigger?.remove();
    profileTrigger = null;
    return;
  }
  const profile = readProfile();
  if (!profile) {
    profileTrigger?.remove();
    profileTrigger = null;
    if (!profilePage) showProfilePage();
    return;
  }
  if (!profileTrigger) {
    profileTrigger = document.createElement("button");
    profileTrigger.type = "button";
    profileTrigger.className = "ags-track-profile-trigger";
    profileTrigger.addEventListener("click", showProfilePage);
    document.body.appendChild(profileTrigger);
  }
  const label = `${profile.year}학년 · ${profile.tracks.join(" / ")}`;
  if (profileTrigger.textContent !== label) profileTrigger.textContent = label;
};

const start = async () => {
  try {
    requirements = await fetch(REQUIREMENTS_URL).then((response) => response.json());
  } catch (error) {
    console.error("Failed to load AGS track requirements:", error);
    return;
  }
  syncProfileTrigger();
  syncRecommendations();
};

new MutationObserver(() => {
  syncProfileTrigger();
  syncRecommendations();
}).observe(document.body, { childList: true, subtree: true });

window.addEventListener("hashchange", () => {
  syncProfileTrigger();
  syncRecommendations();
});

start();
