const DATA_URL = "./assets/ags-usage-analytics.json";

const byId = (id) => document.getElementById(id);
const number = new Intl.NumberFormat("ko-KR");
const percent = (value) => `${Number(value).toFixed(1)}%`;
const seconds = (value) => {
  if (value === null || value === undefined) return "—";
  if (value < 1) return `${Math.max(0.1, value).toFixed(1)}초`;
  return `${value.toFixed(1)}초`;
};

const dateLabel = (value, options = {}) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "short",
  day: "numeric",
  ...options,
}).format(new Date(value));

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const deviceLabels = {
  Windows: "Windows",
  iOS: "iOS",
  Android: "Android",
  macOS: "macOS",
  unknown: "기타",
};

const yearLabel = (value) => value === "unknown" ? "미설정" : `${value}학년`;

const renderOverview = (data) => {
  const { overview, source } = data;
  byId("hero-session-count").textContent = number.format(overview.sessions);
  byId("kpi-sessions").textContent = number.format(overview.sessions);
  byId("kpi-completion").textContent = percent(overview.completionRate);
  byId("kpi-completion-detail").textContent =
    `${overview.completedSessions}/${overview.funnelSessions}개 선택 흐름`;
  byId("kpi-mobile").textContent = percent(overview.mobileShare);
  byId("kpi-mobile-detail").textContent =
    `${overview.mobileSessions}/${overview.detailedSessions}개 상세 세션`;
  byId("kpi-speed").textContent = `${overview.generationMedianMs}ms`;
  byId("usage-period").textContent =
    `${dateLabel(source.periodStart, { year: "numeric" })} — ${dateLabel(source.periodEnd, { year: "numeric" })}`;
  byId("data-through").textContent =
    dateLabel(source.periodEnd, { year: "numeric" });
};

const renderTimeline = (timeline) => {
  const svg = byId("timeline-chart");
  const tooltip = byId("timeline-tooltip");
  const wrap = byId("timeline-wrap");
  const width = 960;
  const height = 300;
  const padding = { top: 22, right: 16, bottom: 45, left: 38 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...timeline.map((item) => item.sessions), 1);
  const roundedMax = Math.ceil(maxValue / 10) * 10;
  const slot = plotWidth / timeline.length;
  const barWidth = Math.max(9, slot * 0.58);

  const grid = [0, 0.5, 1].map((ratio) => {
    const y = padding.top + plotHeight * (1 - ratio);
    return `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"
        stroke="rgba(16,24,32,.12)" stroke-dasharray="3 5" />
      <text x="${padding.left - 9}" y="${y + 4}" text-anchor="end"
        fill="#687582" font-size="10">${Math.round(roundedMax * ratio)}</text>
    `;
  }).join("");

  const bars = timeline.map((item, index) => {
    const x = padding.left + slot * index + (slot - barWidth) / 2;
    const allHeight = plotHeight * item.sessions / roundedMax;
    const detailedHeight = plotHeight * item.detailedSessions / roundedMax;
    const y = padding.top + plotHeight - allHeight;
    const detailedY = padding.top + plotHeight - detailedHeight;
    const showLabel = index === 0 || index === timeline.length - 1 || index % 4 === 0;
    return `
      <g class="usage-timeline-day" data-index="${index}" tabindex="0" role="button"
        aria-label="${escapeHtml(item.date)}, ${item.sessions}개 세션">
        <rect x="${x}" y="${y}" width="${barWidth}" height="${allHeight}"
          rx="4" fill="#dbe2ff" />
        <rect x="${x}" y="${detailedY}" width="${barWidth}" height="${detailedHeight}"
          rx="4" fill="#3157ff" />
        <rect x="${padding.left + slot * index}" y="${padding.top}" width="${slot}"
          height="${plotHeight}" fill="transparent" />
        ${showLabel ? `<text x="${x + barWidth / 2}" y="${height - 18}" text-anchor="middle"
          fill="#687582" font-size="9">${item.date.slice(5).replace("-", ".")}</text>` : ""}
      </g>
    `;
  }).join("");

  svg.innerHTML = grid + bars;
  const peak = timeline.reduce((current, item) =>
    item.sessions > current.sessions ? item : current, timeline[0]);
  byId("timeline-peak").textContent =
    `최고 ${peak.sessions}세션 · ${peak.date.slice(5).replace("-", ".")}`;

  const showTooltip = (group) => {
    const item = timeline[Number(group.dataset.index)];
    const rect = group.querySelector("rect");
    const svgRect = svg.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const x = Number(rect.getAttribute("x")) + Number(rect.getAttribute("width")) / 2;
    const y = Number(rect.getAttribute("y"));
    tooltip.innerHTML = `
      <strong>${item.date.slice(5).replace("-", "월 ")}일</strong>
      전체 ${item.sessions}세션<br />
      상세 로그 ${item.detailedSessions}세션
    `;
    tooltip.hidden = false;
    tooltip.style.left = `${svgRect.left - wrapRect.left + x / 960 * svgRect.width}px`;
    tooltip.style.top = `${svgRect.top - wrapRect.top + y / 300 * svgRect.height}px`;
  };

  svg.querySelectorAll(".usage-timeline-day").forEach((group) => {
    group.addEventListener("mouseenter", () => showTooltip(group));
    group.addEventListener("focus", () => showTooltip(group));
    group.addEventListener("mouseleave", () => { tooltip.hidden = true; });
    group.addEventListener("blur", () => { tooltip.hidden = true; });
  });
};

const renderFunnel = (funnel) => {
  byId("funnel-chart").innerHTML = funnel.map((row, index) => {
    const previous = index ? funnel[index - 1].count : row.count;
    const loss = previous - row.count;
    const detail = index === 0
      ? "분석 가능한 선택 여정"
      : loss > 0
        ? `이전 단계 대비 ${loss}세션 감소`
        : "이전 단계와 동일";
    return `
      <div class="usage-funnel-row">
        <div class="usage-funnel-fill" style="width:${row.shareOfStart}%"></div>
        <div class="usage-funnel-copy">
          <strong>${escapeHtml(row.label)}</strong>
          <small>${detail}</small>
        </div>
        <div class="usage-funnel-value">${row.count}</div>
      </div>
    `;
  }).join("");
};

const renderDwell = (rows) => {
  const clean = rows.filter((row) => row.medianSeconds !== null);
  const maxValue = Math.max(...clean.map((row) => row.medianSeconds), 1);
  byId("dwell-chart").innerHTML = clean.map((row) => {
    const height = Math.max(6, 220 * Math.sqrt(row.medianSeconds / maxValue));
    return `
      <div class="usage-dwell-item" data-key="${row.id}">
        <span class="usage-dwell-value">${seconds(row.medianSeconds)}</span>
        <div class="usage-dwell-bar" style="height:${height}px"
          title="${escapeHtml(row.label)} 중앙값 ${seconds(row.medianSeconds)}"></div>
        <span class="usage-dwell-label">${escapeHtml(row.label)}</span>
      </div>
    `;
  }).join("");
};

const horizontalRow = (label, value, max, suffix = "") => `
  <div class="usage-horizontal-row">
    <span title="${escapeHtml(label)}">${escapeHtml(label)}</span>
    <div class="usage-horizontal-track">
      <div class="usage-horizontal-fill" style="width:${max ? 100 * value / max : 0}%"></div>
    </div>
    <strong>${number.format(value)}${suffix}</strong>
  </div>
`;

const renderAudience = (data) => {
  const mobile = data.devices.types.find((item) => item.label === "mobile");
  const mobileShare = mobile?.share || 0;
  const donut = byId("device-donut");
  donut.style.setProperty("--mobile-share", `${mobileShare}%`);
  byId("device-donut-value").textContent = percent(mobileShare);

  const systems = data.devices.operatingSystems;
  const systemMax = Math.max(...systems.map((item) => item.count), 1);
  byId("device-bars").innerHTML = systems
    .map((item) => horizontalRow(deviceLabels[item.label] || item.label, item.count, systemMax))
    .join("");

  const years = data.audience.years;
  byId("year-stack").innerHTML = years.map((item) =>
    `<div class="usage-year-segment" style="width:${item.share}%"
      title="${yearLabel(item.label)} ${item.count}세션"></div>`).join("");
  byId("year-list").innerHTML = years.map((item) => `
    <div class="usage-year-item">
      <span>${yearLabel(item.label)}</span>
      <strong>${item.count}<small> · ${percent(item.share)}</small></strong>
    </div>
  `).join("");

  const tracks = data.audience.tracks;
  const trackMax = Math.max(...tracks.map((item) => item.count), 1);
  byId("track-list").innerHTML = tracks
    .map((item) => horizontalRow(item.label, item.count, trackMax, ""))
    .join("");
};

const renderCategories = (categories) => {
  const maxValue = Math.max(...categories.map((item) => item.sessions), 1);
  byId("category-chart").innerHTML = categories.map((item, index) => `
    <div class="usage-category-row">
      <div class="usage-category-rank">
        <i>${String(index + 1).padStart(2, "0")}</i>
        <strong>${escapeHtml(item.label)}</strong>
      </div>
      <div class="usage-horizontal-track">
        <div class="usage-horizontal-fill" style="width:${100 * item.sessions / maxValue}%"></div>
      </div>
      <div class="usage-category-value">${item.sessions}세션</div>
    </div>
  `).join("");
};

const renderFindings = (findings) => {
  byId("findings").innerHTML = findings.map((item, index) => `
    <article class="usage-finding">
      <span class="usage-finding-index">${String(index + 1).padStart(2, "0")}</span>
      <p class="usage-finding-eyebrow">${escapeHtml(item.eyebrow)}</p>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="usage-finding-evidence">${escapeHtml(item.evidence)}</p>
      <p class="usage-finding-action">→ ${escapeHtml(item.action)}</p>
    </article>
  `).join("");
};

const renderMethod = (notes) => {
  byId("method-notes").innerHTML = notes
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join("");
};

const loadDashboard = async () => {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Usage data request failed: ${response.status}`);
  const data = await response.json();
  renderOverview(data);
  renderTimeline(data.timeline);
  renderFunnel(data.funnel);
  renderDwell(data.stageDurations);
  renderAudience(data);
  renderCategories(data.categories);
  renderFindings(data.findings);
  renderMethod(data.source.notes);
};

loadDashboard().catch((error) => {
  console.error(error);
  byId("usage-error").hidden = false;
});
