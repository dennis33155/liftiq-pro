import { WARMUP_PRESETS } from "./schedule";
import { makeId } from "./storage";
import type { Category, Workout, WorkoutExercise } from "./types";

export const PR_SEED_FLAG_KEY = "gymlog.prSeed.v1";

type SeedSet = { weight: number | null; reps: number };
type SeedExercise = { exerciseId: string; sets: SeedSet[]; note?: string };
type SeedDay = {
  category: Category;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  exercises: SeedExercise[];
  notes?: string;
};

const WARMUP: SeedExercise[] = [
  {
    exerciseId: "ex_dips_tri",
    sets: [{ weight: WARMUP_PRESETS.ex_dips_tri?.weight ?? null, reps: 15 }],
  },
  {
    exerciseId: "ex_pullup",
    sets: [{ weight: WARMUP_PRESETS.ex_pullup?.weight ?? null, reps: 12 }],
  },
];

const FINISHER: SeedExercise[] = [
  { exerciseId: "ex_hip_abductor", sets: [{ weight: 165, reps: 15 }] },
];

const SEED_DAYS: SeedDay[] = [
  {
    category: "Arms",
    weekday: 3,
    exercises: [
      { exerciseId: "ex_db_curl_blaster", sets: [{ weight: 25, reps: 12 }] },
      { exerciseId: "ex_hammer", sets: [{ weight: 27.5, reps: 12 }] },
      { exerciseId: "ex_cable_curl", sets: [{ weight: 35, reps: 12 }] },
      { exerciseId: "ex_rope_pushdown", sets: [{ weight: 40, reps: 15 }] },
      { exerciseId: "ex_overhead_tri", sets: [{ weight: 60, reps: 15 }] },
      { exerciseId: "ex_cable_overhead_tri", sets: [{ weight: 35, reps: 12 }] },
    ],
    notes:
      "Wednesday biceps + triceps. Arm blaster locked the elbows, no swing on the curls.",
  },
  {
    category: "Back",
    weekday: 4,
    exercises: [
      { exerciseId: "ex_lat_pull", sets: [{ weight: 110, reps: 12 }] },
      { exerciseId: "ex_lat_pull_reverse", sets: [{ weight: 110, reps: 8 }] },
      { exerciseId: "ex_seated_row", sets: [{ weight: 115, reps: 15 }] },
      { exerciseId: "ex_db_row", sets: [{ weight: 55, reps: 12 }] },
      { exerciseId: "ex_reverse_pec", sets: [{ weight: 70, reps: 8 }] },
      { exerciseId: "ex_face_pull", sets: [{ weight: null, reps: 15 }] },
    ],
    notes:
      "Pull volume day. Lat pulldown superset wide -> reverse, no rest. MAG grip on the row.",
  },
  {
    category: "Shoulders",
    weekday: 5,
    exercises: [
      { exerciseId: "ex_db_press_sh", sets: [{ weight: 50, reps: 14 }] },
      { exerciseId: "ex_machine_lat_raise", sets: [{ weight: 75, reps: 12 }] },
      { exerciseId: "ex_cable_lat_raise", sets: [{ weight: 15, reps: 10 }] },
      { exerciseId: "ex_db_shrug", sets: [{ weight: 50, reps: 15 }] },
      { exerciseId: "ex_foreman_217_low", sets: [{ weight: 25, reps: 10 }] },
    ],
    notes:
      "Injection day. Built shoulder press 40 -> 45 -> 50 lb. Strict cable laterals.",
  },
  {
    category: "Chest",
    weekday: 6,
    exercises: [
      { exerciseId: "ex_inc_db", sets: [{ weight: 50, reps: 12 }] },
      { exerciseId: "ex_hammer_inc", sets: [{ weight: 65, reps: 11 }] },
      { exerciseId: "ex_hammer_supine", sets: [{ weight: 70, reps: 10 }] },
      { exerciseId: "ex_foreman_231", sets: [{ weight: 35, reps: 7 }] },
      { exerciseId: "ex_db_pullover", sets: [{ weight: 55, reps: 12 }] },
      { exerciseId: "ex_cable_fly", sets: [{ weight: 17.5, reps: 15 }] },
    ],
    notes:
      "T-peak Saturday. Cable fly tri-set: top 17.5 / mid 17.5 / bottom 12.5, three rounds.",
  },
  {
    category: "Legs",
    weekday: 0,
    exercises: [
      { exerciseId: "ex_squat", sets: [{ weight: 195, reps: 12 }] },
      { exerciseId: "ex_leg_press", sets: [{ weight: 180, reps: 12 }] },
      { exerciseId: "ex_leg_ext", sets: [{ weight: 90, reps: 9 }] },
      { exerciseId: "ex_leg_curl", sets: [{ weight: null, reps: 12 }] },
      { exerciseId: "ex_hip_adductor", sets: [{ weight: 110, reps: 15 }] },
      { exerciseId: "ex_calf", sets: [{ weight: null, reps: 20 }] },
    ],
    notes:
      "T-peak Sunday. Knee sleeves on for squats. Built 135 -> 155 -> 175 -> 195 lb.",
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function previousSunday(now: Date): Date {
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const dow = startOfToday.getDay();
  const daysBack = dow === 0 ? 7 : dow;
  return new Date(startOfToday.getTime() - daysBack * DAY_MS);
}

function buildWorkoutExercises(items: SeedExercise[]): WorkoutExercise[] {
  return items.map((item) => ({
    id: makeId(),
    exerciseId: item.exerciseId,
    sets: item.sets.map((s) => ({
      id: makeId(),
      weight: s.weight,
      reps: s.reps,
      done: true,
    })),
  }));
}

export function buildPRSeedWorkouts(now: Date = new Date()): Workout[] {
  const baseSunday = previousSunday(now);

  return SEED_DAYS.map((day) => {
    const offset = day.weekday === 0 ? 0 : day.weekday - 7;
    const sessionDate = new Date(baseSunday.getTime() + offset * DAY_MS);
    const startedAt = sessionDate.getTime() + (18 * 60 + 30) * 60 * 1000;
    const endedAt = startedAt + 90 * 60 * 1000;

    const exercises: WorkoutExercise[] = [
      ...buildWorkoutExercises(WARMUP),
      ...buildWorkoutExercises(day.exercises),
      ...buildWorkoutExercises(FINISHER),
    ];

    return {
      id: makeId(),
      category: day.category,
      startedAt,
      endedAt,
      exercises,
      notes: day.notes,
    };
  });
}
