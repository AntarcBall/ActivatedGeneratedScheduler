import { useApp } from '../context/AppContext';
import { useState, useMemo } from 'react';
import { formatTimeString } from '../utils/lectureUtils';

export const LectureList = () => {
    const { allLectures, selectedLectureIds, toggleLectureSelection } = useApp();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredLectures = useMemo(() => {
        return allLectures.filter(lec => 
            lec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lec.prof.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [allLectures, searchTerm]);

    return (
        <div className="flex flex-col h-full">
            <div className="mb-4">
                <input 
                    type="text" 
                    placeholder="Search by name or professor..." 
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex-1 overflow-y-auto border rounded-lg">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="p-3 border-b font-semibold">Select</th>
                            <th className="p-3 border-b font-semibold">Name</th>
                            <th className="p-3 border-b font-semibold">Prof</th>
                            <th className="p-3 border-b font-semibold">Section</th>
                            <th className="p-3 border-b font-semibold">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLectures.map(lec => {
                            const isSelected = selectedLectureIds.includes(lec.id);
                            return (
                                <tr 
                                    key={lec.id} 
                                    onClick={() => toggleLectureSelection(lec.id)}
                                    className={`cursor-pointer hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-100' : ''}`}
                                >
                                    <td className="p-3 border-b text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected} 
                                            readOnly 
                                            className="w-4 h-4 text-blue-600"
                                        />
                                    </td>
                                    <td className="p-3 border-b font-medium">{lec.name}</td>
                                    <td className="p-3 border-b text-gray-600">{lec.prof}</td>
                                    <td className="p-3 border-b text-center">{lec.section}</td>
                                    <td className="p-3 border-b text-sm text-gray-500">{formatTimeString(lec.time_slots)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-4 text-sm text-gray-500">
                Selected: <span className="font-bold text-blue-600">{selectedLectureIds.length}</span> lectures
            </div>
        </div>
    );
};
