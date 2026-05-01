import { epley1RM } from "./personalRecords";
import type { Workout } from "./types";

export type ExerciseHistoryPoint = {
  workoutId: string;
  date: number;
  bestWeight: number;
  bestReps: number;
  estimated1RM: number;
  totalVolume: number;
};

/**
 * For a given exerciseId, returns one chart point per completed workout that
 * contained at least one valid completed set, sorted ASC by date.
 *
 * "Best" set is by est-1RM; ties resolved by higher weight then higher reps
 * to match celebration semantics.
 */
export function exerciseHistory(
  workouts: Workout[],
  exerciseId: string,
): ExerciseHistoryPoint[] {
  const points: ExerciseHistoryPoint[] = [];

  for (const w of workouts) {
    if (w.endedAt == null) continue;
    let bestWeight = 0;
    let bestReps = 0;
    let bestE1rm = 0;
    let totalVolume = 0;
    let any = false;

    for (const we of w.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const s of we.sets) {
        if (!s.done) continue;
        if (s.weight == null || s.reps == null) continue;
        if (s.weight <= 0 || s.reps <= 0) continue;
        any = true;
        totalVolume += s.weight * s.reps;
        const e1 = epley1RM(s.weight, s.reps);
        const beats =
          e1 > bestE1rm ||
          (e1 === bestE1rm && s.weight > bestWeight) ||
          (e1 === bestE1rm && s.weight === bestWeight && s.reps > bestReps);
        if (beats) {
          bestE1rm = e1;
          bestWeight = s.weight;
          bestReps = s.reps;
        }
      }
    }

    if (!any) continue;
    points.push({
      workoutId: w.id,
      date: w.endedAt ?? w.startedAt,
      bestWeight,
      bestReps,
      estimated1RM: Math.round(bestE1rm * 10) / 10,
      totalVolume,
    });
  }

  points.sort((a, b) => a.date - b.date);
  return points;
}
