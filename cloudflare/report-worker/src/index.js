import { createRemoteJWKSet, jwtVerify } from "jose";

const jwksByTeamDomain = new Map();
const ACCESS_HEADER = "cf-access-jwt-assertion";
const DIMENSIONS = [
  ["years", "year"],
  ["majors", "major"],
  ["regions", "estimated_region"],
  ["operatingSystems", "os"],
  ["deviceTypes", "device_type"],
];

class AccessDenied extends Error {}

const securityHeaders = (contentType, nonce = "") => {
  const headers = {
    "cache-control": "no-store, private, max-age=0",
    "content-type": contentType,
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), geolocation=(), microphone=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "x-robots-tag": "noindex, nofollow, noarchive",
  };
  if (nonce) {
    headers["content-security-policy"] = [
      "default-src 'none'",
      `style-src 'nonce-${nonce}'`,
      `script-src 'nonce-${nonce}'`,
      "connect-src 'self'",
      "img-src 'self' data:",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; ");
  }
  return headers;
};

const historicalReportHeaders = (nonce) => ({
  ...securityHeaders("text/html; charset=utf-8"),
  "content-security-policy": [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline'",
    "img-src data:",
    "connect-src 'self'",
    "font-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
});

const historicalLivePanel = (nonce) => ({
  styles: `<style nonce="${nonce}">
    #cf-live-report {
      width: min(1240px, calc(100% - 40px));
      margin: 24px auto 0;
      border: 1px solid #26354a;
      border-radius: 20px;
      padding: 24px;
      color: #f8fbff;
      background: #101820;
      box-shadow: 0 16px 44px rgba(16,24,32,.18);
    }
    #cf-live-report * { box-sizing: border-box; }
    .cf-live-head { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; }
    .cf-live-kicker { margin:0 0 7px; color:#c9ff4a; font-size:10px; font-weight:900; letter-spacing:.14em; }
    .cf-live-head h2 { margin:0; font-size:clamp(24px,4vw,38px); letter-spacing:-.045em; }
    .cf-live-copy { max-width:760px; margin:10px 0 0; color:#aebdce; font-size:12px; line-height:1.7; }
    #cf-live-refresh {
      flex:0 0 auto; border:1px solid #7e93ad; border-radius:10px; padding:9px 13px;
      color:#101820; background:#c9ff4a; font-weight:900; cursor:pointer;
    }
    #cf-live-refresh:disabled { opacity:.6; cursor:wait; }
    #cf-live-error { margin:14px 0 0; border:1px solid #ff805d; border-radius:10px; padding:10px 12px; color:#ffd5ca; background:#3a211e; font-size:12px; }
    .cf-live-kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:18px; }
    .cf-live-kpi { border:1px solid #314055; border-radius:12px; padding:14px; background:#162231; }
    .cf-live-kpi span { color:#92a4b8; font-size:9px; font-weight:850; }
    .cf-live-kpi strong { display:block; margin-top:7px; color:#fff; font-size:24px; }
    .cf-live-groups { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:10px; }
    .cf-live-group { border:1px solid #314055; border-radius:12px; padding:14px; background:#162231; }
    .cf-live-group h3 { margin:0 0 11px; color:#fff; font-size:13px; }
    .cf-live-row { display:grid; grid-template-columns:minmax(80px,1fr) 2fr 34px; gap:8px; align-items:center; margin:7px 0; font-size:10px; }
    .cf-live-label { overflow:hidden; color:#dbe5f0; text-overflow:ellipsis; white-space:nowrap; }
    .cf-live-track { height:6px; overflow:hidden; border-radius:999px; background:#26364a; }
    .cf-live-fill { height:100%; border-radius:inherit; background:#c9ff4a; }
    .cf-live-count { color:#92a4b8; text-align:right; }
    .cf-live-table-wrap { max-height:280px; margin-top:10px; overflow:auto; border:1px solid #314055; border-radius:12px; }
    .cf-live-table { width:100%; border-collapse:collapse; color:#dbe5f0; background:#162231; font-size:10px; white-space:nowrap; }
    .cf-live-table th,.cf-live-table td { border-bottom:1px solid #314055; padding:9px 11px; text-align:left; }
    .cf-live-table th { position:sticky; top:0; color:#c9ff4a; background:#101820; }
    .cf-live-boundary { margin:12px 2px 0; color:#92a4b8; font-size:10px; line-height:1.65; }
    @media (max-width:720px) {
      #cf-live-report { width:min(100% - 20px,1240px); padding:18px; }
      .cf-live-head { flex-direction:column; }
      #cf-live-refresh { width:100%; }
      .cf-live-kpis,.cf-live-groups { grid-template-columns:1fr; }
    }
  </style>`,
  body: `<section id="cf-live-report" aria-labelledby="cf-live-title">
    <div class="cf-live-head">
      <div>
        <p class="cf-live-kicker">LIVE · CLOUDFLARE D1</p>
        <h2 id="cf-live-title">Cloudflare 최신 세션 데이터</h2>
        <p class="cf-live-copy">페이지를 열 때 D1을 직접 조회하고 30초마다 갱신합니다. 현재 수집 중인 추정 지역·학년·전공·OS·기기 종류만 표시합니다.</p>
      </div>
      <button id="cf-live-refresh" type="button">지금 동기화</button>
    </div>
    <p id="cf-live-error" role="alert" hidden></p>
    <div class="cf-live-kpis">
      <div class="cf-live-kpi"><span>D1 누적 세션</span><strong id="cf-live-total">—</strong></div>
      <div class="cf-live-kpi"><span>최신 입력 순번</span><strong id="cf-live-sequence">—</strong></div>
      <div class="cf-live-kpi"><span>마지막 동기화</span><strong id="cf-live-updated">—</strong></div>
    </div>
    <div class="cf-live-groups" id="cf-live-groups"></div>
    <div class="cf-live-table-wrap">
      <table class="cf-live-table">
        <thead><tr><th>순번</th><th>추정 지역</th><th>학년</th><th>전공</th><th>OS</th><th>기기</th></tr></thead>
        <tbody id="cf-live-recent"></tbody>
      </table>
    </div>
    <p class="cf-live-boundary">아래의 개인별 IP·기기 지문·행동 분석은 Telegram 내보내기로 만든 과거 상세 스냅샷입니다. 현재 D1은 해당 상세 필드를 수집하지 않으므로 이 실시간 영역과 분리해서 표시합니다.</p>
  </section>`,
  script: `<script nonce="${nonce}">
    (() => {
      const names = {
        years: "학년", majors: "전공", regions: "추정 지역",
        operatingSystems: "운영체제", deviceTypes: "기기 종류"
      };
      const total = document.getElementById("cf-live-total");
      const sequence = document.getElementById("cf-live-sequence");
      const updated = document.getElementById("cf-live-updated");
      const groups = document.getElementById("cf-live-groups");
      const recent = document.getElementById("cf-live-recent");
      const error = document.getElementById("cf-live-error");
      const button = document.getElementById("cf-live-refresh");
      const value = (input) => String(input == null || input === "" ? "unknown" : input);
      const group = (key, items, grandTotal) => {
        const panel = document.createElement("section");
        panel.className = "cf-live-group";
        const heading = document.createElement("h3");
        heading.textContent = names[key];
        panel.appendChild(heading);
        items.forEach((item) => {
          const row = document.createElement("div");
          row.className = "cf-live-row";
          const label = document.createElement("span");
          label.className = "cf-live-label";
          label.textContent = value(item.label);
          label.title = value(item.label);
          const track = document.createElement("div");
          track.className = "cf-live-track";
          const fill = document.createElement("div");
          fill.className = "cf-live-fill";
          fill.style.width = Math.max(2, Number(item.count) / Math.max(1, grandTotal) * 100) + "%";
          track.appendChild(fill);
          const count = document.createElement("span");
          count.className = "cf-live-count";
          count.textContent = Number(item.count).toLocaleString("ko-KR");
          row.append(label, track, count);
          panel.appendChild(row);
        });
        return panel;
      };
      const renderRecent = (items) => {
        recent.replaceChildren();
        items.slice(0, 20).forEach((item) => {
          const row = document.createElement("tr");
          [item.sequence, item.estimated_region, item.year ? item.year + "학년" : "unknown",
            item.major, item.os, item.device_type].forEach((itemValue) => {
            const cell = document.createElement("td");
            cell.textContent = value(itemValue);
            row.appendChild(cell);
          });
          recent.appendChild(row);
        });
      };
      const refresh = async () => {
        button.disabled = true;
        error.hidden = true;
        try {
          const response = await fetch("/api/live", {
            headers: { accept: "application/json" },
            credentials: "same-origin",
            cache: "no-store"
          });
          if (!response.ok) throw new Error("D1 조회 실패 (" + response.status + ")");
          const data = await response.json();
          total.textContent = Number(data.total).toLocaleString("ko-KR");
          sequence.textContent = "#" + Number(data.latestSequence).toLocaleString("ko-KR");
          updated.textContent = new Intl.DateTimeFormat("ko-KR", {
            timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit"
          }).format(new Date(data.fetchedAt));
          groups.replaceChildren(...Object.entries(data.dimensions).map(
            ([key, items]) => group(key, items, data.total)
          ));
          renderRecent(data.recent);
        } catch (reason) {
          error.textContent = reason instanceof Error ? reason.message : "D1 조회 실패";
          error.hidden = false;
        } finally {
          button.disabled = false;
        }
      };
      button.addEventListener("click", refresh);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") refresh();
      });
      setInterval(() => {
        if (document.visibilityState === "visible") refresh();
      }, 30000);
      refresh();
    })();
  </script>`,
});

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: securityHeaders("application/json; charset=utf-8"),
});

const randomNonce = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes));
};

const normalizedTeamDomain = (value) => {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) throw new AccessDenied("access_not_configured");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new AccessDenied("access_not_configured");
  }
  if (url.protocol !== "https:"
      || url.pathname !== "/"
      || url.search
      || url.hash
      || !/^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(url.hostname)) {
    throw new AccessDenied("access_not_configured");
  }
  return url.origin;
};

export const verifyAccessJwt = async (request, env) => {
  const teamDomain = normalizedTeamDomain(env.TEAM_DOMAIN);
  const audience = String(env.POLICY_AUD || "").trim();
  const adminEmail = String(env.ADMIN_EMAIL || "").trim().toLowerCase();
  const token = request.headers.get(ACCESS_HEADER);
  if (!audience || !adminEmail) throw new AccessDenied("access_not_configured");
  if (!token) throw new AccessDenied("access_token_missing");

  let jwks = jwksByTeamDomain.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksByTeamDomain.set(teamDomain, jwks);
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: teamDomain,
      audience,
      algorithms: ["RS256"],
    }));
  } catch {
    throw new AccessDenied("access_token_invalid");
  }
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email || email !== adminEmail) throw new AccessDenied("email_denied");
  return { email };
};

const rows = (result) => Array.isArray(result?.results) ? result.results : [];

export const readLiveSnapshot = async (db) => {
  const statements = [
    db.prepare(
      "SELECT COUNT(*) AS total, COALESCE(MAX(rowid), 0) AS latest_rowid "
      + "FROM telemetry_sessions",
    ),
    ...DIMENSIONS.map(([, column]) => db.prepare(
      `SELECT ${column} AS label, COUNT(*) AS count `
      + `FROM telemetry_sessions GROUP BY ${column} ORDER BY count DESC, label ASC`,
    )),
    db.prepare(
      "SELECT rowid AS sequence, estimated_region, year, major, os, device_type "
      + "FROM telemetry_sessions ORDER BY rowid DESC LIMIT 50",
    ),
  ];
  const result = await db.batch(statements);
  const totals = rows(result[0])[0] || { total: 0, latest_rowid: 0 };
  const dimensions = Object.fromEntries(
    DIMENSIONS.map(([key], index) => [key, rows(result[index + 1])]),
  );
  return {
    fetchedAt: new Date().toISOString(),
    source: "Cloudflare D1",
    total: Number(totals.total || 0),
    latestSequence: Number(totals.latest_rowid || 0),
    dimensions,
    recent: rows(result[DIMENSIONS.length + 1]),
  };
};

const dashboardHtml = (nonce) => `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>AGS 실시간 이용 현황</title>
  <style nonce="${nonce}">
    :root {
      color-scheme: light;
      --ink: #172235;
      --muted: #647083;
      --line: #dce3ed;
      --paper: rgba(255, 255, 255, .92);
      --blue: #335eea;
      --blue-soft: #edf2ff;
      --green: #16836b;
      --shadow: 0 18px 55px rgba(24, 42, 74, .10);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 8% 0%, #dce9ff 0, transparent 31rem),
        radial-gradient(circle at 95% 20%, #d9f3eb 0, transparent 27rem),
        #f5f7fb;
    }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 42px 0 70px; }
    header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-end;
      margin-bottom: 24px;
    }
    .eyebrow {
      margin: 0 0 8px;
      color: var(--blue);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    h1 { margin: 0; font-size: clamp(30px, 5vw, 54px); letter-spacing: -.055em; }
    .subtitle { margin: 12px 0 0; color: var(--muted); line-height: 1.65; }
    button {
      border: 1px solid #b9c7e0;
      border-radius: 12px;
      padding: 11px 16px;
      color: #fff;
      background: var(--blue);
      font: inherit;
      font-weight: 750;
      cursor: pointer;
      box-shadow: 0 8px 20px rgba(51, 94, 234, .2);
    }
    .actions { display: flex; gap: 10px; }
    .report-link {
      display: inline-flex;
      align-items: center;
      border: 1px solid #b9c7e0;
      border-radius: 12px;
      padding: 11px 16px;
      color: var(--ink);
      background: rgba(255, 255, 255, .85);
      font-size: 14px;
      font-weight: 750;
      text-decoration: none;
    }
    button:disabled { cursor: wait; opacity: .65; }
    .status {
      display: grid;
      grid-template-columns: 1.1fr .9fr .9fr;
      gap: 14px;
      margin-bottom: 18px;
    }
    .card, .panel {
      border: 1px solid rgba(190, 201, 219, .8);
      border-radius: 20px;
      background: var(--paper);
      box-shadow: var(--shadow);
      backdrop-filter: blur(14px);
    }
    .card { padding: 22px; }
    .card span { color: var(--muted); font-size: 13px; font-weight: 700; }
    .card strong { display: block; margin-top: 7px; font-size: 30px; letter-spacing: -.04em; }
    .live { color: var(--green); }
    .live::before {
      content: "";
      display: inline-block;
      width: 9px;
      height: 9px;
      margin-right: 7px;
      border-radius: 50%;
      background: #21b48f;
      box-shadow: 0 0 0 5px rgba(33, 180, 143, .12);
    }
    .error {
      margin: 0 0 18px;
      border: 1px solid #f0b8b8;
      border-radius: 14px;
      padding: 14px 16px;
      color: #8b2626;
      background: #fff1f1;
    }
    .charts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      margin-bottom: 18px;
    }
    .panel { padding: 22px; overflow: hidden; }
    .panel h2 { margin: 0 0 18px; font-size: 18px; letter-spacing: -.025em; }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(90px, 1fr) 3fr 42px;
      gap: 11px;
      align-items: center;
      margin: 11px 0;
      font-size: 13px;
    }
    .bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-track { height: 9px; overflow: hidden; border-radius: 999px; background: var(--blue-soft); }
    .bar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #335eea, #6688f2); }
    .bar-count { color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
    .table-wrap { overflow: auto; max-height: 520px; border: 1px solid var(--line); border-radius: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap; }
    th, td { padding: 12px 14px; border-bottom: 1px solid var(--line); text-align: left; }
    th { position: sticky; top: 0; color: #4f5c70; background: #f3f6fb; z-index: 1; }
    td:first-child { color: var(--muted); font-variant-numeric: tabular-nums; }
    tr:last-child td { border-bottom: 0; }
    .note { margin: 12px 2px 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
    footer { margin-top: 20px; color: var(--muted); font-size: 12px; text-align: center; }
    [hidden] { display: none !important; }
    @media (max-width: 760px) {
      main { width: min(100% - 20px, 1180px); padding-top: 25px; }
      header { align-items: flex-start; flex-direction: column; }
      .status, .charts { grid-template-columns: 1fr; }
      .actions { width: 100%; flex-direction: column; }
      header button, .report-link { width: 100%; justify-content: center; }
      .bar-row { grid-template-columns: minmax(80px, 1fr) 2fr 34px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p class="eyebrow">Private · Cloudflare D1</p>
        <h1>실시간 이용 현황</h1>
        <p class="subtitle">현재 D1에 저장된 세션 요약을 직접 읽습니다. 30초마다 자동 갱신됩니다.</p>
      </div>
      <div class="actions">
        <a class="report-link" href="/people-usage-report.html">상세 스냅샷 보고서</a>
        <button id="refresh" type="button">지금 새로고침</button>
      </div>
    </header>
    <p class="error" id="error" role="alert" hidden></p>
    <section class="status" aria-label="현재 상태">
      <article class="card"><span>누적 세션</span><strong id="total">—</strong></article>
      <article class="card"><span>최신 입력 순번</span><strong id="sequence">—</strong></article>
      <article class="card"><span class="live">마지막 동기화</span><strong id="updated">—</strong></article>
    </section>
    <section class="charts" id="charts"></section>
    <section class="panel">
      <h2>최근 입력 50건</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>순번</th><th>추정 지역</th><th>학년</th><th>전공</th><th>OS</th><th>기기</th></tr></thead>
          <tbody id="recent"></tbody>
        </table>
      </div>
      <p class="note">수집 스키마에 시각 필드가 없어 순번은 D1 삽입 순서를 뜻합니다. IP, 이름, 학번, 원시 User-Agent는 이 화면이나 현재 세션 테이블에 저장·표시하지 않습니다.</p>
    </section>
    <footer>Cloudflare Access 인증과 Worker 내부 JWT·이메일 검증을 모두 통과한 요청만 조회할 수 있습니다.</footer>
  </main>
  <script nonce="${nonce}">
    const labels = {
      years: "학년",
      majors: "전공",
      regions: "추정 지역",
      operatingSystems: "운영체제",
      deviceTypes: "기기 종류"
    };
    const total = document.getElementById("total");
    const sequence = document.getElementById("sequence");
    const updated = document.getElementById("updated");
    const charts = document.getElementById("charts");
    const recent = document.getElementById("recent");
    const error = document.getElementById("error");
    const refreshButton = document.getElementById("refresh");
    const text = (value) => String(value ?? "unknown");

    const renderBars = (key, items, grandTotal) => {
      const panel = document.createElement("article");
      panel.className = "panel";
      const heading = document.createElement("h2");
      heading.textContent = labels[key];
      panel.appendChild(heading);
      items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "bar-row";
        const label = document.createElement("span");
        label.className = "bar-label";
        label.title = text(item.label);
        label.textContent = text(item.label);
        const track = document.createElement("div");
        track.className = "bar-track";
        const fill = document.createElement("div");
        fill.className = "bar-fill";
        fill.style.width = Math.max(2, Number(item.count) / Math.max(1, grandTotal) * 100) + "%";
        track.appendChild(fill);
        const count = document.createElement("span");
        count.className = "bar-count";
        count.textContent = Number(item.count).toLocaleString("ko-KR");
        row.append(label, track, count);
        panel.appendChild(row);
      });
      return panel;
    };

    const renderRecent = (items) => {
      recent.replaceChildren();
      items.forEach((item) => {
        const row = document.createElement("tr");
        [
          item.sequence,
          item.estimated_region,
          item.year ? item.year + "학년" : "unknown",
          item.major,
          item.os,
          item.device_type
        ].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = text(value);
          row.appendChild(cell);
        });
        recent.appendChild(row);
      });
    };

    const refresh = async () => {
      refreshButton.disabled = true;
      error.hidden = true;
      try {
        const response = await fetch("/api/live", {
          headers: { accept: "application/json" },
          cache: "no-store",
          credentials: "same-origin"
        });
        if (!response.ok) throw new Error("실시간 데이터를 가져오지 못했습니다 (" + response.status + ")");
        const data = await response.json();
        total.textContent = Number(data.total).toLocaleString("ko-KR");
        sequence.textContent = "#" + Number(data.latestSequence).toLocaleString("ko-KR");
        updated.textContent = new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }).format(new Date(data.fetchedAt));
        charts.replaceChildren(...Object.entries(data.dimensions).map(
          ([key, items]) => renderBars(key, items, data.total)
        ));
        renderRecent(data.recent);
      } catch (reason) {
        error.textContent = reason instanceof Error ? reason.message : "알 수 없는 오류가 발생했습니다.";
        error.hidden = false;
      } finally {
        refreshButton.disabled = false;
      }
    };

    refreshButton.addEventListener("click", refresh);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refresh();
    });
    setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30000);
    refresh();
  </script>
</body>
</html>`;

export const createApp = ({ verifyAccess = verifyAccessJwt } = {}) => ({
  async fetch(request, env) {
    let identity;
    try {
      identity = await verifyAccess(request, env);
    } catch (error) {
      const code = error instanceof AccessDenied ? error.message : "access_denied";
      return jsonResponse({ ok: false, error: code }, 403);
    }

    const url = new URL(request.url);
    if (request.method !== "GET") {
      return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
    }
    if (url.pathname === "/api/live") {
      try {
        const snapshot = await readLiveSnapshot(env.DB);
        return jsonResponse({ ok: true, viewer: identity.email, ...snapshot });
      } catch {
        return jsonResponse({ ok: false, error: "data_unavailable" }, 503);
      }
    }
    if (url.pathname === "/people-usage-report.html") {
      try {
        const assetResponse = await env.REPORT_ASSETS.fetch(request);
        if (!assetResponse.ok) throw new Error("asset_unavailable");
        const nonce = randomNonce();
        const panel = historicalLivePanel(nonce);
        const report = (await assetResponse.text())
          .replace("<style>", `<style nonce="${nonce}">`)
          .replace("<script>", `<script nonce="${nonce}">`)
          .replace("</head>", `${panel.styles}</head>`)
          .replace("<body>", `<body>${panel.body}`)
          .replace("</body>", `${panel.script}</body>`);
        return new Response(report, {
          headers: historicalReportHeaders(nonce),
        });
      } catch {
        return jsonResponse({ ok: false, error: "report_unavailable" }, 503);
      }
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const nonce = randomNonce();
      return new Response(dashboardHtml(nonce), {
        headers: securityHeaders("text/html; charset=utf-8", nonce),
      });
    }
    return jsonResponse({ ok: false, error: "not_found" }, 404);
  },
});

export default createApp();
