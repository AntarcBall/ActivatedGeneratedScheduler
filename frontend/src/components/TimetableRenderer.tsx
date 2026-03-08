import React, { useEffect, useMemo, useState } from 'react';
import { Timetable } from '../types';
import { formatSingleSlotTime } from '../utils/lectureUtils';
import { ChevronLeft, ChevronRight, Trophy, BookOpen, Clock } from 'lucide-react';

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
    'bg-violet-100 text-violet-900 border-violet-200',
    'bg-purple-100 text-purple-900 border-purple-200',
    'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200',
    'bg-pink-100 text-pink-900 border-pink-200',
    'bg-rose-100 text-rose-900 border-rose-200',
];

export type TimetableRendererLabels = {
    title: string;
    subtitle: string;
    rank: string;
    total: string;
    totalLoss: string;
    totalCredits: string;
    noResults: string;
};

interface TimetableRendererProps {
    timetables: Timetable[];
    preferences?: Record<number, number>;
    labels: TimetableRendererLabels;
}

export const TimetableRenderer = ({ timetables, preferences = {}, labels }: TimetableRendererProps) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    const normalizedIndex = useMemo(
        () => Math.min(currentIndex, Math.max(timetables.length - 1, 0)),
        [currentIndex, timetables.length]
    );

    const currentTimetable = useMemo(
        () => timetables[normalizedIndex] ?? null,
        [normalizedIndex, timetables]
    );

    useEffect(() => {
        if (!timetables.length) {
            setCurrentIndex(0);
            return;
        }

        if (normalizedIndex !== currentIndex) {
            setCurrentIndex(normalizedIndex);
        }
    }, [normalizedIndex, currentIndex, timetables.length]);

    if (timetables.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-12 bg-white rounded-3xl border-8 border-dashed border-gray-100">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                    <BookOpen className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{labels.title}</h3>
                <p className="text-gray-400 max-w-sm leading-relaxed">{labels.noResults}</p>
            </div>
        );
    }

    if (!currentTimetable) {
        return null;
    }

    const maxScore = useMemo(() => Math.max(...timetables.map((tt) => tt.totalLoss), 1), [timetables]);
    const minScore = useMemo(() => Math.min(...timetables.map((tt) => tt.totalLoss), 0), [timetables]);

    const next = () => setCurrentIndex((prev) => (prev + 1) % timetables.length);
    const prev = () => setCurrentIndex((prev) => (prev - 1 + timetables.length) % timetables.length);

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div
                className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50"
                style={{ height: '83.81818200000001px', paddingTop: 0, paddingBottom: 0 }}
            >
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-lg shadow-yellow-100 rotate-3">
                        <Trophy className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-black text-yellow-600 uppercase tracking-widest">{labels.rank} #{normalizedIndex + 1}</span>
                            <span className="w-1 h-1 bg-gray-200 rounded-full" />
                            <span className="text-sm font-bold text-gray-400">{timetables.length} {labels.total}</span>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900">
                            {labels.totalLoss}: <span className="text-blue-600">{currentTimetable.totalLoss.toFixed(2)}</span>
                        </h3>
                        <p className="text-sm text-gray-500">{labels.subtitle}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                    <button onClick={prev} className="p-3 hover:bg-white hover:shadow-md rounded-xl transition-all active:scale-95">
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <div className="px-6 py-2 text-center min-w-[100px]">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Score</div>
                        <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                            <div
                                className="bg-blue-600 h-full transition-all duration-1000"
                                style={{ width: `${100 - ((currentTimetable.totalLoss - minScore) / (maxScore - minScore || 1) * 100)}%` }}
                            />
                        </div>
                    </div>
                    <button onClick={next} className="p-3 hover:bg-white hover:shadow-md rounded-xl transition-all active:scale-95">
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden p-4">
                    <div className="grid grid-cols-[50px_repeat(5,1fr)] gap-0 border-l border-t border-gray-100">
                        <div className="h-8 bg-gray-50 border-r border-b border-gray-100" />
                        {DAYS.map((day) => (
                            <div key={day} className="h-8 flex items-center justify-center font-black text-[10px] text-gray-400 uppercase tracking-widest bg-gray-50 border-r border-b border-gray-100">
                                {day}
                            </div>
                        ))}

                        {Array.from({ length: 24 }).map((_, slotIdx) => (
                            <React.Fragment key={slotIdx}>
                                <div key={`t-${slotIdx}`} className="h-[22px] flex items-center justify-end pr-2 text-[8px] font-bold text-gray-300 bg-gray-50/30 border-r border-b border-gray-100">
                                    {formatSingleSlotTime(slotIdx)}
                                </div>
                                {DAYS.map((day) => {
                                    const lecture = currentTimetable.lectures.find((l) =>
                                        l.time_slots.some((slot) => slot.day === day && slotIdx >= slot.start_index && slotIdx <= slot.end_index)
                                    );

                                    const slot = lecture?.time_slots.find((s) => s.day === day && slotIdx >= s.start_index && slotIdx <= s.end_index);
                                    const isStart = slot && slot.start_index === slotIdx;
                                    const isSecond = slot && slot.start_index + 1 === slotIdx;

                                    const colorClass = lecture
                                        ? COLORS[currentTimetable.lectures.indexOf(lecture) % COLORS.length]
                                        : 'bg-white';

                                    const pref = lecture ? (preferences[lecture.id] || 0) : 0;

                                    let borderClass = '';
                                    if (lecture) {
                                        let borderStyle = '';
                                        if (pref > 0) {
                                            borderStyle = 'border-green-500 border-l-4 border-r-4';
                                            borderStyle += isStart ? ' border-t-4' : '';
                                            borderStyle += slot && slot.end_index === slotIdx ? ' border-b-4' : '';
                                        } else if (pref < 0) {
                                            borderStyle = 'border-red-500 border-l-4 border-r-4';
                                            borderStyle += isStart ? ' border-t-4' : '';
                                            borderStyle += slot && slot.end_index === slotIdx ? ' border-b-4' : '';
                                        } else {
                                            const borderPart = colorClass.split(' ').pop() || '';
                                            borderStyle = `border-l border-r ${isStart ? 'border-t' : 'border-t-0'} ${slot && slot.end_index === slotIdx ? 'border-b' : 'border-b-0'} ${borderPart.replace('border-', 'border-opacity-50 border-')}`;
                                        }

                                        borderClass = borderStyle;
                                    } else {
                                        borderClass = 'border-r border-b border-gray-50';
                                    }

                                    return (
                                        <div
                                            key={`${day}-${slotIdx}`}
                                            className={`h-[22px] transition-all overflow-hidden ${colorClass} ${borderClass} ${lecture ? 'z-10' : ''}`}
                                        >
                                            {lecture && (isStart || isSecond) && (
                                                <div className="px-1 py-0.5 h-full flex flex-col justify-center leading-[1.1]">
                                                    {isStart && (
                                                        <div className="font-bold text-[13px] truncate text-gray-900">
                                                            {lecture.name}
                                                        </div>
                                                    )}
                                                    {isSecond && (
                                                        <div className="text-[12px] opacity-90 truncate font-medium">
                                                            Section {lecture.section} {lecture.prof}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-4">
                    <div className="bg-gray-900 rounded-3xl p-6 text-white mb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Clock className="w-5 h-5 text-blue-400" />
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">{labels.totalCredits}</span>
                        </div>
                        <div className="text-4xl font-black">
                            {currentTimetable.lectures.reduce((sum, l) => sum + (l.credit || 0), 0).toFixed(1)}
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                        {currentTimetable.lectures.map((lec, idx) => {
                            const pref = preferences[lec.id] || 0;
                            const cardBorderClass = pref > 0
                                ? 'ring-2 ring-green-500 border-transparent'
                                : pref < 0
                                    ? 'ring-2 ring-red-500 border-transparent'
                                    : 'border-gray-100';

                            return (
                                <div
                                    key={lec.id}
                                    className={`group bg-white p-5 rounded-2xl border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden ${cardBorderClass}`}
                                >
                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${COLORS[idx % COLORS.length].split(' ')[0]}`} />
                                    <div className="flex items-start justify-between mb-3 pl-3">
                                        <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                                            Section {lec.section}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-300">{lec.credit || 0} Credits</span>
                                    </div>
                                    <div className="pl-3">
                                        <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">{lec.name}</h4>
                                        <p className="text-sm text-gray-500 font-medium">{lec.prof}</p>
                                        <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-2">
                                            {lec.time_slots.map((s, i) => (
                                                <span key={`${s.day}-${s.start_index}-${i}`} className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
                                                    {s.day} {formatSingleSlotTime(s.start_index)}
                                                </span>
                                            ))}
                                        </div>
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
