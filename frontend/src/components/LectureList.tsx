import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatTimeString } from '../utils/lectureUtils';
import { Lecture } from '../types';
import { HelpCircle, X, Search, Filter, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { translations } from '../translations';

export const LectureList = () => {
    const { allLectures, selectedLectureIds, toggleLectureSelection, language } = useApp();
    const t = translations[language].lectureList;
    const tc = translations[language].common;

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
            const matchesSearch = 
                lec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                lec.prof.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (!matchesSearch) return false;

            if (isFilterEnabled) {
                if (!activeFilter) return false;

                const classification = lec.classification || '';
                const category = lec.category || '';

                if (activeFilter === 'basicMandatory') return classification === (language === 'ko' ? '기초필수' : 'Basic compulsory course');
                if (activeFilter === 'math') return category === (language === 'ko' ? '수학' : 'Mathematics');
                if (activeFilter === 'physics') return category === (language === 'ko' ? '물리' : 'Physics');
                if (activeFilter === 'chemistry') return category === (language === 'ko' ? '화학' : 'Chemistry');
                if (activeFilter === 'biology') return category === (language === 'ko' ? '생명과학' : 'Biology');
                if (activeFilter === 'track') return category === (language === 'ko' ? '트랙' : 'Track');
                if (activeFilter === 'writingReading') return category === (language === 'ko' ? '쓰기·읽기 중점' : 'Writing·Reading');
                if (activeFilter === 'nonTrackConvergence') return category === (language === 'ko' ? '비트랙/융합' : 'Non-Track/Convergence');
                
                if (lec.major_tracks && lec.major_tracks.includes(activeFilter)) {
                    return true;
                }

                return false;
            }

            return true;
        });
    }, [allLectures, searchTerm, isFilterEnabled, activeFilter, language]);

    const groupedLectures = useMemo(() => {
        const groups: Record<string, Lecture[]> = {};
        filteredLectures.forEach(lec => {
            if (!groups[lec.name]) groups[lec.name] = [];
            groups[lec.name].push(lec);
        });
        
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

    const stats = useMemo(() => {
        let credits = 0;
        const selected = allLectures.filter(l => selectedLectureIds.includes(l.id));
        
        // Group by name to sum credits only once per course
        const uniqueCourses = new Set<string>();
        selected.forEach(l => {
            if (!uniqueCourses.has(l.name)) {
                uniqueCourses.add(l.name);
                credits += l.credit;
            }
        });
        
        return { count: selected.length, credits };
    }, [allLectures, selectedLectureIds]);

    return (
        <div className="flex flex-col lg:flex-row gap-4 w-full h-full min-h-0">
            {/* Sidebar Controls - Compressed */}
            <div className="w-full lg:w-[25%] flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar">
                {/* Stats Card - Highly Compressed */}
                <div className="bg-gray-900 rounded-2xl p-4 text-white shadow-lg flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.selectedCount}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-3xl font-black">{stats.count}</span>
                        <span className="text-xs text-gray-400 font-bold">Sections</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <span className="text-[10px] font-bold text-gray-400">{t.totalCredits}</span>
                        <span className="text-lg font-black text-blue-400">{stats.credits.toFixed(1)}</span>
                    </div>
                </div>

                {/* Search Toggle - Compressed */}
                <div className="bg-white rounded-xl border border-gray-100 p-2 shadow-sm flex-shrink-0">
                    <button 
                        onClick={() => setIsSearchEnabled(!isSearchEnabled)}
                        className={`w-full flex items-center justify-between p-1.5 rounded-lg transition-all ${isSearchEnabled ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Search className="w-4 h-4" />
                            <span className="font-bold text-sm">{t.showSearch}</span>
                        </div>
                        <Check className={`w-3 h-3 transition-opacity ${isSearchEnabled ? 'opacity-100' : 'opacity-0'}`} />
                    </button>
                    {isSearchEnabled && (
                        <div className="mt-2 animate-in slide-in-from-top-1 duration-200">
                            <input
                                type="text"
                                placeholder={t.searchPlaceholder}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-50 border-none rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    )}
                </div>

                {/* Filter Toggle - Compressed */}
                <div className="bg-white rounded-xl border border-gray-100 p-2 shadow-sm flex-1 min-h-0 flex flex-col">
                    <button 
                        onClick={() => setIsFilterEnabled(!isFilterEnabled)}
                        className={`w-full flex items-center justify-between p-1.5 rounded-lg transition-all flex-shrink-0 ${isFilterEnabled ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            <span className="font-bold text-sm">{t.showMatches}</span>
                        </div>
                        <Check className={`w-3 h-3 transition-opacity ${isFilterEnabled ? 'opacity-100' : 'opacity-0'}`} />
                    </button>

                    {isFilterEnabled && (
                        <div className="mt-3 space-y-4 overflow-y-auto pr-1 custom-scrollbar animate-in slide-in-from-top-1 duration-200">
                            <div className="grid grid-cols-1 gap-1">
                                {[
                                    { id: 'basicMandatory', label: t.basicMandatory },
                                    { id: 'math', label: t.math },
                                    { id: 'physics', label: t.physics },
                                    { id: 'chemistry', label: t.chemistry },
                                    { id: 'biology', label: t.biology },
                                    { id: 'track', label: t.track },
                                    { id: 'writingReading', label: t.writingReading },
                                    { id: 'nonTrackConvergence', label: t.nonTrackConvergence },
                                ].map(filter => (
                                    <button
                                        key={filter.id}
                                        onClick={() => handleFilterChange(filter.id)}
                                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            activeFilter === filter.id 
                                                ? 'bg-blue-600 text-white shadow-md' 
                                                : 'text-gray-500 hover:bg-gray-50'
                                        }`}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                            </div>

                            <div className="pt-3 border-t border-gray-100">
                                <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest block mb-2">
                                    {t.majorTracks}
                                </span>
                                <div className="grid grid-cols-1 gap-1">
                                    {uniqueMajors.map(major => (
                                        <button
                                            key={major}
                                            onClick={() => handleFilterChange(major)}
                                            className={`w-full text-left px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                                activeFilter === major 
                                                    ? 'bg-gray-900 text-white' 
                                                    : 'text-gray-400 hover:bg-gray-50'
                                            }`}
                                        >
                                            {major}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Help Button - Compressed */}
                <button 
                    onClick={() => setShowHelp(true)}
                    className="flex items-center justify-center gap-2 p-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex-shrink-0"
                >
                    <HelpCircle className="w-4 h-4" />
                    {t.guideTitle}
                </button>
            </div>

            {/* Lecture List Main - Longer and Dominant */}
            <div className="flex-1 lg:w-[75%] bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                    {groupedLectures.map((group) => {
                        const isExpanded = expandedGroups.has(group.name);
                        const selectedInGroup = group.lectures.filter(l => selectedLectureIds.includes(l.id));
                        
                        return (
                            <div key={group.name} className="mb-1 group/item">
                                <button 
                                    onClick={(e) => toggleGroup(group.name, e)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                                        isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg transition-colors ${selectedInGroup.length > 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        </div>
                                        <div className="text-left">
                                            <h4 className="font-bold text-gray-900 text-sm">{group.name}</h4>
                                            <p className="text-[10px] text-gray-400 font-medium">{group.lectures.length} Sections</p>
                                        </div>
                                    </div>
                                    {selectedInGroup.length > 0 && (
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black rounded-full">
                                            {selectedInGroup.length} Selected
                                        </span>
                                    )}
                                </button>

                                {isExpanded && (
                                    <div className="px-3 pb-3 pt-1 grid grid-cols-1 md:grid-cols-2 gap-2 animate-in slide-in-from-top-1 duration-200">
                                        {group.lectures.map(lec => {
                                            const isSelected = selectedLectureIds.includes(lec.id);
                                            return (
                                                <div 
                                                    key={lec.id}
                                                    onClick={() => toggleLectureSelection(lec.id)}
                                                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                                                        isSelected 
                                                            ? 'border-blue-600 bg-blue-50/50' 
                                                            : 'border-gray-100 hover:border-blue-200 bg-white'
                                                    }`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                                            isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                                                        }`}>
                                                            S{lec.section}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-gray-300">{lec.credit}C</span>
                                                    </div>
                                                    <p className="font-bold text-gray-800 text-xs mb-0.5">{lec.prof}</p>
                                                    <div className="text-[9px] font-bold text-gray-400 space-y-0.5">
                                                        {lec.time_slots.map((s, i) => (
                                                            <div key={i}>{s.day} {formatTimeString([s]).split(' ')[1]}</div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Help Modal (Remains readable size) */}
            {showHelp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                        <button 
                            onClick={() => setShowHelp(false)}
                            className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>

                        <h3 className="text-2xl font-black text-gray-900 mb-8">{t.guideTitle}</h3>
                        
                        <div className="space-y-8">
                            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                                <h4 className="font-bold text-blue-700 mb-2 flex items-center gap-2">
                                    <span className="text-lg">✨</span> {t.guideCore}
                                </h4>
                                <p className="text-sm text-blue-800 leading-relaxed">
                                    {t.guideCoreDesc}
                                </p>
                            </div>

                            <div className="grid gap-4">
                                {[
                                    { step: 1, title: translations[language].steps.step1, desc: t.step1Desc },
                                    { step: 2, title: translations[language].steps.step2, desc: t.step2Desc },
                                    { step: 3, title: `${translations[language].steps.step3} & ${translations[language].steps.step4}`, desc: t.step34Desc },
                                    { step: 5, title: translations[language].steps.step5, desc: t.step5Desc },
                                    { step: 6, title: translations[language].steps.step6, desc: t.step6Desc },
                                ].map(item => (
                                    <div key={item.step} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                        <h5 className="font-bold text-gray-900 text-sm mb-1">Step {item.step}: {item.title}</h5>
                                        <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
