import { Exercise, Workout, ExerciseHistoryEntry, Settings } from "./types";
import { SEED_EXERCISES } from "./seedExercises";

const KEYS = {
  EXERCISES: "gymlog:exercises",
  WORKOUTS: "gymlog:workouts",
  ACTIVE: "gymlog:active",
  HISTORY: "gymlog:history",
  SETTINGS: "gymlog:settings",
};

export const DEFAULT_SETTINGS: Settings = {
  unit: "kg",
  defaultRest: 90,
};

export const storage = {
  getExercises: (): Exercise[] => {
    try {
      const stored = localStorage.getItem(KEYS.EXERCISES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Failed to load exercises", e);
    }
    return SEED_EXERCISES;
  },
  saveExercises: (exercises: Exercise[]) => {
    try {
      localStorage.setItem(KEYS.EXERCISES, JSON.stringify(exercises));
    } catch (e) {
      console.error("Failed to save exercises", e);
    }
  },
  getWorkouts: (): Workout[] => {
    try {
      const stored = localStorage.getItem(KEYS.WORKOUTS);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load workouts", e);
    }
    return [];
  },
  saveWorkouts: (workouts: Workout[]) => {
    try {
      localStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts));
    } catch (e) {
      console.error("Failed to save workouts", e);
    }
  },
  getActiveWorkout: (): Workout | null => {
    try {
      const stored = localStorage.getItem(KEYS.ACTIVE);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load active workout", e);
    }
    return null;
  },
  saveActiveWorkout: (workout: Workout | null) => {
    try {
      if (workout) {
        localStorage.setItem(KEYS.ACTIVE, JSON.stringify(workout));
      } else {
        localStorage.removeItem(KEYS.ACTIVE);
      }
    } catch (e) {
      console.error("Failed to save active workout", e);
    }
  },
  getHistory: (): Record<string, ExerciseHistoryEntry> => {
    try {
      const stored = localStorage.getItem(KEYS.HISTORY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load history", e);
    }
    return {};
  },
  saveHistory: (history: Record<string, ExerciseHistoryEntry>) => {
    try {
      localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save history", e);
    }
  },
  getSettings: (): Settings => {
    try {
      const stored = localStorage.getItem(KEYS.SETTINGS);
      if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch (e) {
      console.error("Failed to load settings", e);
    }
    return DEFAULT_SETTINGS;
  },
  saveSettings: (settings: Settings) => {
    try {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  },
  clearAll: () => {
    try {
      localStorage.removeItem(KEYS.EXERCISES);
      localStorage.removeItem(KEYS.WORKOUTS);
      localStorage.removeItem(KEYS.ACTIVE);
      localStorage.removeItem(KEYS.HISTORY);
      localStorage.removeItem(KEYS.SETTINGS);
    } catch (e) {
      console.error("Failed to clear data", e);
    }
  }
};
