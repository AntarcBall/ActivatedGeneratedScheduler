import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DAYS } from '../types';

export const ResultsView = () => {
    const { generatedTimetables } = useApp();
    const [currentIndex, setCurrentIndex] = useState(0);

    if (generatedTimetables.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                <div className="text-4xl">☹️</div>
                <p>No valid timetables found without collisions.</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="text-blue-500 underline"
                >
                    Try again with fewer lectures
                </button>
            </div>
        );
    }

    const current = generatedTimetables[currentIndex];
    
    // Time grid 9:00 to 21:00 (24 slots)
    const timeSlots = Array.from({ length: 24 }, (_, i) => {
        const h = 9 + Math.floor(i / 2);
        const m = i % 2 === 0 ? "00" : "30";
        return `${h}:${m}`;
    });

    return (
        <div className="flex flex-col h-full">
            {/* Controls */}
            <div className="flex items-center justify-between mb-4 bg-gray-100 p-3 rounded-lg">
                <button 
                    onClick={() => setCurrentIndex(p => Math.max(0, p - 1))}
                    disabled={currentIndex === 0}
                    className="px-4 py-1 bg-white border rounded shadow disabled:opacity-30"
                >
                    ← Previous
                </button>
                <div className="text-center">
                    <div className="font-bold">Option {currentIndex + 1} / {generatedTimetables.length}</div>
                    <div className="text-xs text-gray-500">Loss: {current.score.toFixed(2)}</div>
                </div>
                <button 
                    onClick={() => setCurrentIndex(p => Math.min(generatedTimetables.length - 1, p + 1))}
                    disabled={currentIndex === generatedTimetables.length - 1}
                    className="px-4 py-1 bg-white border rounded shadow disabled:opacity-30"
                >
                    Next →
                </button>
            </div>

            {/* Timetable Grid */}
            <div className="flex-1 overflow-auto border rounded-lg bg-white relative">
                <table className="w-full border-collapse table-fixed h-full min-h-[840px]">
                    <thead className="bg-gray-50 sticky top-0 z-20">
                        <tr>
                            <th className="w-16 border p-1 text-xs">Time</th>
                            {DAYS.map(day => <th key={day} className="border p-1 text-xs">{day}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map((time, idx) => (
                            <tr key={idx} className="h-14">
                                <td className="border p-1 text-[10px] text-center text-gray-400 align-top">{time}</td>
                                {DAYS.map(day => (
                                    <td key={day} className="border relative p-0" />
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Overlaid Lectures */}
                {current.lectures.map((lec, lIdx) => {
                    const colors = [
                        'bg-blue-100 border-blue-400 text-blue-800',
                        'bg-green-100 border-green-400 text-green-800',
                        'bg-purple-100 border-purple-400 text-purple-800',
                        'bg-yellow-100 border-yellow-400 text-yellow-800',
                        'bg-pink-100 border-pink-400 text-pink-800',
                        'bg-indigo-100 border-indigo-400 text-indigo-800',
                        'bg-orange-100 border-orange-400 text-orange-800',
                        'bg-teal-100 border-teal-400 text-teal-800',
                    ];
                    const colorClass = colors[lIdx % colors.length];

                    return lec.time_slots.map((slot, sIdx) => {
                        const dayIdx = DAYS.indexOf(slot.day);
                        if (dayIdx === -1) return null;

                        // Calculate position
                        // Header is approx 25px
                        // Each row is h-14 (56px)
                        const top = 25 + (slot.start_index * 56);
                        const height = (slot.end_index - slot.start_index + 1) * 56;
                        const left = `calc(4rem + ${(dayIdx / 5) * 100}% - ${dayIdx * 0.2}px)`; // Offset for time column
                        const width = `calc((100% - 4rem) / 5)`;

                        return (
                            <div 
                                key={`${lIdx}-${sIdx}`}
                                className={`absolute border-l-4 p-1 overflow-hidden flex flex-col justify-center items-center text-center shadow-sm z-10 ${colorClass}`}
                                style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    left: left,
                                    width: width,
                                }}
                            >
                                <div className="text-[10px] font-bold truncate w-full">{lec.name}</div>
                                <div className="text-[8px] truncate">{lec.prof}</div>
                            </div>
                        );
                    });
                })}
            </div>
        </div>
    );
};
