import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatSingleSlotTime } from '../utils/lectureUtils';
import { ChevronLeft, ChevronRight, Trophy, BookOpen, Clock } from 'lucide-react';
import { translations } from '../translations';

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

export const ResultsView = () => {
    const { generatedTimetables, language, preferences } = useApp();
    const t = translations[language].results;
    const [currentIndex, setCurrentIndex] = useState(0);

    const current = generatedTimetables[currentIndex];

    const maxScore = useMemo(() => Math.max(...generatedTimetables.map(t => t.totalLoss), 1), [generatedTimetables]);
    const minScore = useMemo(() => Math.min(...generatedTimetables.map(t => t.totalLoss), 0), [generatedTimetables]);

    if (generatedTimetables.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-12 bg-white rounded-3xl border-8 border-dashed border-gray-100">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                    <BookOpen className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Results</h3>
                <p className="text-gray-400 max-w-sm leading-relaxed">
                    {t.noResults}
                </p>
            </div>
        );
    }

    const next = () => setCurrentIndex(prev => (prev + 1) % generatedTimetables.length);
    const prev = () => setCurrentIndex(prev => (prev - 1 + generatedTimetables.length) % generatedTimetables.length);

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Header / Stats */}
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
                            <span className="text-sm font-black text-yellow-600 uppercase tracking-widest">{t.rank} #{currentIndex + 1}</span>
                            <span className="w-1 h-1 bg-gray-200 rounded-full" />
                            <span className="text-sm font-bold text-gray-400">{generatedTimetables.length} Total</span>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900">
                            {t.loss}: <span className="text-blue-600">{current.totalLoss.toFixed(2)}</span>
                        </h3>
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
                                style={{ width: `${100 - ((current.totalLoss - minScore) / (maxScore - minScore || 1) * 100)}%` }}
                            />
                        </div>
                    </div>
                    <button onClick={next} className="p-3 hover:bg-white hover:shadow-md rounded-xl transition-all active:scale-95">
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Timetable Grid */}
                <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden p-4">
                    <div className="grid grid-cols-[50px_repeat(5,1fr)] gap-0 border-l border-t border-gray-100">
                        <div className="h-8 bg-gray-50 border-r border-b border-gray-100" />
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                            <div key={day} className="h-8 flex items-center justify-center font-black text-[10px] text-gray-400 uppercase tracking-widest bg-gray-50 border-r border-b border-gray-100">
                                {day}
                            </div>
                        ))}

                        {Array.from({ length: 24 }).map((_, slotIdx) => (
                            <React.Fragment key={slotIdx}>
                                <div key={`t-${slotIdx}`} className="h-[22px] flex items-center justify-end pr-2 text-[8px] font-bold text-gray-300 bg-gray-50/30 border-r border-b border-gray-100">
                                    {formatSingleSlotTime(slotIdx)}
                                </div>
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => {
                                    const lecture = current.lectures.find(l =>
                                        l.time_slots.some(s => s.day === day && slotIdx >= s.start_index && slotIdx <= s.end_index)
                                    );

                                    const slot = lecture?.time_slots.find(s => s.day === day && slotIdx >= s.start_index && slotIdx <= s.end_index);
                                    const isStart = slot && slot.start_index === slotIdx;
                                    const isSecond = slot && slot.start_index + 1 === slotIdx;
                                    const isEnd = slot && slot.end_index === slotIdx;

                                    const colorClass = lecture
                                        ? COLORS[current.lectures.indexOf(lecture) % COLORS.length]
                                        : 'bg-white';

                                    const pref = lecture ? (preferences[lecture.id] || 0) : 0;

                                    let borderClass = '';
                                    if (lecture) {
                                        // Base borders
                                        let borderStyle = '';
                                        if (pref > 0) {
                                            // Good preference: Bold Green
                                            borderStyle = 'border-green-500 border-l-4 border-r-4';
                                            if (isStart) borderStyle += ' border-t-4';
                                            if (isEnd) borderStyle += ' border-b-4';
                                        } else if (pref < 0) {
                                            // Bad preference: Bold Red
                                            borderStyle = 'border-red-500 border-l-4 border-r-4';
                                            if (isStart) borderStyle += ' border-t-4';
                                            if (isEnd) borderStyle += ' border-b-4';
                                        } else {
                                            // Normal: Standard colored borders
                                            const borderPart = colorClass.split(' ').pop() || '';
                                            borderStyle = `border-l border-r ${isStart ? 'border-t' : 'border-t-0'} ${isEnd ? 'border-b' : 'border-b-0'} ${borderPart.replace('border-', 'border-opacity-50 border-')}`;
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

                {/* Lecture Detail Cards */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="bg-gray-900 rounded-3xl p-6 text-white mb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Clock className="w-5 h-5 text-blue-400" />
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t.totalCredits}</span>
                        </div>
                        <div className="text-4xl font-black">
                            {current.lectures.reduce((sum, l) => sum + (l.credit || 0), 0).toFixed(1)}
                        </div>
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                        {current.lectures.map((lec, idx) => {
                            const pref = preferences[lec.id] || 0;
                            const cardBorderClass = pref > 0
                                ? 'ring-2 ring-green-500 border-transparent'
                                : pref < 0
                                    ? 'ring-2 ring-red-500 border-transparent'
                                    : 'border-gray-100';

                            return (
                                <div key={lec.id} className={`group bg-white p-5 rounded-2xl border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden ${cardBorderClass}`}>
                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${COLORS[idx % COLORS.length].split(' ')[0]}`} />
                                    <div className="flex items-start justify-between mb-3 pl-3">
                                        <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                                            Section {lec.section}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-300">{lec.credit} Credits</span>
                                    </div>
                                    <div className="pl-3">
                                        <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-1">{lec.name}</h4>
                                        <p className="text-sm text-gray-500 font-medium">{lec.prof}</p>
                                        <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-2">
                                            {lec.time_slots.map((s, i) => (
                                                <span key={i} className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">
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
