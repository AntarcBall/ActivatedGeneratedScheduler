import { useApp } from '../context/AppContext';
import { useState, useMemo } from 'react';
import { formatTimeString } from '../utils/lectureUtils';
import { Lecture } from '../types';
import { HelpCircle, X } from 'lucide-react';

export const LectureList = () => {
    const { allLectures, selectedLectureIds, toggleLectureSelection } = useApp();
    const [searchTerm, setSearchTerm] = useState('');
    const [showHelp, setShowHelp] = useState(false);
    
    // UI Visibility States
    const [isSearchEnabled, setIsSearchEnabled] = useState(false);
    const [isFilterEnabled, setIsFilterEnabled] = useState(false);
    
    // Filter State (Single selection for Radio behavior)
    const [activeFilter, setActiveFilter] = useState<string | null>(null);

    // Group Expansion State
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const uniqueMajors = useMemo(() => {
        const majors = new Set<string>();
        allLectures.forEach(lec => {
            if (lec.major_tracks) {
                lec.major_tracks.forEach(track => majors.add(track));
            }
        });
        return Array.from(majors).sort();
    }, [allLectures]);

    const handleFilterChange = (filter: string) => {
        setActiveFilter(filter);
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
                if (!activeFilter) return false;

                const classification = lec.classification || '';
                const category = lec.category || '';

                if (activeFilter === 'basicMandatory') return classification === '기초필수';
                if (activeFilter === 'math') return category === '수학';
                if (activeFilter === 'physics') return category === '물리';
                if (activeFilter === 'chemistry') return category === '화학';
                if (activeFilter === 'biology') return category === '생명과학';
                if (activeFilter === 'track') return category === '트랙';
                if (activeFilter === 'writingReading') return category === '쓰기·읽기 중점';
                if (activeFilter === 'nonTrackConvergence') return category === '비트랙/융합';
                
                // Check if it matches a major track
                if (lec.major_tracks && lec.major_tracks.includes(activeFilter)) {
                    return true;
                }

                return false;
            }

            return true;
        });
    }, [allLectures, searchTerm, isFilterEnabled, activeFilter]);

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

    // Calculate Info Box Stats
    const stats = useMemo(() => {
        const selectedLectures = allLectures.filter(l => selectedLectureIds.includes(l.id));
        const groups: Record<string, number> = {};
        let credits = 0;
        const uniqueNames = new Set<string>();

        selectedLectures.forEach(l => {
            if (!uniqueNames.has(l.name)) {
                uniqueNames.add(l.name);
                credits += l.credit || 0;
            }
            groups[l.name] = (groups[l.name] || 0) + 1;
        });

        const nameCount = uniqueNames.size;
        
        let combinations = 1;
        if (selectedLectures.length === 0) {
            combinations = 0;
        } else {
            Object.values(groups).forEach(count => {
                combinations *= count;
            });
        }

        return {
            count: selectedLectures.length,
            credits: credits.toFixed(1),
            maxCombinations: combinations,
            nameCount: nameCount
        };
    }, [allLectures, selectedLectureIds]);

    return (
        <div className="flex flex-col h-full relative">
            {/* Help Button */}
            <button 
                onClick={() => setShowHelp(true)}
                className="absolute top-0 right-32 p-1 text-gray-400 hover:text-blue-600 transition-colors z-30"
                title="사용법 가이드"
            >
                <HelpCircle size={20} />
            </button>

            {/* Help Modal */}
            {showHelp && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-xl" onClick={() => setShowHelp(false)} />
                    <div className="bg-white w-full max-w-lg max-h-[90%] overflow-y-auto rounded-xl shadow-2xl border border-gray-200 relative animate-fade-in p-6 text-sm">
                        <button 
                            onClick={() => setShowHelp(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
                        >
                            <X size={20} />
                        </button>
                        
                        <h3 className="text-lg font-bold text-gray-800 mb-4">사용법 가이드 (User Guide)</h3>
                        
                        <div className="space-y-4 text-gray-600">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <h4 className="font-bold text-blue-700 mb-1">✨ 핵심 기능: 자동 최적화 마법사</h4>
                                <p>
                                    같은 과목(예: 공학수학)이라도 <strong>교수님이나 시간이 다른 여러 분반을 모두 체크</strong>해두세요!<br/>
                                    마법사(알고리즘)가 시간 충돌, 공강 배치, 선호도 등을 고려해 <strong>그중 딱 하나를 자동으로 선택</strong>해줍니다.
                                </p>
                            </div>

                            <hr />

                            <div>
                                <h4 className="font-bold text-gray-800 mb-1">Step 1: 강의 선택</h4>
                                <p>듣고 싶은 후보 강의들을 모두 체크하세요. 검색과 필터를 활용하면 편합니다.</p>
                            </div>

                            <div>
                                <h4 className="font-bold text-gray-800 mb-1">Step 2: 선호도 설정</h4>
                                <p>
                                    꼭 듣고 싶은 교수님은 <span className="text-green-600 font-bold">(+)</span>, 
                                    피하고 싶은 분반은 <span className="text-red-600 font-bold">(-)</span> 점수를 주세요.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-bold text-gray-800 mb-1">Step 3 & 4: 시간 설정</h4>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li><strong>Good Slots:</strong> 수업이 배치되면 좋은 시간 (점심 시간, 오후 등)</li>
                                    <li><strong>Bad Slots:</strong> 수업을 피하고 싶은 시간 (아침 9시, 금요일 오후 등)</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-bold text-gray-800 mb-1">Step 5: 가중치(Weight) 조절</h4>
                                <p>
                                    무엇이 더 중요한지 설정합니다.
                                    <br/>"공강(Break Time)을 줄이는 게 중요한가?", "선호 교수님(Preference)을 듣는 게 중요한가?" 등을 조절하세요.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-bold text-gray-800 mb-1">Step 6: 결과 확인</h4>
                                <p>
                                    불만족도(Loss)가 가장 낮은 최적의 시간표들을 보여줍니다. 
                                    Loss가 0에 가까울수록 완벽한 시간표입니다.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Summary Info */}
            <div className="absolute top-0 right-0 z-30 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm border border-blue-100 flex flex-col items-end text-xs sm:text-sm">
                <div className="text-gray-500">
                    Selected: <span className="font-bold text-blue-600">{stats.count}</span>
                </div>
                <div className="text-gray-500">
                    Credits: <span className="font-bold text-green-600">{stats.credits}</span>
                </div>
                <div className="text-gray-500">
                    Names: <span className="font-bold text-purple-600">{stats.nameCount}</span>
                </div>
                <div className="text-gray-500">
                    Cases: <span className="font-bold text-orange-600">{stats.maxCombinations}</span>
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
                                // Default to first filter or null (user must select)
                                // Keeping null so user has to choose, as per "matches only"
                                setActiveFilter(null);
                            } else {
                                setActiveFilter(null);
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
                            <input 
                                type="radio" 
                                name="lectureFilter"
                                checked={activeFilter === 'basicMandatory'} 
                                onChange={() => handleFilterChange('basicMandatory')} 
                                className="text-blue-600 focus:ring-blue-500" 
                            />
                            <span>기초필수 (Basic Mandatory)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="lectureFilter"
                                checked={activeFilter === 'math'} 
                                onChange={() => handleFilterChange('math')} 
                                className="text-blue-600 focus:ring-blue-500" 
                            />
                            <span>수학 (Math)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="lectureFilter"
                                checked={activeFilter === 'physics'} 
                                onChange={() => handleFilterChange('physics')} 
                                className="text-blue-600 focus:ring-blue-500" 
                            />
                            <span>물리 (Physics)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="lectureFilter"
                                checked={activeFilter === 'chemistry'} 
                                onChange={() => handleFilterChange('chemistry')} 
                                className="text-blue-600 focus:ring-blue-500" 
                            />
                            <span>화학 (Chemistry)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="lectureFilter"
                                checked={activeFilter === 'biology'} 
                                onChange={() => handleFilterChange('biology')} 
                                className="text-blue-600 focus:ring-blue-500" 
                            />
                            <span>생명과학 (Biology)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="lectureFilter"
                                checked={activeFilter === 'track'} 
                                onChange={() => handleFilterChange('track')} 
                                className="text-blue-600 focus:ring-blue-500" 
                            />
                            <span>트랙 (Track)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="lectureFilter"
                                checked={activeFilter === 'writingReading'} 
                                onChange={() => handleFilterChange('writingReading')} 
                                className="text-blue-600 focus:ring-blue-500" 
                            />
                            <span>쓰기·읽기 중점 (Writing/Reading)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                                type="radio" 
                                name="lectureFilter"
                                checked={activeFilter === 'nonTrackConvergence'} 
                                onChange={() => handleFilterChange('nonTrackConvergence')} 
                                className="text-blue-600 focus:ring-blue-500" 
                            />
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
                                                type="radio" 
                                                name="lectureFilter"
                                                checked={activeFilter === major} 
                                                onChange={() => handleFilterChange(major)} 
                                                className="text-blue-600 focus:ring-blue-500" 
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
