# model.py
# 애플리케이션의 데이터와 비즈니스 로직을 담당합니다.
import json
import os
import sys
from config import Config

def resource_path(relative_path):
    """
    개발 환경(IDE에서 실행)과 PyInstaller로 빌드된 환경 모두에서
    리소스 파일의 정확한 경로를 찾아 반환합니다.
    """
    try:
        # PyInstaller는 임시 폴더에 파일을 압축 해제하고 이 경로를 _MEIPASS에 저장합니다.
        base_path = sys._MEIPASS
    except Exception:
        # 개발 환경에서는 현재 스크립트의 절대 경로를 사용합니다.
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

class Timetable:
    """
    생성된 시간표 하나를 나타내는 데이터 클래스.
    강의 목록과 해당 시간표의 평가 점수를 저장합니다.
    """
    def __init__(self, lectures, score):
        self.lectures = lectures
        self.score = score
        self.z_score = None
        self.same_score_count = None

class Lecture:
    """강의 정보를 저장하는 데이터 클래스"""
    def __init__(self, data):
        self.id = data.get('id')
        self.section = data.get('section')
        self.name = data.get('name')
        self.prof = data.get('prof')
        
        config = Config()
        
        # === 핵심 수정 사항: 한글 요일을 영어로 변환하는 로직 추가 ===
        DAY_MAP = {'월': 'Mon', '화': 'Tue', '수': 'Wed', '목': 'Thu', '금': 'Fri'}
        
        self.time_slots = []
        for slot in data.get('time_slots', []):
            # 1-based index from JSON to 0-based for internal use
            start_idx = slot.get('start_index', 0) + config.TIME_SLOT_START_BIAS
            end_idx = slot.get('end_index', 0) + config.TIME_SLOT_END_BIAS
            
            original_day = slot.get('day', '').strip()
            # Map Korean day to English day. If not in map, use original value.
            english_day = DAY_MAP.get(original_day, original_day)
            
            self.time_slots.append({
                'day': english_day,
                'start_index': start_idx,
                'end_index': end_idx
            })
        # =======================================================

        self.selected = False
        self.preference = 0 # -1: 비선호, 0: 보통, 1: 선호

    def get_time_string(self):
        """강의 시간 정보를 문자열로 변환합니다."""
        parts = []
        for slot in self.time_slots:
            day = slot.get('day', '')
            # 인덱스를 시간으로 변환 (0 -> 9:00, 1 -> 9:30, ...)
            start_h = 9 + slot.get('start_index', 0) // 2
            start_m = "00" if slot.get('start_index', 0) % 2 == 0 else "30"
            end_h = 9 + (slot.get('end_index', 0) + 1) // 2
            end_m = "00" if (slot.get('end_index', 0) + 1) % 2 == 0 else "30"
            parts.append(f"{day} {start_h}:{start_m}~{end_h}:{end_m}")
        return ", ".join(parts)
    


class Model:
    """
    애플리케이션의 데이터와 상태를 관리하는 클래스
    """
    def __init__(self):
        self.config = Config()
        self.current_page = 1
        self.total_pages = 6
        self.all_lectures = []
        
        # === 핵심 수정 사항: resource_path를 사용하여 파일 경로를 가져오도록 변경 ===
        lectures_file_path = resource_path('lectures.json')
        self.load_lectures_from_json(lectures_file_path)
        # =================================================================

        self.load_selected_lectures_from_cache()

        self.good_slots = {day: set() for day in ["Mon", "Tue", "Wed", "Thu", "Fri"]}
        self.bad_slots = {day: set() for day in ["Mon", "Tue", "Wed", "Thu", "Fri"]}

        self.loss_weights = [{'weight': 5, 'rss': False} for _ in range(len(Config().PAGE5_ATTRIBUTES))]
        
        self.generated_timetables = []
        self.current_timetable_index = 0

    def load_lectures_from_json(self, filepath):
        """주어진 경로의 JSON 파일에서 강의 데이터를 로드합니다."""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.all_lectures = [Lecture(item) for item in data]
            print(f"성공: '{os.path.basename(filepath)}' 파일이 로드되었습니다.")
        except FileNotFoundError:
            print(f"오류: '{filepath}' 파일을 찾을 수 없습니다.")
            self.all_lectures = []
        except json.JSONDecodeError:
            print(f"오류: '{filepath}' 파일이 올바른 JSON 형식이 아닙니다.")
            self.all_lectures = []
        except Exception as e:
            print(f"파일 로딩 중 알 수 없는 오류 발생: {e}")
            self.all_lectures = []


    def save_selected_lectures_to_cache(self):
        """현재 선택된 강의들의 ID를 캐시 파일에 저장합니다."""
        selected_ids = [lec.id for lec in self.all_lectures if lec.selected]
        try:
            with open(self.config.SELECTED_LECTURES_CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(selected_ids, f)
        except IOError as e:
            print(f"[ERROR] Could not save selected lecture IDs to cache: {e}")

    def load_selected_lectures_from_cache(self):
        """캐시 파일에서 선택된 강의 ID를 로드하고 해당 강의를 선택 상태로 설정합니다."""
        try:
            with open(self.config.SELECTED_LECTURES_CACHE_FILE, 'r', encoding='utf-8') as f:
                selected_ids = json.load(f)
            
            for lec in self.all_lectures:
                if lec.id in selected_ids:
                    lec.selected = True
        except FileNotFoundError:
            pass # Cache file may not exist on first run
        except (json.JSONDecodeError, IOError) as e:
            print(f"[ERROR] Could not load selected lecture IDs from cache: {e}")

    def get_selected_lectures(self):
        return [lec for lec in self.all_lectures if lec.selected]

    def toggle_lecture_selection(self, lecture_id):
        """주어진 ID를 가진 강의의 선택 상태를 변경합니다."""
        for lec in self.all_lectures:
            if lec.id == lecture_id:
                lec.selected = not lec.selected
                break

    def set_lecture_preference(self, lecture_id, value):
        for lec in self.get_selected_lectures():
            if lec.id == lecture_id:
                lec.preference = value
                break
    
    def update_time_slots(self, page_num, day, slots_to_toggle):
        """
        사용자가 선택한 시간 슬롯을 업데이트합니다.
        Controller는 이미 0-based 인덱스를 전달하므로, 추가 변환은 필요 없습니다.
        """
        target_slots = self.good_slots if page_num == 3 else self.bad_slots
        
        is_negative_selection = any(slot in target_slots[day] for slot in slots_to_toggle)

        if is_negative_selection:
            target_slots[day].difference_update(slots_to_toggle)
        else:
            target_slots[day].update(slots_to_toggle)

    def update_weight(self, index, weight):
        if 0 <= index < len(self.loss_weights):
            self.loss_weights[index]['weight'] = weight

    def toggle_rss(self, index):
        if 0 <= index < len(self.loss_weights):
            self.loss_weights[index]['rss'] = not self.loss_weights[index]['rss']
            return self.loss_weights[index]['rss']
        return False

    def next_page(self):
        if self.current_page < self.total_pages:
            self.current_page += 1

    def prev_page(self):
        if self.current_page > 1:
            self.current_page -= 1
