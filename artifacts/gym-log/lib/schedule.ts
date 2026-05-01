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
    note: "Hit it hard.",
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
    note: "Press and load. Set up tomorrow's chest.",
  },
  {
    day: 6,
    short: "Sat",
    long: "Saturday",
    category: "Chest",
    isRest: false,
    note: "Primary day. Push to PRs.",
  },
];

export const WARMUP_EXERCISE_IDS: string[] = ["ex_dips_tri", "ex_pullup"];
export const WARMUP_PRESETS: Record<string, { reps: number; weight: number | null }> = {
  ex_dips_tri: { reps: 15, weight: null },
  ex_pullup: { reps: 12, weight: null },
};
export const FINISHER_EXERCISE_IDS: string[] = ["ex_hip_abductor"];

/**
 * Default exercise list inserted into a freshly-started workout for each
 * category. The fixed warm-up (Dips + Pull-ups) is rendered separately at
 * the top of the workout screen, and the finisher (Hip Abductor) is
 * appended automatically after these defaults — both are NOT included in
 * this list.
 */
export const CATEGORY_DEFAULT_EXERCISES: Record<Category, string[]> = {
  Chest: [
    "ex_inc_db",
    "ex_hammer_inc",
    "ex_hammer_supine",
    "ex_cable_fly",
    "ex_db_pullover",
  ],
  Back: [
    "ex_lat_pull",
    "ex_seated_row",
    "ex_db_row",
    "ex_reverse_pec",
    "ex_face_pull",
    "ex_db_pullover",
  ],
  Arms: [
    "ex_db_curl_blaster",
    "ex_hammer",
    "ex_cable_curl",
    "ex_rope_pushdown",
    "ex_overhead_tri",
    "ex_cable_overhead_tri",
  ],
  Shoulders: [
    "ex_db_press_sh",
    "ex_machine_lat_raise",
    "ex_cable_lat_raise",
    "ex_db_shrug",
    "ex_foreman_217_low",
  ],
  Legs: [
    "ex_squat",
    "ex_leg_press",
    "ex_leg_ext",
    "ex_leg_curl",
    "ex_calf",
  ],
  "Full Body": [],
};

export function getTodaySlot(): DaySlot {
  const day = new Date().getDay();
  return WEEKLY_SCHEDULE[day] ?? WEEKLY_SCHEDULE[0]!;
}
