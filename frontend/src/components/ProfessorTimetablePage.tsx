import { Fragment, useMemo, useState } from 'react';
import { Home, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Lecture } from '../types';
import { formatSingleSlotTime } from '../utils/lectureUtils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const COLORS = [
    'bg-red-100 text-red-900 border-red-200',
    'bg-orange-100 text-orange-900 border-orange-200',
    'bg-amber-100 text-amber-900 border-amber-200',
    'bg-lime-100 text-lime-900 border-lime-200',
    'bg-emerald-100 text-emerald-900 border-emerald-200',
    'bg-teal-100 text-teal-900 border-teal-200',
    'bg-cyan-100 text-cyan-900 border-cyan-200',
    'bg-sky-100 text-sky-900 border-sky-200',
    'bg-blue-100 text-blue-900 border-blue-200',
    'bg-indigo-100 text-indigo-900 border-indigo-200',
];

const normalizeProfessors = (value: string) =>
    value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

const containsProfessor = (raw: string, target: string) =>
    normalizeProfessors(raw || '').some((p) => p === target);

const normalizeProfessorName = (name: string) => name.trim().replace(/\s+/g, ' ');

const buildProfessorUrl = (name: string) => {
    const base = import.meta.env.BASE_URL || '/';
    const prefix = base.endsWith('/') ? base : `${base}/`;
    return `${window.location.origin}${prefix}professor/${encodeURIComponent(name)}`;
};

type ProfessorRank = { name: string; sections: number };
type CourseProfessorSuggestion = { name: string; sections: number };

interface ProfessorTimetablePageProps {
    professorName?: string;
}

export const ProfessorTimetablePage = ({ professorName = '김소희' }: ProfessorTimetablePageProps) => {
    const { allLectures, language } = useApp();
    const baseLabel = language === 'ko';
    const currentProfessorName = normalizeProfessorName(professorName);
    const [courseQuery, setCourseQuery] = useState('');
    const [isCourseSuggestionsVisible, setIsCourseSuggestionsVisible] = useState(false);

    const professorRanks = useMemo<ProfessorRank[]>(() => {
        const map = new Map<string, number>();
        allLectures.forEach((lecture) => {
            normalizeProfessors(lecture.prof || '').forEach((name) => {
                const normalized = normalizeProfessorName(name);
                if (!normalized) return;
                map.set(normalized, (map.get(normalized) || 0) + 1);
            });
        });

        return Array.from(map.entries())
            .map(([name, sections]) => ({ name, sections }))
            .sort((a, b) => b.sections - a.sections || a.name.localeCompare(b.name));
    }, [allLectures]);

    const courseProfessorSuggestions = useMemo<CourseProfessorSuggestion[]>(() => {
        const keyword = courseQuery.trim().toLowerCase();
        if (!keyword) return [];

        const map = new Map<string, number>();
        allLectures.forEach((lecture) => {
            const courseText = `${lecture.course_number ? `${lecture.course_number} ` : ''}${lecture.name || ''}`.toLowerCase();
            if (!courseText.includes(keyword)) return;

            normalizeProfessors(lecture.prof || '').forEach((rawName) => {
                const name = normalizeProfessorName(rawName);
                if (!name) return;
                map.set(name, (map.get(name) || 0) + 1);
            });
        });

        return Array.from(map.entries())
            .map(([name, sections]) => ({ name, sections }))
            .sort((a, b) => b.sections - a.sections || a.name.localeCompare(b.name));
    }, [allLectures, courseQuery]);

    const currentIndex = useMemo(
        () => professorRanks.findIndex((entry) => entry.name === currentProfessorName),
        [professorRanks, currentProfessorName]
    );

    const safeIndex = currentIndex === -1 ? 0 : currentIndex;

    const prevProfessor = useMemo(
        () => (safeIndex > 0 ? professorRanks[safeIndex - 1] : null),
        [safeIndex, professorRanks]
    );

    const nextProfessor = useMemo(
        () => (safeIndex + 1 < professorRanks.length ? professorRanks[safeIndex + 1] : null),
        [safeIndex, professorRanks]
    );

    const professorLectures = useMemo(
        () => allLectures.filter((lecture) => containsProfessor(lecture.prof || '', currentProfessorName)),
        [allLectures, currentProfessorName]
    );

    const courseColorMap = useMemo(() => {
        const map = new Map<number, string>();
        professorLectures.forEach((lecture, index) => {
            map.set(lecture.id, COLORS[index % COLORS.length]);
        });
        return map;
    }, [professorLectures]);

    const slotMap = useMemo(() => {
        const emptyDaySlots = () => {
            const entries = Array.from({ length: 24 }).map(() => [] as Lecture[]);
            return entries;
        };

        const result: Record<string, Lecture[][]> = {
            Mon: emptyDaySlots(),
            Tue: emptyDaySlots(),
            Wed: emptyDaySlots(),
            Thu: emptyDaySlots(),
            Fri: emptyDaySlots(),
        };

        professorLectures.forEach((lecture) => {
            lecture.time_slots.forEach((slot) => {
                for (let i = slot.start_index; i <= slot.end_index && i < 24; i += 1) {
                    if (i < 0) continue;
                    const buckets = result[slot.day];
                    if (!buckets) continue;
                    buckets[i].push(lecture);
                }
            });
        });

        return result;
    }, [professorLectures]);

    const totalCredits = useMemo(
        () => professorLectures.reduce((sum, lecture) => sum + (lecture.credit || 0), 0),
        [professorLectures]
    );

    const goToProfessor = (name?: string) => {
        if (!name) return;
        window.location.href = buildProfessorUrl(name);
    };

    const handleCourseSuggestionSelect = (name: string) => {
        setCourseQuery('');
        setIsCourseSuggestionsVisible(false);
        goToProfessor(name);
    };

    const headerActions = (
        <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
                onClick={() => goToProfessor(prevProfessor?.name)}
                disabled={!prevProfessor}
                className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${prevProfessor
                    ? 'bg-gray-900 text-white hover:bg-gray-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
            >
                {baseLabel ? '전으로 가기' : 'Prev Rank'}
            </button>
            <button
                onClick={() => goToProfessor(nextProfessor?.name)}
                disabled={!nextProfessor}
                className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${nextProfessor
                    ? 'bg-gray-900 text-white hover:bg-gray-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
            >
                {baseLabel ? '다음 순위로 가기' : 'Next Rank'}
            </button>
            <a
                href={import.meta.env.BASE_URL}
                className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors"
            >
                <Home className="w-4 h-4" />
                {baseLabel ? '메인으로' : 'Back to Main'}
            </a>
        </div>
    );

    const courseSearchSection = (
        <div className="relative w-full md:w-80 mt-2 md:mt-3">
            <label className="mb-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                {baseLabel ? '과목명으로 교수 찾기' : 'Find Professor by Course'}
            </label>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input
                    value={courseQuery}
                    onChange={(e) => {
                        setCourseQuery(e.target.value);
                        setIsCourseSuggestionsVisible(true);
                    }}
                    onFocus={() => setIsCourseSuggestionsVisible(true)}
                    onBlur={() => setTimeout(() => setIsCourseSuggestionsVisible(false), 120)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && courseProfessorSuggestions.length > 0) {
                            event.preventDefault();
                            handleCourseSuggestionSelect(courseProfessorSuggestions[0].name);
                        }
                    }}
                    className="w-full border border-gray-200 pl-8 pr-9 py-2 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                    placeholder={baseLabel ? '예: 수학, 프로그래밍' : 'e.g. Math, Programming'}
                />
                {courseQuery ? (
                    <button
                        type="button"
                        onMouseDown={() => setCourseQuery('')}
                        className="absolute right-2.5 top-2.5 text-[10px] text-gray-400 hover:text-gray-700"
                    >
                        x
                    </button>
                ) : null}
            </div>
            {isCourseSuggestionsVisible && courseProfessorSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 z-10 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    {courseProfessorSuggestions.map((suggestion) => (
                        <button
                            key={suggestion.name}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                            onMouseDown={() => handleCourseSuggestionSelect(suggestion.name)}
                        >
                            <span className="font-semibold">{suggestion.name}</span>
                            <span className="text-[10px] text-gray-400">
                                {baseLabel ? `${suggestion.sections}개 섹션` : `${suggestion.sections} sections`}
                            </span>
                        </button>
                    ))}
                </div>
            )}
            {isCourseSuggestionsVisible && courseQuery && courseProfessorSuggestions.length === 0 && (
                <div className="absolute left-0 right-0 mt-2 z-10 bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-400">
                    {baseLabel ? '해당 과목을 강의하는 교수가 없습니다.' : 'No professor teaches this course.'}
                </div>
            )}
        </div>
    );

    if (professorLectures.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 p-3 md:p-6">
                <div className="w-full max-w-7xl mx-auto space-y-4">
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                {baseLabel ? '교수 시간표 뷰' : 'Professor Timetable View'}
                            </p>
                            <h1 className="text-xl font-black text-gray-900">
                                {baseLabel
                                    ? `${currentProfessorName} 교수 강의`
                                    : `Courses by Prof. ${currentProfessorName}`}
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">
                                {baseLabel
                                    ? '현재 로드된 데이터에서 해당 교수가 담당한 과목을 찾지 못했습니다.'
                                    : `No lectures were found for ${currentProfessorName} in the loaded data.`}
                            </p>
                            {courseSearchSection}
                        </div>
                        {headerActions}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-3 md:p-6">
            <div className="w-full max-w-7xl mx-auto space-y-4">
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                            {baseLabel ? '교수 시간표 뷰' : 'Professor Timetable View'}
                        </p>
                        <h1 className="text-xl font-black text-gray-900">
                            {baseLabel
                                ? `${currentProfessorName} 교수 수업 시간표`
                                : `Timetable of Prof. ${currentProfessorName}`}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {baseLabel
                                ? `총 ${professorLectures.length}개 섹션 · 총 학점 ${totalCredits}`
                                : `${professorLectures.length} sections · Total credits ${totalCredits}`}
                        </p>
                        {courseSearchSection}
                    </div>
                    {headerActions}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden p-4">
                    <div className="grid grid-cols-[56px_repeat(5,1fr)] gap-0 border-l border-t border-gray-100">
                        <div className="h-8 bg-gray-50 border-r border-b border-gray-100" />
                        {DAYS.map((day) => (
                            <div
                                key={day}
                                className="h-8 flex items-center justify-center font-black text-[10px] text-gray-400 uppercase tracking-widest bg-gray-50 border-r border-b border-gray-100"
                            >
                                {day}
                            </div>
                        ))}

                        {Array.from({ length: 24 }).map((_, slotIdx) => (
                            <Fragment key={`row-${slotIdx}`}>
                                <div
                                    className="h-[22px] flex items-center justify-end pr-2 text-[8px] font-bold text-gray-300 bg-gray-50/30 border-r border-b border-gray-100"
                                >
                                    {formatSingleSlotTime(slotIdx)}
                                </div>
                                {DAYS.map((day) => {
                                    const lecturesAtSlot = slotMap[day][slotIdx] || [];
                                    const primaryLecture = lecturesAtSlot[0] || null;
                                    const activeSlot = primaryLecture?.time_slots.find((slot) => slot.day === day && slotIdx >= slot.start_index && slotIdx <= slot.end_index);
                                    const isStartSlot = activeSlot ? activeSlot.start_index === slotIdx : false;
                                    const colorClass = primaryLecture
                                        ? courseColorMap.get(primaryLecture.id) || 'bg-blue-100 text-blue-900 border-blue-200'
                                        : 'bg-white';
                                    const hasMore = lecturesAtSlot.length > 1 && isStartSlot;

                                    return (
                                        <div
                                            key={`${day}-${slotIdx}`}
                                            className={`h-[22px] transition-all overflow-hidden ${colorClass} border-r border-b border-gray-100`}
                                        >
                                            {isStartSlot && primaryLecture && (
                                                <div className="px-1 py-0.5 h-full flex flex-col justify-center leading-[1.1]">
                                                    <div className="font-bold text-[10px] truncate text-gray-900">
                                                        {primaryLecture.name} ({primaryLecture.section})
                                                    </div>
                                                    {hasMore && (
                                                        <div className="text-[8px] text-gray-600">
                                                            + {lecturesAtSlot.length - 1} more
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </Fragment>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h2 className="text-sm font-black text-gray-900 mb-3">
                        {baseLabel ? '과목 목록 (색상 범례)' : 'Section List (Legend)'}
                    </h2>
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {professorLectures.map((lecture) => {
                            const badge = courseColorMap.get(lecture.id) || 'bg-blue-100 text-blue-900 border-blue-200';
                            const period = lecture.time_slots
                                .map((slot) => `${slot.day} ${formatSingleSlotTime(slot.start_index)}-${formatSingleSlotTime(slot.end_index + 1)}`)
                                .join(', ');

                            return (
                                <div key={lecture.id} className="flex items-start gap-2 rounded-lg border border-gray-100 p-2">
                                    <span className={`w-2 h-2 mt-1 rounded-full ${badge.split(' ')[0]}`} />
                                    <div>
                                        <p className="text-xs font-black text-gray-900">{lecture.name}</p>
                                        <p className="text-[11px] text-gray-500">
                                            Section {lecture.section} · {lecture.credit || 0} credits
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{period}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

