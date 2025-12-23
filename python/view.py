# view.py
# 사용자 인터페이스(UI)를 생성하고 관리합니다.
import sys
import io
import os # resource_path 함수를 위해 os 모듈을 임포트합니다.

import tkinter as tk
from tkinter import ttk
import random
import colorsys
from config import Config
from PIL import Image, ImageTk # Pillow 라이브러리 임포트

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

class View:
    def __init__(self, root, controller):
        self.root = root
        self.controller = controller
        self.config = Config()
        self.frames = {}
        self.slider_labels = {} # Added for page 5 slider value display
        self.p1_tree_scroll_pos = 0.0 # Added for page 1 scroll position
        self.image_references = [] # 이미지 객체 참조를 저장할 리스트 (가비지 컬렉션 방지)
        self._setup_window()
        self._create_main_container()

    def _setup_window(self):
        self.root.title(self.config.WINDOW_TITLE)
        self.root.geometry(f"{self.config.WINDOW_WIDTH}x{self.config.WINDOW_HEIGHT}")
        self.root.configure(bg=self.config.COLOR_BACKGROUND)
        style = ttk.Style(self.root)
        style.theme_use('clam')
        style.configure("TFrame", background=self.config.COLOR_FRAME_BACKGROUND)
        style.configure("TLabel", background=self.config.COLOR_FRAME_BACKGROUND, font=self.config.FONT_DEFAULT)
        style.configure("TButton", font=self.config.FONT_DEFAULT, padding=5)
        style.configure("Treeview", font=self.config.FONT_DEFAULT, rowheight=24)
        style.configure("Treeview.Heading", font=self.config.FONT_HEADING)

    def _create_main_container(self):
        self.main_container = ttk.Frame(self.root)
        self.main_container.place(relx=0.5, rely=0.5, anchor='center',
                                  relwidth=self.config.CONTENT_REL_WIDTH,
                                  relheight=self.config.CONTENT_REL_HEIGHT)
        for i in range(0, 8):
            self.frames[i] = ttk.Frame(self.main_container, relief="solid", borderwidth=1)
            self.frames[i].place(x=0, y=0, relwidth=1, relheight=1)

    def show_page(self, page_num):
        frame = self.frames.get(page_num)
        if frame:
            # Save scroll position if leaving page 1
            if self.controller.model.current_page == 1 and page_num != 1:
                current_page_frame = self.frames.get(1)
                if current_page_frame:
                    # Find the Treeview widget in the current page 1 frame
                    for widget in current_page_frame.winfo_children():
                        if isinstance(widget, ttk.Frame):
                            for sub_widget in widget.winfo_children():
                                if isinstance(sub_widget, ttk.Treeview):
                                    self.p1_tree_scroll_pos = sub_widget.yview()[0]
                                    break
                            if self.p1_tree_scroll_pos != 0.0: # Break outer loop if found
                                break

            for widget in frame.winfo_children():
                widget.destroy()
            
            page_creator = None
            if page_num == 0: # Title page
                page_creator = self._create_page0
            elif page_num == 1: # Disclaimer page
                page_creator = self._create_disclaimer_page
            elif page_num >= 2: # Shifted pages (e.g., page 2 should call _create_page1)
                page_creator = getattr(self, f'_create_page{page_num - 1}', None)
            
            if callable(page_creator):
                page_creator(frame)
            frame.tkraise()

    def _create_page0(self, parent_frame):
        # Title Frame
        title_frame = ttk.Frame(parent_frame)
        title_frame.pack(expand=True, fill='both')

        title_label = ttk.Label(title_frame, text="Welcome to the Activated-Generated Scheduler!\n\n20250724",
                                font=("Arial", 26, "bold"),
                                anchor='center')
        title_label.pack(expand=True, fill='both')

        # Next Button at bottom right
        next_button_frame = ttk.Frame(parent_frame)
        next_button_frame.pack(side="bottom", fill="x", padx=20, pady=20)
        next_button_frame.grid_columnconfigure(0, weight=1) # Allow column to expand

        next_button = ttk.Button(next_button_frame, text="Next", command=self.controller.next_page)
        next_button.grid(row=0, column=0, sticky="se") # Stick to south-east (bottom-right)

    def _create_disclaimer_page(self, parent_frame):
        # Disclaimer Frame
        disclaimer_frame = ttk.Frame(parent_frame)
        disclaimer_frame.place(relx=0.5, rely=0.35, relwidth=0.9, relheight=0.7, anchor='center')

        disclaimer_label = ttk.Label(disclaimer_frame, text="""본 소프트웨어를 사용하는 것은 위 면책 조항의 모든 내용에 동의하는 것으로 간주합니다.
                                     면책 조항 (Disclaimer)
이 소프트웨어는 사용자들의 편의를 위해 제작된 비공식 프로그램이며, DGIST와는 딱히 아무런 관련이 없습니다.

1. 보증의 부인 (AS-IS): 이 소프트웨어는 어떠한 종류의 명시적 혹은 묵시적 보증 없이 "있는 그대로" 제공됩니다. 제작자는 소프트웨어의 완전성, 정확성, 신뢰성, 특정 목적에의 적합성 또는 상품성에 대해 보증하지 않습니다. 다만 오류가 있다면 issue에서 알려주시기 바랍니다.

2. 책임의 제한 (Limitation of Liability): 이 소프트웨어의 사용으로 인해 발생하는 모든 위험은 전적으로 사용자 본인에게 있습니다.고의적인 해킹 스크립트는 전혀 없지만, \n제작자는 이 소프트웨어의 사용 또는 사용 불능으로 인해 발생하는 모든 직접적, 간접적, 부수적, 결과적, 특별 또는 징벌적 손해(데이터 손실, 수강신청 실패, 금전적 손실 등을 포함하되 이에 국한되지 않음)에 대해 어떠한 경우에도 책임을 지지 않습니다. """, 
                                     font=self.config.FONT_DESCRIPTION, 
                                     wraplength=self.root.winfo_width()*0.8,
                                     justify='center',
                                     anchor='center')
        disclaimer_label.pack(expand=True, fill='both')

        # Navigation Frame
        nav_frame = ttk.Frame(parent_frame)
        nav_frame.pack(side="bottom", fill="x", pady=20)

        agree_button = ttk.Button(nav_frame, text="I agree", command=self.controller.next_page)
        agree_button.pack()
        
    def _create_page_template(self, parent_frame, page_num):
        desc = ttk.Label(parent_frame, text=self.config.PAGE_DESCRIPTIONS.get(page_num, ""),
                         font=self.config.FONT_DESCRIPTION, wraplength=self.root.winfo_width()*0.8)
        desc.pack(pady=20, padx=20, fill='x')
        content_frame = ttk.Frame(parent_frame)
        content_frame.pack(expand=True, fill="both", padx=20, pady=10)
        nav_frame = ttk.Frame(parent_frame)
        nav_frame.pack(side="bottom", fill="x", padx=20, pady=10)
        ttk.Label(nav_frame, text=f"Page {page_num}/{len(self.frames)-1}").pack(side="left")
        ttk.Button(nav_frame, text="Next", command=self.controller.next_page).pack(side="right")
        ttk.Button(nav_frame, text="Prev", command=self.controller.prev_page).pack(side="right", padx=5)
        return content_frame

    def _create_page1(self, parent_frame):
        content_frame = self._create_page_template(parent_frame, 1)
        headers = self.config.PAGE1_HEADERS
        tree = ttk.Treeview(content_frame, columns=headers, show="headings")
        tree.heading("#0", text="Select")
        tree.column("#0", width=60, stretch=tk.NO, anchor='center')
        for col in headers:
            tree.heading(col, text=col)
            col_width = 200 if col == "Time" else 100
            tree.column(col, width=col_width, anchor='center')
        
        tree.tag_configure("selected_lecture", background=self.config.COLOR_SELECTED_ROW)
        
        tree.pack(expand=True, fill="both")
        
        # Schedule the tree population to allow the UI to draw itself first
        self.root.after(50, self._populate_p1_tree, tree)

        tree.bind("<Button-1>", lambda e: self.controller.on_p1_lecture_select(e, tree))

    def _populate_p1_tree(self, tree):
        # Clear any existing items first
        for i in tree.get_children():
            tree.delete(i)

        lectures = self.controller.get_all_lectures()
        for lec in lectures:
            values = (lec.name, lec.prof, lec.section, lec.get_time_string())
            tags = ("selected_lecture",) if lec.selected else ()
            tree.insert("", "end", iid=lec.id, text="", values=values, tags=tags)

        # Restore scroll position
        if self.p1_tree_scroll_pos != 0.0:
            tree.yview_moveto(self.p1_tree_scroll_pos)

    def update_p1_lecture_display(self, tree, lecture_id, is_selected):
        """P1 Treeview에서 특정 강의의 선택 상태를 시각적으로 업데이트합니다."""
        if tree.exists(lecture_id):
            tags = ("selected_lecture",) if is_selected else ()
            tree.item(lecture_id, tags=tags)

    def update_p2_lecture_preference_display(self, tree, lecture_id, new_preference):
        """P2 Treeview에서 특정 강의의 선호도를 시각적으로 업데이트합니다."""
        if tree.exists(lecture_id):
            # Get current values, update the preference, and set new values
            current_values = list(tree.item(lecture_id, 'values'))
            # Assuming 'Preference' is the 4th column (index 3) based on PAGE2_HEADERS
            current_values[3] = new_preference
            tree.item(lecture_id, values=tuple(current_values))

    def _create_page2(self, parent_frame):
        content_frame = self._create_page_template(parent_frame, 2)
        headers = self.config.PAGE2_HEADERS
        tree = ttk.Treeview(content_frame, columns=headers, show="headings")
        
        for col in headers:
            tree.heading(col, text=col)
            if col in ["+", "-"]:
                tree.column(col, width=40, anchor='center', stretch=tk.NO)
            else:
                tree.column(col, width=120, anchor='center')
        
        tree.column("Preference", width=80, anchor='center')

        lectures = self.controller.get_selected_lectures()
        for lec in lectures:
            values = (lec.name, lec.prof, lec.section, lec.preference, '+', '-')
            tree.insert("", "end", iid=lec.id, values=values)
        
        tree.bind("<Button-1>", lambda e: self.controller.on_p2_preference_click(e, tree))
        tree.pack(expand=True, fill="both")

    def _create_page3(self, parent_frame):
        content_frame = self._create_page_template(parent_frame, 3)
        self._create_timetable_grid(content_frame, 3)

    def _create_page4(self, parent_frame):
        content_frame = self._create_page_template(parent_frame, 4)
        self._create_timetable_grid(content_frame, 4)

    def _create_timetable_grid(self, parent_frame, page_num):
        """
        P3, P4의 시간 선택 그리드를 생성합니다.
        개별 '셀'에 선택 표시(■)를 하여 시각적으로 표현합니다.
        """
        headers = self.config.TIMETABLE_HEADERS
        tree = ttk.Treeview(parent_frame, columns=headers, show="headings", selectmode="none")
        
        # Treeview 컬럼 설정
        for col in headers: 
            tree.heading(col, text=col)
            tree.column(col, width=80, anchor='center')
        tree.column("Time", width=100, anchor='center')
        
        # Model로부터 선택된 시간 슬롯 데이터를 가져옵니다. (good_slots 또는 bad_slots)
        slots_data = self.controller.get_timeslots(page_num)
        
        # === 핵심 수정 사항: 셀 단위로 선택 표시(■)를 하도록 변경 ===
        # 시간 범위를 23:30까지 모두 표시하도록 range(30)으로 설정합니다.
        for i in range(30):
            # 0-based 인덱스 'i'를 사용하여 시간 텍스트를 생성합니다.
            hour, minute = 9 + i // 2, "00" if i % 2 == 0 else "30"
            
            # 각 행에 들어갈 값들의 리스트를 생성합니다. 첫 번째 값은 시간입니다.
            row_values = [f"{hour:02d}:{minute}"]

            # 각 요일(열)을 순회하며 해당 셀이 선택되었는지 확인합니다.
            for day in headers[1:]: # headers[1:]는 'Mon', 'Tue', ... 입니다.
                # Model의 slots_data에 (day, i) 조합이 있는지 확인합니다.
                if i in slots_data.get(day, set()):
                    # 선택된 상태이면 "■" 문자를 추가합니다.
                    row_values.append("■")
                else:
                    # 선택되지 않았으면 빈 문자열을 추가합니다.
                    row_values.append("")
            
            # 완성된 행 데이터를 Treeview에 삽입합니다. iid는 0-based 시간 인덱스입니다.
            tree.insert("", "end", values=tuple(row_values), iid=i)

        # 클릭 이벤트 바인딩
        tree.bind("<Button-1>", lambda e: self.controller.on_timeslot_click(e, tree, page_num))
        tree.pack(expand=True, fill="both")

    def update_timetable_grid_display(self, tree, page_num):
        """P3, P4의 시간표 그리드를 업데이트합니다."""
        # Clear existing items
        for i in tree.get_children():
            tree.delete(i)

        # Repopulate based on current model data
        slots_data = self.controller.get_timeslots(page_num)
        headers = self.config.TIMETABLE_HEADERS

        for i in range(30):
            hour, minute = 9 + i // 2, "00" if i % 2 == 0 else "30"
            row_values = [f"{hour:02d}:{minute}"]
            for day in headers[1:]:
                if i in slots_data.get(day, set()):
                    row_values.append("■")
                else:
                    row_values.append("")
            tree.insert("", "end", values=tuple(row_values), iid=i)

    def _create_page5(self, parent_frame):
        content_frame = self._create_page_template(parent_frame, 5)

        # 1. 이미지 프레임 생성 (상단)
        image_display_frame = ttk.Frame(content_frame, relief="solid", borderwidth=0)
        image_display_frame.pack(fill='both', expand=True, pady=(0, 10))
        image_display_frame.pack_propagate(False)

        # 2. 이미지 삽입
        try:
            # === 핵심 수정 사항: resource_path를 사용하여 이미지 경로를 가져오도록 변경 ===
            image_path = resource_path("net.gif")
            # =================================================================
            
            pil_image = Image.open(image_path)

            def resize_image(event=None):
                frame_width = image_display_frame.winfo_width()
                frame_height = image_display_frame.winfo_height()
                
                if frame_width > 1 and frame_height > 1:
                    img_width, img_height = pil_image.size
                    ratio = min(frame_width / img_width, frame_height / img_height)
                    new_width = int(img_width * ratio)
                    new_height = int(img_height * ratio) - 11
                    
                    if new_width > 0 and new_height > 0:
                        resized_image = pil_image.resize((new_width, new_height), Image.LANCZOS)
                        tk_image = ImageTk.PhotoImage(resized_image)
                        
                        image_label.config(image=tk_image)
                        image_label.image = tk_image 
                        self.image_references.append(tk_image)

            image_label = ttk.Label(image_display_frame, anchor='center')
            image_label.pack(expand=True)

            image_display_frame.bind('<Configure>', resize_image)
            self.root.after(100, resize_image)

        except FileNotFoundError:
            error_msg = f"이미지 '{os.path.basename(image_path)}'를 찾을 수 없습니다."
            image_label = ttk.Label(image_display_frame, text=error_msg, 
                                    foreground="red", font=self.config.FONT_DEFAULT)
            image_label.pack(expand=True)
            print(f"경고: 이미지를 찾을 수 없습니다: {image_path}. 이 아이템에는 이미지가 표시되지 않습니다.")
        except Exception as e:
            image_label = ttk.Label(image_display_frame, text=f"이미지 로드 중 오류 발생: {e}", 
                                    foreground="red", font=self.config.FONT_DEFAULT)
            image_label.pack(expand=True)
            print(f"이미지 로드 중 오류 발생: {e}")

        # 3. 슬라이더 및 체크박스 프레임 생성 (하단)
        sliders_frame = ttk.Frame(content_frame, relief="solid", borderwidth=1)
        sliders_frame.pack(fill='both', expand=True)

        for i, attr in enumerate(self.config.PAGE5_ATTRIBUTES):
            attr_frame = ttk.Frame(sliders_frame, padding=(10, 5))
            attr_frame.pack(fill='x', pady=5, padx=20)
            
            ttk.Label(attr_frame, text=attr, width=15).pack(side='left', padx=10)
            
            slider_value_label = ttk.Label(attr_frame, text=str(self.controller.get_weight(i)), width=4)
            slider_value_label.pack(side='left', padx=5)
            
            slider = ttk.Scale(attr_frame, from_=0, to=10, orient='horizontal', 
                               command=lambda val, index=i, label=slider_value_label: self.controller.on_slider_change(val, index, label))
            slider.set(self.controller.get_weight(i))
            slider.pack(side='left', expand=True, fill='x', padx=10)
            self.slider_labels[i] = slider_value_label
            
            rss_var = tk.BooleanVar(value=self.controller.get_rss_option(i))
            ttk.Checkbutton(attr_frame, text="RSS", variable=rss_var, 
                            command=lambda index=i: self.controller.on_rss_toggle(index)).pack(side='right', padx=10)

    def _create_page6(self, parent_frame):
        content_frame = self._create_page_template(parent_frame, 6)
        self.feedback_label = ttk.Label(content_frame, text="시간표를 계산 중입니다...", font=self.config.FONT_DESCRIPTION)
        self.feedback_label.pack(pady=20)
        self.p6_timetable_frame = ttk.Frame(content_frame)
        self.p6_timetable_frame.pack(expand=True, fill="both", pady=10)
        self.p6_score_label = ttk.Label(content_frame, text="Score = N/A")
        self.p6_score_label.pack(pady=10)
        self.p6_credits_label = ttk.Label(content_frame, text="총 학점: N/A")
        self.p6_credits_label.pack(pady=5)
        self.p6_zscore_label = ttk.Label(content_frame, text="Z-Score = N/A")
        self.p6_zscore_label.pack(pady=5)
        self.p6_same_score_count_label = ttk.Label(content_frame, text="Same Score Candidates = N/A")
        self.p6_same_score_count_label.pack(pady=5)
        lr_frame = ttk.Frame(content_frame)
        lr_frame.pack(pady=5)
        ttk.Button(lr_frame, text="< Prev Result", command=self.controller.show_prev_timetable).pack(side='left', padx=10)
        ttk.Button(lr_frame, text="Next Result >", command=self.controller.show_next_timetable).pack(side='right', padx=10)
        
        lr_fast_frame = ttk.Frame(content_frame)
        lr_fast_frame.pack(pady=5)
        ttk.Button(lr_fast_frame, text="< Prev Result +10", command=self.controller.show_prev_timetable_fast).pack(side='left', padx=10)
        ttk.Button(lr_fast_frame, text="Next Result +10 >", command=self.controller.show_next_timetable_fast).pack(side='right', padx=10)

    def _generate_distinct_colors(self, n):
        """서로 다른 n개의 색상을 생성합니다."""
        if n == 0:
            return []
        
        predefined_colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE',
            '#AED6F1', '#A3E4D7', '#F9E79F', '#FADBD8', '#D5DBDB'
        ]
        
        if n <= len(predefined_colors):
            return predefined_colors[:n]
        
        colors = predefined_colors[:]
        for i in range(len(predefined_colors), n):
            hue = (i * 137.508) % 360 / 360
            saturation = 0.7 + (i % 3) * 0.1
            value = 0.80
            rgb_float = colorsys.hsv_to_rgb(hue, saturation, value)
            rgb_int = tuple(int(c * 255) for c in rgb_float)
            colors.append(f'#{"%02x%02x%02x" % rgb_int}')
        
        return colors

    def _create_lecture_spans(self, lectures):
        """강의별로 연속된 시간 슬롯들을 spanning 영역으로 그룹화합니다."""
        spans = {}
        
        for lec_idx, lecture in enumerate(lectures):
            if not hasattr(lecture, 'time_slots') or not lecture.time_slots:
                continue
                
            spans[lec_idx] = []
            
            day_slots = {}
            
            day_map_korean = {'월': 0, '화': 1, '수': 2, '목': 3, '금': 4}
            day_map_english = {'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4}
            headers = self.config.TIMETABLE_HEADERS
            
            for slot in lecture.time_slots:
                if not isinstance(slot, dict):
                    continue
                
                day = slot.get('day', '')
                start_idx = slot.get('start_index')
                end_idx = slot.get('end_index')
                
                if start_idx is None or end_idx is None:
                    continue
                
                col_idx = None
                if day in day_map_korean:
                    col_idx = day_map_korean[day] + 1
                elif day in day_map_english:
                    col_idx = day_map_english[day] + 1
                else:
                    try:
                        col_idx = headers.index(day)
                    except ValueError:
                        continue
                
                if col_idx is None:
                    continue
                
                time_indices = list(range(start_idx, end_idx + 1))
                if day not in day_slots:
                    day_slots[day] = []
                day_slots[day].extend(time_indices)
            
            for day, time_indices in day_slots.items():
                if not time_indices:
                    continue
                
                col_idx = None
                if day in day_map_korean:
                    col_idx = day_map_korean[day] + 1
                elif day in day_map_english:
                    col_idx = day_map_english[day] + 1
                else:
                    try:
                        col_idx = headers.index(day)
                    except ValueError:
                        continue
                
                if col_idx is None:
                    continue
                
                time_indices = sorted(set(time_indices))
                
                current_start = time_indices[0]
                current_end = time_indices[0]
                
                for i in range(1, len(time_indices)):
                    if time_indices[i] == current_end + 1:
                        current_end = time_indices[i]
                    else:
                        spans[lec_idx].append({
                            'col': col_idx,
                            'start_row': current_start + 1,
                            'end_row': current_end + 1,
                            'lecture': lecture,
                            'span_height': current_end - current_start + 1
                        })
                        current_start = time_indices[i]
                        current_end = time_indices[i]
                
                spans[lec_idx].append({
                    'col': col_idx,
                    'start_row': current_start + 1,
                    'end_row': current_end + 1,
                    'lecture': lecture,
                    'span_height': current_end - current_start + 1
                })
        
        return spans

    def display_timetable(self, timetable_obj, index, total, elapsed_time=None):
        """시간표를 화면에 표시합니다 - spanning 적용"""
        frame = self.p6_timetable_frame
        
        for widget in frame.winfo_children():
            widget.destroy()

        feedback_text = f"Result {index} / {total}"
        if elapsed_time is not None:
            feedback_text += f" (Calculation Time: {elapsed_time:.2f} seconds)"
        self.feedback_label.config(text=feedback_text)
        
        credits = self.controller.get_credits_for_timetable(timetable_obj.lectures)
        self.p6_credits_label.config(text=f"총 학점: {credits}")
        
        self.p6_score_label.config(text=f"Score = {timetable_obj.score:.2f}")
        self.p6_zscore_label.config(text=f"Z-Score = {timetable_obj.z_score:.2f}" if timetable_obj.z_score is not None else "Z-Score = N/A")
        self.p6_same_score_count_label.config(text=f"Same Score Candidates = {timetable_obj.same_score_count}" if timetable_obj.same_score_count is not None else "Same Score Candidates = N/A")

        if not timetable_obj or not hasattr(timetable_obj, 'lectures') or not timetable_obj.lectures:
            ttk.Label(frame, text="표시할 시간표 데이터가 없습니다.").pack(pady=20)
            return

        headers = self.config.TIMETABLE_HEADERS
        canvas = tk.Canvas(frame, bg='white', highlightthickness=1, highlightbackground='black')
        canvas.pack(expand=True, fill="both", padx=5, pady=5)
        
        lecture_spans = self._create_lecture_spans(timetable_obj.lectures)
        colors = self._generate_distinct_colors(len(timetable_obj.lectures))
        
        def draw_timetable(event=None):
            canvas.delete("all")
            
            canvas.update_idletasks()
            canvas_width = canvas.winfo_width()
            canvas_height = canvas.winfo_height()
            
            if canvas_width <= 1 or canvas_height <= 1:
                canvas.after(100, draw_timetable)
                return
            
            rows = 19
            cols = 6
            
            cell_width = canvas_width / cols
            cell_height = canvas_height / rows
            
            for i in range(rows + 1):
                y = i * cell_height
                line_width = 2 if i > 0 and (i - 1) % 2 == 0 else 1
                canvas.create_line(0, y, canvas_width, y, fill='black', width=line_width)
            
            for i in range(cols + 1):
                x = i * cell_width
                canvas.create_line(x, 0, x, canvas_height, fill='black', width=1)
            
            header_font = ("Arial", max(8, min(self.config.TIMETABLE_HEADER_FONT_SIZE, int(cell_height / 3))), "bold")
            for col, header in enumerate(headers):
                x = col * cell_width + cell_width / 2
                y = cell_height / 2
                canvas.create_rectangle(col * cell_width, 0, (col + 1) * cell_width, cell_height, 
                                        fill='lightgray', outline='black')
                canvas.create_text(x, y, text=header, font=header_font, anchor='center')
            
            time_font = ("Arial", max(6, min(self.config.TIMETABLE_TIME_FONT_SIZE, int(cell_height / 4))))
            for row in range(18):
                hour = 9 + row // 2
                minute = "00" if row % 2 == 0 else "30"
                time_text = f"{hour:02d}:{minute}"
                
                x = cell_width / 2
                y = (row + 1) * cell_height + cell_height / 2
                
                canvas.create_rectangle(0, (row + 1) * cell_height, cell_width, (row + 2) * cell_height,
                                        fill='lightblue', outline='black')
                canvas.create_text(x, y, text=time_text, font=time_font, anchor='center')
            
            for lec_idx, spans in lecture_spans.items():
                if lec_idx >= len(colors):
                    continue
                    
                color = colors[lec_idx]
                
                for span in spans:
                    lecture = span['lecture']
                    col_idx = span['col']
                    start_row = span['start_row']
                    end_row = span['end_row']
                    
                    x1 = col_idx * cell_width
                    y1 = start_row * cell_height
                    x2 = (col_idx + 1) * cell_width
                    y2 = (end_row + 1) * cell_height
                    
                    canvas.create_rectangle(x1, y1, x2, y2, fill=color, outline='black', width=2)
                    
                    display_text = f"{lecture.name}\n{lecture.prof}"
                    if hasattr(lecture, 'section') and lecture.section:
                        display_text += f"({lecture.section})"
                    
                    span_pixel_height = y2 - y1
                    base_font_size = max(self.config.TIMETABLE_LECTURE_MIN_FONT_SIZE, 
                                         min(self.config.TIMETABLE_LECTURE_MAX_FONT_SIZE, 
                                             int(span_pixel_height / (4 + display_text.count('\n')))))
                    
                    lecture_font = ("Arial", base_font_size, "bold")
                    
                    text_x = (x1 + x2) / 2
                    text_y = (y1 + y2) / 2
                    
                    canvas.create_text(text_x, text_y, text=display_text, 
                                      font=lecture_font, anchor='center', 
                                      width=cell_width-10, fill='black')
                    
        
        canvas.bind('<Configure>', draw_timetable)
        canvas.after(100, draw_timetable)
        
        
    def display_no_result(self):
        """결과가 없을 때 표시하는 함수"""
        self.feedback_label.config(text="생성 가능한 시간표가 없습니다.")
        self.p6_score_label.config(text="Score = N/A")
        self.p6_credits_label.config(text="총 학점: N/A")
        
        for widget in self.p6_timetable_frame.winfo_children():
            widget.destroy()
            
        ttk.Label(
            self.p6_timetable_frame, 
            text="조건을 변경하여 다시 시도해보세요.",
            font=self.config.FONT_DESCRIPTION
        ).pack(pady=20)
