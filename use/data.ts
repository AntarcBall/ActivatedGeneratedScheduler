import coursesCsv from "../Courses_eng.csv?raw";
import latestCsv from "../latest.csv?raw";

export type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

export type Session = {
  room: string;
  courseCode: string;
  section: string;
  professor: string;
  professorKo: string | null;
  title: string;
  titleKo: string | null;
  day: DayKey;
  start: string;
  end: string;
  enrolled: number | null;
  adminCapacity: number | null;
  fillRate: number | null;
};

export type RoomInsight = {
  courseCode: string;
  section: string;
  professor: string;
  professorKo: string | null;
  title: string;
  titleKo: string | null;
  enrolled: number;
  adminCapacity: number;
  fillRate: number;
  meetingHours: number;
  adminGap: number;
  roomGap: number;
};

export type RoomData = {
  room: string;
  courseCount: number;
  analyzedCourseCount: number;
  coverage: number;
  sessionCount: number;
  sessions: Session[];
  estimatedCapacity: number | null;
  meetingHours: number;
  weeklyOccupancy: number;
  avgFillRate: number | null;
  avgEnrollmentVsRoom: number | null;
  avgAdminCapVsRoom: number | null;
  inUseSeatUtil: number | null;
  fullWeekSeatUtil: number | null;
  dayHours: Record<DayKey, number>;
  topSlackSections: RoomInsight[];
};

type DemandRow = {
  courseCode: string;
  section: string;
  titleKo: string;
  enrolled: number;
  adminCapacity: number;
};

type SectionAccumulator = {
  courseCode: string;
  section: string;
  professor: string;
  professorKo: string | null;
  title: string;
  titleKo: string | null;
  enrolled: number | null;
  adminCapacity: number | null;
  fillRate: number | null;
  meetingHours: number;
};

const DAYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const TOTAL_WEEK_HOURS = 60;
const SCHEDULE_PATTERN =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(\d{2}:\d{2})-(\d{2}:\d{2})\((.+)\)$/;
const LATEST_COURSE_CODE = "\uACFC\uBAA9\uCF54\uB4DC";
const LATEST_SECTION = "\uBD84\uBC18";
const LATEST_TITLE = "\uACFC\uBAA9\uBA85";
const LATEST_ENROLLED = "\uD604\uC7AC\uC218\uAC15\uC2E0\uCCAD\uC778\uC6D0";
const LATEST_CAPACITY = "\uC804\uCCB4\uC815\uC6D0";

function splitCsvLine(line: string) {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

function parseCsv(raw: string) {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  const [headerLine, ...dataLines] = lines;
  const headers = splitCsvLine(headerLine);

  return dataLines.map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    ) as Record<string, string>;
  });
}

function normalizeTitle(value: string) {
  return value.split(" - ")[0].trim();
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function createDayHours() {
  return {
    Mon: 0,
    Tue: 0,
    Wed: 0,
    Thu: 0,
    Fri: 0,
  } satisfies Record<DayKey, number>;
}

function buildDemandMap(raw: string) {
  const latestRows = parseCsv(raw);
  const demandRows = latestRows.map((row) => ({
    courseCode: row[LATEST_COURSE_CODE].trim(),
    section: row[LATEST_SECTION].trim(),
    titleKo: row[LATEST_TITLE].trim(),
    enrolled: Number(row[LATEST_ENROLLED]),
    adminCapacity: Number(row[LATEST_CAPACITY]),
  }));

  return new Map<string, DemandRow>(
    demandRows.map((row) => [`${row.courseCode}-${row.section}`, row]),
  );
}

function buildRooms(courseRaw: string, latestRaw: string): RoomData[] {
  const courseRows = parseCsv(courseRaw);
  const demandBySection = buildDemandMap(latestRaw);
  const roomMap = new Map<
    string,
    {
      courses: Set<string>;
      sessions: Session[];
      sections: Map<string, SectionAccumulator>;
      dayHours: Record<DayKey, number>;
      meetingHours: number;
    }
  >();

  for (const row of courseRows) {
    const schedule = row["Day/Time/Class Room"]?.trim();
    if (!schedule) {
      continue;
    }

    const courseCode = row["Course Number"].trim();
    const section = row["Section"].trim();
    const key = `${courseCode}-${section}`;
    const demand = demandBySection.get(key);
    const title = normalizeTitle(row["Course Title"].trim());
    const titleKo = demand?.titleKo ?? null;
    const professor = row["Instructor"].trim();
    const professorKo = null;

    for (const item of schedule.split(",").map((entry) => entry.trim()).filter(Boolean)) {
      const match = item.match(SCHEDULE_PATTERN);
      if (!match) {
        continue;
      }

      const day = match[1] as DayKey | "Sat" | "Sun";
      if (!DAYS.includes(day as DayKey)) {
        continue;
      }

      const room = match[4].trim();
      const duration = (toMinutes(match[3]) - toMinutes(match[2])) / 60;
      const fillRate =
        demand && demand.adminCapacity > 0 ? demand.enrolled / demand.adminCapacity : null;

      const session: Session = {
        room,
        courseCode,
        section,
        professor,
        professorKo,
        title,
        titleKo,
        day: day as DayKey,
        start: match[2],
        end: match[3],
        enrolled: demand?.enrolled ?? null,
        adminCapacity: demand?.adminCapacity ?? null,
        fillRate,
      };

      const roomEntry = roomMap.get(room) ?? {
        courses: new Set<string>(),
        sessions: [],
        sections: new Map<string, SectionAccumulator>(),
        dayHours: createDayHours(),
        meetingHours: 0,
      };

      roomEntry.courses.add(key);
      roomEntry.sessions.push(session);
      roomEntry.dayHours[day as DayKey] += duration;
      roomEntry.meetingHours += duration;

      const existingSection = roomEntry.sections.get(key) ?? {
        courseCode,
        section,
        professor,
        professorKo,
        title,
        titleKo,
        enrolled: demand?.enrolled ?? null,
        adminCapacity: demand?.adminCapacity ?? null,
        fillRate,
        meetingHours: 0,
      };

      existingSection.meetingHours += duration;
      roomEntry.sections.set(key, existingSection);
      roomMap.set(room, roomEntry);
    }
  }

  return [...roomMap.entries()]
    .map(([room, value]) => {
      const analyzedSections = [...value.sections.values()].filter(
        (section) => section.enrolled !== null && section.adminCapacity !== null,
      );
      const estimatedCapacity =
        analyzedSections.length > 0
          ? Math.max(...analyzedSections.map((section) => section.adminCapacity as number))
          : null;
      const analyzedMeetingHours = analyzedSections.reduce(
        (total, section) => total + section.meetingHours,
        0,
      );
      const seatHoursDemand = analyzedSections.reduce(
        (total, section) => total + (section.enrolled as number) * section.meetingHours,
        0,
      );
      const seatHoursSupplyInUse =
        estimatedCapacity !== null ? estimatedCapacity * analyzedMeetingHours : null;
      const avgFillRate =
        analyzedSections.length > 0
          ? analyzedSections.reduce((total, section) => total + (section.fillRate as number), 0) /
            analyzedSections.length
          : null;
      const avgEnrollmentVsRoom =
        estimatedCapacity !== null && analyzedSections.length > 0
          ? analyzedSections.reduce(
              (total, section) => total + (section.enrolled as number) / estimatedCapacity,
              0,
            ) / analyzedSections.length
          : null;
      const avgAdminCapVsRoom =
        estimatedCapacity !== null && analyzedSections.length > 0
          ? analyzedSections.reduce(
              (total, section) => total + (section.adminCapacity as number) / estimatedCapacity,
              0,
            ) / analyzedSections.length
          : null;
      const inUseSeatUtil =
        seatHoursSupplyInUse && seatHoursSupplyInUse > 0
          ? seatHoursDemand / seatHoursSupplyInUse
          : null;
      const fullWeekSeatUtil =
        estimatedCapacity !== null && estimatedCapacity > 0
          ? seatHoursDemand / (estimatedCapacity * TOTAL_WEEK_HOURS)
          : null;
      const topSlackSections =
        estimatedCapacity !== null
          ? analyzedSections
              .map((section) => ({
                courseCode: section.courseCode,
                section: section.section,
                professor: section.professor,
                professorKo: section.professorKo,
                title: section.title,
                titleKo: section.titleKo,
                enrolled: section.enrolled as number,
                adminCapacity: section.adminCapacity as number,
                fillRate: section.fillRate as number,
                meetingHours: section.meetingHours,
                adminGap: estimatedCapacity - (section.adminCapacity as number),
                roomGap: estimatedCapacity - (section.enrolled as number),
              }))
              .sort((left, right) => right.roomGap - left.roomGap)
              .slice(0, 4)
          : [];

      return {
        room,
        courseCount: value.courses.size,
        analyzedCourseCount: analyzedSections.length,
        coverage: value.courses.size > 0 ? analyzedSections.length / value.courses.size : 0,
        sessionCount: value.sessions.length,
        sessions: value.sessions.sort((left, right) => {
          const dayOrder = DAYS.indexOf(left.day) - DAYS.indexOf(right.day);
          if (dayOrder !== 0) {
            return dayOrder;
          }

          return left.start.localeCompare(right.start);
        }),
        estimatedCapacity,
        meetingHours: value.meetingHours,
        weeklyOccupancy: value.meetingHours / TOTAL_WEEK_HOURS,
        avgFillRate,
        avgEnrollmentVsRoom,
        avgAdminCapVsRoom,
        inUseSeatUtil,
        fullWeekSeatUtil,
        dayHours: value.dayHours,
        topSlackSections,
      } satisfies RoomData;
    })
    .sort((left, right) => {
      if (right.courseCount !== left.courseCount) {
        return right.courseCount - left.courseCount;
      }

      return left.room.localeCompare(right.room);
    });
}

export const rooms = buildRooms(coursesCsv, latestCsv);
