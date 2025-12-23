import { useApp } from '../context/AppContext';
import { useState, useMemo } from 'react';
import { formatTimeString } from '../utils/lectureUtils';
import { Lecture } from '../types';

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

    // Group Expansion State
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Dynamic Major Tracks Filter
    const [selectedMajors, setSelectedMajors] = useState<Set<string>>(new Set());

    const uniqueMajors = useMemo(() => {
        const majors = new Set<string>();
        allLectures.forEach(lec => {
            if (lec.major_tracks) {
                lec.major_tracks.forEach(track => majors.add(track));
            }
        });
        return Array.from(majors).sort();
    }, [allLectures]);

    const toggleFilter = (key: keyof typeof filters) => {
        setFilters(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleMajor = (major: string) => {
        setSelectedMajors(prev => {
            const newSet = new Set(prev);
            if (newSet.has(major)) newSet.delete(major);
            else newSet.add(major);
            return newSet;
        });
    };

    const toggleGroup = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(name)) newSet.delete(name);
            else newSet.add(name);
            return newSet;
        });
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
                const hasAnyFilterChecked = Object.values(filters).some(v => v) || selectedMajors.size > 0;
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

                const matchesMajor = lec.major_tracks ? lec.major_tracks.some(track => selectedMajors.has(track)) : false;

                return matchesBasic || matchesMath || matchesPhy || matchesChem || matchesBio || matchesTrack || matchesWrite || matchesNonTrack || matchesMajor;
            }

            return true;
        });
    }, [allLectures, searchTerm, isFilterEnabled, filters, selectedMajors]);

    // Grouping Logic
    const groupedLectures = useMemo(() => {
        const groups: Record<string, Lecture[]> = {};
        filteredLectures.forEach(lec => {
            if (!groups[lec.name]) groups[lec.name] = [];
            groups[lec.name].push(lec);
        });
        
        // Sort keys to ensure consistent order (though user input implies existing order)
        // We'll preserve filteredLectures order by using a Set to track seen names
        const orderedGroups: { name: string, lectures: Lecture[] }[] = [];
        const seenNames = new Set<string>();

        filteredLectures.forEach(lec => {
            if (!seenNames.has(lec.name)) {
                seenNames.add(lec.name);
                orderedGroups.push({ name: lec.name, lectures: groups[lec.name] });
            }
        });

        return orderedGroups;
    }, [filteredLectures]);

    return (
        <div className="flex flex-col h-full relative">
            {/* Floating Summary Info */}
            <div className="absolute top-0 right-0 z-30 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm border border-blue-100 flex flex-col items-end text-xs sm:text-sm">
                <div className="text-gray-500">
                    Selected: <span className="font-bold text-blue-600">{selectedLectureIds.length}</span>
                </div>
                <div className="text-gray-500">
                    Credits: <span className="font-bold text-green-600">
                        {(() => {
                            const selectedLectures = allLectures.filter(l => selectedLectureIds.includes(l.id));
                            const uniqueNames = new Set<string>();
                            let totalCredits = 0;
                            selectedLectures.forEach(l => {
                                if (!uniqueNames.has(l.name)) {
                                    uniqueNames.add(l.name);
                                    totalCredits += l.credit || 0;
                                }
                            });
                            return totalCredits.toFixed(1);
                        })()}
                    </span>
                </div>
            </div>

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
                                setSelectedMajors(new Set());
                            }
                        }}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="enableFilter" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
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
                        
                        {/* Dynamic Major/Track Filters */}
                        {uniqueMajors.length > 0 && (
                            <div className="col-span-2 md:col-span-4 border-t my-1 pt-2">
                                <span className="font-semibold text-gray-600 block mb-2">전공/트랙 (Majors/Tracks)</span>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {uniqueMajors.map(major => (
                                        <label key={major} className="flex items-center space-x-2 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedMajors.has(major)} 
                                                onChange={() => toggleMajor(major)} 
                                                className="text-blue-600 rounded" 
                                            />
                                            <span>{major}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <div className="flex-1 overflow-y-auto border rounded-lg">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="py-1 px-3 border-b font-semibold">Select</th>
                            <th className="py-1 px-3 border-b font-semibold">Name</th>
                            <th className="py-1 px-3 border-b font-semibold">Prof</th>
                            <th className="py-1 px-3 border-b font-semibold">Section</th>
                            <th className="py-1 px-3 border-b font-semibold">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedLectures.map(group => {
                            // If group has only 1 lecture, render normally
                            if (group.lectures.length === 1) {
                                const lec = group.lectures[0];
                                const isSelected = selectedLectureIds.includes(lec.id);
                                return (
                                    <tr 
                                        key={lec.id} 
                                        onClick={() => toggleLectureSelection(lec.id)}
                                        className={`cursor-pointer hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-100' : ''}`}
                                    >
                                        <td className="py-1 px-3 border-b text-center">
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected} 
                                                readOnly 
                                                className="w-4 h-4 text-blue-600"
                                            />
                                        </td>
                                        <td className="py-1 px-3 border-b font-medium">{lec.name}</td>
                                        <td className="py-1 px-3 border-b text-gray-600">{lec.prof}</td>
                                        <td className="py-1 px-3 border-b text-center">{lec.section}</td>
                                        <td className="py-1 px-3 border-b text-sm text-gray-500">{formatTimeString(lec.time_slots)}</td>
                                    </tr>
                                );
                            } else {
                                // Group Header
                                const isExpanded = expandedGroups.has(group.name);
                                return (
                                    <>
                                        <tr 
                                            key={`group-${group.name}`}
                                            onClick={(e) => toggleGroup(group.name, e)}
                                            className="cursor-pointer bg-gray-50 hover:bg-gray-100 border-b font-semibold text-gray-700"
                                        >
                                            <td colSpan={5} className="py-1 px-3 pl-4">
                                                <div className="flex items-center">
                                                    <span className="mr-2 transform transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                                        ▶
                                                    </span>
                                                    {group.name} 
                                                    <span className="ml-2 text-xs font-normal text-gray-500 bg-white px-2 py-0.5 rounded border">
                                                        {group.lectures.length} sections
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && group.lectures.map(lec => {
                                            const isSelected = selectedLectureIds.includes(lec.id);
                                            return (
                                                <tr 
                                                    key={lec.id} 
                                                    onClick={() => toggleLectureSelection(lec.id)}
                                                    className={`cursor-pointer hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-100' : 'bg-gray-50/30'}`}
                                                >
                                                    <td className="py-1 px-3 border-b text-center pl-8">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={isSelected} 
                                                            readOnly 
                                                            className="w-4 h-4 text-blue-600"
                                                        />
                                                    </td>
                                                    <td className="py-1 px-3 border-b font-medium pl-8">{lec.name}</td>
                                                    <td className="py-1 px-3 border-b text-gray-600">{lec.prof}</td>
                                                    <td className="py-1 px-3 border-b text-center">{lec.section}</td>
                                                    <td className="py-1 px-3 border-b text-sm text-gray-500">{formatTimeString(lec.time_slots)}</td>
                                                </tr>
                                            );
                                        })}
                                    </>
                                );
                            }
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
        </div>
    );
};
