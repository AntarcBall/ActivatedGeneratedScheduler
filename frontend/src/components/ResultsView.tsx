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

    // Histogram Calculation
    const scores = generatedTimetables.map(t => t.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const binCount = 40;
    const range = maxScore - minScore || 1; // avoid div by zero
    const bins = new Array(binCount).fill(0);
    
    scores.forEach(s => {
        const binIdx = Math.min(
            Math.floor(((s - minScore) / range) * binCount),
            binCount - 1
        );
        bins[binIdx]++;
    });
    const maxFreq = Math.max(...bins, 1);

    const currentScore = current.score;
    const currentBinIdx = Math.min(
        Math.floor(((currentScore - minScore) / range) * binCount),
        binCount - 1
    );

    return (
        <div className="flex flex-col h-full">
            {/* Loss Distribution Chart */}
            <div className="mb-4 bg-white p-3 rounded-lg border shadow-sm">
                <div className="flex justify-between items-end mb-1 text-xs text-gray-500">
                    <span>Loss Distribution</span>
                    <span>Min: {minScore.toFixed(1)} ~ Max: {maxScore.toFixed(1)}</span>
                </div>
                <div className="h-16 w-full flex items-end space-x-[1px]">
                    {bins.map((count, idx) => {
                        const height = (count / maxFreq) * 100;
                        const isCurrent = idx === currentBinIdx;
                        return (
                            <div 
                                key={idx} 
                                className={`flex-1 rounded-t-sm transition-all ${isCurrent ? 'bg-blue-500' : 'bg-gray-200'}`}
                                style={{ height: `${height}%` }}
                                title={`Range: ${(minScore + (idx/binCount)*range).toFixed(1)} - ${(minScore + ((idx+1)/binCount)*range).toFixed(1)}\nCount: ${count}`}
                            />
                        );
                    })}
                </div>
            </div>

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
                <table className="w-full border-collapse table-fixed h-full min-h-[500px]">
                    <thead className="bg-gray-50 sticky top-0 z-20">
                        <tr>
                            <th className="w-16 border py-0.5 px-1 text-xs">Time</th>
                            {DAYS.map(day => <th key={day} className="border py-0.5 px-1 text-xs">{day}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map((time, idx) => (
                            <tr key={idx} className="h-[22px]">
                                <td className="border px-1 text-[9px] text-center text-gray-400 align-middle leading-none">{time}</td>
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
                        // Header is approx 18px (reduced from 25)
                        // Each row is 22px (reduced from 56)
                        const rowHeight = 22;
                        const headerHeight = 18;
                        const top = headerHeight + (slot.start_index * rowHeight);
                        const height = (slot.end_index - slot.start_index + 1) * rowHeight;
                        const left = `calc(4rem + ${(dayIdx / 5) * 100}% - ${dayIdx * 0.2}px)`; // Offset for time column
                        const width = `calc((100% - 4rem) / 5)`;

                        return (
                            <div 
                                key={`${lIdx}-${sIdx}`}
                                className={`absolute border-l-2 p-0.5 overflow-hidden flex flex-col justify-center items-center text-center shadow-sm z-10 ${colorClass}`}
                                style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    left: left,
                                    width: width,
                                }}
                            >
                                <div className="text-[9px] font-bold truncate w-full leading-tight">{lec.name}</div>
                                <div className="text-[7px] truncate leading-none">{lec.prof}</div>
                            </div>
                        );
                    });
                })}
            </div>
        </div>
    );
};
