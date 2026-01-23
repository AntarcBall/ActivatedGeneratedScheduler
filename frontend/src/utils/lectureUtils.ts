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
        course_number: raw.course_number,
        section: raw.section,
        name: raw.name,
        prof: raw.prof,
        classification: raw.classification,
        category: raw.category,
        major_tracks: raw.major_tracks || [],
        credit: raw.credit || 0,
        time_slots,
        selected: false,
        preference: 0
    };
};

export const getLectureKey = (lec: Pick<Lecture, 'course_number' | 'section' | 'id'>): string => {
    if (lec.course_number) return `${lec.course_number}#${lec.section}`;
    return `id:${lec.id}`;
};

export const formatTimeString = (slots: TimeSlot[]): string => {
    return slots.map(slot => {
        const start = formatSingleSlotTime(slot.start_index);
        const end = formatSingleSlotTime(slot.end_index + 1);
        return `${slot.day} ${start}~${end}`;
    }).join(', ');
};

export const formatSingleSlotTime = (slotIdx: number): string => {
    // slotIdx 1 is 9:00
    // But after parseLecture, start_index = slot.start_index - 1
    // So if raw was 1, parsed is 0. 0 -> 9:00
    const h = 9 + Math.floor(slotIdx / 2);
    const m = slotIdx % 2 === 0 ? "00" : "30";
    return `${h}:${m}`;
};
