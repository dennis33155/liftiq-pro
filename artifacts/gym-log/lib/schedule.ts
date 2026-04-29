import type { Category } from "./types";

export type DaySlot = {
  day: number;
  short: string;
  long: string;
  category: Category | null;
  isRest: boolean;
  badge?: string;
  note?: string;
};

export const WEEKLY_SCHEDULE: DaySlot[] = [
  {
    day: 0,
    short: "Sun",
    long: "Sunday",
    category: "Legs",
    isRest: false,
    badge: "T PEAK",
    note: "Hit it hard. Hormones are with you.",
  },
  {
    day: 1,
    short: "Mon",
    long: "Monday",
    category: null,
    isRest: true,
    note: "Recover. Eat. Sleep.",
  },
  {
    day: 2,
    short: "Tue",
    long: "Tuesday",
    category: null,
    isRest: true,
    note: "Recover. Eat. Sleep.",
  },
  {
    day: 3,
    short: "Wed",
    long: "Wednesday",
    category: "Arms",
    isRest: false,
    note: "Biceps and triceps focus.",
  },
  {
    day: 4,
    short: "Thu",
    long: "Thursday",
    category: "Back",
    isRest: false,
    note: "Pull volume day.",
  },
  {
    day: 5,
    short: "Fri",
    long: "Friday",
    category: "Shoulders",
    isRest: false,
    badge: "INJECTION DAY",
    note: "Press and load. Set up tomorrow's chest.",
  },
  {
    day: 6,
    short: "Sat",
    long: "Saturday",
    category: "Chest",
    isRest: false,
    badge: "T PEAK",
    note: "Primary day. Push to PRs.",
  },
];

export const WARMUP_EXERCISE_IDS: string[] = ["ex_dips_tri", "ex_pullup"];
export const WARMUP_PRESETS: Record<string, { reps: number; weight: number | null }> = {
  ex_dips_tri: { reps: 15, weight: null },
  ex_pullup: { reps: 12, weight: null },
};
export const FINISHER_EXERCISE_IDS: string[] = ["ex_hip_abductor"];

export function getTodaySlot(): DaySlot {
  const day = new Date().getDay();
  return WEEKLY_SCHEDULE[day] ?? WEEKLY_SCHEDULE[0]!;
}
