import { useApp } from '../context/AppContext';
import { formatSingleSlotTime, getLectureKey } from '../utils/lectureUtils';
import { useMemo } from 'react';
import { translations } from '../translations';
import { Minus, Plus } from 'lucide-react';

export const PreferenceList = () => {
    const { allLectures, selectedLectureKeys, preferences, setLecturePreference, language } = useApp();
    const t = translations[language].preference;

    const groupedLectures = useMemo(() => {
        const selected = allLectures.filter(lec => selectedLectureKeys.includes(getLectureKey(lec)));
        const groups: Record<string, typeof selected> = {};
        
        selected.forEach(lec => {
            if (!groups[lec.name]) groups[lec.name] = [];
            groups[lec.name].push(lec);
        });

        return Object.entries(groups)
            .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
            .map(([name, lecs]) => [name, lecs.sort((a, b) => a.section - b.section)] as const);
    }, [allLectures, selectedLectureKeys]);

    return (
        <div className="flex flex-col h-full space-y-4 min-h-0">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex-shrink-0">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{t.title}</h3>
                <p className="text-gray-500 text-xs">{t.desc}</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 pb-4">
                {groupedLectures.map(([name, lecs]) => (
                    <div key={name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="bg-gray-50 px-6 py-2 border-b border-gray-100">
                            <h4 className="font-bold text-gray-800 text-sm">{name}</h4>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {lecs.map(lec => {
                                const pref = preferences[lec.id] || 0;
                                return (
                                    <div key={lec.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded-md uppercase">
                                                    Section {lec.section}
                                                </span>
                                                <span className="font-semibold text-gray-700 text-sm">{lec.prof}</span>
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {lec.time_slots.map((s, i) => (
                                                    <span key={i}>
                                                        {s.day} {formatSingleSlotTime(s.start_index)}-{formatSingleSlotTime(s.end_index + 1)}
                                                        {i < lec.time_slots.length - 1 && ', '}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 bg-gray-100 p-1 rounded-xl">
                                            <button 
                                                onClick={() => setLecturePreference(lec.id, pref - 1)}
                                                className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow-sm text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <span className={`w-8 text-center font-bold text-base ${
                                                pref > 0 ? 'text-green-600' : pref < 0 ? 'text-red-600' : 'text-gray-400'
                                            }`}>
                                                {pref > 0 ? `+${pref}` : pref}
                                            </span>
                                            <button 
                                                onClick={() => setLecturePreference(lec.id, pref + 1)}
                                                className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow-sm text-green-500 hover:bg-green-50 transition-colors"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
