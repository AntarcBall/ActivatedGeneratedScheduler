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

def parse_csv_eng_to_json(csv_path, json_path):
    lectures = []
    
    if not os.path.exists(csv_path):
        print(f"File not found: {csv_path}")
        return

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        header_row = next(reader) # NO,Department,Degree...
        
        for row in reader:
            if not row or len(row) < 22:
                continue
            
            if not row[0].strip():
                continue

            try:
                l_id = int(row[0])
                section_str = row[4]
                section = int(section_str) if section_str.isdigit() else 0
                
                # Course Title often has "Name - Name" or just "Name"
                name_full = row[5]
                if " - " in name_full:
                    name = name_full.split(" - ")[0].strip()
                else:
                    name = name_full.strip()
                
                prof = row[6]
                classification = row[7]
                # In eng csv, category might be in Course Areas (col 12) or Course Category (col 10)
                # Looking at lectures.csv: row[12] was category (교과영역)
                # Courses_eng.csv col 12 is Course Areas
                category = row[12]
                
                major_track_str = row[13] # Track
                major_tracks = []
                if major_track_str.strip():
                    parts = major_track_str.split('/')
                    major_tracks = [p.strip() for p in parts if p.strip()]

                credit_str = row[16]
                credit = float(credit_str) if credit_str.replace('.', '', 1).isdigit() else 0.0
                time_str = row[21]
                
                time_slots = []
                
                if time_str:
                    parts = time_str.split(',')
                    for part in parts:
                        part = part.strip()
                        # Regex for English days: Mon, Tue, Wed, Thu, Fri
                        match = re.search(r'(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(\d{1,2}:\d{2})-(\d{1,2}:\d{2})', part)
                        if match:
                            eng_day = match.group(1)
                            day = DAY_MAP.get(eng_day, eng_day) # Convert to Korean '월', '화' to match internal logic or keep it consistent
                            
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
    parse_csv_eng_to_json("Courses_eng.csv", "lectures_eng.json")
    parse_csv_eng_to_json("Courses_eng.csv", "frontend/public/lectures_eng.json")
