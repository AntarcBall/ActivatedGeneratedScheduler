import { useApp } from '../context/AppContext';
import { formatTimeString } from '../utils/lectureUtils';
import { useMemo } from 'react';
import { translations } from '../translations';
import { Minus, Plus } from 'lucide-react';

export const PreferenceList = () => {
    const { allLectures, selectedLectureIds, preferences, setLecturePreference, language } = useApp();
    const t = translations[language].preference;

    const groupedLectures = useMemo(() => {
        const selected = allLectures.filter(lec => selectedLectureIds.includes(lec.id));
        const groups: Record<string, typeof selected> = {};
        
        selected.forEach(lec => {
            if (!groups[lec.name]) groups[lec.name] = [];
            groups[lec.name].push(lec);
        });

        return Object.entries(groups)
            .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
            .map(([name, lecs]) => [name, lecs.sort((a, b) => a.section - b.section)] as const);
    }, [allLectures, selectedLectureIds]);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{t.title}</h3>
                <p className="text-gray-500 text-sm">{t.desc}</p>
            </div>

            <div className="grid gap-6">
                {groupedLectures.map(([name, lecs]) => (
                    <div key={name} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
                            <h4 className="font-bold text-gray-800">{name}</h4>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {lecs.map(lec => {
                                const pref = preferences[lec.id] || 0;
                                return (
                                    <div key={lec.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-md">
                                                    Section {lec.section}
                                                </span>
                                                <span className="font-semibold text-gray-700">{lec.prof}</span>
                                            </div>
                                            <div className="text-sm text-gray-400">
                                                {lec.time_slots.map((s, i) => (
                                                    <span key={i}>
                                                        {s.day} {formatTimeString(s.start_index)}-{formatTimeString(s.end_index + 1)}
                                                        {i < lec.time_slots.length - 1 && ', '}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 bg-gray-100 p-1.5 rounded-xl">
                                            <button 
                                                onClick={() => setLecturePreference(lec.id, pref - 1)}
                                                className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className={`w-8 text-center font-bold text-lg ${
                                                pref > 0 ? 'text-green-600' : pref < 0 ? 'text-red-600' : 'text-gray-400'
                                            }`}>
                                                {pref > 0 ? `+${pref}` : pref}
                                            </span>
                                            <button 
                                                onClick={() => setLecturePreference(lec.id, pref + 1)}
                                                className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-green-500 hover:bg-green-50 transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
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