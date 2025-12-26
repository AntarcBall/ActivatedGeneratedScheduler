import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatSingleSlotTime } from '../utils/lectureUtils';
import { ChevronLeft, ChevronRight, Trophy, BookOpen, Clock } from 'lucide-react';
import { translations } from '../translations';

export const ResultsView = () => {
    const { generatedTimetables, language } = useApp();
    const t = translations[language].results;
    const [currentIndex, setCurrentIndex] = useState(0);

    const current = generatedTimetables[currentIndex];

    const maxScore = useMemo(() => Math.max(...generatedTimetables.map(t => t.totalLoss), 1), [generatedTimetables]);
    const minScore = useMemo(() => Math.min(...generatedTimetables.map(t => t.totalLoss), 0), [generatedTimetables]);

    if (generatedTimetables.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-12 bg-white rounded-3xl border-2 border-dashed border-gray-100">
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
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50">
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Timetable Grid */}
                <div className="lg:col-span-8 bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden p-6">
                    <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-2">
                        <div className="h-10" />
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                            <div key={day} className="h-10 flex items-center justify-center font-black text-xs text-gray-400 uppercase tracking-widest">
                                {day}
                            </div>
                        ))}
                        
                        {Array.from({ length: 24 }).map((_, slotIdx) => (
                            <React.Fragment key={slotIdx}>
                                <div className="h-12 flex items-center justify-end pr-3 text-[10px] font-bold text-gray-300">
                                    {formatSingleSlotTime(slotIdx)}
                                </div>
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => {
                                    const lecture = current.lectures.find(l => 
                                        l.time_slots.some(s => s.day === day && slotIdx >= s.start_index && slotIdx <= s.end_index)
                                    );
                                    return (
                                        <div 
                                            key={`${day}-${slotIdx}`} 
                                            className={`h-12 rounded-lg border border-transparent transition-all ${
                                                lecture ? 'bg-blue-600 shadow-lg shadow-blue-100 border-blue-400/20' : 'bg-gray-50/50'
                                            }`}
                                        />
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
                            {current.lectures.reduce((sum, l) => sum + l.credit, 0).toFixed(1)}
                        </div>
                    </div>

                    {current.lectures.map(lec => (
                        <div key={lec.id} className="group bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            <div className="flex items-start justify-between mb-3">
                                <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                                    Section {lec.section}
                                </span>
                                <span className="text-[10px] font-bold text-gray-300">{lec.credit} Credits</span>
                            </div>
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
                    ))}
                </div>
            </div>
        </div>
    );
};
