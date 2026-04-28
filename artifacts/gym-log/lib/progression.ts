import type { Workout } from "./types";

export type LastPerformance = {
  weight: number;
  reps: number;
  date: number;
};

export type Suggestion = {
  weight: number;
  reps: number;
  hint: string;
};

export function getLastPerformance(
  workouts: Workout[],
  exerciseId: string,
): LastPerformance | null {
  const sorted = [...workouts].sort((a, b) => b.startedAt - a.startedAt);
  for (const w of sorted) {
    for (const we of w.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      const completed = we.sets.filter(
        (s) => s.done && s.weight !== null && s.reps !== null,
      );
      if (completed.length === 0) continue;
      const top = completed.reduce((best, s) =>
        (s.weight ?? 0) > (best.weight ?? 0) ? s : best,
      );
      return {
        weight: top.weight ?? 0,
        reps: top.reps ?? 0,
        date: w.startedAt,
      };
    }
  }
  return null;
}

export function suggestNext(last: LastPerformance | null): Suggestion {
  if (!last) {
    return { weight: 0, reps: 8, hint: "First time. Start light, learn the form." };
  }
  if (last.reps >= 10) {
    const next = Math.round((last.weight + 2.5) * 2) / 2;
    return {
      weight: next,
      reps: 8,
      hint: "Hit " + last.reps + " reps last time. Bump weight up.",
    };
  }
  if (last.reps >= 6) {
    return {
      weight: last.weight,
      reps: last.reps + 1,
      hint: "Match weight, push for one more rep.",
    };
  }
  return {
    weight: last.weight,
    reps: last.reps,
    hint: "Repeat last session. Lock in the form.",
  };
}

export function workoutVolume(workout: Workout): number {
  let total = 0;
  for (const we of workout.exercises) {
    for (const s of we.sets) {
      if (s.done && s.weight !== null && s.reps !== null) {
        total += s.weight * s.reps;
      }
    }
  }
  return total;
}

export function workoutDurationMinutes(workout: Workout): number {
  if (!workout.endedAt) return 0;
  return Math.max(0, Math.round((workout.endedAt - workout.startedAt) / 60000));
}
