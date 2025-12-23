import csv
import json
import re
import os

def parse_time(t_str):
    h, m = map(int, t_str.split(':'))
    return h * 60 + m

def get_slot_index(minutes):
    # 9:00 is 540 minutes.
    # index 1 starts at 540.
    # (minutes - 540) / 30 + 1
    return int((minutes - 540) / 30) + 1

def parse_csv_to_json(csv_path, json_path):
    lectures = []
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        # Skip header lines
        # Line 1: 개설강좌,,,,
        # Line 2: ,,,,
        # Line 3: NO,개설전공,,,
        
        # Read until we find the header row starting with 'NO'
        header_row = None
        for row in reader:
            if row and row[0] == 'NO':
                header_row = row
                break
        
        if not header_row:
            print("Could not find header row starting with 'NO'")
            return

        for row in reader:
            if not row or len(row) < 22:
                continue
            
            # Skip empty NO rows
            if not row[0].strip():
                continue

            try:
                l_id = int(row[0])
                section_str = row[4]
                section = int(section_str) if section_str.isdigit() else 0
                name = row[5]
                prof = row[6]
                classification = row[7]
                category = row[12]
                time_str = row[21]
                
                time_slots = []
                
                if time_str:
                    # Split multiple times (comma separated)
                    # Be careful of commas inside parentheses if any, though here it looks like "," separates days
                    parts = time_str.split(',')
                    for part in parts:
                        part = part.strip()
                        # Regex to find pattern like 월09:00-11:00
                        match = re.search(r'([월화수목금토일])(\d{1,2}:\d{2})-(\d{1,2}:\d{2})', part)
                        if match:
                            day = match.group(1)
                            start_time = match.group(2)
                            end_time = match.group(3)
                            
                            start_min = parse_time(start_time)
                            end_min = parse_time(end_time)
                            
                            start_idx = get_slot_index(start_min)
                            # End index calc
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
                    "time_slots": time_slots
                })
            except ValueError as e:
                print(f"Skipping row due to error: {row} - {e}")
                continue

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(lectures, f, ensure_ascii=False, indent=4)
    
    print(f"Successfully converted {len(lectures)} lectures to {json_path}")

if __name__ == "__main__":
    parse_csv_to_json("lectures.csv", "lectures.json")
