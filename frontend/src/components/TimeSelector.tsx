import { useApp } from '../context/AppContext';
import { DAYS } from '../types';

interface TimeSelectorProps {
    type: 'good' | 'bad';
}

export const TimeSelector = ({ type }: TimeSelectorProps) => {
    const { goodSlots, badSlots, toggleSlot } = useApp();
    
    // 9:00 (index 0) to 21:00 (index 24) - 30 min intervals
    const timeSlots = Array.from({ length: 25 }, (_, i) => {
        const h = 9 + Math.floor(i / 2);
        const m = i % 2 === 0 ? "00" : "30";
        return `${h}:${m}`;
    });

    const activeSlots = type === 'good' ? goodSlots : badSlots;
    const activeColor = type === 'good' ? 'bg-green-400' : 'bg-red-400';
    const hoverColor = type === 'good' ? 'hover:bg-green-100' : 'hover:bg-red-100';

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto border rounded-lg">
                <table className="w-full border-collapse table-fixed">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="p-2 border border-gray-200 w-20">Time</th>
                            {DAYS.map(day => (
                                <th key={day} className="p-2 border border-gray-200">{day}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {timeSlots.map((time, idx) => (
                            <tr key={idx} className="h-8">
                                <td className="p-1 border border-gray-200 text-xs text-center text-gray-500 bg-gray-50">
                                    {time}
                                </td>
                                {DAYS.map(day => {
                                    const isSelected = activeSlots[day].includes(idx);
                                    return (
                                        <td 
                                            key={day}
                                            onClick={() => toggleSlot(type, day, idx)}
                                            className={`border border-gray-200 cursor-pointer transition-colors ${
                                                isSelected ? activeColor : hoverColor
                                            }`}
                                        />
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-2 text-xs text-gray-400">
                * Click cells to toggle. {type === 'good' ? 'Greens' : 'Reds'} are {type === 'good' ? 'preferred' : 'avoided'} times.
            </div>
        </div>
    );
};
