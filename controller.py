# controller.py
# View와 Model 사이의 상호작용을 제어합니다.
from scheduler import Scheduler
import numpy as np

class Controller:
    def __init__(self, model, view):
        self.model = model
        self.view = view
        # === 수정된 부분: drag_info 속성 제거 ===

    def start(self):
        self.calculate_and_update_credits()
        self.view.show_page(self.model.current_page)

    def get_all_lectures(self):
        return self.model.all_lectures

    def get_selected_lectures(self):
        return self.model.get_selected_lectures()

    def next_page(self):
        self.model.next_page() # Increment page first
        self.view.show_page(self.model.current_page)
        if self.model.current_page == 7: # If we just moved to page 7 (from page 6)
            self.view.root.after(100, self._run_scheduler_and_display)

    def prev_page(self):
        self.model.prev_page()
        self.view.show_page(self.model.current_page)
        
    def _run_scheduler_and_display(self):
        scheduler = Scheduler(
            self.model.get_selected_lectures(),
            self.model.good_slots,
            self.model.bad_slots,
            self.model.loss_weights
        )
        self.model.generated_timetables, elapsed_time = scheduler.run()
        
        if self.model.generated_timetables:
            scores = [tt.score for tt in self.model.generated_timetables]
            mean_score = np.mean(scores)
            std_dev_score = np.std(scores)
            
            score_counts = {score: scores.count(score) for score in scores}

            for tt in self.model.generated_timetables:
                tt.z_score = (tt.score - mean_score) / std_dev_score if std_dev_score != 0 else 0.0
                tt.same_score_count = score_counts[tt.score]

        self.model.current_timetable_index = 0
        self.display_current_timetable(elapsed_time=elapsed_time)

    def display_current_timetable(self, elapsed_time=None):
        
        if self.model.generated_timetables:
            timetable = self.model.generated_timetables[self.model.current_timetable_index]
            total = len(self.model.generated_timetables)
            index = self.model.current_timetable_index + 1
            self.view.display_timetable(timetable, index, total, elapsed_time)
        else:
            self.view.display_no_result()

    def show_prev_timetable(self):
        if self.model.generated_timetables and self.model.current_timetable_index > 0:
            self.model.current_timetable_index -= 1
            self.display_current_timetable()

    def show_next_timetable(self):
        if self.model.generated_timetables and self.model.current_timetable_index < len(self.model.generated_timetables) - 1:
            self.model.current_timetable_index += 1
            self.display_current_timetable()

    def show_prev_timetable_fast(self):
        if self.model.generated_timetables:
            self.model.current_timetable_index = max(0, self.model.current_timetable_index - 10)
            self.display_current_timetable()

    def show_next_timetable_fast(self):
        if self.model.generated_timetables:
            self.model.current_timetable_index = min(len(self.model.generated_timetables) - 1, self.model.current_timetable_index + 10)
            self.display_current_timetable()

    def on_p1_lecture_select(self, event, tree):
        # === 수정된 부분: 강의 ID 기반으로 선택 로직 통일 ===
        # identify_region으로 클릭된 영역이 유효한지 확인
        if tree.identify_region(event.x, event.y) == "heading":
            return # 헤더 클릭 시 무시
        
        item_id = tree.identify_row(event.y)
        if item_id:
            # item_id는 이제 lecture.id 입니다.
            self.model.toggle_lecture_selection(int(item_id))
            # Get the updated lecture object to pass its selected state
            updated_lecture = next((lec for lec in self.model.all_lectures if lec.id == int(item_id)), None)
            if updated_lecture:
                self.view.update_p1_lecture_display(tree, updated_lecture.id, updated_lecture.selected)
            self.calculate_and_update_credits()

    def _calculate_credits(self, lectures):
        """
        주어진 강의 목록의 총 학점을 계산합니다.
        Config 파일의 CREDIT_EXCEPTIONS_BY_NAME 규칙을 사용합니다.
        """
        if not lectures:
            return 0
        
        unique_lectures = {}
        for lec in lectures:
            if lec.name not in unique_lectures:
                unique_lectures[lec.name] = lec
        
        total_credits = 0
        exceptions = self.view.config.CREDIT_EXCEPTIONS_BY_NAME
        default_credit = self.view.config.DEFAULT_CREDIT

        for name, lec in unique_lectures.items():
            # 예외 목록에 과목명이 있으면 해당 학점을, 없으면 기본 학점을 더합니다.
            total_credits += exceptions.get(name, default_credit)
                
        return total_credits

    def calculate_and_update_credits(self):
        """
        선택된 강의들의 총 학점을 계산하고 UI를 업데이트합니다.
        """
        selected_lectures = self.model.get_selected_lectures()
        total_credits = self._calculate_credits(selected_lectures)
        
        # view의 라벨 업데이트
        if hasattr(self.view, 'page1_credits_label'):
            self.view.page1_credits_label.config(text=f"총 학점: {total_credits}")

    def get_credits_for_timetable(self, lectures):
        """
        주어진 강의 목록의 총 학점을 계산합니다.
        """
        return self._calculate_credits(lectures)

    def on_p2_preference_click(self, event, tree):
        """P2의 +/- 버튼 클릭을 처리하여 선호도를 조절합니다."""
        item_id = tree.identify_row(event.y)
        if not item_id: return

        lecture_id = int(item_id)
        column_id = tree.identify_column(event.x)
        
        current_pref = 0
        for lec in self.model.get_selected_lectures():
            if lec.id == lecture_id:
                current_pref = lec.preference
                break
        
        if column_id == '#5': # '+' 컬럼
            new_pref = min(1, current_pref + 1)
        elif column_id == '#6': # '-' 컬럼
            new_pref = max(-1, current_pref - 1)
        else:
            return

        self.model.set_lecture_preference(lecture_id, new_pref)
        self.view.update_p2_lecture_preference_display(tree, lecture_id, new_pref)

    def get_timeslots(self, page_num):
        return self.model.good_slots if page_num == 3 else self.model.bad_slots

    # === 수정된 부분: 개별 셀 클릭으로 시간 선택 로직 변경 ===
    def on_timeslot_click(self, event, tree, page_num):
        """P3, P4의 타임슬롯을 클릭하여 개별적으로 선택/해제합니다."""
        row_id = tree.identify_row(event.y)
        col_id = tree.identify_column(event.x)
        
        # 헤더나 시간 열(첫 번째 열)을 클릭한 경우 무시
        if not row_id or not col_id or int(col_id.replace('#', '')) == 1:
            return

        # 클릭된 셀의 요일과 시간 인덱스 파악
        day = self.view.config.TIMETABLE_HEADERS[int(col_id.replace('#', '')) - 1]
        time_index = int(row_id)
        
        # 모델의 시간 슬롯 업데이트 (Set으로 단일 인덱스 전달)
        self.model.update_time_slots(page_num, day, {time_index})
        
        # 변경사항을 반영하기 위해 Treeview만 업데이트
        self.view.update_timetable_grid_display(tree, page_num)
    # =======================================================

    # === 수정된 부분: 드래그 관련 메서드 제거 ===
    # on_timeslot_drag, on_timeslot_release 제거
    # =======================================

    def get_weight(self, index):
        return self.model.loss_weights[index]['weight']

    def get_rss_option(self, index):
        return self.model.loss_weights[index]['rss']

    def on_slider_change(self, value, index, label):
        rounded_value = int(round(float(value)))
        self.model.update_weight(index, rounded_value)
        label.config(text=str(rounded_value))

    def on_rss_toggle(self, index):
        self.model.toggle_rss(index)
