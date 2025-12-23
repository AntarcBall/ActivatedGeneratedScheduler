import { useApp } from '../context/AppContext';
import { formatTimeString } from '../utils/lectureUtils';
import { useMemo } from 'react';

export const PreferenceList = () => {
    const { allLectures, selectedLectureIds, preferences, setLecturePreference } = useApp();

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

    if (groupedLectures.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 italic">
                No lectures selected. Go back to Step 1.
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-4 p-1">
                {groupedLectures.map(([name, lectures]) => (
                    <div key={name} className="bg-white border rounded-lg shadow-sm overflow-hidden">
                        <div className="bg-blue-50 px-4 py-2 font-bold text-blue-800 border-b border-blue-100">
                            {name}
                        </div>
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="px-4 py-2 font-semibold">Prof</th>
                                    <th className="px-4 py-2 font-semibold text-center">Section</th>
                                    <th className="px-4 py-2 font-semibold">Time</th>
                                    <th className="px-4 py-2 font-semibold text-center">Preference</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {lectures.map(lec => {
                                    const pref = preferences[lec.id] || 0;
                                    return (
                                        <tr key={lec.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-2 text-gray-700 font-medium">{lec.prof}</td>
                                            <td className="px-4 py-2 text-center text-gray-600">{lec.section}</td>
                                            <td className="px-4 py-2 text-sm text-gray-500">{formatTimeString(lec.time_slots)}</td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center justify-center space-x-3">
                                                    <button 
                                                        onClick={() => setLecturePreference(lec.id, pref - 1)}
                                                        className="w-7 h-7 rounded-full border border-red-300 text-red-500 hover:bg-red-50 flex items-center justify-center font-bold transition-colors"
                                                    >
                                                        -
                                                    </button>
                                                    <span className={`w-6 text-center font-bold ${
                                                        pref > 0 ? 'text-green-600' : pref < 0 ? 'text-red-600' : 'text-gray-400'
                                                    }`}>
                                                        {pref > 0 ? `+${pref}` : pref}
                                                    </span>
                                                    <button 
                                                        onClick={() => setLecturePreference(lec.id, pref + 1)}
                                                        className="w-7 h-7 rounded-full border border-green-300 text-green-500 hover:bg-green-50 flex items-center justify-center font-bold transition-colors"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
};
