#!/usr/bin/env python3
"""Refresh scheduler JSON and bilingual opened-course metadata from DGIST XLS exports."""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DAY_PATTERN = re.compile(
    r"(월|화|수|목|금|토|일|Mon|Tue|Wed|Thu|Fri|Sat|Sun)"
    r"(\d{2}):(\d{2})-(\d{2}):(\d{2})\(([^)]*)\)"
)
WEEKDAY_KO = {"월", "화", "수", "목", "금"}
EN_TO_KO_DAY = {"Mon": "월", "Tue": "화", "Wed": "수", "Thu": "목", "Fri": "금"}
EXCLUDED_COURSE = re.compile(r"URGP|UGRP|URP|인턴|Internship", re.IGNORECASE)

CATEGORY_EN = {
    "트랙": "Track",
    "쓰기·읽기 중점": "Writing·Reading",
    "영어": "English",
    "화학": "Chemistry",
    "생명과학": "Biology",
    "수학": "Mathematics",
    "물리": "Physics",
    "공학선택": "Engineering Selection",
    "비트랙/융합": "Non-Track/Convergence",
    "반도체공학": "Semiconductor Engineering",
    "컴퓨터공학": "Computer Engineering",
    "창업": "Entrepreneurship",
}
TRACK_EN = {
    "뇌과학": "Brain Science",
    "생명과학": "Life Science",
    "물리학": "Physics",
    "전자공학": "Electronic Engineering",
    "기계공학": "Mechanical Engineering",
    "화학공학": "Chemical Engineering",
    "화학": "Chemistry",
    "컴퓨터공학": "Computer Engineering",
    "재료공학": "Materials Science & Engineering",
    "반도체공학": "Semiconductor Engineering",
}

# The official English export uses commas both between instructors and inside a
# single instructor's name. These arrays preserve the official individual names
# for professor links while `prof` retains the official display string verbatim.
MULTI_PROFESSORS_EN = {
    "BR201#01": ["Suh, Byung Chang", "Hanbin Jeong", "Um, JI Won"],
    "BR202#01": ["Hyun, Jung Ho", "Lee, Hyo Sang", "HAN KYOUNG CHOE"],
    "BR302#01": ["Lee Kwang", "Cho, Yongcheol"],
    "BR303#01": ["Yu, Woo Kyung", "Lee Kwang", "HAN KYOUNG CHOE"],
    "BR306#01": ["Hyun, Jung Ho", "HAN KYOUNG CHOE"],
    "BR406#01": ["Lee, Hyo Sang", "Oh, Yong Seok"],
    "BS116#01": ["Sukkyoo Lee", "Yu, Seong-Woon"],
    "BS117#01": ["Suh, Byung Chang", "LEE, SANGIM"],
    "BS117#02": ["Um, JI Won", "CHOI, IL-KYU"],
    "CE201a#01": [
        "Kim, Chan Yeon",
        "Seunghyeon Kim",
        "Un-Hyuck Kim",
        "Choi, Jong Min",
        "Dong Hae Ho",
    ],
    "CHEM302#01": ["SEONG KYUN KIM", "Jang, Yun Hee"],
    "HSS210#01": ["Lee, Jeong Ah", "Bae, Haeun", "Yoon, Ji Sung"],
    "LS202#01": ["Woo, Hye Ryun", "Song-Yi Lee", "Kim, Kyu Hyung", "Lee, Sung Bae"],
    "LS202#02": ["Woo, Hye Ryun", "Song-Yi Lee", "Kim, Kyu Hyung", "Lee, Sung Bae"],
    "LS205#01": ["Song-Yi Lee", "Cho, Jeong A"],
    "LS206#01": ["Kim, Min Sik", "Kim, Yoo Ri", "Kim, Min Seok"],
    "LS303b#01": ["Lee, Chang-Hun", "Yu, Woo Kyung"],
    "LS307#01": ["Um, JI Won", "Kim, Jin Hae", "Lee, Young Sam"],
    "LS313a#01": ["Lee, Young Sam", "Lee, Chang-Hun"],
    "LS401a#01": ["Nam, Chang Hoon", "CHOI, IL-KYU"],
    "MECH205#01": ["Sukho Song", "Eojin Rho", "Minsoo Kim", "Ah-Hyoung Lee"],
    "MECH404a#01": ["Seongmin Lee", "DongWook Kim"],
    "PHY301#01": ["Park, Keeseong", "You, Chun Yeol", "Kim, Youngwook", "Chang-Hee Cho"],
    "TP314#01": ["Kim, Yoo Ri", "Sohyun Jung"],
}

HEADERS = [
    "no",
    "department",
    "program",
    "course_number",
    "section",
    "name",
    "professor",
    "classification",
    "detail_classification",
    "lecture_type",
    "curriculum_group",
    "field",
    "area",
    "track_text",
    "degree_classification",
    "grade_method",
    "credit",
    "theory_hours",
    "practice_hours",
    "code_share",
    "english",
    "schedule",
    "prerequisites",
    "notes",
]


def normalize(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalized_course_name(value: object, language: str) -> str:
    name = normalize(value)
    if language == "ko":
        return re.sub(r"\s*-\s*영어강의$", "", name).strip()
    return re.sub(
        r"\s*-\s*EMI\s*\(English-Medium Instruction\)\s*course$",
        "",
        name,
        flags=re.IGNORECASE,
    ).strip()


def section_text(value: object) -> str:
    return normalize(value).zfill(2)


def key_for(row: dict[str, str]) -> str:
    return f"{row['course_number']}#{section_text(row['section'])}"


def convert_xls_to_csv(source: Path, destination: Path) -> Path:
    libreoffice = shutil.which("libreoffice") or shutil.which("soffice")
    if not libreoffice:
        raise RuntimeError("LibreOffice is required to read legacy .xls exports")
    subprocess.run(
        [
            libreoffice,
            "--headless",
            "--convert-to",
            "csv",
            "--outdir",
            str(destination),
            str(source),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    converted = destination / f"{source.stem}.csv"
    if not converted.exists():
        raise RuntimeError(f"LibreOffice did not create {converted}")
    return converted


def read_export(source: Path) -> list[dict[str, str]]:
    with tempfile.TemporaryDirectory(prefix="ags-course-export-") as temp_dir:
        csv_path = convert_xls_to_csv(source, Path(temp_dir))
        with csv_path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.reader(handle))
    if len(rows) < 4 or len(rows[2]) != len(HEADERS):
        raise ValueError(f"Unexpected DGIST export format: {source}")
    result = []
    for values in rows[3:]:
        values += [""] * (len(HEADERS) - len(values))
        row = {name: normalize(value) for name, value in zip(HEADERS, values)}
        if row["course_number"]:
            result.append(row)
    return result


def schedule_slots(schedule: str) -> list[dict[str, int | str]]:
    slots = []
    for match in DAY_PATTERN.finditer(schedule):
        day = EN_TO_KO_DAY.get(match[1], match[1])
        if day not in WEEKDAY_KO:
            continue
        start_minutes = int(match[2]) * 60 + int(match[3])
        end_minutes = int(match[4]) * 60 + int(match[5])
        if start_minutes % 30 or end_minutes % 30:
            raise ValueError(f"Schedule is not aligned to 30 minutes: {match.group(0)}")
        slots.append(
            {
                "day": day,
                "start_index": (start_minutes - 9 * 60) // 30 + 1,
                "end_index": (end_minutes - 9 * 60) // 30,
            }
        )
    return slots


def inherited_enrichment(
    row: dict[str, str],
    current_by_key: dict[str, dict],
    current_by_course: dict[str, list[dict]],
) -> tuple[str, list[str], int | None]:
    key = key_for(row)
    existing = current_by_key.get(key)
    if not existing and row["course_number"] == "MECH304a":
        existing = current_by_key.get(f"MECH304#{section_text(row['section'])}")
    if not existing:
        siblings = current_by_course.get(row["course_number"], [])
        if siblings:
            return (
                siblings[0]["category"],
                list(siblings[0].get("major_tracks", [])),
                None,
            )
    if not existing and row["course_number"] == "RP303":
        return "반도체공학", ["반도체공학"], None
    if not existing:
        return row["area"], [], None
    return (
        existing["category"],
        list(existing.get("major_tracks", [])),
        int(existing["id"]),
    )


def professor_arrays(ko_row: dict[str, str], en_row: dict[str, str]) -> tuple[list[str], list[str]]:
    ko_names = [
        item.strip()
        for item in ko_row["professor"].split(",")
        if item.strip() and item.strip() != "미배정"
    ]
    if not ko_names:
        return [], []
    key = key_for(ko_row)
    if len(ko_names) == 1:
        en_names = [] if en_row["professor"].lower() == "unassigned" else [en_row["professor"]]
    else:
        en_names = MULTI_PROFESSORS_EN.get(key, [])
        if len(en_names) != len(ko_names):
            raise ValueError(f"Missing official professor split for {key}: {en_row['professor']}")
    return ko_names, en_names


def build_lecture_data(
    ko_rows: list[dict[str, str]],
    en_rows: list[dict[str, str]],
    current: list[dict],
) -> tuple[list[dict], list[dict]]:
    en_by_key = {key_for(row): row for row in en_rows}
    if {key_for(row) for row in ko_rows} != set(en_by_key):
        raise ValueError("Korean and English exports do not contain the same course sections")

    current_by_key = {
        f"{row['course_number']}#{section_text(row['section'])}": row for row in current
    }
    current_by_course: dict[str, list[dict]] = {}
    for row in current:
        current_by_course.setdefault(row["course_number"], []).append(row)
    next_id = max(int(row["id"]) for row in current) + 1
    used_ids: set[int] = set()

    korean = []
    english = []
    for ko_row in ko_rows:
        en_row = en_by_key[key_for(ko_row)]
        searchable = " ".join(
            [ko_row["course_number"], ko_row["name"], en_row["name"]]
        )
        if EXCLUDED_COURSE.search(searchable) or not ko_row["schedule"]:
            continue

        category, tracks, inherited_id = inherited_enrichment(
            ko_row, current_by_key, current_by_course
        )
        lecture_id = inherited_id
        if lecture_id is None or lecture_id in used_ids:
            lecture_id = next_id
            next_id += 1
        used_ids.add(lecture_id)
        ko_professors, en_professors = professor_arrays(ko_row, en_row)
        base = {
            "id": lecture_id,
            "course_number": ko_row["course_number"],
            "section": int(ko_row["section"]),
            "credit": float(ko_row["credit"]) if "." in ko_row["credit"] else int(ko_row["credit"]),
            "time_slots": schedule_slots(ko_row["schedule"]),
        }
        current_lecture = current_by_key.get(key_for(ko_row), {})
        everytime = current_lecture.get("everytime")
        korean.append(
            {
                **base,
                "name": normalized_course_name(ko_row["name"], "ko"),
                "prof": ko_row["professor"],
                "professors": ko_professors,
                "classification": ko_row["classification"],
                "category": category,
                "major_tracks": tracks,
                **({"everytime": everytime} if everytime else {}),
            }
        )
        english.append(
            {
                **base,
                "name": normalized_course_name(en_row["name"], "en"),
                "prof": en_row["professor"],
                "professors": en_professors,
                "classification": en_row["classification"],
                "category": CATEGORY_EN.get(category, en_row["area"]),
                "major_tracks": [TRACK_EN.get(track, track) for track in tracks],
                **({"everytime": everytime} if everytime else {}),
            }
        )
    return korean, english


def numeric_or_text(value: str) -> int | float | str:
    if not value:
        return ""
    try:
        number = float(value)
    except ValueError:
        return value
    return int(number) if number.is_integer() else number


def build_metadata(
    ko_rows: list[dict[str, str]],
    en_rows: list[dict[str, str]],
    previous_metadata: dict,
) -> dict:
    en_by_key = {key_for(row): row for row in en_rows}
    old_by_key = {
        f"{row['course_number']}#{section_text(row['section'])}": row
        for row in previous_metadata.get("courses", [])
    }
    courses = []
    for ko_row in ko_rows:
        en_row = en_by_key[key_for(ko_row)]
        old = old_by_key.get(key_for(ko_row), {})
        if not old and ko_row["course_number"] == "MECH304a":
            old = old_by_key.get(f"MECH304#{section_text(ko_row['section'])}", {})
        courses.append(
            {
                "course_number": ko_row["course_number"],
                "section": section_text(ko_row["section"]),
                "name": normalized_course_name(ko_row["name"], "ko"),
                "name_en": normalized_course_name(en_row["name"], "en"),
                "raw_name": ko_row["name"],
                "raw_name_en": en_row["name"],
                "professor": ko_row["professor"],
                "professor_en": en_row["professor"],
                "department": ko_row["department"],
                "department_en": en_row["department"],
                "program": ko_row["program"],
                "program_en": en_row["program"],
                "classification": ko_row["classification"],
                "classification_en": en_row["classification"],
                "detail_classification": ko_row["detail_classification"],
                "detail_classification_en": en_row["detail_classification"],
                "lecture_type": ko_row["lecture_type"],
                "lecture_type_en": en_row["lecture_type"],
                "curriculum_group": ko_row["curriculum_group"],
                "curriculum_group_en": en_row["curriculum_group"],
                "field": ko_row["field"],
                "field_en": en_row["field"],
                "area": ko_row["area"],
                "area_en": en_row["area"],
                "track_text": ko_row["track_text"],
                "track_text_en": en_row["track_text"],
                "degree_classification": ko_row["degree_classification"],
                "degree_classification_en": en_row["degree_classification"],
                "grade_method": ko_row["grade_method"],
                "grade_method_en": en_row["grade_method"],
                "credit": numeric_or_text(ko_row["credit"]),
                "theory_hours": ko_row["theory_hours"],
                "practice_hours": ko_row["practice_hours"],
                "code_share": ko_row["code_share"],
                "english": ko_row["english"].upper() == "Y",
                "schedule_text": ko_row["schedule"],
                "schedule_text_en": en_row["schedule"],
                "prerequisites": ko_row["prerequisites"],
                "prerequisites_en": en_row["prerequisites"],
                "notes": ko_row["notes"],
                "notes_en": en_row["notes"],
                "is_semiconductor_related": bool(old.get("is_semiconductor_related", False)),
                "semiconductor_tags": list(old.get("semiconductor_tags", [])),
            }
        )
    return {
        "source": {
            "ko": "data_ex/개설강좌.xls",
            "en": "data_ex/Offered+Courses.xls",
        },
        "row_count": len(courses),
        "courses": courses,
    }


def write_json(path: Path, value: object) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--korean-xls", type=Path, default=ROOT / "data_ex/개설강좌.xls")
    parser.add_argument(
        "--english-xls", type=Path, default=ROOT / "data_ex/Offered+Courses.xls"
    )
    parser.add_argument("--korean-json", type=Path, default=ROOT / "lectures.json")
    parser.add_argument("--english-json", type=Path, default=ROOT / "lectures_eng.json")
    parser.add_argument(
        "--metadata-json",
        type=Path,
        default=ROOT / "assets/ags-open-course-metadata.json",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    current = json.loads(args.korean_json.read_text(encoding="utf-8"))
    previous_metadata = json.loads(args.metadata_json.read_text(encoding="utf-8"))
    ko_rows = read_export(args.korean_xls)
    en_rows = read_export(args.english_xls)
    korean, english = build_lecture_data(ko_rows, en_rows, current)
    metadata = build_metadata(ko_rows, en_rows, previous_metadata)
    write_json(args.korean_json, korean)
    write_json(args.english_json, english)
    write_json(args.metadata_json, metadata)
    print(
        f"refreshed {len(korean)} scheduler sections and "
        f"{metadata['row_count']} opened-course metadata rows"
    )


if __name__ == "__main__":
    main()
