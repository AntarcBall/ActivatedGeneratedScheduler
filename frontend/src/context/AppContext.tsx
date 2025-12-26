import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lecture, Timetable, WeightConfig, DayOfWeek } from '../types';
import { parseLecture } from '../utils/lectureUtils';

interface AppState {
    // Data
    allLectures: Lecture[];
    selectedLectureIds: number[];
    preferences: Record<number, number>; // id -> preference
    goodSlots: Record<DayOfWeek, number[]>;
    badSlots: Record<DayOfWeek, number[]>;
    weights: WeightConfig[];
    
    // UI State
    currentPage: number;
    totalPages: number;
    generatedTimetables: Timetable[];
    isGenerating: boolean;
    language: 'ko' | 'en';
    
    // Actions
    toggleLectureSelection: (id: number) => void;
    setLecturePreference: (id: number, pref: number) => void;
    toggleSlot: (type: 'good' | 'bad', day: DayOfWeek, slotIndex: number) => void;
    setWeight: (index: number, weight: number) => void;
    toggleRss: (index: number) => void;
    setPage: (page: number) => void;
    nextPage: () => void;
    prevPage: () => void;
    generateTimetables: () => void;
    setLanguage: (lang: 'ko' | 'en') => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [allLectures, setAllLectures] = useState<Lecture[]>([]);
    const [selectedLectureIds, setSelectedLectureIds] = useState<number[]>([]);
    const [preferences, setPreferences] = useState<Record<number, number>>({});
    
    const [goodSlots, setGoodSlots] = useState<Record<DayOfWeek, number[]>>({
        Mon: [], Tue: [], Wed: [], Thu: [], Fri: []
    });
    const [badSlots, setBadSlots] = useState<Record<DayOfWeek, number[]>>({
        Mon: [], Tue: [], Wed: [], Thu: [], Fri: []
    });
    
    // Weights: [FitGood, FitBad, BreakTime, Prefer]
    const [weights, setWeights] = useState<WeightConfig[]>([
        { weight: 5, rss: false },
        { weight: 5, rss: false },
        { weight: 5, rss: false },
        { weight: 5, rss: false },
    ]);

    const [currentPage, setCurrentPage] = useState(0); // Start at Landing Page (0)
    const totalPages = 6;
    
    const [generatedTimetables, setGeneratedTimetables] = useState<Timetable[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [language, setLanguage] = useState<'ko' | 'en'>('ko');

    // Load Data
    useEffect(() => {
        const baseUrl = import.meta.env?.BASE_URL || '/';
        const filename = language === 'en' ? 'lectures_eng.json' : 'lectures.json';
        fetch(`${baseUrl}${filename}?t=${Date.now()}`)
            .then(res => res.json())
            .then(data => {
                const parsed = data.map((d: any) => parseLecture(d));
                setAllLectures(parsed);
            })
            .catch(err => console.error(`Failed to load lectures (${language}):`, err));
    }, [language]);

    const toggleLectureSelection = (id: number) => {
        setSelectedLectureIds(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id);
            return [...prev, id];
        });
    };

    const setLecturePreference = (id: number, pref: number) => {
        setPreferences(prev => ({ ...prev, [id]: pref }));
    };

    const toggleSlot = (type: 'good' | 'bad', day: DayOfWeek, slotIndex: number) => {
        const targetSet = type === 'good' ? setGoodSlots : setBadSlots;
        targetSet(prev => {
            const currentSlots = prev[day];
            const exists = currentSlots.includes(slotIndex);
            const newSlots = exists 
                ? currentSlots.filter(s => s !== slotIndex)
                : [...currentSlots, slotIndex];
            return { ...prev, [day]: newSlots };
        });
    };

    const setWeight = (index: number, weight: number) => {
        setWeights(prev => {
            const newWeights = [...prev];
            newWeights[index] = { ...newWeights[index], weight };
            return newWeights;
        });
    };

    const toggleRss = (index: number) => {
        setWeights(prev => {
            const newWeights = [...prev];
            newWeights[index] = { ...newWeights[index], rss: !newWeights[index].rss };
            return newWeights;
        });
    };

    const setPage = (page: number) => {
        if (page >= 0 && page <= totalPages) setCurrentPage(page);
    };

    const nextPage = () => {
        if (currentPage < totalPages) setCurrentPage(p => p + 1);
    };

    const prevPage = () => {
        if (currentPage > 0) setCurrentPage(p => p - 1);
    };

    const generateTimetables = () => {
        setIsGenerating(true);
        // Prepare data for worker
        const selectedLectures = allLectures
            .filter(l => selectedLectureIds.includes(l.id))
            .map(l => ({
                ...l,
                preference: preferences[l.id] || 0
            }));

        const worker = new Worker(new URL('../scheduler.worker.ts', import.meta.url), { type: 'module' });
        
        worker.postMessage({
            selectedLectures,
            goodSlots,
            badSlots,
            weights
        });

        worker.onmessage = (e) => {
            setGeneratedTimetables(e.data);
            setIsGenerating(false);
            worker.terminate();
            nextPage(); // Move to result page
        };

        worker.onerror = (err) => {
            console.error("Worker error:", err);
            setIsGenerating(false);
            worker.terminate();
        };
    };

    const value: AppState = {
        allLectures,
        selectedLectureIds,
        preferences,
        goodSlots,
        badSlots,
        weights,
        currentPage,
        totalPages,
        generatedTimetables,
        isGenerating,
        language,
        toggleLectureSelection,
        setLecturePreference,
        toggleSlot,
        setWeight,
        toggleRss,
        setPage,
        nextPage,
        prevPage,
        generateTimetables,
        setLanguage
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useApp must be used within AppProvider");
    return context;
};