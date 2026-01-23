import csv
import json
import re
import os

def parse_time(t_str):
    h, m = map(int, t_str.split(':'))
    return h * 60 + m

def get_slot_index(minutes):
    return int((minutes - 540) / 30) + 1

DAY_MAP = {
    'Mon': '월',
    'Tue': '화',
    'Wed': '수',
    'Thu': '목',
    'Fri': '금',
    'Sat': '토',
    'Sun': '일'
}

# Korean to English Track Mapping
TRACK_MAPPING = {
    '뇌과학': 'Brain Science',
    '기계공학': 'Mechanical Engineering',
    '물리학': 'Physics',
    '생명과학': 'Life Science',
    '전자공학': 'Electronic Engineering',
    '화학공학': 'Chemical Engineering',
    '재료공학': 'Materials Science & Engineering',
    '컴퓨터공학': 'Computer Engineering',
    '화학': 'Chemistry'
}

def get_korean_tracks(lectures_csv_path):
    """Reads the Korean lectures.csv and returns a map of ID -> [English Tracks]"""
    id_to_tracks = {}
    if not os.path.exists(lectures_csv_path):
        print(f"Warning: Korean lectures file not found at {lectures_csv_path}")
        return id_to_tracks

    with open(lectures_csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        # Skip 3 header lines for lectures.csv
        # Line 1: 개설강좌,,,,
        # Line 2: ,,,,
        # Line 3: NO,개설전공,,,
        header_row = None
        for row in reader:
            if row and row[0] == 'NO':
                header_row = row
                break
        
        for row in reader:
            if not row or len(row) < 14 or not row[0].strip():
                continue
            
            try:
                l_id = int(row[0])
                track_str = row[13] # 전공(트랙)
                
                eng_tracks = []
                if track_str.strip():
                    # Remove (*) and split
                    cleaned = track_str.replace('(*)', '')
                    parts = cleaned.split('/')
                    
                    for p in parts:
                        korean_track = p.strip()
                        if korean_track in TRACK_MAPPING:
                            eng_tracks.append(TRACK_MAPPING[korean_track])
                        elif korean_track:
                            # Fallback if mapping missing, though unlikely for standard tracks
                            eng_tracks.append(korean_track)
                
                if eng_tracks:
                    id_to_tracks[l_id] = eng_tracks
            except ValueError:
                continue
                
    return id_to_tracks

def parse_csv_eng_to_json(csv_path, json_path, korean_csv_path):
    lectures = []
    
    if not os.path.exists(csv_path):
        print(f"File not found: {csv_path}")
        return

    # Load Korean tracks to fill missing English data
    id_track_map = get_korean_tracks(korean_csv_path)

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header_row = next(reader) 
        
        for row in reader:
            if not row or len(row) < 22:
                continue
            
            if not row[0].strip():
                continue

            try:
                l_id = int(row[0])
                course_number = row[3].strip()
                section_str = row[4]
                section = int(section_str) if section_str.isdigit() else 0
                
                name_full = row[5]
                if " - " in name_full:
                    parts = name_full.split(" - ")
                    if len(parts) >= 2 and parts[0].strip() == parts[1].strip():
                        name = parts[0].strip()
                    else:
                        name = name_full.strip()
                else:
                    name = name_full.strip()
                
                prof = row[6]
                classification = row[7]
                category = row[12] # Course Areas
                
                # Try to get tracks from English CSV first (Column 13)
                major_track_str = row[13]
                major_tracks = []
                if major_track_str.strip():
                    parts = major_track_str.split('/')
                    major_tracks = [p.strip() for p in parts if p.strip()]
                
                # If empty, use data from Korean CSV
                if not major_tracks and l_id in id_track_map:
                    major_tracks = id_track_map[l_id]

                credit_str = row[16]
                credit = float(credit_str) if credit_str.replace('.', '', 1).isdigit() else 0.0
                time_str = row[21]
                
                time_slots = []
                
                if time_str:
                    parts = time_str.split(',')
                    for part in parts:
                        part = part.strip()
                        match = re.search(r'(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(\d{1,2}:\d{2})-(\d{1,2}:\d{2})', part)
                        if match:
                            eng_day = match.group(1)
                            day = DAY_MAP.get(eng_day, eng_day)
                            
                            start_time = match.group(2)
                            end_time = match.group(3)
                            
                            start_min = parse_time(start_time)
                            end_min = parse_time(end_time)
                            
                            start_idx = get_slot_index(start_min)
                            end_idx = int((end_min - 540) / 30)
                            
                            time_slots.append({
                                "day": day,
                                "start_index": start_idx,
                                "end_index": end_idx
                            })
                
                lectures.append({
                    "id": l_id,
                    "course_number": course_number,
                    "section": section,
                    "name": name,
                    "prof": prof,
                    "classification": classification,
                    "category": category,
                    "major_tracks": major_tracks,
                    "credit": credit,
                    "time_slots": time_slots
                })
            except Exception as e:
                print(f"Skipping row {row[0]} due to error: {e}")
                continue

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(lectures, f, ensure_ascii=False, indent=4)
    
    print(f"Successfully converted {len(lectures)} English lectures to {json_path}")

if __name__ == "__main__":
    parse_csv_eng_to_json("Courses_eng.csv", "lectures_eng.json", "lectures.csv")
    parse_csv_eng_to_json("Courses_eng.csv", "frontend/public/lectures_eng.json", "lectures.csv")
