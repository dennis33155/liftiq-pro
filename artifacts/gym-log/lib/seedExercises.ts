import type { Exercise } from "./types";

export const SEED_EXERCISES: Exercise[] = [
  // Chest
  { id: "ex_bench", name: "Barbell Bench Press", category: "Chest" },
  { id: "ex_inc_db", name: "Incline Dumbbell Press", category: "Chest" },
  { id: "ex_cable_fly", name: "Cable Fly", category: "Chest" },
  { id: "ex_pushup", name: "Push Up", category: "Chest" },
  { id: "ex_dips_chest", name: "Chest Dip", category: "Chest" },
  { id: "ex_machine_press", name: "Machine Chest Press", category: "Chest" },

  // Back
  { id: "ex_pullup", name: "Pull Up", category: "Back" },
  { id: "ex_deadlift", name: "Deadlift", category: "Back" },
  { id: "ex_bb_row", name: "Barbell Row", category: "Back" },
  { id: "ex_lat_pull", name: "Lat Pulldown", category: "Back" },
  { id: "ex_seated_row", name: "Seated Cable Row", category: "Back" },
  { id: "ex_db_row", name: "One-Arm Dumbbell Row", category: "Back" },
  { id: "ex_face_pull", name: "Face Pull", category: "Back" },

  // Legs
  { id: "ex_squat", name: "Back Squat", category: "Legs" },
  { id: "ex_front_squat", name: "Front Squat", category: "Legs" },
  { id: "ex_leg_press", name: "Leg Press", category: "Legs" },
  { id: "ex_rdl", name: "Romanian Deadlift", category: "Legs" },
  { id: "ex_leg_ext", name: "Leg Extension", category: "Legs" },
  { id: "ex_leg_curl", name: "Leg Curl", category: "Legs" },
  { id: "ex_lunges", name: "Walking Lunges", category: "Legs" },
  { id: "ex_calf", name: "Standing Calf Raise", category: "Legs" },

  // Arms
  { id: "ex_bb_curl", name: "Barbell Curl", category: "Arms" },
  { id: "ex_db_curl", name: "Dumbbell Curl", category: "Arms" },
  { id: "ex_hammer", name: "Hammer Curl", category: "Arms" },
  { id: "ex_preacher", name: "Preacher Curl", category: "Arms" },
  { id: "ex_tri_pushdown", name: "Triceps Pushdown", category: "Arms" },
  { id: "ex_skull", name: "Skull Crusher", category: "Arms" },
  { id: "ex_overhead_tri", name: "Overhead Triceps Extension", category: "Arms" },
  { id: "ex_dips_tri", name: "Triceps Dip", category: "Arms" },

  // Shoulders
  { id: "ex_ohp", name: "Overhead Press", category: "Shoulders" },
  { id: "ex_db_press_sh", name: "Dumbbell Shoulder Press", category: "Shoulders" },
  { id: "ex_lat_raise", name: "Lateral Raise", category: "Shoulders" },
  { id: "ex_front_raise", name: "Front Raise", category: "Shoulders" },
  { id: "ex_rear_delt", name: "Rear Delt Fly", category: "Shoulders" },
  { id: "ex_arnold", name: "Arnold Press", category: "Shoulders" },
  { id: "ex_shrug", name: "Barbell Shrug", category: "Shoulders" },

  // Full Body
  { id: "ex_clean", name: "Power Clean", category: "Full Body" },
  { id: "ex_thruster", name: "Thruster", category: "Full Body" },
  { id: "ex_burpee", name: "Burpee", category: "Full Body" },
  { id: "ex_kb_swing", name: "Kettlebell Swing", category: "Full Body" },
  { id: "ex_clean_press", name: "Clean and Press", category: "Full Body" },
  { id: "ex_turkish", name: "Turkish Get Up", category: "Full Body" },
];
