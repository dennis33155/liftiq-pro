export type Category =
  | "Chest"
  | "Back"
  | "Legs"
  | "Arms"
  | "Shoulders"
  | "Full Body";

export const CATEGORIES: Category[] = [
  "Chest",
  "Back",
  "Legs",
  "Arms",
  "Shoulders",
  "Full Body",
];

export type Exercise = {
  id: string;
  name: string;
  category: Category;
  isCustom?: boolean;
  imageUrl?: string;
};

export type WorkoutSet = {
  id: string;
  weight: number | null;
  reps: number | null;
  done: boolean;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  sets: WorkoutSet[];
};

export type Workout = {
  id: string;
  category: Category;
  startedAt: number;
  endedAt: number | null;
  exercises: WorkoutExercise[];
  notes?: string;
};
