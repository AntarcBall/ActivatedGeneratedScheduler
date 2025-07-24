# config.py
# 애플리케이션의 설정값들을 관리합니다.

class Config:
    # 윈도우 설정
    WINDOW_TITLE = "Activated-Generative Schedule; AGS for DGIST made by H.J."
    WINDOW_WIDTH = 1100
    WINDOW_HEIGHT = 800
    CONTENT_REL_WIDTH = 0.9
    CONTENT_REL_HEIGHT = 0.9
    
    # 색상 설정
    COLOR_BACKGROUND = "#f0f0f0"
    COLOR_FRAME_BACKGROUND = "#ffffff"
    COLOR_SELECTED_ROW = "#e6f3ff"
    COLOR_GOOD_SLOT = "#c8e6c9"
    COLOR_BAD_SLOT = "#ffcdd2"
    
    # 폰트 설정
    FONT_DEFAULT = ("Arial", 11)
    FONT_HEADING = ("Arial", 10, "bold")
    FONT_DESCRIPTION = ("Arial", 9)
    
    # 시간표 폰트 설정 (P6용)
    TIMETABLE_HEADER_FONT_SIZE = 12        # 헤더 폰트 크기
    TIMETABLE_TIME_FONT_SIZE = 10          # 시간 열 폰트 크기
    TIMETABLE_LECTURE_MIN_FONT_SIZE = 4    # 강의 텍스트 최소 폰트 크기
    TIMETABLE_LECTURE_MAX_FONT_SIZE = 13   # 강의 텍스트 최대 폰트 크기
    
    # 페이지 설명
    PAGE_DESCRIPTIONS = {
        1: "I.G.W.T. .",
        2: "선택한 강의의 선호도를 조정하세요. +/- 버튼으로 선호도를 변경할 수 있습니다.",
        3: "선호하는 시간대를 선택하세요. 선택한 시간대에 강의가 배치될 확률이 높아집니다.",
        4: "피하고 싶은 시간대를 선택하세요. 선택한 시간대는 가능한 한 피해서 시간표를 생성합니다.",
        5: "각 조건의 중요도를 설정하세요. 값이 높을수록 해당 조건이 시간표 생성에 더 큰 영향을 미칩니다.",
        6: "생성된 시간표입니다. 좌우 버튼을 사용하여 다른 결과를 확인할 수 있습니다."
    }
    
    # 테이블 헤더
    PAGE1_HEADERS = ["Name", "Prof", "Section", "Time"]
    PAGE2_HEADERS = ["Name", "Prof", "Section", "Preference", "+", "-"]
    TIMETABLE_HEADERS = ["Time", "Mon", "Tue", "Wed", "Thu", "Fri"]
    
    # 페이지 5 속성
    PAGE5_ATTRIBUTES = [
        "Fit Good range",
        "Fit Bad range",
        "Break time",
        "Prefer lectures"
    ]

    # 캐시 파일 설정
    SELECTED_LECTURES_CACHE_FILE = "selected_lectures_cache.json"

    # 시간 슬롯 인덱스 조정 (bias)
    TIME_SLOT_START_BIAS = -1  # 시작 인덱스에 더할 값 (예: 1을 더하면 9:00 -> 9:30)
    TIME_SLOT_END_BIAS = -1    # 종료 인덱스에 더할 값 (예: 1을 더하면 9:00 -> 9:30)

    # 학점 계산 규칙
    DEFAULT_CREDIT = 3
    CREDIT_EXCEPTIONS_BY_NAME = {
        '일반물리실험Ⅱ': 1,
        '일반생물학 실험': 1,
        '일반화학실험Ⅰ': 1,
        '미래소양강좌': 1,
        'Academic English: Research and Writing': 2,
        '진로탐색 및 전공설계 II': 1,}
        # 여기에 다른 예외 과목들을 추가할 수 있습니다.
        # 예: '특수연구': 1
    