import { Lecture, RawLecture, RawTimeSlot, TimeSlot, DayOfWeek } from './../types';

const TIME_SLOT_START_BIAS = -1;
const TIME_SLOT_END_BIAS = -1;

const DAY_MAP: Record<string, DayOfWeek> = {
    '월': 'Mon',
    '화': 'Tue',
    '수': 'Wed',
    '목': 'Thu',
    '금': 'Fri'
};

export const parseLecture = (raw: RawLecture): Lecture => {
    const time_slots: TimeSlot[] = raw.time_slots.map((slot: RawTimeSlot) => {
        const day = DAY_MAP[slot.day.trim()] || 'Mon'; // Default to Mon or handle error
        const start_index = slot.start_index + TIME_SLOT_START_BIAS;
        const end_index = slot.end_index + TIME_SLOT_END_BIAS;
        return {
            day,
            start_index,
            end_index
        };
    });

    return {
        id: raw.id,
        section: raw.section,
        name: raw.name,
        prof: raw.prof,
        time_slots,
        selected: false,
        preference: 0
    };
};

export const formatTimeString = (slots: TimeSlot[]): string => {
    return slots.map(slot => {
        const startH = 9 + Math.floor(slot.start_index / 2);
        const startM = slot.start_index % 2 === 0 ? "00" : "30";
        const endH = 9 + Math.floor((slot.end_index + 1) / 2);
        const endM = (slot.end_index + 1) % 2 === 0 ? "00" : "30";
        return `${slot.day} ${startH}:${startM}~${endH}:${endM}`;
    }).join(', ');
};