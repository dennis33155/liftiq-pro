export type MuscleGroup = "Chest" | "Back" | "Legs" | "Arms" | "Shoulders" | "Core" | "Glutes" | "Full Body" | string;
export type Category = "Chest" | "Back" | "Legs" | "Arms" | "Shoulders" | "Full Body";

export interface Exercise {
  id: string;
  name: string;            // e.g. "Barbell Bench Press"
  aka?: string;            // plain English / nickname, e.g. "Flat bench"
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  category: Category;
  imageUrl?: string;       // remote URL OR /exercises/foo.jpg local path
  isCustom?: boolean;
}

export interface SetEntry {
  id: string;
  weight: number;          // in current unit; also store the unit per workout
  reps: number;
  done: boolean;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets: SetEntry[];
}

export interface Workout {
  id: string;
  category: Category;
  startedAt: number;       // ms timestamp
  endedAt?: number;
  unit: "kg" | "lb";
  exercises: WorkoutExercise[];
}

export interface ExerciseHistoryEntry {
  exerciseId: string;
  lastWeight: number;
  lastReps: number;
  lastUnit: "kg" | "lb";
  lastDate: number;
}

export interface Settings {
  unit: "kg" | "lb";
  defaultRest: number; // in seconds
}
