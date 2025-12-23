# main.py
# 애플리케이션의 시작점입니다.

import tkinter as tk
from model import Model
from view import View
from controller import Controller

class App(tk.Tk):
    """
    애플리케이션의 메인 클래스
    """
    def __init__(self):
        super().__init__()

        # 1. Model 생성
        model = Model()

        # 2. Controller 생성 및 Model 연결
        # Controller는 View를 필요로 하므로, View 생성 후 연결
        
        # 3. View 생성 및 Controller 연결
        # View는 Controller를 직접 참조하여 이벤트 발생 시 호출
        controller = Controller(model, None) # 임시로 None 전달
        view = View(self, controller)
        
        # 4. Controller에 View 연결
        controller.view = view
        
        # 5. 첫 페이지 보여주기
        view.show_page(model.current_page)

        # 6. 윈도우 종료 시 선택된 강의 저장 및 종료
        def on_closing():
            model.save_selected_lectures_to_cache()
            self.destroy()

        self.protocol("WM_DELETE_WINDOW", on_closing)


if __name__ == "__main__":
    app = App()
    app.mainloop()

