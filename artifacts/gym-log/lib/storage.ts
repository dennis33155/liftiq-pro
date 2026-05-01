import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Exercise, Workout } from "./types";

const KEYS = {
  workouts: "gymlog.workouts.v1",
  custom: "gymlog.customExercises.v1",
  active: "gymlog.activeWorkout.v1",
};

/**
 * Legacy AsyncStorage keys from a previous version of the app that seeded
 * preloaded "personal best" workout data on first launch. Cleared on every
 * app boot so existing installs can't keep that flag (or any partial seed)
 * around. Defined as a constant rather than inlined so the cleanup logic
 * stays self-documenting.
 */
const LEGACY_KEYS = ["gymlog.prSeed.v2", "gymlog.prSeed.v1"];

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadWorkouts(): Promise<Workout[]> {
  return readJson<Workout[]>(KEYS.workouts, []);
}
export async function saveWorkouts(workouts: Workout[]): Promise<void> {
  await writeJson(KEYS.workouts, workouts);
}

export async function loadCustomExercises(): Promise<Exercise[]> {
  return readJson<Exercise[]>(KEYS.custom, []);
}
export async function saveCustomExercises(items: Exercise[]): Promise<void> {
  await writeJson(KEYS.custom, items);
}

export async function loadActiveWorkout(): Promise<Workout | null> {
  return readJson<Workout | null>(KEYS.active, null);
}
export async function saveActiveWorkout(workout: Workout | null): Promise<void> {
  if (workout === null) {
    await AsyncStorage.removeItem(KEYS.active);
    return;
  }
  await writeJson(KEYS.active, workout);
}

/**
 * Set of exact `notes` strings that the previous version of the app used
 * for its preloaded "Dennis" PR seed workouts. Used to scrub any
 * lingering seeded sessions out of an existing user's stored history on
 * boot so the public app never carries one user's personal data.
 */
export const SEEDED_WORKOUT_NOTES: ReadonlySet<string> = new Set([
  "Wednesday biceps + triceps. Arm blaster locked the elbows, no swing on the curls.",
  "Pull volume day. Lat pulldown superset wide -> reverse, no rest. MAG grip on the row.",
  "Injection day. Built shoulder press 40 -> 45 -> 50 lb. Strict cable laterals.",
  "T-peak Saturday. Cable fly tri-set: top 17.5 / mid 17.5 / bottom 12.5, three rounds.",
  "T-peak Sunday. Knee sleeves on for squats. Built 135 -> 155 -> 175 -> 195 lb.",
]);

/**
 * Removes any legacy seed-flag keys left over from a previous version of
 * the app. Safe to call on every boot.
 */
export async function clearLegacySeedKeys(): Promise<void> {
  await Promise.all(LEGACY_KEYS.map((k) => AsyncStorage.removeItem(k)));
}

export async function clearAll(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(KEYS.workouts),
    AsyncStorage.removeItem(KEYS.custom),
    AsyncStorage.removeItem(KEYS.active),
    ...LEGACY_KEYS.map((k) => AsyncStorage.removeItem(k)),
  ]);
}

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
