#!/usr/bin/env python3
"""Fetch Everytime subjects and attach their lecture-rating linkage to scheduler data."""

from __future__ import annotations

import argparse
import datetime as dt
import getpass
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENDPOINT = "https://api.everytime.kr/find/timetable/subject/list"
COURSE_CODE_PATTERN = re.compile(r"-(?P<course_number>[^-]+)-(?P<section>\d+)$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Fetch all Everytime timetable subjects, save a sanitized snapshot, "
            "and enrich lectures.json plus lectures_eng.json."
        )
    )
    parser.add_argument("--campus-id", default="166")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--semester", type=int, default=2)
    parser.add_argument("--page-size", type=int, default=50)
    parser.add_argument("--delay", type=float, default=0.2)
    parser.add_argument("--cookie-env", default="EVERYTIME_COOKIE")
    parser.add_argument(
        "--allow-unmatched",
        action="store_true",
        help="Write results even when some scheduler sections are absent from Everytime.",
    )
    parser.add_argument("--korean-json", type=Path, default=ROOT / "lectures.json")
    parser.add_argument("--english-json", type=Path, default=ROOT / "lectures_eng.json")
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "assets/ags-everytime-lecture-ratings.json",
    )
    return parser.parse_args()


def request_headers(cookie: str) -> dict[str, str]:
    return {
        "Accept": "*/*",
        "Accept-Language": "ko-KR,ko;q=0.8",
        "Cache-Control": "no-cache",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Cookie": cookie,
        "Origin": "https://everytime.kr",
        "Pragma": "no-cache",
        "Priority": "u=1, i",
        "Referer": "https://everytime.kr/",
        "Sec-CH-UA": '"Not;A=Brand";v="8", "Chromium";v="150", "Brave";v="150"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Linux"',
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "Sec-GPC": "1",
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
        ),
    }


def fetch_page(
    cookie: str,
    campus_id: str,
    year: int,
    semester: int,
    page_size: int,
    start_num: int,
) -> tuple[str, list[dict[str, str]]]:
    payload = urllib.parse.urlencode(
        {
            "campusId": campus_id,
            "year": year,
            "semester": semester,
            "limitNum": page_size,
            "startNum": start_num,
        }
    ).encode()
    request = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers=request_headers(cookie),
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            root = ET.fromstring(response.read())
    except urllib.error.HTTPError as error:
        if error.code == 401:
            raise RuntimeError(
                "Everytime rejected the session cookie (HTTP 401). "
                "Copy a fresh x-et-device/etsid cookie and retry."
            ) from error
        raise
    if root.tag != "response":
        raise ValueError(f"Unexpected Everytime XML root: {root.tag}")
    return root.attrib.get("now", ""), [dict(node.attrib) for node in root.findall("subject")]


def fetch_all(args: argparse.Namespace, cookie: str) -> tuple[str, list[dict[str, str]]]:
    subjects: list[dict[str, str]] = []
    response_now = ""
    start_num = 0
    while True:
        current_now, page = fetch_page(
            cookie,
            args.campus_id,
            args.year,
            args.semester,
            args.page_size,
            start_num,
        )
        response_now = current_now or response_now
        subjects.extend(page)
        print(f"fetched startNum={start_num}: {len(page)} subjects")
        if len(page) < args.page_size:
            break
        start_num += len(page)
        if args.delay:
            time.sleep(args.delay)
    ids = [subject["id"] for subject in subjects]
    if len(ids) != len(set(ids)):
        raise ValueError("Everytime returned duplicate subject IDs while paginating")
    return response_now, subjects


def numeric_rate(value: str) -> int | float:
    number = float(value or 0)
    return int(number) if number.is_integer() else number


def subject_record(subject: dict[str, str]) -> dict:
    match = COURSE_CODE_PATTERN.search(subject["code"])
    if not match:
        raise ValueError(f"Cannot parse Everytime course code: {subject['code']}")
    return {
        "subject_id": int(subject["id"]),
        "code": subject["code"],
        "course_number": match.group("course_number"),
        "section": int(match.group("section")),
        "name": subject["name"],
        "professor": subject["professor"],
        "lecture_id": int(subject["lectureId"]) if subject.get("lectureId") else None,
        "lecture_rate": numeric_rate(subject.get("lectureRate", "0")),
        "popular": int(subject.get("popular", "0")),
    }


def course_key(record: dict) -> tuple[str, int]:
    return str(record["course_number"]).casefold(), int(record["section"])


def enrich_lectures(
    path: Path,
    ratings_by_key: dict[tuple[str, int], dict],
) -> tuple[list[dict], list[tuple[str, int]]]:
    lectures = json.loads(path.read_text(encoding="utf-8"))
    missing = []
    for lecture in lectures:
        rating = ratings_by_key.get(course_key(lecture))
        if rating is None:
            lecture.pop("everytime", None)
            missing.append((lecture["course_number"], int(lecture["section"])))
            continue
        lecture["everytime"] = {
            "subject_id": rating["subject_id"],
            "lecture_id": rating["lecture_id"],
            "lecture_rate": rating["lecture_rate"],
            "popular": rating["popular"],
        }
    return lectures, missing


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    args = parse_args()
    cookie = os.environ.get(args.cookie_env, "").strip()
    if not cookie:
        cookie = getpass.getpass(
            f"{args.cookie_env} is unset; paste the Everytime Cookie header: "
        ).strip()
    if not cookie:
        raise SystemExit("An Everytime session cookie is required")

    response_now, raw_subjects = fetch_all(args, cookie)
    subjects = [subject_record(subject) for subject in raw_subjects]
    ratings_by_key: dict[tuple[str, int], dict] = {}
    duplicate_keys: list[tuple[str, int]] = []
    for subject in subjects:
        key = course_key(subject)
        if key in ratings_by_key:
            duplicate_keys.append((subject["course_number"], subject["section"]))
        ratings_by_key[key] = subject
    if duplicate_keys:
        raise ValueError(f"Duplicate Everytime course/section keys: {duplicate_keys}")

    korean, missing_ko = enrich_lectures(args.korean_json, ratings_by_key)
    english, missing_en = enrich_lectures(args.english_json, ratings_by_key)
    if missing_ko != missing_en:
        raise ValueError("Korean and English lecture files produced different match results")
    if missing_ko and not args.allow_unmatched:
        missing_text = ", ".join(
            f"{course}-{section:02d}" for course, section in missing_ko
        )
        raise RuntimeError(
            "Refusing to replace rating data because scheduler sections were not matched: "
            f"{missing_text}. Use --allow-unmatched only if this is expected."
        )

    snapshot = {
        "source": {
            "provider": "Everytime",
            "endpoint": ENDPOINT,
            "campus_id": args.campus_id,
            "year": args.year,
            "semester": args.semester,
            "response_now": response_now,
            "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        },
        "row_count": len(subjects),
        "matched_lecture_count": len(korean) - len(missing_ko),
        "subjects": subjects,
    }
    write_json(args.output, snapshot)
    write_json(args.korean_json, korean)
    write_json(args.english_json, english)

    rated = sum(subject["lecture_rate"] > 0 for subject in subjects)
    print(
        f"saved {len(subjects)} subjects ({rated} with ratings); "
        f"matched {len(korean) - len(missing_ko)}/{len(korean)} scheduler sections"
    )
    if missing_ko:
        print(
            "unmatched scheduler sections: "
            + ", ".join(f"{course}-{section:02d}" for course, section in missing_ko)
        )


if __name__ == "__main__":
    main()
