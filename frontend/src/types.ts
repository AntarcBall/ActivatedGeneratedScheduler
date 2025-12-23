export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

export const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export interface TimeSlot {
    day: DayOfWeek;
    start_index: number; // 0-based
    end_index: number;   // 0-based
}

export interface RawTimeSlot {
    day: string; // '월', '화' ...
    start_index: number; // 1-based (usually)
    end_index: number;   // 1-based
}

export interface RawLecture {
    id: number;
    section: number;
    name: string;
    prof: string;
    classification?: string;
    category?: string;
    credit?: number;
    time_slots: RawTimeSlot[];
}

export interface Lecture {
    id: number;
    section: number;
    name: string;
    prof: string;
    classification?: string;
    category?: string;
    credit?: number;
    time_slots: TimeSlot[];
    selected: boolean;
    preference: number; // -1 (Bad), 0 (Normal), 1 (Good)
}

export interface Timetable {
    lectures: Lecture[];
    score: number;
    details?: {
        fitGood: number;
        fitBad: number;
        breakTime: number;
        preference: number;
    };
}

export interface WeightConfig {
    weight: number;
    rss: boolean; // Root Sum Square
}

export interface SchedulerInput {
    selectedLectures: Lecture[];
    goodSlots: Record<DayOfWeek, number[]>;
    badSlots: Record<DayOfWeek, number[]>;
    weights: WeightConfig[]; // [FitGood, FitBad, BreakTime, Prefer]
}