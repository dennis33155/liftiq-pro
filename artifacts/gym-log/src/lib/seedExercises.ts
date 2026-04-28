import { Exercise } from "./types";

export const SEED_EXERCISES: Exercise[] = [
  // Chest
  { id: "bench-press", name: "Barbell Bench Press", aka: "Flat Bench", primaryMuscle: "Chest", secondaryMuscles: ["Arms", "Shoulders"], category: "Chest" },
  { id: "incline-dumbbell-press", name: "Incline Dumbbell Press", primaryMuscle: "Chest", secondaryMuscles: ["Arms", "Shoulders"], category: "Chest" },
  { id: "cable-fly", name: "Cable Fly", primaryMuscle: "Chest", secondaryMuscles: [], category: "Chest" },
  { id: "push-up", name: "Push-up", primaryMuscle: "Chest", secondaryMuscles: ["Arms", "Core"], category: "Chest" },
  { id: "machine-chest-press", name: "Machine Chest Press", primaryMuscle: "Chest", secondaryMuscles: ["Arms"], category: "Chest" },

  // Back
  { id: "deadlift", name: "Deadlift", primaryMuscle: "Back", secondaryMuscles: ["Legs", "Core", "Glutes"], category: "Back" },
  { id: "pull-up", name: "Pull-up", primaryMuscle: "Back", secondaryMuscles: ["Arms", "Core"], category: "Back" },
  { id: "barbell-row", name: "Barbell Row", primaryMuscle: "Back", secondaryMuscles: ["Arms"], category: "Back" },
  { id: "lat-pulldown", name: "Lat Pulldown", primaryMuscle: "Back", secondaryMuscles: ["Arms"], category: "Back" },
  { id: "seated-cable-row", name: "Seated Cable Row", primaryMuscle: "Back", secondaryMuscles: ["Arms"], category: "Back" },
  { id: "face-pull", name: "Face Pull", primaryMuscle: "Back", secondaryMuscles: ["Shoulders"], category: "Back" },

  // Legs
  { id: "back-squat", name: "Back Squat", primaryMuscle: "Legs", secondaryMuscles: ["Glutes", "Core"], category: "Legs" },
  { id: "romanian-deadlift", name: "Romanian Deadlift", aka: "RDL", primaryMuscle: "Legs", secondaryMuscles: ["Glutes", "Back"], category: "Legs" },
  { id: "leg-press", name: "Leg Press", primaryMuscle: "Legs", secondaryMuscles: ["Glutes"], category: "Legs" },
  { id: "walking-lunge", name: "Walking Lunge", primaryMuscle: "Legs", secondaryMuscles: ["Glutes", "Core"], category: "Legs" },
  { id: "leg-curl", name: "Leg Curl", primaryMuscle: "Legs", secondaryMuscles: [], category: "Legs" },
  { id: "leg-extension", name: "Leg Extension", primaryMuscle: "Legs", secondaryMuscles: [], category: "Legs" },
  { id: "calf-raise", name: "Calf Raise", primaryMuscle: "Legs", secondaryMuscles: [], category: "Legs" },

  // Arms
  { id: "barbell-curl", name: "Barbell Curl", primaryMuscle: "Arms", secondaryMuscles: [], category: "Arms" },
  { id: "dumbbell-curl", name: "Dumbbell Curl", primaryMuscle: "Arms", secondaryMuscles: [], category: "Arms" },
  { id: "hammer-curl", name: "Hammer Curl", primaryMuscle: "Arms", secondaryMuscles: [], category: "Arms" },
  { id: "tricep-pushdown", name: "Tricep Pushdown", primaryMuscle: "Arms", secondaryMuscles: [], category: "Arms" },
  { id: "skull-crusher", name: "Skull Crusher", primaryMuscle: "Arms", secondaryMuscles: [], category: "Arms" },
  { id: "dips", name: "Dips", primaryMuscle: "Arms", secondaryMuscles: ["Chest", "Shoulders"], category: "Arms" },

  // Shoulders
  { id: "overhead-press", name: "Overhead Press", aka: "OHP", primaryMuscle: "Shoulders", secondaryMuscles: ["Arms", "Core"], category: "Shoulders" },
  { id: "dumbbell-shoulder-press", name: "Dumbbell Shoulder Press", primaryMuscle: "Shoulders", secondaryMuscles: ["Arms"], category: "Shoulders" },
  { id: "lateral-raise", name: "Lateral Raise", primaryMuscle: "Shoulders", secondaryMuscles: [], category: "Shoulders" },
  { id: "rear-delt-fly", name: "Rear Delt Fly", primaryMuscle: "Shoulders", secondaryMuscles: ["Back"], category: "Shoulders" },
  { id: "upright-row", name: "Upright Row", primaryMuscle: "Shoulders", secondaryMuscles: ["Arms", "Back"], category: "Shoulders" },

  // Full Body
  { id: "clean-and-press", name: "Clean and Press", primaryMuscle: "Full Body", secondaryMuscles: ["Legs", "Back", "Shoulders", "Arms", "Core"], category: "Full Body" },
  { id: "kettlebell-swing", name: "Kettlebell Swing", primaryMuscle: "Full Body", secondaryMuscles: ["Glutes", "Legs", "Core"], category: "Full Body" },
  { id: "burpee", name: "Burpee", primaryMuscle: "Full Body", secondaryMuscles: ["Legs", "Chest", "Core", "Arms"], category: "Full Body" },
  { id: "thruster", name: "Thruster", primaryMuscle: "Full Body", secondaryMuscles: ["Legs", "Shoulders", "Arms", "Core"], category: "Full Body" }
];
