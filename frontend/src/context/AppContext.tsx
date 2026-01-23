import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lecture, Timetable, WeightConfig, DayOfWeek } from '../types';
import { parseLecture, getLectureKey } from '../utils/lectureUtils';

const LOCALSTORAGE_KEY = 'ags_selected_lecture_keys';
const LEGACY_LOCALSTORAGE_KEY = 'ags_selected_lectures';
const LOCALSTORAGE_PREFERENCES_KEY = 'ags_preferences';
const LOCALSTORAGE_GOOD_SLOTS_KEY = 'ags_good_slots';
const LOCALSTORAGE_BAD_SLOTS_KEY = 'ags_bad_slots';
const LOCALSTORAGE_WEIGHTS_KEY = 'ags_weights';
const LOCALSTORAGE_CURRENT_PAGE_KEY = 'ags_current_page';
const TOTAL_PAGES = 6;
const DEFAULT_WEIGHTS: WeightConfig[] = [
    { weight: 5, rss: false },
    { weight: 5, rss: false },
    { weight: 5, rss: false },
    { weight: 5, rss: false },
];
const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const readPreferencesFromStorage = () => {
    try {
        const saved = localStorage.getItem(LOCALSTORAGE_PREFERENCES_KEY);
        if (!saved) return {};
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const result: Record<number, number> = {};
        Object.entries(parsed).forEach(([key, value]) => {
            const id = Number(key);
            if (!Number.isFinite(id)) return;
            if (typeof value !== 'number' || !Number.isFinite(value)) return;
            if (value !== 0) result[id] = value;
        });
        return result;
    } catch {
        return {};
    }
};

const readSlotsFromStorage = (storageKey: string) => {
    const base: Record<DayOfWeek, number[]> = {
        Mon: [],
        Tue: [],
        Wed: [],
        Thu: [],
        Fri: [],
    };
    try {
        const saved = localStorage.getItem(storageKey);
        if (!saved) return base;
        const parsed = JSON.parse(saved);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base;
        const result: Record<DayOfWeek, number[]> = { ...base };
        DAYS.forEach(day => {
            const daySlots = (parsed as Record<string, unknown>)[day];
            if (!Array.isArray(daySlots)) return;
            const filtered = daySlots
                .filter(slot => Number.isInteger(slot) && slot >= 0 && slot <= 23) as number[];
            result[day] = Array.from(new Set(filtered)).sort((a, b) => a - b);
        });
        return result;
    } catch {
        return base;
    }
};

const readWeightsFromStorage = () => {
    try {
        const saved = localStorage.getItem(LOCALSTORAGE_WEIGHTS_KEY);
        if (!saved) return DEFAULT_WEIGHTS;
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return DEFAULT_WEIGHTS;
        return DEFAULT_WEIGHTS.map((base, index) => {
            const item = parsed[index];
            if (!item || typeof item !== 'object' || Array.isArray(item)) return base;
            const weightValue = (item as { weight?: unknown }).weight;
            const rssValue = (item as { rss?: unknown }).rss;
            const weight = typeof weightValue === 'number' && Number.isFinite(weightValue)
                ? Math.min(10, Math.max(0, Math.round(weightValue)))
                : base.weight;
            const rss = typeof rssValue === 'boolean' ? rssValue : base.rss;
            return { weight, rss };
        });
    } catch {
        return DEFAULT_WEIGHTS;
    }
};

const readCurrentPageFromStorage = () => {
    try {
        const saved = localStorage.getItem(LOCALSTORAGE_CURRENT_PAGE_KEY);
        if (!saved) return 0;
        const parsed = Number(saved);
        if (!Number.isInteger(parsed)) return 0;
        if (parsed < 0 || parsed > TOTAL_PAGES) return 0;
        return parsed;
    } catch {
        return 0;
    }
};

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
    const [preferences, setPreferences] = useState<Record<number, number>>(
        () => readPreferencesFromStorage()
    );
    
    const [goodSlots, setGoodSlots] = useState<Record<DayOfWeek, number[]>>(
        () => readSlotsFromStorage(LOCALSTORAGE_GOOD_SLOTS_KEY)
    );
    const [badSlots, setBadSlots] = useState<Record<DayOfWeek, number[]>>(
        () => readSlotsFromStorage(LOCALSTORAGE_BAD_SLOTS_KEY)
    );
    
    // Weights: [FitGood, FitBad, BreakTime, Prefer]
    const [weights, setWeights] = useState<WeightConfig[]>(() => readWeightsFromStorage());

    const [currentPage, setCurrentPage] = useState(() => readCurrentPageFromStorage());
    const totalPages = TOTAL_PAGES;
    
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
        localStorage.setItem(LOCALSTORAGE_WEIGHTS_KEY, JSON.stringify(weights));
    }, [weights]);

    useEffect(() => {
        localStorage.setItem(LOCALSTORAGE_CURRENT_PAGE_KEY, String(currentPage));
    }, [currentPage]);

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
        setPreferences(prev => {
            const next = { ...prev };
            if (pref === 0) {
                delete next[id];
            } else {
                next[id] = pref;
            }
            localStorage.setItem(LOCALSTORAGE_PREFERENCES_KEY, JSON.stringify(next));
            return next;
        });
    };

    const toggleSlot = (type: 'good' | 'bad', day: DayOfWeek, slotIndex: number) => {
        const targetSet = type === 'good' ? setGoodSlots : setBadSlots;
        targetSet(prev => {
            const currentSlots = prev[day];
            const exists = currentSlots.includes(slotIndex);
            const newSlots = exists 
                ? currentSlots.filter(s => s !== slotIndex)
                : [...currentSlots, slotIndex];
            const next = { ...prev, [day]: newSlots };
            localStorage.setItem(
                type === 'good' ? LOCALSTORAGE_GOOD_SLOTS_KEY : LOCALSTORAGE_BAD_SLOTS_KEY,
                JSON.stringify(next)
            );
            return next;
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
