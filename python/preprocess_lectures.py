import pandas as pd
import json
import datetime # datetime 모듈 import
import openpyxl
from pathlib import Path # pathlib 모듈 import

def time_to_minutes(time_val):
    """시간 값(문자열 또는 datetime.time)을 자정부터의 분으로 변환합니다."""
    if pd.isna(time_val):
        return None
    # Excel에서 시간을 읽을 때 datetime.time 객체로 읽어오는 경우가 많습니다.
    if isinstance(time_val, datetime.time):
        return time_val.hour * 60 + time_val.minute
    if isinstance(time_val, str):
        try:
            # HH:MM 형식의 문자열 처리
            hours, minutes = map(int, time_val.split(':'))
            return hours * 60 + minutes
        except ValueError:
            return None
    return None

def minutes_to_time_index(minutes):
    """분을 9시부터 시작하는 30분 단위 인덱스로 변환합니다."""
    if minutes is None:
        return None
    # 9:00 AM은 자정으로부터 540분입니다.
    # 인덱스 1은 9:00 AM (540분)에 해당합니다.
    if minutes >= 540:
        # 9시(540분)부터의 경과 시간을 30분으로 나누어 인덱스 계산
        return (minutes - 540) // 30 + 1
    return None # 9:00 AM 이전 시간은 유효하지 않은 것으로 처리합니다.

def preprocess_excel(excel_path, json_output_path):
    """Excel 파일을 읽어 전처리한 후 JSON 파일로 저장합니다."""
    df = pd.read_excel(excel_path)

    lectures_data = []
    for idx, row in df.iterrows():
        lecture_id = idx + 1 # 로드 순서에 기반한 고유 ID

        p1_start_minutes = time_to_minutes(row.get('p1.start'))
        p1_end_minutes = time_to_minutes(row.get('p1.end'))
        p2_start_minutes = time_to_minutes(row.get('p2.start'))
        p2_end_minutes = time_to_minutes(row.get('p2.end'))

        lecture = {
            "id": lecture_id,
            "section": row.get('section'),
            "name": row.get('name'),
            "prof": row.get('prof.'),
            "time_slots": []
        }

        # p1.day, p1.start, p1.end 처리
        if pd.notna(row.get('p1.day')):
            p1_start_index = minutes_to_time_index(p1_start_minutes)
            p1_end_index = minutes_to_time_index(p1_end_minutes - 1 if p1_end_minutes is not None else None)

            if p1_start_index is not None and p1_end_index is not None:
                lecture["time_slots"].append({
                    "day": row['p1.day'],
                    "start_index": p1_start_index,
                    "end_index": p1_end_index
                })
        
        # p2.day, p2.start, p2.end 처리 (존재하는 경우)
        if pd.notna(row.get('p2.day')):
            p2_start_index = minutes_to_time_index(p2_start_minutes)
            p2_end_index = minutes_to_time_index(p2_end_minutes - 1 if p2_end_minutes is not None else None)

            if p2_start_index is not None and p2_end_index is not None:
                lecture["time_slots"].append({
                    "day": row['p2.day'],
                    "start_index": p2_start_index,
                    "end_index": p2_end_index
                })
        
        lectures_data.append(lecture)

    with open(json_output_path, 'w', encoding='utf-8') as f:
        json.dump(lectures_data, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    # **개선점**: 스크립트 파일의 위치를 기준으로 파일 경로를 동적으로 생성합니다.
    # 이렇게 하면 다른 컴퓨터에서도 경로 문제 없이 스크립트를 쉽게 실행할 수 있습니다.
    try:
        # 현재 스크립트 파일이 있는 디렉토리의 절대 경로를 가져옵니다.
        script_dir = Path(__file__).resolve().parent
        
        # 입력 파일과 출력 파일의 경로를 설정합니다.
        # 스크립트와 같은 폴더에 'Lectures.xlsx' 파일이 있다고 가정합니다.
        excel_file_path = script_dir / "Lectures0.xlsx"
        json_file_path = script_dir / "lectures.json"

        # 입력 파일(Excel)이 실제로 존재하는지 확인합니다.
        if not excel_file_path.is_file():
            raise FileNotFoundError(f"'{excel_file_path}' 파일을 찾을 수 없습니다. 스크립트와 동일한 폴더에 파일이 있는지 확인해주세요.")

        preprocess_excel(excel_file_path, json_file_path)
        print(f"성공적으로 '{excel_file_path.name}' 파일을 처리하여 '{json_file_path.name}' 파일로 저장했습니다.")
    
    except FileNotFoundError as e:
        print(f"파일 오류: {e}")
    except Exception as e:
        print(f"처리 중 오류가 발생했습니다: {e}")
        print("pandas와 openpyxl 라이브러리가 설치되어 있는지 확인해주세요 (`pip install pandas openpyxl`).")
        print("또한 Excel 파일의 컬럼 형식이 코드와 일치하는지 확인해주세요.")
        print("(필요한 컬럼: section, name, prof., p1.day, p1.start, p1.end, p2.day, p2.start, p2.end)")
