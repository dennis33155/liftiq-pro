import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Exercise, Workout } from "./types";

const KEYS = {
  workouts: "gymlog.workouts.v1",
  custom: "gymlog.customExercises.v1",
  active: "gymlog.activeWorkout.v1",
  prSeed: "gymlog.prSeed.v1",
};

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

export async function loadPRSeedDone(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.prSeed);
    return raw === "1";
  } catch {
    return false;
  }
}
export async function markPRSeedDone(): Promise<void> {
  await AsyncStorage.setItem(KEYS.prSeed, "1");
}

export async function clearAll(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(KEYS.workouts),
    AsyncStorage.removeItem(KEYS.custom),
    AsyncStorage.removeItem(KEYS.active),
    AsyncStorage.removeItem(KEYS.prSeed),
  ]);
}

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
