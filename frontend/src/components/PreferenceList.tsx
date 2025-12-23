import { useApp } from '../context/AppContext';
import { formatTimeString } from '../utils/lectureUtils';

export const PreferenceList = () => {
    const { allLectures, selectedLectureIds, preferences, setLecturePreference } = useApp();

    const selectedLectures = allLectures.filter(lec => selectedLectureIds.includes(lec.id));

    if (selectedLectures.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 italic">
                No lectures selected. Go back to Step 1.
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto border rounded-lg">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="p-3 border-b font-semibold">Name</th>
                            <th className="p-3 border-b font-semibold">Prof</th>
                            <th className="p-3 border-b font-semibold">Section</th>
                            <th className="p-3 border-b font-semibold text-center">Preference</th>
                        </tr>
                    </thead>
                    <tbody>
                        {selectedLectures.map(lec => {
                            const pref = preferences[lec.id] || 0;
                            return (
                                <tr key={lec.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3 border-b">
                                        <div className="font-medium">{lec.name}</div>
                                        <div className="text-xs text-gray-400">{formatTimeString(lec.time_slots)}</div>
                                    </td>
                                    <td className="p-3 border-b text-gray-600">{lec.prof}</td>
                                    <td className="p-3 border-b text-center">{lec.section}</td>
                                    <td className="p-3 border-b">
                                        <div className="flex items-center justify-center space-x-4">
                                            <button 
                                                onClick={() => setLecturePreference(lec.id, pref - 1)}
                                                className="w-8 h-8 rounded-full border border-red-300 text-red-500 hover:bg-red-50 flex items-center justify-center font-bold"
                                            >
                                                -
                                            </button>
                                            <span className={`w-8 text-center font-bold ${
                                                pref > 0 ? 'text-green-600' : pref < 0 ? 'text-red-600' : 'text-gray-400'
                                            }`}>
                                                {pref > 0 ? `+${pref}` : pref}
                                            </span>
                                            <button 
                                                onClick={() => setLecturePreference(lec.id, pref + 1)}
                                                className="w-8 h-8 rounded-full border border-green-300 text-green-500 hover:bg-green-50 flex items-center justify-center font-bold"
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
        </div>
    );
};
