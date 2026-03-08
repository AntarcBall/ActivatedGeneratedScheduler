import { useMemo, useState } from 'react';
import { DoorOpen, Home, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatSingleSlotTime } from '../utils/lectureUtils';
import { rooms, type DayKey, type RoomInsight, type Session } from '../../../use/data.ts';

const DAYS: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const START_HOUR = 9;
const END_HOUR = 21;
const HOUR_HEIGHT = 56;

const DAY_LABELS: Record<'ko' | 'en', Record<DayKey, string>> = {
    ko: {
        Mon: '월',
        Tue: '화',
        Wed: '수',
        Thu: '목',
        Fri: '금',
    },
    en: {
        Mon: 'Mon',
        Tue: 'Tue',
        Wed: 'Wed',
        Thu: 'Thu',
        Fri: 'Fri',
    },
};

const normalizeRoomName = (value: string) => value.trim().replace(/\s+/g, ' ');

const buildRoomUrl = (name: string) => {
    const base = import.meta.env.BASE_URL || '/';
    const prefix = base.endsWith('/') ? base : `${base}/`;
    return `${window.location.origin}${prefix}#/room/${encodeURIComponent(name)}`;
};

const timeToMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
};

const formatPercent = (value: number | null) => {
    if (value === null) return 'N/A';
    return `${Math.round(value * 100)}%`;
};

const formatHours = (value: number) => `${value.toFixed(1)}h`;

const formatWindow = (session: Session) => `${session.start} - ${session.end}`;

const getSessionTitle = (session: Session, language: 'ko' | 'en') => {
    if (language === 'ko' && session.titleKo) return session.titleKo;
    return session.title;
};

const getSessionProfessor = (session: Session, language: 'ko' | 'en') => {
    if (language === 'ko' && session.professorKo) return session.professorKo;
    return session.professor;
};

const getInsightTitle = (insight: RoomInsight, language: 'ko' | 'en') => {
    if (language === 'ko' && insight.titleKo) return insight.titleKo;
    return insight.title;
};

const getInsightProfessor = (insight: RoomInsight, language: 'ko' | 'en') => {
    if (language === 'ko' && insight.professorKo) return insight.professorKo;
    return insight.professor;
};

const getCardStyle = (session: Session) => {
    const startMinutes = timeToMinutes(session.start);
    const endMinutes = timeToMinutes(session.end);
    const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
    const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
    const dayIndex = DAYS.indexOf(session.day);

    return {
        top: `${top}px`,
        height: `${Math.max(height, 36)}px`,
        left: `calc(${dayIndex} * (100% / 5) + 0.375rem)`,
        width: 'calc((100% / 5) - 0.75rem)',
    };
};

const getSessionColor = (fillRate: number | null) => {
    if (fillRate === null) return 'border-slate-200 bg-slate-100 text-slate-900';
    if (fillRate >= 0.85) return 'border-emerald-200 bg-emerald-100 text-emerald-950';
    if (fillRate >= 0.55) return 'border-amber-200 bg-amber-100 text-amber-950';
    return 'border-rose-200 bg-rose-100 text-rose-950';
};

type RoomSuggestion = {
    room: string;
    sessionCount: number;
    courseCount: number;
};

interface RoomTimetablePageProps {
    roomName?: string;
}

export const RoomTimetablePage = ({ roomName = 'E7 - 233' }: RoomTimetablePageProps) => {
    const { language } = useApp();
    const isKorean = language === 'ko';
    const currentRoomName = normalizeRoomName(roomName);
    const [roomQuery, setRoomQuery] = useState('');
    const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);

    const roomSuggestions = useMemo<RoomSuggestion[]>(() => {
        const keyword = roomQuery.trim().toLowerCase();
        const list = rooms
            .filter((room) => !keyword || room.room.toLowerCase().includes(keyword))
            .map((room) => ({
                room: room.room,
                sessionCount: room.sessionCount,
                courseCount: room.courseCount,
            }))
            .sort((a, b) => b.sessionCount - a.sessionCount || a.room.localeCompare(b.room));

        return list.slice(0, keyword ? 12 : 8);
    }, [roomQuery]);

    const roomIndex = useMemo(
        () => rooms.findIndex((entry) => entry.room === currentRoomName),
        [currentRoomName]
    );
    const safeIndex = roomIndex === -1 ? 0 : roomIndex;
    const activeRoom = rooms[safeIndex];
    const prevRoom = safeIndex > 0 ? rooms[safeIndex - 1] : null;
    const nextRoom = safeIndex + 1 < rooms.length ? rooms[safeIndex + 1] : null;

    const goToRoom = (name?: string) => {
        if (!name) return;
        window.location.href = buildRoomUrl(name);
    };

    const handleSelectRoom = (name: string) => {
        setRoomQuery('');
        setIsSuggestionsVisible(false);
        goToRoom(name);
    };

    const summaryCards = activeRoom ? [
        {
            label: isKorean ? '추정 강의실 정원' : 'Estimated Capacity',
            value: activeRoom.estimatedCapacity !== null ? String(activeRoom.estimatedCapacity) : 'N/A',
            hint: isKorean ? '해당 강의실에서 관측된 최대 정원' : 'Max observed admin cap in this room',
        },
        {
            label: isKorean ? '주간 점유율' : 'Weekly Occupancy',
            value: formatPercent(activeRoom.weeklyOccupancy),
            hint: isKorean ? `${formatHours(activeRoom.meetingHours)} 사용` : `${formatHours(activeRoom.meetingHours)} scheduled`,
        },
        {
            label: isKorean ? '평균 충원율' : 'Avg Fill Rate',
            value: formatPercent(activeRoom.avgFillRate),
            hint: isKorean ? '분반별 평균 수강신청률' : 'Mean section fill rate',
        },
        {
            label: isKorean ? '분석 커버리지' : 'Coverage',
            value: `${activeRoom.analyzedCourseCount}/${activeRoom.courseCount}`,
            hint: formatPercent(activeRoom.coverage),
        },
    ] : [];

    const searchSection = (
        <div className="relative w-full md:w-80 mt-3">
            <label className="mb-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                {isKorean ? '강의실 찾기' : 'Find Room'}
            </label>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input
                    value={roomQuery}
                    onChange={(e) => {
                        setRoomQuery(e.target.value);
                        setIsSuggestionsVisible(true);
                    }}
                    onFocus={() => setIsSuggestionsVisible(true)}
                    onBlur={() => setTimeout(() => setIsSuggestionsVisible(false), 120)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && roomSuggestions.length > 0) {
                            event.preventDefault();
                            handleSelectRoom(roomSuggestions[0].room);
                        }
                    }}
                    className="w-full border border-gray-200 pl-8 pr-9 py-2 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                    placeholder={isKorean ? '예: E7 - 233' : 'e.g. E7 - 233'}
                />
                {roomQuery ? (
                    <button
                        type="button"
                        onMouseDown={() => setRoomQuery('')}
                        className="absolute right-2.5 top-2.5 text-[10px] text-gray-400 hover:text-gray-700"
                    >
                        x
                    </button>
                ) : null}
            </div>
            {isSuggestionsVisible && roomSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 z-10 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    {roomSuggestions.map((suggestion) => (
                        <button
                            key={suggestion.room}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-4"
                            onMouseDown={() => handleSelectRoom(suggestion.room)}
                        >
                            <span className="font-semibold">{suggestion.room}</span>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                {isKorean
                                    ? `${suggestion.courseCount}과목 · ${suggestion.sessionCount}회`
                                    : `${suggestion.courseCount} courses · ${suggestion.sessionCount} sessions`}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    if (!activeRoom || roomIndex === -1) {
        return (
            <div className="min-h-screen bg-gray-50 p-3 md:p-6">
                <div className="w-full max-w-7xl mx-auto">
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                {isKorean ? '강의실 시간표 뷰' : 'Room Timetable View'}
                            </p>
                            <h1 className="text-xl font-black text-gray-900">
                                {isKorean ? `${currentRoomName} 강의실을 찾지 못했습니다.` : `Room ${currentRoomName} was not found.`}
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">
                                {isKorean ? '아래 검색창에서 다른 강의실을 찾아 이동하세요.' : 'Search for another room below.'}
                            </p>
                            {searchSection}
                        </div>
                        <a
                            href={import.meta.env.BASE_URL}
                            className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-700 transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            {isKorean ? '메인으로' : 'Back to Main'}
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-3 md:p-6">
            <div className="w-full max-w-7xl mx-auto space-y-4">
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                            {isKorean ? '강의실 시간표 뷰' : 'Room Timetable View'}
                        </p>
                        <h1 className="text-xl md:text-2xl font-black text-gray-900 flex items-center gap-2">
                            <DoorOpen className="w-5 h-5 text-blue-600" />
                            {isKorean ? `${activeRoom.room} 강의실 시간표` : `${activeRoom.room} Room Timetable`}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {isKorean
                                ? `총 ${activeRoom.courseCount}과목 · ${activeRoom.sessionCount}회 수업 · 활용 ${formatPercent(activeRoom.inUseSeatUtil)}`
                                : `${activeRoom.courseCount} courses · ${activeRoom.sessionCount} sessions · in-use ${formatPercent(activeRoom.inUseSeatUtil)}`}
                        </p>
                        {searchSection}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button
                            onClick={() => goToRoom(prevRoom?.room)}
                            disabled={!prevRoom}
                            className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${prevRoom
                                ? 'bg-gray-900 text-white hover:bg-gray-700'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {isKorean ? '이전 강의실' : 'Prev Room'}
                        </button>
                        <button
                            onClick={() => goToRoom(nextRoom?.room)}
                            disabled={!nextRoom}
                            className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${nextRoom
                                ? 'bg-gray-900 text-white hover:bg-gray-700'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {isKorean ? '다음 강의실' : 'Next Room'}
                        </button>
                        <a
                            href={import.meta.env.BASE_URL}
                            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-500 transition-colors"
                        >
                            <Home className="w-4 h-4" />
                            {isKorean ? '메인으로' : 'Back to Main'}
                        </a>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
                    {summaryCards.map((card) => (
                        <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{card.label}</p>
                            <p className="text-2xl font-black text-gray-900 mt-2">{card.value}</p>
                            <p className="text-xs text-gray-500 mt-1">{card.hint}</p>
                        </div>
                    ))}
                </div>

                <div className="grid xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)] gap-4">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 overflow-hidden">
                        <div className="flex items-center justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-sm font-black text-gray-900">
                                    {isKorean ? '주간 강의실 배치' : 'Weekly Room Layout'}
                                </h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    {isKorean
                                        ? '월요일부터 금요일, 09:00부터 21:00까지 표시합니다.'
                                        : 'Monday to Friday, from 09:00 to 21:00.'}
                                </p>
                            </div>
                            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                                {isKorean ? '시간표' : 'Schedule'}
                            </p>
                        </div>

                        <div className="overflow-x-auto">
                            <div className="min-w-[760px]">
                                <div className="grid grid-cols-[80px_repeat(5,minmax(0,1fr))] gap-3 mb-3">
                                    <div />
                                    {DAYS.map((day) => (
                                        <div
                                            key={day}
                                            className="rounded-xl border border-gray-100 bg-gray-50 h-11 flex items-center justify-center text-xs font-black text-gray-500 uppercase tracking-widest"
                                        >
                                            {DAY_LABELS[language][day]}
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-[80px_1fr] gap-3">
                                    <div className="relative" style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}>
                                        {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, index) => {
                                            const hour = START_HOUR + index;
                                            const slotIndex = (hour - 9) * 2;
                                            return (
                                                <div
                                                    key={hour}
                                                    className="absolute left-0 right-0 text-[11px] font-bold text-gray-300"
                                                    style={{ top: `${index * HOUR_HEIGHT - 8}px` }}
                                                >
                                                    {formatSingleSlotTime(slotIndex)}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div
                                        className="relative rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white overflow-hidden"
                                        style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}
                                    >
                                        {Array.from({ length: END_HOUR - START_HOUR }).map((_, index) => (
                                            <div
                                                key={`row-${index}`}
                                                className="absolute left-0 right-0 border-t border-gray-100"
                                                style={{ top: `${index * HOUR_HEIGHT}px` }}
                                            />
                                        ))}
                                        {DAYS.map((day, index) => (
                                            <div
                                                key={day}
                                                className="absolute top-0 bottom-0 border-l border-gray-100"
                                                style={{ left: `${(index * 100) / DAYS.length}%` }}
                                            />
                                        ))}

                                        {activeRoom.sessions.map((session) => (
                                            <article
                                                key={`${session.courseCode}-${session.section}-${session.day}-${session.start}`}
                                                className={`absolute rounded-2xl border shadow-sm px-3 py-2 overflow-hidden ${getSessionColor(session.fillRate)}`}
                                                style={getCardStyle(session)}
                                            >
                                                <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest opacity-70">
                                                    <span>{session.courseCode}</span>
                                                    <span>{session.section}</span>
                                                </div>
                                                <h3 className="mt-1 text-[13px] font-black leading-tight">
                                                    {getSessionTitle(session, language)}
                                                </h3>
                                                <p className="mt-1 text-[11px] opacity-80 truncate">
                                                    {getSessionProfessor(session, language)}
                                                </p>
                                                <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-bold opacity-70">
                                                    <span>{formatWindow(session)}</span>
                                                    <span>
                                                        {session.enrolled !== null && session.adminCapacity !== null
                                                            ? `${session.enrolled}/${session.adminCapacity}`
                                                            : 'N/A'}
                                                    </span>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="flex items-center justify-between gap-4 mb-3">
                                <h2 className="text-sm font-black text-gray-900">
                                    {isKorean ? '요일별 사용 시간' : 'Weekday Load'}
                                </h2>
                                <span className="text-xs text-gray-400 font-bold">
                                    {formatHours(activeRoom.meetingHours)}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {DAYS.map((day) => {
                                    const hours = activeRoom.dayHours[day];
                                    const ratio = Math.min(hours / 12, 1);
                                    return (
                                        <div key={day} className="grid grid-cols-[36px_1fr_auto] gap-3 items-center">
                                            <span className="text-xs font-black text-gray-500 uppercase">
                                                {DAY_LABELS[language][day]}
                                            </span>
                                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                                                    style={{ width: `${ratio * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-gray-500">{formatHours(hours)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <div className="flex items-center justify-between gap-4 mb-3">
                                <h2 className="text-sm font-black text-gray-900">
                                    {isKorean ? '빈자리 여유가 큰 분반' : 'Largest Room Gaps'}
                                </h2>
                                <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest">
                                    {isKorean ? '추정 정원 - 수강인원' : 'room cap - enrolled'}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {activeRoom.topSlackSections.length > 0 ? activeRoom.topSlackSections.map((insight) => {
                                    const capacity = activeRoom.estimatedCapacity ?? 0;
                                    const width = capacity > 0 ? (insight.enrolled / capacity) * 100 : 0;

                                    return (
                                        <article key={`${insight.courseCode}-${insight.section}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-black text-gray-900">
                                                        {getInsightTitle(insight, language)}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {insight.courseCode} · {insight.section} · {getInsightProfessor(insight, language)}
                                                    </p>
                                                </div>
                                                <strong className="text-lg font-black text-gray-900">{insight.roomGap}</strong>
                                            </div>
                                            <div className="mt-3 h-2 rounded-full bg-white overflow-hidden border border-gray-100">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                                                    style={{ width: `${width}%` }}
                                                />
                                            </div>
                                            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-gray-500">
                                                <span>
                                                    {isKorean
                                                        ? `수강 ${insight.enrolled} / 강의실 ${activeRoom.estimatedCapacity ?? 'N/A'}`
                                                        : `enrolled ${insight.enrolled} / room ${activeRoom.estimatedCapacity ?? 'N/A'}`}
                                                </span>
                                                <span>
                                                    {isKorean ? `정원 ${insight.adminCapacity}` : `admin ${insight.adminCapacity}`}
                                                </span>
                                            </div>
                                        </article>
                                    );
                                }) : (
                                    <p className="text-sm text-gray-400">
                                        {isKorean ? '이 강의실에는 연결된 수강 인원 데이터가 없습니다.' : 'No matched enrollment data for this room.'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <h2 className="text-sm font-black text-gray-900 mb-3">
                        {isKorean ? '수업 목록' : 'Session List'}
                    </h2>
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {activeRoom.sessions.map((session) => (
                            <div
                                key={`${session.courseCode}-${session.section}-${session.day}-${session.start}-list`}
                                className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                            >
                                <p className="text-xs font-black text-gray-900">
                                    {getSessionTitle(session, language)}
                                </p>
                                <p className="text-[11px] text-gray-500 mt-1">
                                    {session.courseCode} · {session.section} · {getSessionProfessor(session, language)}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1">
                                    {DAY_LABELS[language][session.day]} {formatWindow(session)}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1">
                                    {session.enrolled !== null && session.adminCapacity !== null
                                        ? (isKorean
                                            ? `수강 ${session.enrolled} / 정원 ${session.adminCapacity} / 충원 ${formatPercent(session.fillRate)}`
                                            : `enrolled ${session.enrolled} / admin ${session.adminCapacity} / fill ${formatPercent(session.fillRate)}`)
                                        : (isKorean ? '수강 데이터 없음' : 'No demand data')}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
