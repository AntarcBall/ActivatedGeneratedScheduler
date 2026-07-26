#!/usr/bin/env python3
"""Build a privacy-safe, deduplicated usage summary from a Telegram HTML export."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import statistics
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo


TEXT_BLOCK_RE = re.compile(
    r'<div class="text">\s*(.*?)\s*</div>',
    flags=re.IGNORECASE | re.DOTALL,
)
EVENT_RE = re.compile(r"^- #(\d+) \+(\d+)ms (\S+)(.*)$", flags=re.MULTILINE)
FIELD_RE_TEMPLATE = r"^{name}:\s*(.*)$"
SEOUL = ZoneInfo("Asia/Seoul")

CATEGORY_ALIASES = {
    "물리학": "물리",
    "물리적": "물리",
    "쓰다·읽기": "쓰기·읽기 중점",
    "쓰기·읽기": "쓰기·읽기 중점",
    "전체 트랙": "트랙 전체",
}
EXCLUDED_CATEGORY_LABELS = {"", "none", "카테고리", "의견"}
KNOWN_TRACKS = {
    "기계공학",
    "뇌과학",
    "물리학",
    "반도체공학",
    "생명과학",
    "수학",
    "재료공학",
    "전자공학",
    "컴퓨터공학",
    "화학",
    "화학공학",
}


def clean_message(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", "\n", fragment, flags=re.IGNORECASE)
    fragment = re.sub(r"<[^>]+>", "", fragment)
    return html.unescape(fragment).replace("\xa0", " ").strip()


def extract_messages(source: Path) -> list[str]:
    raw = source.read_text(encoding="utf-8")
    return [clean_message(match) for match in TEXT_BLOCK_RE.findall(raw)]


def field(text: str, name: str) -> str:
    match = re.search(
        FIELD_RE_TEMPLATE.format(name=re.escape(name)),
        text,
        flags=re.MULTILINE,
    )
    return match.group(1).strip() if match else ""


def nested_field(text: str, name: str) -> str:
    match = re.search(rf"^- {re.escape(name)}:\s*(.*)$", text, flags=re.MULTILINE)
    return match.group(1).strip() if match else ""


def parse_public_ip(text: str) -> str:
    value = field(text, "public_ip")
    if value:
        return value
    match = re.search(r"^public_ip:\s*\n([^\n]+)", text, flags=re.MULTILINE)
    return match.group(1).strip() if match else ""


def parse_categories(text: str) -> dict[str, int]:
    match = re.search(
        r"^category_clicks:\s*\n(.*?)(?:\nweb_vitals_by_page:|\nevents:|\Z)",
        text,
        flags=re.MULTILINE | re.DOTALL,
    )
    if not match:
        return {}
    return {
        label.strip(): int(count)
        for label, count in re.findall(
            r"^- (.*?):\s*(\d+)$",
            match.group(1),
            flags=re.MULTILINE,
        )
    }


def parse_vitals(text: str) -> dict[str, dict[str, float | int | None]]:
    match = re.search(
        r"^web_vitals_by_page:\s*\n(.*?)(?:\nevents:|\Z)",
        text,
        flags=re.MULTILINE | re.DOTALL,
    )
    if not match:
        return {}
    vitals: dict[str, dict[str, float | int | None]] = {}
    pattern = (
        r"^- (.*?): LCP=(n/a|\d+)ms? "
        r"INP=(n/a|\d+)ms? CLS=([0-9.]+)"
    )
    for page, lcp, inp, cls in re.findall(pattern, match.group(1), re.MULTILINE):
        vitals[page] = {
            "lcp": None if lcp == "n/a" else int(lcp),
            "inp": None if inp == "n/a" else int(inp),
            "cls": float(cls),
        }
    return vitals


def parse_snapshot(text: str) -> dict:
    navigation = re.search(
        r"^navigation:\s*ttfb=(\d+)ms dcl=(\d+)ms load=(\d+)ms",
        text,
        flags=re.MULTILINE,
    )
    snapshot = {
        key: field(text, key)
        for key in (
            "reason",
            "time",
            "page_id",
            "tab_state",
            "year",
            "major",
            "result_skip",
            "result_errors",
            "total_clicks",
        )
    }
    snapshot.update(
        {
            key: nested_field(text, key)
            for key in (
                "type",
                "os",
                "browser",
                "context",
                "ua",
                "timezone",
                "screen",
                "viewport",
            )
        }
    )
    snapshot["public_ip"] = parse_public_ip(text)
    snapshot["categories"] = parse_categories(text)
    snapshot["vitals"] = parse_vitals(text)
    if navigation:
        snapshot["navigation"] = [int(value) for value in navigation.groups()]
    return snapshot


def parse_events(text: str) -> list[dict]:
    events = []
    for sequence, at_ms, event_type, detail_text in EVENT_RE.findall(text):
        details = dict(re.findall(r"(\w+)=([^ ]+)", detail_text))
        events.append(
            {
                "sequence": int(sequence),
                "atMs": int(at_ms),
                "type": event_type,
                **details,
            }
        )
    return events


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def percentage(value: int, total: int) -> float:
    return round((100 * value / total), 1) if total else 0.0


def median(values: list[float | int], digits: int = 0) -> float | int | None:
    if not values:
        return None
    value = statistics.median(values)
    return round(value, digits) if digits else round(value)


def p75(values: list[float | int], digits: int = 0) -> float | int | None:
    if not values:
        return None
    if len(values) < 2:
        value = values[0]
    else:
        value = statistics.quantiles(values, n=4, method="inclusive")[2]
    return round(value, digits) if digits else round(value)


def ranked(counter: Counter, total: int | None = None, limit: int | None = None) -> list[dict]:
    rows = []
    ordered = sorted(counter.items(), key=lambda item: (-item[1], str(item[0])))
    if limit is not None:
        ordered = ordered[:limit]
    for label, count in ordered:
        row = {"label": label or "Unknown", "count": count}
        if total is not None:
            row["share"] = percentage(count, total)
        rows.append(row)
    return rows


def normalize_category(label: str) -> str:
    label = CATEGORY_ALIASES.get(label.strip(), label.strip())
    return "" if label in EXCLUDED_CATEGORY_LABELS else label


def make_dashboard_data(messages: list[str]) -> dict:
    legacy: dict[str, list[dict]] = {}
    detailed: dict[str, dict] = {}

    for text in messages:
        if text.startswith("AGS category usage"):
            session_id = field(text, "session")
            if session_id:
                legacy.setdefault(session_id, []).append(parse_snapshot(text))
            continue

        if not text.startswith("AGS usage telemetry v3"):
            continue
        session_id = field(text, "session")
        if not session_id:
            continue
        session = detailed.setdefault(
            session_id,
            {"snapshots": [], "events": {}},
        )
        if not text.startswith("AGS usage telemetry v3 (events continued)"):
            session["snapshots"].append(parse_snapshot(text))
        for event in parse_events(text):
            session["events"][event["sequence"]] = event

    legacy_latest = {}
    for session_id, snapshots in legacy.items():
        usable = [snapshot for snapshot in snapshots if snapshot.get("time")]
        if usable:
            legacy_latest[session_id] = max(usable, key=lambda item: item["time"])

    detailed_ready = {}
    for session_id, session in detailed.items():
        usable = [snapshot for snapshot in session["snapshots"] if snapshot.get("time")]
        if not usable:
            continue
        detailed_ready[session_id] = {
            "first": min(usable, key=lambda item: item["time"]),
            "last": max(usable, key=lambda item: item["time"]),
            "events": [
                event
                for _, event in sorted(session["events"].items())
            ],
        }

    all_sessions = [
        {"kind": "legacy", **snapshot}
        for snapshot in legacy_latest.values()
    ] + [
        {"kind": "detailed", **session["last"]}
        for session in detailed_ready.values()
    ]
    all_times = [parse_iso(session["time"]) for session in all_sessions]
    first_at = min(all_times)
    last_at = max(all_times)

    daily = Counter()
    daily_detailed = Counter()
    for snapshots in legacy.values():
        session_first = min(
            (item for item in snapshots if item.get("time")),
            key=lambda item: item["time"],
        )
        date = parse_iso(session_first["time"]).astimezone(SEOUL).date().isoformat()
        daily[date] += 1
    for session in detailed_ready.values():
        date = parse_iso(session["first"]["time"]).astimezone(SEOUL).date().isoformat()
        daily[date] += 1
        daily_detailed[date] += 1

    first_date = min(daily)
    last_date = max(daily)
    cursor = datetime.fromisoformat(first_date).date()
    end_date = datetime.fromisoformat(last_date).date()
    timeline = []
    while cursor <= end_date:
        label = cursor.isoformat()
        timeline.append(
            {
                "date": label,
                "sessions": daily[label],
                "detailedSessions": daily_detailed[label],
            }
        )
        cursor += timedelta(days=1)

    detailed_sessions = list(detailed_ready.values())
    detailed_count = len(detailed_sessions)

    def has_event(session: dict, event_type: str) -> bool:
        return any(event["type"] == event_type for event in session["events"])

    def entered(session: dict, page_id: str) -> bool:
        return any(
            event["type"] == "page_enter" and event.get("page_id") == page_id
            for event in session["events"]
        )

    funnel_eligible = [
        session
        for session in detailed_sessions
        if entered(session, "landing") or entered(session, "step_1")
    ]
    funnel = [
        {"label": "시작·선택 화면 도달", "count": len(funnel_eligible)},
        {
            "label": "강의 선택 화면 이용",
            "count": sum(entered(session, "step_1") for session in funnel_eligible),
        },
        {
            "label": "생성 경로 진입",
            "count": sum(entered(session, "step_5") for session in funnel_eligible),
        },
        {
            "label": "시간표 생성 완료",
            "count": sum(
                has_event(session, "result_generate_complete")
                for session in funnel_eligible
            ),
        },
    ]
    funnel_start = funnel[0]["count"]
    completed = funnel[-1]["count"]

    device_types = Counter(session["last"].get("type") or "unknown" for session in detailed_sessions)
    os_counts = Counter(session["last"].get("os") or "unknown" for session in detailed_sessions)
    browser_counts = Counter(
        session["last"].get("browser") or "unknown"
        for session in detailed_sessions
    )
    context_counts = Counter(
        session["last"].get("context") or "unknown"
        for session in detailed_sessions
    )

    visitor_signatures = set()
    for session in detailed_sessions:
        latest = session["last"]
        signature_source = "|".join(
            [
                latest.get("public_ip", ""),
                latest.get("ua", ""),
                latest.get("screen", ""),
            ]
        )
        visitor_signatures.add(
            hashlib.sha256(signature_source.encode("utf-8")).hexdigest()
        )

    years = Counter(
        (session.get("year") or "unknown")
        for session in all_sessions
    )
    tracks = Counter()
    combinations = Counter()
    for session in all_sessions:
        major = session.get("major", "")
        if not major or major == "unknown":
            continue
        combinations[major] += 1
        for track in (part.strip() for part in major.split("/")):
            if track in KNOWN_TRACKS:
                tracks[track] += 1

    category_reach = Counter()
    category_clicks = Counter()
    for session in all_sessions:
        normalized_in_session = set()
        for raw_label, click_count in session.get("categories", {}).items():
            label = normalize_category(raw_label)
            if not label or click_count <= 0:
                continue
            normalized_in_session.add(label)
            category_clicks[label] += click_count
        category_reach.update(sorted(normalized_in_session))

    stage_labels = {
        "landing": "시작",
        "step_1": "강의 선택",
        "step_2": "공강 설정",
        "step_3": "연강 설정",
        "step_4": "점심 설정",
        "step_5": "생성 설정",
        "step_6": "결과",
    }
    stage_durations = []
    for page_id, label in stage_labels.items():
        per_session = []
        for session in detailed_sessions:
            values = [
                int(event["active_ms"])
                for event in session["events"]
                if (
                    event["type"] == "page_exit"
                    and event.get("page_id") == page_id
                    and event.get("active_ms", "").isdigit()
                    and int(event["active_ms"]) <= 1_800_000
                )
            ]
            if values:
                per_session.append(statistics.median(values) / 1000)
        stage_durations.append(
            {
                "id": page_id,
                "label": label,
                "medianSeconds": median(per_session, 1),
                "p75Seconds": p75(per_session, 1),
                "sessions": len(per_session),
            }
        )

    generation_times = [
        int(event["duration_ms"])
        for session in detailed_sessions
        for event in session["events"]
        if (
            event["type"] == "result_generate_complete"
            and event.get("duration_ms", "").isdigit()
        )
    ]

    performance = []
    for page_id, label in (("landing", "시작 화면"), ("step_1", "강의 선택")):
        row = {"id": page_id, "label": label}
        for metric in ("lcp", "inp", "cls"):
            values = [
                session["last"].get("vitals", {}).get(page_id, {}).get(metric)
                for session in detailed_sessions
            ]
            clean_values = [value for value in values if value is not None]
            digits = 3 if metric == "cls" else 0
            row[metric] = {
                "median": median(clean_values, digits),
                "p75": p75(clean_values, digits),
                "samples": len(clean_values),
            }
        performance.append(row)

    skip_sessions = sum(
        has_event(session, "result_skip_click")
        for session in detailed_sessions
    )
    error_sessions = sum(
        has_event(session, "client_error") or has_event(session, "unhandled_rejection")
        for session in detailed_sessions
    )
    mobile_sessions = device_types["mobile"]

    return {
        "schemaVersion": 1,
        "source": {
            "label": "동의 기반 AGS 이용 로그",
            "periodStart": first_at.astimezone(SEOUL).isoformat(),
            "periodEnd": last_at.astimezone(SEOUL).isoformat(),
            "timezone": "Asia/Seoul",
            "legacySessions": len(legacy_latest),
            "detailedSessions": detailed_count,
            "notes": [
                "같은 세션의 반복 Telegram 스냅샷과 이어진 이벤트 메시지를 합쳐 중복을 제거했습니다.",
                "사람 수가 아닌 브라우저 세션을 기본 단위로 사용합니다.",
                "IP, User-Agent, 세션 ID 등 원본 식별 정보는 결과 파일에 포함하지 않습니다.",
            ],
        },
        "overview": {
            "sessions": len(all_sessions),
            "detailedSessions": detailed_count,
            "estimatedEnvironments": len(visitor_signatures),
            "funnelSessions": funnel_start,
            "completedSessions": completed,
            "completionRate": percentage(completed, funnel_start),
            "mobileSessions": mobile_sessions,
            "mobileShare": percentage(mobile_sessions, detailed_count),
            "skipSessions": skip_sessions,
            "skipShare": percentage(skip_sessions, detailed_count),
            "errorSessions": error_sessions,
            "generationMedianMs": median(generation_times),
            "generationP75Ms": p75(generation_times),
        },
        "timeline": timeline,
        "funnel": [
            {
                **row,
                "shareOfStart": percentage(row["count"], funnel_start),
            }
            for row in funnel
        ],
        "devices": {
            "types": ranked(device_types, detailed_count),
            "operatingSystems": ranked(os_counts, detailed_count),
            "browsers": ranked(browser_counts, detailed_count),
            "contexts": ranked(context_counts, detailed_count),
        },
        "audience": {
            "years": ranked(years, len(all_sessions)),
            "tracks": ranked(tracks, len(all_sessions), 10),
            "trackCombinations": ranked(combinations, len(all_sessions), 8),
        },
        "categories": [
            {
                "label": label,
                "sessions": session_count,
                "share": percentage(session_count, len(all_sessions)),
                "clicks": category_clicks[label],
            }
            for label, session_count in sorted(
                category_reach.items(),
                key=lambda item: (-item[1], -category_clicks[item[0]], item[0]),
            )[:12]
        ],
        "stageDurations": stage_durations,
        "performance": performance,
        "findings": [
            {
                "eyebrow": "전환",
                "title": "강의 선택 화면이 핵심 이탈 구간입니다",
                "evidence": (
                    f"선택 흐름에 들어온 {funnel_start}개 세션 중 "
                    f"{completed}개가 시간표 생성까지 완료했습니다."
                ),
                "action": "강의 선택 직후의 다음 행동과 바로 생성 기능을 더 명확하게 안내합니다.",
            },
            {
                "eyebrow": "모바일",
                "title": "모바일을 기본 화면으로 설계해야 합니다",
                "evidence": (
                    f"상세 로그 {detailed_count}개 중 모바일은 "
                    f"{mobile_sessions}개({percentage(mobile_sessions, detailed_count)}%)입니다."
                ),
                "action": "하단 핵심 버튼의 짧은 문구, 터치 영역, 인앱 브라우저 호환성을 우선합니다.",
            },
            {
                "eyebrow": "빠른 경로",
                "title": "상당수 사용자가 중간 설정을 건너뜁니다",
                "evidence": (
                    f"{skip_sessions}개 세션({percentage(skip_sessions, detailed_count)}%)이 "
                    "바로 결과 보기 동작을 사용했습니다."
                ),
                "action": "‘결과’보다 목적이 선명한 ‘시간표 만들기’ 문구를 사용합니다.",
            },
            {
                "eyebrow": "안정성",
                "title": "생성 자체는 빠르고 안정적입니다",
                "evidence": (
                    f"완료 이벤트 기준 생성 중앙값은 {median(generation_times)}ms이며 "
                    f"수집된 클라이언트 오류 세션은 {error_sessions}개입니다."
                ),
                "action": "생성 엔진보다 선택 경험과 첫 사용 안내에 개선 역량을 집중합니다.",
            },
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Telegram messages.html export")
    parser.add_argument("output", type=Path, help="Destination JSON path")
    args = parser.parse_args()

    data = make_dashboard_data(extract_messages(args.source))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {args.output}: "
        f"{data['overview']['sessions']} sessions, "
        f"{data['overview']['detailedSessions']} detailed"
    )


if __name__ == "__main__":
    main()
