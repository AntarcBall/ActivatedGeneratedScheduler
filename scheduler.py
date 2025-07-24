# scheduler.py
# 시간표 생성 및 평가와 관련된 모든 복잡한 계산을 담당합니다.

import itertools
import math
import time # Import the time module
from collections import defaultdict
def create_bar(value, min_val, max_val, bar_length=60, fill_char='■', empty_char='□'):
    """
    주어진 값에 대해 터미널용 가로 막대 그래프 문자열을 생성합니다.
    값은 min_val에서 max_val 사이의 범위로 정규화됩니다.
    """
    if not (min_val <= value <= max_val):
        # 값이 범위를 벗어나면 경고하고 가장 가까운 유효 값으로 클램프합니다.
        print(f"경고: 값 {value}가 범위 [{min_val}, {max_val}]를 벗어납니다. 값은 클램프됩니다.")
        value = max(min_val, min(max_val, value))

    # 전체 범위의 크기를 계산합니다.
    total_range = max_val - min_val

    # 0을 기준으로 막대를 그리기 위해 0의 상대적 위치를 계산합니다.
    # 0이 막대의 중앙에 오도록 합니다.
    # 0이 min_val과 max_val 사이의 정확히 중간에 있지 않을 수 있으므로,
    # 0의 위치를 명시적으로 계산해야 합니다.
    zero_position_normalized = (0 - min_val) / total_range
    zero_bar_index = int(zero_position_normalized * bar_length)

    # 값의 상대적 위치를 계산합니다.
    value_position_normalized = (value - min_val) / total_range
    value_bar_index = int(value_position_normalized * bar_length)

    bar_chars = [empty_char] * bar_length

    if value >= 0:
        # 양수 값: 0에서 값까지 채웁니다.
        for i in range(zero_bar_index, value_bar_index):
            if i < bar_length: # 인덱스 범위 확인
                bar_chars[i] = fill_char
    else:
        # 음수 값: 값에서 0까지 채웁니다.
        for i in range(value_bar_index, zero_bar_index):
            if i >= 0: # 인덱스 범위 확인
                bar_chars[i] = fill_char

    # 0 위치에 구분자를 추가합니다.
    if 0 <= zero_bar_index < bar_length:
        bar_chars[zero_bar_index] = '|' # 0 위치를 나타내는 구분자

    return "".join(bar_chars)

class Scheduler:
    """
    사용자 입력을 기반으로 유효한 시간표를 생성하고 평가하는 클래스.
    """
    def __init__(self, selected_lectures, good_slots, bad_slots, weights):
        self.selected_lectures = selected_lectures
        self.good_slots = good_slots
        self.bad_slots = bad_slots
        self.weights = weights
        self.lecture_clusters = self._cluster_lectures()
        self.days = ["Mon", "Tue", "Wed", "Thu", "Fri"]

    def _cluster_lectures(self):
        """선택된 강의를 과목명(name) 기준으로 클러스터링합니다."""
        clusters = defaultdict(list)
        for lec in self.selected_lectures:
            clusters[lec.name].append(lec)
        return list(clusters.values())

    def _check_collision(self, timetable_lectures):
        """주어진 강의 목록(시간표) 내에서 시간 충돌이 있는지 확인합니다."""
        occupied_slots = defaultdict(set)
        for lec in timetable_lectures:
            for slot in lec.time_slots:
                day = slot['day']
                for i in range(slot['start_index'], slot['end_index'] + 1):
                    if i in occupied_slots[day]:
                        return True
                    occupied_slots[day].add(i)
        return False

    def _calculate_loss(self, timetable_lectures):
        """주어진 시간표의 상세 점수(Loss)를 계산합니다."""
        
        # 1. 시간표의 모든 수업 시간 슬롯을 요일별로 정리
        timetable_slots = defaultdict(set)
        for lec in timetable_lectures:
            for slot in lec.time_slots:
                day = slot['day']
                for i in range(slot['start_index'], slot['end_index'] + 1):
                    timetable_slots[day].add(i)

        # 2. 각 속성(property)별 점수 계산
        
        # [Fit Good range] 계산
        fit_good_prop = self._calculate_fit_property(timetable_slots, self.good_slots, self.weights[0]['rss'])
        
        # [Fit Bad range] 계산
        fit_bad_prop = self._calculate_fit_property(timetable_slots, self.bad_slots, self.weights[1]['rss'])

        # [Break time] 계산
        break_time_prop = self._calculate_break_time_property(timetable_slots, self.weights[2]['rss'])

        # [Prefer lectures] 계산
        prefer_prop = sum(lec.preference for lec in timetable_lectures)

        # 3. 최종 Loss 계산 (가중치 적용)
        loss = 0
        loss += fit_good_prop * self.weights[0]['weight'] * -1 # Good range는 점수가 높을수록 좋으므로 -1 곱함
        loss += fit_bad_prop * self.weights[1]['weight']
        loss += break_time_prop * self.weights[2]['weight'] 
        loss += prefer_prop * self.weights[3]['weight'] * -1 # 선호도도 높을수록 좋으므로 -1 곱함
        
        print([fit_good_prop,fit_bad_prop,break_time_prop,prefer_prop])
        min_limit = -50
        max_limit = 150
        print("--- 가로 막대 그래프 ---")
        print(f"범위: {min_limit}에서 {max_limit}까지")
        print(f"막대 길이: 20 문자 ('■' 채움, '□' 비움, '|' 0 지점)")
        print("-" * 30)

        # 각 prop에 대해 막대 그래프를 생성하고 출력합니다.
        print(f"fit_good_prop:   {create_bar(fit_good_prop * self.weights[0]['weight'] *-1 , min_limit, max_limit)}")
        print(f"fit_bad_prop:    {create_bar(fit_bad_prop* self.weights[1]['weight'], min_limit, max_limit)}")
        print(f"break_time_prop: {create_bar(break_time_prop* self.weights[2]['weight'] , min_limit, max_limit)}")
        print(f"prefer_prop:     {create_bar(prefer_prop* self.weights[3]['weight'] * -1, min_limit, max_limit)}")
        print(f"Total loss: {loss}")

        print("-" * 30)
                
        return loss

    def _calculate_fit_property(self, timetable_slots, user_slots, rss_enabled):
        """Fit Good/Bad range 속성 값을 계산합니다."""
        daily_scores = []
        
        # print(f"\n=== Fit Property 계산 디버깅 ===")
        
        for day in self.days:
            # 겹치는 시간의 수
            timetable_set = timetable_slots[day]
            user_set = user_slots[day]
            
            overlap_count = len(timetable_set.intersection(user_set))
            daily_scores.append(overlap_count)
            
            # 디버깅 출력
            # print(f"{day}:")
            # print(f"  시간표 슬롯: {sorted(list(timetable_set)) if timetable_set else '없음'}")
            # print(f"  사용자 슬롯: {sorted(list(user_set)) if user_set else '없음'}")
            # print(f"  교집합: {sorted(list(timetable_set.intersection(user_set))) if timetable_set.intersection(user_set) else '없음'}")
            # print(f"  교집합 개수: {overlap_count}")
        
        # print(f"일별 점수: {daily_scores}")
        
        if rss_enabled:
            result = math.sqrt(sum(score ** 2 for score in daily_scores))
        else:
            result = sum(daily_scores)
        
        # print(f"최종 결과 (RSS={rss_enabled}): {result}")
        # print("=" * 35)
        
        return result

    def _calculate_break_time_property(self, timetable_slots, rss_enabled):
        """Break time 속성 값을 계산합니다."""
        daily_scores = []
        for day in self.days:
            if not timetable_slots[day]:
                daily_scores.append(0)
                continue

            sorted_slots = sorted(list(timetable_slots[day]))
            
            # 수업 블록 찾기
            if not sorted_slots:
                daily_scores.append(0)
                continue

            blocks = []
            current_block = [sorted_slots[0]]
            for i in range(1, len(sorted_slots)):
                if sorted_slots[i] == sorted_slots[i-1] + 1:
                    current_block.append(sorted_slots[i])
                else:
                    blocks.append(current_block)
                    current_block = [sorted_slots[i]]
            blocks.append(current_block)

            # 공강 시간 계산
            break_time = 0
            if len(blocks) > 1:
                for i in range(len(blocks) - 1):
                    break_time += blocks[i+1][0] - blocks[i][-1] - 1
            
            daily_scores.append(break_time)

        if rss_enabled:
            return math.sqrt(sum(score ** 2 for score in daily_scores))
        else:
            return sum(daily_scores)

    def run(self):
        """시간표 생성 및 평가의 전체 프로세스를 실행합니다."""
        start_time = time.time() # Start timing

        if not self.lecture_clusters:
            return [], 0 # Return empty list and 0 elapsed time

        all_combinations = list(itertools.product(*self.lecture_clusters))
        valid_timetables = [list(combo) for combo in all_combinations if not self._check_collision(combo)]

        from model import Timetable
        results = [Timetable(lectures, self._calculate_loss(lectures)) for lectures in valid_timetables]
        
        # Loss가 낮은 순서대로 (더 좋은 시간표 순서대로) 정렬
        results.sort(key=lambda x: x.score)
        
        end_time = time.time() # End timing
        elapsed_time = end_time - start_time
        
        return results, elapsed_time # Return results and elapsed time