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
      box-sizing: border-box;
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
    .cf-current { margin-top:18px; border-top:1px solid #314055; padding-top:18px; }
    .cf-current-head { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; }
    .cf-current-head h3 { margin:0; color:#fff; font-size:20px; }
    .cf-current-head p { max-width:760px; margin:7px 0 0; color:#92a4b8; font-size:10px; line-height:1.65; }
    #cf-current-refresh { border:1px solid #7e93ad; border-radius:9px; padding:8px 11px; color:#101820; background:#c9ff4a; font-size:10px; font-weight:900; cursor:pointer; }
    #cf-current-refresh:disabled { opacity:.6; cursor:wait; }
    #cf-current-error { margin:12px 0 0; border:1px solid #ff805d; border-radius:9px; padding:9px 11px; color:#ffd5ca; background:#3a211e; font-size:10px; }
    .cf-current-layout { display:grid; grid-template-columns:minmax(230px,.72fr) minmax(0,1.7fr); gap:10px; margin-top:12px; }
    .cf-current-list,.cf-current-detail { min-height:360px; border:1px solid #314055; border-radius:12px; background:#162231; }
    .cf-current-list { max-height:720px; overflow:auto; padding:8px; }
    .cf-current-person,.cf-current-session { width:100%; border:0; border-radius:9px; padding:10px; color:#dbe5f0; background:transparent; font:inherit; text-align:left; cursor:pointer; box-shadow:none; }
    .cf-current-person:hover,.cf-current-person:focus,.cf-current-person[aria-pressed="true"],.cf-current-session:hover,.cf-current-session:focus,.cf-current-session[aria-pressed="true"] { outline:none; background:#26364a; }
    .cf-current-person strong,.cf-current-session strong { display:block; overflow-wrap:anywhere; color:#fff; font-size:11px; }
    .cf-current-person span,.cf-current-session span { display:block; margin-top:4px; color:#92a4b8; font-size:8px; line-height:1.5; }
    .cf-current-detail { overflow:hidden; padding:14px; }
    .cf-current-empty { margin:0; padding:30px 12px; color:#92a4b8; font-size:10px; text-align:center; }
    .cf-current-identity { display:flex; flex-wrap:wrap; justify-content:space-between; gap:12px; border-bottom:1px solid #314055; padding-bottom:12px; }
    .cf-current-identity h4 { margin:0; color:#fff; font-size:16px; }
    .cf-current-identity code { display:block; margin-top:5px; color:#c9ff4a; font-size:9px; overflow-wrap:anywhere; }
    .cf-current-identity p { margin:0; color:#92a4b8; font-size:9px; line-height:1.6; text-align:right; }
    .cf-current-sessions { display:flex; gap:6px; margin:12px 0; overflow:auto; padding-bottom:3px; }
    .cf-current-session { flex:0 0 150px; border:1px solid #314055; }
    .cf-current-snapshot { border-top:1px solid #314055; padding-top:12px; }
    .cf-current-snapshot h5 { margin:0 0 10px; color:#fff; font-size:13px; }
    .cf-current-meta { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; }
    .cf-current-meta div { min-width:0; border:1px solid #314055; border-radius:8px; padding:8px; background:#101820; }
    .cf-current-meta span { display:block; color:#92a4b8; font-size:7px; font-weight:900; }
    .cf-current-meta strong { display:block; margin-top:4px; overflow-wrap:anywhere; color:#fff; font-size:9px; }
    .cf-current-subhead { margin:14px 0 7px; color:#c9ff4a; font-size:9px; letter-spacing:.08em; }
    .cf-current-tags { display:flex; flex-wrap:wrap; gap:5px; }
    .cf-current-tags span { border:1px solid #314055; border-radius:999px; padding:5px 7px; color:#dbe5f0; background:#101820; font-size:8px; }
    .cf-current-events { max-height:330px; overflow:auto; border:1px solid #314055; border-radius:9px; background:#101820; }
    .cf-current-event { border-top:1px solid #26364a; padding:8px 10px; }
    .cf-current-event:first-child { border-top:0; }
    .cf-current-event strong { color:#fff; font-size:9px; }
    .cf-current-event span { margin-left:6px; color:#c9ff4a; font-size:8px; }
    .cf-current-event code { display:block; margin-top:4px; color:#92a4b8; font-size:7px; line-height:1.55; white-space:pre-wrap; overflow-wrap:anywhere; }
    .cf-current-cost { margin:10px 1px 0; color:#92a4b8; font-size:8px; line-height:1.6; }
    @media (max-width:720px) {
      #cf-live-report { width:min(100% - 20px,1240px); padding:18px; }
      .cf-live-head { flex-direction:column; }
      #cf-live-refresh { width:100%; }
      .cf-live-kpis,.cf-live-groups { grid-template-columns:1fr; }
      .cf-current-head { flex-direction:column; }
      #cf-current-refresh { width:100%; }
      .cf-current-layout { grid-template-columns:1fr; }
      .cf-current-list { min-height:0; max-height:290px; }
      .cf-current-detail { min-height:320px; }
      .cf-current-meta { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .cf-current-identity p { text-align:left; }
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
    <section class="cf-current" aria-labelledby="cf-current-title">
      <div class="cf-current-head">
        <div>
          <h3 id="cf-current-title">현재 개인별 상세 로그</h3>
          <p>IP 해시와 User-Agent 조합으로 보수적으로 분리한 최신 이용자 50명입니다. 사용자를 선택하면 세션 목록을, 세션을 선택하면 정확한 IP·기기 지문·행동 이벤트를 불러옵니다.</p>
        </div>
        <button id="cf-current-refresh" type="button">사용자 목록 갱신</button>
      </div>
      <p id="cf-current-error" role="alert" hidden></p>
      <div class="cf-current-layout">
        <div class="cf-current-list" id="cf-current-people" aria-label="현재 이용자 목록"></div>
        <div class="cf-current-detail" id="cf-current-detail">
          <p class="cf-current-empty">왼쪽에서 사용자를 선택하세요.</p>
        </div>
      </div>
      <p class="cf-current-cost">무료 한도 보호: 목록 50명·사용자당 세션 20개·세션당 최신 스냅샷 12개로 제한하며, 30초 자동 갱신 대상에서 제외합니다. 아래 기존 분석은 2026-07 Telegram 내보내기로 만든 과거 스냅샷입니다.</p>
    </section>
    <p class="cf-live-boundary">아래 그래프와 개인 카드는 과거 상세 스냅샷이며, 위의 현재 D1 상세 로그와 분리해서 표시합니다.</p>
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
    (() => {
      const people = document.getElementById("cf-current-people");
      const detail = document.getElementById("cf-current-detail");
      const error = document.getElementById("cf-current-error");
      const button = document.getElementById("cf-current-refresh");
      const text = (input) => String(input == null || input === "" ? "unknown" : input);
      const time = (input) => input ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul", year: "2-digit", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      }).format(new Date(Number(input))) : "unknown";
      const element = (name, className, content) => {
        const node = document.createElement(name);
        if (className) node.className = className;
        if (content !== undefined) node.textContent = content;
        return node;
      };
      const request = async (path) => {
        const response = await fetch(path, {
          headers: { accept: "application/json" }, credentials: "same-origin", cache: "no-store"
        });
        if (!response.ok) throw new Error("상세 로그 조회 실패 (" + response.status + ")");
        return response.json();
      };
      const setError = (reason) => {
        error.textContent = reason instanceof Error ? reason.message : "상세 로그 조회 실패";
        error.hidden = false;
      };
      const meta = (label, value) => {
        const item = element("div");
        item.append(element("span", "", label), element("strong", "", text(value)));
        return item;
      };
      const tags = (values) => {
        const wrap = element("div", "cf-current-tags");
        values.forEach((value) => wrap.appendChild(element("span", "", value)));
        return wrap;
      };
      const renderSnapshot = (data) => {
        const snapshot = data.snapshots[0];
        const area = element("div", "cf-current-snapshot");
        if (!snapshot) {
          area.appendChild(element("p", "cf-current-empty", "읽을 수 있는 payload가 없습니다."));
          return area;
        }
        const payload = snapshot.payload || {};
        const device = payload.device || {};
        const profile = payload.profile || {};
        area.appendChild(element("h5", "", time(snapshot.receivedAtMs) + " · " + text(snapshot.reason)));
        const grid = element("div", "cf-current-meta");
        [
          ["학년", profile.year ? profile.year + "학년" : "unknown"],
          ["전공", Array.isArray(profile.tracks) ? profile.tracks.join(" / ") : "unknown"],
          ["OS / 브라우저", text(device.os) + " / " + text(device.browser)],
          ["기기 / 플랫폼", text(device.deviceType) + " / " + text(device.platform)],
          ["화면 / 뷰포트", text(device.screen) + " / " + text(device.viewport)],
          ["RAM / CPU", text(device.memory) + " / " + text(device.cores) + " cores"],
          ["시간대 / 언어", text(device.timezone) + " / " + text(device.languages)],
          ["네트워크", text(device.network) + " / " + text(device.networkRtt)],
          ["활성시간", Number(payload.pageActiveMs || 0).toLocaleString("ko-KR") + "ms"],
          ["결과 오류", Number(payload.resultErrors || 0).toLocaleString("ko-KR")],
          ["페이지", payload.pageId],
          ["Navigation", payload.navigation]
        ].forEach(([label, value]) => grid.appendChild(meta(label, value)));
        area.appendChild(grid);
        area.appendChild(element("h6", "cf-current-subhead", "USER-AGENT"));
        area.appendChild(tags([text(device.userAgent)]));
        const clicks = Object.entries(payload.categoryClicks || {});
        area.appendChild(element("h6", "cf-current-subhead", "카테고리 클릭"));
        area.appendChild(tags(clicks.length ? clicks.map(([key, value]) => key + " " + value + "회") : ["없음"]));
        const vitals = Object.entries(payload.webVitalsByPage || {});
        area.appendChild(element("h6", "cf-current-subhead", "WEB VITALS"));
        area.appendChild(tags(vitals.length ? vitals.map(([key, value]) =>
          key + " · LCP " + text(value?.lcp) + " · INP " + text(value?.inp) + " · CLS " + text(value?.cls)) : ["없음"]));
        area.appendChild(element("h6", "cf-current-subhead", "이벤트 타임라인"));
        const timeline = element("div", "cf-current-events");
        const eventMap = new Map();
        data.snapshots.slice().reverse().forEach((item) => {
          (item.payload?.events || []).forEach((eventItem) => eventMap.set(String(eventItem.seq), eventItem));
        });
        [...eventMap.values()].sort((a, b) => Number(a.seq) - Number(b.seq)).forEach((eventItem) => {
          const row = element("div", "cf-current-event");
          row.append(element("strong", "", text(eventItem.type)), element("span", "", "+" + Number(eventItem.at_ms || 0).toLocaleString("ko-KR") + "ms"));
          const values = Object.entries(eventItem).filter(([key]) => !["seq", "at_ms", "type"].includes(key));
          row.appendChild(element("code", "", values.map(([key, value]) => key + "=" + text(value)).join(" · ") || "상세 필드 없음"));
          timeline.appendChild(row);
        });
        if (!timeline.childElementCount) timeline.appendChild(element("p", "cf-current-empty", "기록된 이벤트가 없습니다."));
        area.appendChild(timeline);
        return area;
      };
      const loadSession = async (userId, sessionId, target) => {
        target.disabled = true;
        error.hidden = true;
        try {
          const data = await request("/api/people/" + userId + "/sessions/" + encodeURIComponent(sessionId));
          detail.querySelector(".cf-current-snapshot")?.remove();
          detail.appendChild(renderSnapshot(data));
          detail.querySelectorAll(".cf-current-session").forEach((item) => item.setAttribute("aria-pressed", String(item === target)));
        } catch (reason) {
          setError(reason);
        } finally {
          target.disabled = false;
        }
      };
      const renderPerson = (data) => {
        detail.replaceChildren();
        const identity = element("div", "cf-current-identity");
        const title = element("div");
        title.append(element("h4", "", "이용자 #" + data.person.user_id), element("code", "", text(data.person.ip_address)));
        identity.append(title, element("p", "", [data.person.country, data.person.region, data.person.city, data.person.colo].filter(Boolean).join(" · ") + " · 최근 " + time(data.person.last_seen_ms)));
        detail.appendChild(identity);
        const sessions = element("div", "cf-current-sessions");
        data.sessions.forEach((session) => {
          const item = element("button", "cf-current-session");
          item.type = "button";
          item.append(element("strong", "", time(session.last_seen_ms)), element("span", "", text(session.latest_reason) + " · " + Number(session.event_row_count) + " snapshots · " + text(session.os) + " · " + text(session.browser)));
          item.addEventListener("click", () => loadSession(data.person.user_id, session.session_id, item));
          sessions.appendChild(item);
        });
        detail.appendChild(sessions);
        if (data.sessions[0]) sessions.firstElementChild.click();
        else detail.appendChild(element("p", "cf-current-empty", "연결된 세션이 없습니다."));
      };
      const loadPerson = async (userId, target) => {
        target.disabled = true;
        error.hidden = true;
        try {
          const data = await request("/api/people/" + userId);
          renderPerson(data);
          people.querySelectorAll(".cf-current-person").forEach((item) => item.setAttribute("aria-pressed", String(item === target)));
        } catch (reason) {
          setError(reason);
        } finally {
          target.disabled = false;
        }
      };
      const loadPeople = async () => {
        button.disabled = true;
        error.hidden = true;
        try {
          const data = await request("/api/people");
          people.replaceChildren();
          data.people.forEach((person) => {
            const item = element("button", "cf-current-person");
            item.type = "button";
            item.append(element("strong", "", "#" + person.user_id + " · " + text(person.ip_address)), element("span", "", [person.country, person.region, person.city].filter(Boolean).join(" / ") + " · " + person.session_count + " sessions · " + time(person.last_seen_ms)));
            item.addEventListener("click", () => loadPerson(person.user_id, item));
            people.appendChild(item);
          });
          if (!data.people.length) people.appendChild(element("p", "cf-current-empty", "현재 상세 로그가 없습니다."));
        } catch (reason) {
          setError(reason);
        } finally {
          button.disabled = false;
        }
      };
      button.addEventListener("click", loadPeople);
      loadPeople();
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

const DAILY_DATE_SQL = "date(created_at_ms / 1000, 'unixepoch', '+9 hours')";
const DAILY_WINDOW_SQL = "created_at_ms > 0 AND created_at_ms >= "
  + "(unixepoch(date('now', '+9 hours', '-59 days')) - 9 * 60 * 60) * 1000";

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
      `WITH RECURSIVE dates(date) AS (`
      + `SELECT date('now', '+9 hours', '-59 days') `
      + `UNION ALL SELECT date(date, '+1 day') FROM dates `
      + `WHERE date < date('now', '+9 hours')`
      + `), counts AS (`
      + `SELECT ${DAILY_DATE_SQL} AS date, COUNT(*) AS count `
      + `FROM telemetry_sessions WHERE ${DAILY_WINDOW_SQL} GROUP BY date`
      + `) SELECT dates.date, COALESCE(counts.count, 0) AS count `
      + `FROM dates LEFT JOIN counts USING (date) ORDER BY dates.date`,
    ),
    ...DIMENSIONS.map(([, column]) => db.prepare(
      `SELECT ${DAILY_DATE_SQL} AS date, ${column} AS label, COUNT(*) AS count `
      + `FROM telemetry_sessions WHERE ${DAILY_WINDOW_SQL} `
      + `GROUP BY date, ${column} ORDER BY date ASC, count DESC, label ASC`,
    )),
    db.prepare(
      "SELECT rowid AS sequence, created_at_ms, estimated_region, year, major, os, device_type "
      + "FROM telemetry_sessions ORDER BY rowid DESC LIMIT 50",
    ),
  ];
  const result = await db.batch(statements);
  const totals = rows(result[0])[0] || { total: 0, latest_rowid: 0 };
  const dimensions = Object.fromEntries(
    DIMENSIONS.map(([key], index) => [key, rows(result[index + 1])]),
  );
  const dailyOffset = DIMENSIONS.length + 1;
  const dailyDimensions = Object.fromEntries(
    DIMENSIONS.map(([key], index) => [key, rows(result[dailyOffset + index + 1])]),
  );
  return {
    fetchedAt: new Date().toISOString(),
    source: "Cloudflare D1",
    total: Number(totals.total || 0),
    latestSequence: Number(totals.latest_rowid || 0),
    dimensions,
    daily: {
      timeZone: "Asia/Seoul",
      totals: rows(result[dailyOffset]),
      dimensions: dailyDimensions,
    },
    recent: rows(result[dailyOffset + DIMENSIONS.length + 1]),
  };
};

const PEOPLE_LIMIT = 50;
const PERSON_SESSION_LIMIT = 20;
const SESSION_SNAPSHOT_LIMIT = 12;
const PERSON_ID_RE = /^[1-9][0-9]{0,12}$/;
const SESSION_ID_RE = /^[a-f0-9]{24}$/;

const decodeBase64Url = (value) => {
  const normalized = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const decodeStoredPayload = async (value, encoding) => {
  let json;
  if (encoding === "json") {
    json = String(value);
  } else if (encoding === "gzip+base64url") {
    const decompressed = new Blob([decodeBase64Url(value)])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    json = await new Response(decompressed).text();
  } else {
    throw new Error("unsupported_payload_encoding");
  }
  if (new TextEncoder().encode(json).byteLength > 128 * 1024) {
    throw new Error("payload_too_large");
  }
  const payload = JSON.parse(json);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("invalid_payload");
  }
  return payload;
};

export const readPeople = async (db) => {
  const result = await db.prepare(
    `SELECT user_id, first_seen_ms, last_seen_ms, event_count, session_count,
      ip_address, country, region, city, colo
    FROM telemetry_users
    ORDER BY last_seen_ms DESC, user_id DESC LIMIT ?`,
  ).bind(PEOPLE_LIMIT).all();
  return rows(result);
};

export const readPerson = async (db, userId) => {
  const result = await db.batch([
    db.prepare(
      `SELECT user_id, first_seen_ms, last_seen_ms, event_count, session_count,
        ip_address, country, region, city, colo
      FROM telemetry_users WHERE user_id = ? LIMIT 1`,
    ).bind(userId),
    db.prepare(
      `SELECT session_id, started_at_ms, last_seen_ms, latest_reason,
        event_row_count, year, major, os, device_type, browser, browser_context
      FROM telemetry_session_rollups WHERE user_id = ?
      ORDER BY last_seen_ms DESC, session_id LIMIT ?`,
    ).bind(userId, PERSON_SESSION_LIMIT),
  ]);
  const person = rows(result[0])[0] || null;
  if (!person) return null;
  const sessions = rows(result[1]);
  const incomplete = sessions.filter((session) => !session.year || !session.browser);
  if (incomplete.length) {
    const payloadRows = await db.batch(incomplete.map((session) => db.prepare(
      `SELECT payload_json, payload_encoding FROM telemetry_events
      WHERE session_id = ? ORDER BY received_at_ms DESC, id DESC LIMIT 1`,
    ).bind(session.session_id)));
    for (let index = 0; index < incomplete.length; index += 1) {
      const stored = rows(payloadRows[index])[0];
      if (!stored) continue;
      try {
        const payload = await decodeStoredPayload(stored.payload_json, stored.payload_encoding);
        const profile = payload.profile && typeof payload.profile === "object" ? payload.profile : {};
        const device = payload.device && typeof payload.device === "object" ? payload.device : {};
        incomplete[index].year ||= String(profile.year || "");
        incomplete[index].major ||= Array.isArray(profile.tracks) ? profile.tracks.join(" / ") : "";
        incomplete[index].os ||= String(device.os || "");
        incomplete[index].device_type ||= String(device.deviceType || "");
        incomplete[index].browser ||= String(device.browser || "");
        incomplete[index].browser_context ||= String(device.browserContext || "");
      } catch {
        // A damaged legacy payload should not hide the rest of the user's sessions.
      }
    }
  }
  return { person, sessions };
};

export const readSessionDetails = async (db, userId, sessionId) => {
  const result = await db.prepare(
    `SELECT events.id, events.received_at_ms, events.reason,
      events.payload_json, events.payload_encoding
    FROM telemetry_events AS events
    JOIN telemetry_session_rollups AS sessions
      ON sessions.session_id = events.session_id
    WHERE sessions.user_id = ? AND events.session_id = ?
    ORDER BY events.received_at_ms DESC, events.id DESC LIMIT ?`,
  ).bind(userId, sessionId, SESSION_SNAPSHOT_LIMIT).all();
  const snapshots = [];
  let unreadable = 0;
  for (const row of rows(result)) {
    try {
      snapshots.push({
        id: Number(row.id),
        receivedAtMs: Number(row.received_at_ms),
        reason: String(row.reason),
        payload: await decodeStoredPayload(row.payload_json, row.payload_encoding),
      });
    } catch {
      unreadable += 1;
    }
  }
  return { snapshots, unreadable };
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
    .daily-panel { margin-bottom: 18px; }
    .panel-head { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
    .panel-head h2 { margin-bottom: 5px; }
    .panel-copy { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
    .category-select {
      min-width: 150px;
      border: 1px solid #b9c7e0;
      border-radius: 11px;
      padding: 9px 34px 9px 12px;
      color: var(--ink);
      background: #fff;
      font: inherit;
      font-size: 13px;
      font-weight: 700;
    }
    .daily-chart-wrap { position: relative; margin-top: 18px; overflow-x: auto; }
    .daily-chart { display: block; width: 100%; min-width: 760px; height: auto; }
    .daily-day { cursor: default; outline: none; }
    .daily-day:focus rect, .daily-day:hover rect { filter: brightness(.9); }
    .daily-tooltip {
      position: absolute;
      z-index: 2;
      min-width: 140px;
      transform: translate(-50%, calc(-100% - 10px));
      border-radius: 10px;
      padding: 9px 11px;
      color: #fff;
      background: #172235;
      box-shadow: 0 8px 24px rgba(23, 34, 53, .2);
      font-size: 11px;
      line-height: 1.55;
      pointer-events: none;
    }
    .daily-tooltip strong { display: block; margin-bottom: 3px; font-size: 12px; }
    .daily-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 12px; }
    .legend-item { display: inline-flex; gap: 6px; align-items: center; color: var(--muted); font-size: 11px; }
    .legend-swatch { width: 9px; height: 9px; border-radius: 3px; }
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
      .panel-head { flex-direction: column; }
      .category-select { width: 100%; }
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
    <section class="panel daily-panel" aria-labelledby="daily-title">
      <div class="panel-head">
        <div>
          <h2 id="daily-title">일별 이용자수</h2>
          <p class="panel-copy">최근 60일의 신규 세션을 한국 시간 기준으로 집계합니다. 카테고리를 선택하면 값별 누적 막대로 분리됩니다.</p>
        </div>
        <label>
          <span class="panel-copy">분리 기준</span>
          <select class="category-select" id="daily-category">
            <option value="total">전체</option>
            <option value="years">학년</option>
            <option value="majors">전공</option>
            <option value="regions">추정 지역</option>
            <option value="operatingSystems">운영체제</option>
            <option value="deviceTypes">기기 종류</option>
          </select>
        </label>
      </div>
      <div class="daily-chart-wrap" id="daily-chart-wrap">
        <svg class="daily-chart" id="daily-chart" viewBox="0 0 960 300" role="img" aria-label="최근 60일 일별 이용자수 막대 그래프"></svg>
        <div class="daily-tooltip" id="daily-tooltip" hidden></div>
      </div>
      <div class="daily-legend" id="daily-legend" aria-label="그래프 범례"></div>
      <p class="note">이용자수는 개인정보를 저장하지 않는 신규 세션 수 기준입니다. 기존 세션 날짜는 저장된 session_start 수신 순서로 복원했으며, 날짜를 복원할 수 없는 행은 그래프에서 제외됩니다.</p>
    </section>
    <section class="charts" id="charts"></section>
    <section class="panel">
      <h2>최근 입력 50건</h2>
      <div class="table-wrap">
        <table>
            <thead><tr><th>순번</th><th>일시</th><th>추정 지역</th><th>학년</th><th>전공</th><th>OS</th><th>기기</th></tr></thead>
          <tbody id="recent"></tbody>
        </table>
      </div>
      <p class="note">순번은 D1 삽입 순서를 뜻합니다. IP, 이름, 학번, 원시 User-Agent는 이 화면이나 현재 세션 테이블에 저장·표시하지 않습니다.</p>
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
    const dailyCategory = document.getElementById("daily-category");
    const dailyChart = document.getElementById("daily-chart");
    const dailyChartWrap = document.getElementById("daily-chart-wrap");
    const dailyTooltip = document.getElementById("daily-tooltip");
    const dailyLegend = document.getElementById("daily-legend");
    const palette = ["#335eea", "#16a085", "#f29d38", "#9656d6", "#e45d7a", "#25a4c4", "#77869d", "#c5ccd8"];
    let dailyData = null;
    const text = (value) => String(value ?? "unknown");
    const svgElement = (name, attributes = {}) => {
      const element = document.createElementNS("http://www.w3.org/2000/svg", name);
      Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
      return element;
    };

    const renderDaily = () => {
      if (!dailyData) return;
      dailyChart.replaceChildren();
      dailyLegend.replaceChildren();
      dailyTooltip.hidden = true;
      const totals = dailyData.totals || [];
      const dimension = dailyCategory.value;
      const source = dimension === "total"
        ? totals.map((item) => ({ ...item, label: "전체" }))
        : dailyData.dimensions?.[dimension] || [];
      const labelTotals = new Map();
      source.forEach((item) => labelTotals.set(text(item.label),
        (labelTotals.get(text(item.label)) || 0) + Number(item.count)));
      const topLabels = [...labelTotals.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
        .slice(0, dimension === "total" ? 1 : 7)
        .map(([label]) => label);
      const hasOther = [...labelTotals.keys()].some((label) => !topLabels.includes(label));
      const series = hasOther ? [...topLabels, "기타"] : topLabels;
      const byDate = new Map(totals.map((item) => [item.date, new Map()]));
      source.forEach((item) => {
        if (!byDate.has(item.date)) return;
        const label = topLabels.includes(text(item.label)) ? text(item.label) : "기타";
        const day = byDate.get(item.date);
        day.set(label, (day.get(label) || 0) + Number(item.count));
      });
      const width = 960;
      const height = 300;
      const padding = { top: 18, right: 14, bottom: 42, left: 42 };
      const plotWidth = width - padding.left - padding.right;
      const plotHeight = height - padding.top - padding.bottom;
      const maximum = Math.max(1, ...totals.map((item) => Number(item.count)));
      const roundedMaximum = Math.max(5, Math.ceil(maximum / 5) * 5);
      [0, .5, 1].forEach((ratio) => {
        const y = padding.top + plotHeight * (1 - ratio);
        dailyChart.appendChild(svgElement("line", {
          x1: padding.left, y1: y, x2: width - padding.right, y2: y,
          stroke: "#dce3ed", "stroke-dasharray": "3 5"
        }));
        const label = svgElement("text", {
          x: padding.left - 8, y: y + 4, "text-anchor": "end", fill: "#647083", "font-size": 10
        });
        label.textContent = Math.round(roundedMaximum * ratio);
        dailyChart.appendChild(label);
      });
      const slot = plotWidth / Math.max(1, totals.length);
      const barWidth = Math.max(5, Math.min(11, slot * .68));
      const labelStep = Math.max(1, Math.ceil(totals.length / 8));
      totals.forEach((item, index) => {
        const group = svgElement("g", { class: "daily-day", tabindex: "0", role: "button" });
        const x = padding.left + slot * index + (slot - barWidth) / 2;
        let stack = 0;
        const values = byDate.get(item.date) || new Map();
        series.forEach((label, seriesIndex) => {
          const count = values.get(label) || 0;
          if (!count) return;
          const segmentHeight = plotHeight * count / roundedMaximum;
          const y = padding.top + plotHeight - stack - segmentHeight;
          group.appendChild(svgElement("rect", {
            x, y, width: barWidth, height: segmentHeight,
            rx: Math.min(3, segmentHeight / 2), fill: palette[seriesIndex]
          }));
          stack += segmentHeight;
        });
        if (!stack) group.appendChild(svgElement("rect", {
          x, y: padding.top + plotHeight - 1, width: barWidth, height: 1, rx: 1, fill: "#dce3ed"
        }));
        group.appendChild(svgElement("rect", {
          x: padding.left + slot * index, y: padding.top, width: slot, height: plotHeight, fill: "transparent"
        }));
        const details = series.filter((label) => values.get(label))
          .map((label) => label + " " + Number(values.get(label)).toLocaleString("ko-KR") + "명");
        group.setAttribute("aria-label", item.date + ", " + Number(item.count).toLocaleString("ko-KR") + "명" + (details.length ? ", " + details.join(", ") : ""));
        const showTooltip = () => {
          dailyTooltip.replaceChildren();
          const strong = document.createElement("strong");
          strong.textContent = item.date;
          dailyTooltip.appendChild(strong);
          const lines = details.length ? details : ["전체 0명"];
          lines.forEach((line) => dailyTooltip.append(line, document.createElement("br")));
          dailyTooltip.hidden = false;
          const chartRect = dailyChart.getBoundingClientRect();
          dailyTooltip.style.left = (dailyChart.offsetLeft + x / width * chartRect.width) + "px";
          dailyTooltip.style.top = (dailyChart.offsetTop + (padding.top + plotHeight - stack) / height * chartRect.height) + "px";
        };
        group.addEventListener("mouseenter", showTooltip);
        group.addEventListener("focus", showTooltip);
        group.addEventListener("mouseleave", () => { dailyTooltip.hidden = true; });
        group.addEventListener("blur", () => { dailyTooltip.hidden = true; });
        dailyChart.appendChild(group);
        if (index === 0 || index === totals.length - 1 || index % labelStep === 0) {
          const dateLabel = svgElement("text", {
            x: x + barWidth / 2, y: height - 17, "text-anchor": "middle", fill: "#647083", "font-size": 9
          });
          dateLabel.textContent = item.date.slice(5).replace("-", ".");
          dailyChart.appendChild(dateLabel);
        }
      });
      series.forEach((label, index) => {
        const item = document.createElement("span");
        item.className = "legend-item";
        const swatch = document.createElement("i");
        swatch.className = "legend-swatch";
        swatch.style.background = palette[index];
        const copy = document.createElement("span");
        copy.textContent = label;
        item.append(swatch, copy);
        dailyLegend.appendChild(item);
      });
    };

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
          item.created_at_ms ? new Intl.DateTimeFormat("ko-KR", {
            timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit"
          }).format(new Date(Number(item.created_at_ms))) : "도입 전",
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
        dailyData = data.daily;
        renderDaily();
        renderRecent(data.recent);
      } catch (reason) {
        error.textContent = reason instanceof Error ? reason.message : "알 수 없는 오류가 발생했습니다.";
        error.hidden = false;
      } finally {
        refreshButton.disabled = false;
      }
    };

    refreshButton.addEventListener("click", refresh);
    dailyCategory.addEventListener("change", renderDaily);
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
    if (url.pathname === "/api/people") {
      try {
        return jsonResponse({ ok: true, people: await readPeople(env.DB) });
      } catch {
        return jsonResponse({ ok: false, error: "data_unavailable" }, 503);
      }
    }
    const personMatch = url.pathname.match(/^\/api\/people\/([1-9][0-9]{0,12})$/);
    if (personMatch) {
      try {
        const person = await readPerson(env.DB, Number(personMatch[1]));
        return person
          ? jsonResponse({ ok: true, ...person })
          : jsonResponse({ ok: false, error: "person_not_found" }, 404);
      } catch {
        return jsonResponse({ ok: false, error: "data_unavailable" }, 503);
      }
    }
    const sessionMatch = url.pathname.match(
      /^\/api\/people\/([1-9][0-9]{0,12})\/sessions\/([a-f0-9]{24})$/,
    );
    if (sessionMatch && PERSON_ID_RE.test(sessionMatch[1]) && SESSION_ID_RE.test(sessionMatch[2])) {
      try {
        const details = await readSessionDetails(env.DB, Number(sessionMatch[1]), sessionMatch[2]);
        return details.snapshots.length || details.unreadable
          ? jsonResponse({ ok: true, sessionId: sessionMatch[2], ...details })
          : jsonResponse({ ok: false, error: "session_not_found" }, 404);
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
