export const translations = {
    ko: {
        landing: {
            title: "DGIST 자동 시간표 생성기",
            subtitle: "동아리 DGROID에 가입해서 더 좋은 소프트웨어를 개발해주세요.",
            start: "시작하기",
            helpTitle: "도움이 필요하신가요?",
            helpDesc: "? 버튼을 누르면 자세한 사용 가이드를 확인할 수 있습니다."
        },
        steps: {
            step1: "강의 선택",
            step2: "선호도 설정",
            step3: "희망 시간",
            step4: "기피 시간",
            step5: "가중치 설정",
            step6: "결과 확인"
        },
        lectureList: {
            searchPlaceholder: "강의명, 교수명, 또는 전공 검색...",
            selectedCount: "개 선택됨",
            selectedTitle: "선택한 강의",
            selectedEmpty: "아직 선택된 강의가 없습니다.",
            totalCredits: "총 학점",
            showSearch: "검색창 보기",
            showMatches: "다음 중 하나라도 해당하는 것들만 보기",
            basicMandatory: "기초필수",
            math: "수학",
            physics: "물리",
            chemistry: "화학",
            biology: "생명과학",
            track: "트랙",
            writingReading: "쓰기·읽기 중점",
            nonTrackConvergence: "비트랙/융합",
            majorTracks: "전공/트랙",
            guideTitle: "사용법 가이드",
            guideCore: "핵심 기능: 자동 최적화 마법사",
            guideCoreDesc: "같은 과목이라도 교수님이나 시간이 다른 여러 분반을 모두 체크해두세요! 마법사가 최적의 하나를 자동으로 선택해줍니다.",
            step1Desc: "듣고 싶은 후보 강의들을 모두 체크하세요.",
            step2Desc: "꼭 듣고 싶은 교수님은 (+), 피하고 싶은 분반은 (-) 점수를 주세요.",
            step34Desc: "Good/Bad Slots을 설정하세요.",
            step5Desc: "무엇이 더 중요한지 가중치를 조절하세요.",
            step6Desc: "불만족도(Loss)가 가장 낮은 최적의 시간표들을 보여줍니다."
        },
        preference: {
            title: "강의 선호도 설정",
            desc: "선택한 강의들 중 특별히 선호하거나 피하고 싶은 분반의 점수를 조절하세요. (기본값: 0)",
            sortAlphaLabel: "가나다순 정렬"
        },
        timeSelector: {
            goodTitle: "희망 시간대 설정 (Good Slots)",
            goodDesc: "수업이 배치되기를 희망하는 시간대를 클릭하여 드래그하세요. (예: 오후 시간, 점심 직후 등)",
            badTitle: "기피 시간대 설정 (Bad Slots)",
            badDesc: "수업 배치를 피하고 싶은 시간대를 설정하세요. (예: 아침 9시, 금요일 오후 등)"
        },
        weight: {
            title: "가중치 및 최적화 설정",
            desc: "시간표 생성 시 어떤 요소를 더 중요하게 고려할지 설정합니다.",
            fitGood: "희망 시간 부합",
            fitBad: "기피 시간 회피",
            breakTime: "공강 최소화",
            preferLectures: "선호 강의 포함",
            helpTitle: "도움말",
            lossTitle: "Loss (불만족도) & Weight (가중치)",
            lossDesc: "불만족도가 0에 가까운 시간표를 찾습니다. 가중치가 높을수록 해당 항목은 '절대 어기기 싫다'는 뜻입니다.",
            rssTitle: "계산 방식 (Linear vs Squared)",
            rssOff: "OFF (Linear): 단순히 횟수로 계산",
            rssOn: "ON (Squared): 위반 크기를 제곱해서 계산"
        },
        results: {
            title: "생성된 최적 시간표",
            desc: "불만족도(Loss)가 낮은 순서대로 최대 50개의 시간표를 보여줍니다.",
            noResults: "조건을 만족하는 시간표를 찾을 수 없습니다. 선택한 강의가 너무 많아 충돌하거나, 조건이 너무 까다로울 수 있습니다.",
            loss: "불만족도",
            totalCredits: "총 학점",
            rank: "순위"
        },
        common: {
            next: "다음",
            prev: "이전",
            generate: "시간표 생성",
            generating: "생성 중...",
            reset: "초기화",
            finished: "완료"
        }
    },
    en: {
        landing: {
            title: "DGIST Auto Timetable Generator",
            subtitle: "Smart Choice for Your Perfect Semester",
            start: "Get Started",
            helpTitle: "Need Help?",
            helpDesc: "Click the ? button at the top right of each page for a detailed guide."
        },
        steps: {
            step1: "Select Lectures",
            step2: "Set Preferences",
            step3: "Good Slots",
            step4: "Bad Slots",
            step5: "Set Weights",
            step6: "View Results"
        },
        lectureList: {
            searchPlaceholder: "Search by name, professor, or major...",
            selectedCount: "selected",
            selectedTitle: "Selected Lectures",
            selectedEmpty: "No lectures selected yet.",
            totalCredits: "Total Credits",
            showSearch: "Show Search",
            showMatches: "Show matches only",
            basicMandatory: "Basic Mandatory",
            math: "Math",
            physics: "Physics",
            chemistry: "Chemistry",
            biology: "Biology",
            track: "Track",
            writingReading: "Writing/Reading",
            nonTrackConvergence: "Non-Track/Convergence",
            majorTracks: "Majors/Tracks",
            guideTitle: "User Guide",
            guideCore: "Core Feature: Optimization Wizard",
            guideCoreDesc: "Check all sections of the same course that you are interested in! The wizard will automatically select the single best one for you.",
            step1Desc: "Check all candidate lectures you want to take.",
            step2Desc: "Give (+) to professors you want, and (-) to sections you avoid.",
            step34Desc: "Set your Good/Bad slots.",
            step5Desc: "Adjust weights to prioritize what matters most to you.",
            step6Desc: "Shows timetables with the lowest dissatisfaction (Loss)."
        },
        preference: {
            title: "Lecture Preferences",
            desc: "Adjust scores for specific sections you prefer or want to avoid. (Default: 0)",
            sortAlphaLabel: "Order alphabetically"
        },
        timeSelector: {
            goodTitle: "Set Good Slots",
            goodDesc: "Click and drag time slots where you prefer to have classes. (e.g., afternoon, after lunch)",
            badTitle: "Set Bad Slots",
            badDesc: "Set time slots where you want to avoid classes. (e.g., 9 AM, Friday afternoon)"
        },
        weight: {
            title: "Weights & Optimization",
            desc: "Set which factors should be more strictly considered during generation.",
            fitGood: "Fit Good Slots",
            fitBad: "Avoid Bad Slots",
            breakTime: "Minimize Breaks",
            preferLectures: "Include Preferred",
            helpTitle: "Help",
            lossTitle: "Loss & Weight",
            lossDesc: "The tool finds timetables with Loss close to 0. Higher weight means 'Never violate this rule'.",
            rssTitle: "Calculation (Linear vs Squared)",
            rssOff: "OFF (Linear): Simple count",
            rssOn: "ON (Squared): Square the violation size"
        },
        results: {
            title: "Generated Timetables",
            desc: "Shows up to 50 timetables ordered by lowest Loss.",
            noResults: "No valid timetables found. Try selecting fewer conflicting lectures or relaxing your constraints.",
            loss: "Loss",
            totalCredits: "Total Credits",
            rank: "Rank"
        },
        common: {
            next: "Next",
            prev: "Prev",
            generate: "Generate",
            generating: "Generating...",
            reset: "Reset",
            finished: "Finished"
        }
    }
};
