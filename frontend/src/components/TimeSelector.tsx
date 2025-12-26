import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { DayOfWeek } from '../types';
import { formatSingleSlotTime } from '../utils/lectureUtils';
import { translations } from '../translations';

interface TimeSelectorProps {
    type: 'good' | 'bad';
}

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const SLOTS = Array.from({ length: 24 }, (_, i) => i); // 0 (9:00) to 23 (20:30)

export const TimeSelector = ({ type }: TimeSelectorProps) => {
    const { goodSlots, badSlots, toggleSlot, language } = useApp();
    const t = translations[language].timeSelector;
    const selectedSlots = type === 'good' ? goodSlots : badSlots;
    
    const [isDragging, setIsDragging] = useState(false);
    const [dragType, setDragType] = useState<'add' | 'remove' | null>(null);
    const lastToggled = useRef<string | null>(null);

    const handleMouseDown = (day: DayOfWeek, slot: number) => {
        setIsDragging(true);
        const exists = selectedSlots[day].includes(slot);
        setDragType(exists ? 'remove' : 'add');
        toggleSlot(type, day, slot);
        lastToggled.current = `${day}-${slot}`;
    };

    const handleMouseEnter = (day: DayOfWeek, slot: number) => {
        if (!isDragging || !dragType) return;
        
        const key = `${day}-${slot}`;
        if (lastToggled.current === key) return;

        const exists = selectedSlots[day].includes(slot);
        if ((dragType === 'add' && !exists) || (dragType === 'remove' && exists)) {
            toggleSlot(type, day, slot);
            lastToggled.current = key;
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDragType(null);
        lastToggled.current = null;
    };

    return (
        <div className="space-y-6" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {type === 'good' ? t.goodTitle : t.badTitle}
                </h3>
                <p className="text-gray-500 text-sm">
                    {type === 'good' ? t.goodDesc : t.badDesc}
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden select-none">
                <div className="grid grid-cols-[80px_repeat(5,1fr)] divide-x divide-gray-100">
                    <div className="bg-gray-50 py-4"></div>
                    {DAYS.map(day => (
                        <div key={day} className="bg-gray-50 py-4 text-center font-bold text-gray-600 text-sm">
                            {day}
                        </div>
                    ))}

                    {SLOTS.map(slot => (
                        <React.Fragment key={slot}>
                            <div className="py-2 px-3 text-right text-[10px] font-bold text-gray-400 bg-gray-50/50 flex items-center justify-end">
                                {formatSingleSlotTime(slot)}
                            </div>
                            {DAYS.map(day => (
                                <div 
                                    key={`${day}-${slot}`}
                                    onMouseDown={() => handleMouseDown(day, slot)}
                                    onMouseEnter={() => handleMouseEnter(day, slot)}
                                    className={`h-10 cursor-pointer transition-all duration-100 border-t border-gray-50 ${
                                        selectedSlots[day].includes(slot)
                                            ? type === 'good' 
                                                ? 'bg-blue-500 shadow-inner' 
                                                : 'bg-red-500 shadow-inner'
                                            : 'hover:bg-gray-100'
                                    }`}
                                />
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};
