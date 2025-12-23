import { SchedulerInput, Timetable, Lecture, DayOfWeek, DAYS } from './types';

self.onmessage = (e: MessageEvent<SchedulerInput>) => {
    const { selectedLectures, goodSlots, badSlots, weights } = e.data;
    
    // 1. Cluster lectures by name
    const clusters: Record<string, Lecture[]> = {};
    selectedLectures.forEach(lec => {
        if (!clusters[lec.name]) clusters[lec.name] = [];
        clusters[lec.name].push(lec);
    });
    const lectureGroups = Object.values(clusters);

    // 2. Generate combinations and filter
    const validTimetables: Timetable[] = [];
    
    // Cartesian Product Logic (Indices based)
    if (lectureGroups.length > 0) {
        const indices = new Array(lectureGroups.length).fill(0);
        
        while (true) {
            const currentCombo: Lecture[] = [];
            for (let i = 0; i < lectureGroups.length; i++) {
                currentCombo.push(lectureGroups[i][indices[i]]);
            }
            
            if (!checkCollision(currentCombo)) {
                const loss = calculateLoss(currentCombo, goodSlots, badSlots, weights);
                validTimetables.push({ lectures: [...currentCombo], score: loss });
            }
            
            // Increment indices
            let next = lectureGroups.length - 1;
            while (next >= 0 && indices[next] + 1 >= lectureGroups[next].length) {
                indices[next] = 0;
                next--;
            }
            
            if (next < 0) break;
            indices[next]++;
        }
    }

    // Sort by score (Loss) ascending
    validTimetables.sort((a, b) => a.score - b.score);

    self.postMessage(validTimetables);
};

function checkCollision(lectures: Lecture[]): boolean {
    const occupied = {
        Mon: new Set<number>(),
        Tue: new Set<number>(),
        Wed: new Set<number>(),
        Thu: new Set<number>(),
        Fri: new Set<number>()
    };

    for (const lec of lectures) {
        for (const slot of lec.time_slots) {
            const daySlots = occupied[slot.day];
            for (let i = slot.start_index; i <= slot.end_index; i++) {
                if (daySlots.has(i)) return true;
                daySlots.add(i);
            }
        }
    }
    return false;
}

function calculateLoss(
    lectures: Lecture[], 
    goodSlots: Record<DayOfWeek, number[]>, 
    badSlots: Record<DayOfWeek, number[]>, 
    weights: { weight: number, rss: boolean }[]
): number {
    
    // 1. Flatten slots
    const timetableSlots: Record<DayOfWeek, Set<number>> = {
        Mon: new Set(), Tue: new Set(), Wed: new Set(), Thu: new Set(), Fri: new Set()
    };

    for (const lec of lectures) {
        for (const slot of lec.time_slots) {
            for (let i = slot.start_index; i <= slot.end_index; i++) {
                timetableSlots[slot.day].add(i);
            }
        }
    }

    // 2. Calculate properties
    // [0] Fit Good
    const fitGood = calculateFitProperty(timetableSlots, goodSlots, weights[0].rss);
    // [1] Fit Bad
    const fitBad = calculateFitProperty(timetableSlots, badSlots, weights[1].rss);
    // [2] Break Time
    const breakTime = calculateBreakTimeProperty(timetableSlots, weights[2].rss);
    // [3] Preferences
    const preference = lectures.reduce((sum, lec) => sum + lec.preference, 0);

    // 3. Final Loss
    // good and prefer are subtracted because high is good
    let loss = 0;
    loss += fitGood * weights[0].weight * -1;
    loss += fitBad * weights[1].weight;
    loss += breakTime * weights[2].weight;
    loss += preference * weights[3].weight * -1;

    return loss;
}

function calculateFitProperty(
    timetableSlots: Record<DayOfWeek, Set<number>>, 
    targetSlots: Record<DayOfWeek, number[]>, 
    rss: boolean
): number {
    const dailyScores: number[] = [];

    for (const day of DAYS) {
        const tSet = timetableSlots[day];
        const uArr = targetSlots[day] || [];
        
        let overlap = 0;
        for (const s of uArr) {
            if (tSet.has(s)) overlap++;
        }
        dailyScores.push(overlap);
    }

    if (rss) {
        return Math.sqrt(dailyScores.reduce((sum, s) => sum + s * s, 0));
    } else {
        return dailyScores.reduce((sum, s) => sum + s, 0);
    }
}

function calculateBreakTimeProperty(
    timetableSlots: Record<DayOfWeek, Set<number>>, 
    rss: boolean
): number {
    const dailyScores: number[] = [];

    for (const day of DAYS) {
        const slots = Array.from(timetableSlots[day]).sort((a, b) => a - b);
        
        if (slots.length === 0) {
            dailyScores.push(0);
            continue;
        }

        let breakTime = 0;
        
        // Simple logic: if slots are not contiguous, add gap
        // But slots usually come in blocks (e.g. 12, 13).
        // If we have 12, 13, 16, 17.
        // Block 1: 12-13. Block 2: 16-17. Gap: 16 - 13 - 1 = 2 slots?
        // Let's match Python logic precisely.
        
        /* Python logic:
            blocks = []
            current_block = [slots[0]]
            for i in range(1, len):
                if slots[i] == slots[i-1] + 1: append
                else: push block, new block
            
            gap = 0
            for i in range(len(blocks)-1):
                gap += blocks[i+1][0] - blocks[i][-1] - 1
        */

        const blocks: number[][] = [];
        let currentBlock = [slots[0]];
        
        for (let i = 1; i < slots.length; i++) {
            if (slots[i] === slots[i-1] + 1) {
                currentBlock.push(slots[i]);
            } else {
                blocks.push(currentBlock);
                currentBlock = [slots[i]];
            }
        }
        blocks.push(currentBlock);

        if (blocks.length > 1) {
            for (let i = 0; i < blocks.length - 1; i++) {
                breakTime += blocks[i+1][0] - blocks[i][blocks[i].length - 1] - 1;
            }
        }
        
        dailyScores.push(breakTime);
    }

    if (rss) {
        return Math.sqrt(dailyScores.reduce((sum, s) => sum + s * s, 0));
    } else {
        return dailyScores.reduce((sum, s) => sum + s, 0);
    }
}