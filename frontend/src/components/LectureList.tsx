import { useApp } from '../context/AppContext';
import { useState, useMemo } from 'react';
import { formatTimeString } from '../utils/lectureUtils';

export const LectureList = () => {
    const { allLectures, selectedLectureIds, toggleLectureSelection } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    
    // UI Visibility States
    const [isSearchEnabled, setIsSearchEnabled] = useState(false);
    const [isFilterEnabled, setIsFilterEnabled] = useState(false);
    
    // Filter States
    const [filters, setFilters] = useState({
        basicMandatory: false, // 기초필수
        math: false,           // 수학
        physics: false,        // 물리
        chemistry: false,      // 화학
        biology: false,        // 생명과학
        track: false,          // 트랙
        writingReading: false, // 쓰기·읽기 중점
        nonTrackConvergence: false // 비트랙/융합
    });

    const toggleFilter = (key: keyof typeof filters) => {
        setFilters(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const filteredLectures = useMemo(() => {
        return allLectures.filter(lec => {
            // 1. Search Filter
            const matchesSearch = 
                lec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lec.prof.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (!matchesSearch) return false;

            // 2. Category Filter (if enabled)
            if (isFilterEnabled) {
                // If no filters are checked, usually show nothing or all? 
                // "다음 중 하나라도 해당하는 것들만 보기" implies if none are checked, none are shown.
                const hasAnyFilterChecked = Object.values(filters).some(v => v);
                if (!hasAnyFilterChecked) return false;

                const classification = lec.classification || '';
                const category = lec.category || '';

                const matchesBasic = filters.basicMandatory && classification === '기초필수';
                const matchesMath = filters.math && category === '수학';
                const matchesPhy = filters.physics && category === '물리';
                const matchesChem = filters.chemistry && category === '화학';
                const matchesBio = filters.biology && category === '생명과학';
                const matchesTrack = filters.track && category === '트랙';
                const matchesWrite = filters.writingReading && category === '쓰기·읽기 중점';
                const matchesNonTrack = filters.nonTrackConvergence && category === '비트랙/융합';

                return matchesBasic || matchesMath || matchesPhy || matchesChem || matchesBio || matchesTrack || matchesWrite || matchesNonTrack;
            }

            return true;
        });
    }, [allLectures, searchTerm, isFilterEnabled, filters]);

    return (
        <div className="flex flex-col h-full">
            <div className="mb-4 space-y-3">
                {/* Search Toggle and Input */}
                <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                        <input 
                            type="checkbox" 
                            id="enableSearch"
                            checked={isSearchEnabled}
                            onChange={(e) => {
                                setIsSearchEnabled(e.target.checked);
                                if (!e.target.checked) setSearchTerm('');
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="enableSearch" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                            검색창 보기 (Show Search)
                        </label>
                    </div>
                    {isSearchEnabled && (
                        <input 
                            type="text" 
                            placeholder="Search by name or professor..." 
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    )}
                </div>
                
                {/* Filter Toggle */}
                <div className="flex items-center space-x-2">
                    <input 
                        type="checkbox" 
                        id="enableFilter"
                        checked={isFilterEnabled}
                        onChange={(e) => {
                            setIsFilterEnabled(e.target.checked);
                            // If disabled, maybe reset filters? Or keep them? User said "체크하는 순간 박스 내부체크박스들은 기본적으로 모두 꺼져있게 된다."
                            // This implies reset when enabling? Or just initial state?
                            // "체크하는 순간... 모두 꺼져있게 된다" -> implies reset on enable.
                            if (e.target.checked) {
                                setFilters({
                                    basicMandatory: false,
                                    math: false,
                                    physics: false,
                                    chemistry: false,
                                    biology: false,
                                    track: false,
                                    writingReading: false,
                                    nonTrackConvergence: false
                                });
                            }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="enableFilter" className="text-sm font-medium text-gray-700 select-none">
                        다음 중 하나라도 해당하는 것들만 보기 (Show matches only)
                    </label>
                </div>

                {/* Filter Options Box */}
                {isFilterEnabled && (
                    <div className="p-3 bg-gray-50 border rounded-lg grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={filters.basicMandatory} onChange={() => toggleFilter('basicMandatory')} className="text-blue-600 rounded" />
                            <span>기초필수 (Basic Mandatory)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={filters.math} onChange={() => toggleFilter('math')} className="text-blue-600 rounded" />
                            <span>수학 (Math)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={filters.physics} onChange={() => toggleFilter('physics')} className="text-blue-600 rounded" />
                            <span>물리 (Physics)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={filters.chemistry} onChange={() => toggleFilter('chemistry')} className="text-blue-600 rounded" />
                            <span>화학 (Chemistry)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={filters.biology} onChange={() => toggleFilter('biology')} className="text-blue-600 rounded" />
                            <span>생명과학 (Biology)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={filters.track} onChange={() => toggleFilter('track')} className="text-blue-600 rounded" />
                            <span>트랙 (Track)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={filters.writingReading} onChange={() => toggleFilter('writingReading')} className="text-blue-600 rounded" />
                            <span>쓰기·읽기 중점 (Writing/Reading)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={filters.nonTrackConvergence} onChange={() => toggleFilter('nonTrackConvergence')} className="text-blue-600 rounded" />
                            <span>비트랙/융합 (Non-Track/Convergence)</span>
                        </label>
                    </div>
                )}
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
                        {filteredLectures.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500">
                                    No lectures match your criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <div className="mt-4 text-sm text-gray-500 flex justify-between items-center">
                <div>
                    Selected: <span className="font-bold text-blue-600">{selectedLectureIds.length}</span> lectures
                </div>
                <div>
                    Total Credits: <span className="font-bold text-green-600">
                        {allLectures
                            .filter(l => selectedLectureIds.includes(l.id))
                            .reduce((sum, l) => sum + (l.credit || 0), 0)
                            .toFixed(1)}
                    </span>
                </div>
            </div>
        </div>
    );
};