import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lecture, Timetable, WeightConfig, DayOfWeek } from '../types';
import { parseLecture, getLectureKey } from '../utils/lectureUtils';

const LOCALSTORAGE_KEY = 'ags_selected_lecture_keys';
const LEGACY_LOCALSTORAGE_KEY = 'ags_selected_lectures';

interface AppState {
    // Data
    allLectures: Lecture[];
    selectedLectureKeys: string[];
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
    toggleLectureSelection: (lecture: Lecture) => void;
    resetSelectedLectures: () => void;
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
    const [selectedLectureKeys, setSelectedLectureKeys] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(LOCALSTORAGE_KEY);
            if (!saved) return [];
            const parsed = JSON.parse(saved);
            if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) return [];
            return parsed;
        } catch {
            return [];
        }
    });
    const [legacySelectedIds, setLegacySelectedIds] = useState<number[]>(() => {
        try {
            const saved = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
            if (!saved) return [];
            const parsed = JSON.parse(saved);
            if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'number')) return [];
            return parsed;
        } catch {
            return [];
        }
    });
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

    useEffect(() => {
        if (!allLectures.length || !legacySelectedIds.length) return;
        if (selectedLectureKeys.length > 0) return;
        const mappedKeys = allLectures
            .filter(l => legacySelectedIds.includes(l.id))
            .map(l => getLectureKey(l));
        if (!mappedKeys.length) {
            setLegacySelectedIds([]);
            localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
            return;
        }
        setSelectedLectureKeys(mappedKeys);
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(mappedKeys));
        localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
        setLegacySelectedIds([]);
    }, [allLectures, legacySelectedIds, selectedLectureKeys.length]);

    const toggleLectureSelection = (lecture: Lecture) => {
        const key = getLectureKey(lecture);
        setSelectedLectureKeys(prev => {
            const newKeys = prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key];
            localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(newKeys));
            return newKeys;
        });
    };

    const resetSelectedLectures = () => {
        setSelectedLectureKeys([]);
        localStorage.removeItem(LOCALSTORAGE_KEY);
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
            .filter(l => selectedLectureKeys.includes(getLectureKey(l)))
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
        selectedLectureKeys,
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
        resetSelectedLectures,
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
