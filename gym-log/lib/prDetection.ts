import type { Workout, WorkoutExercise } from "./types";

export type PRSnapshot = {
  exerciseId: string;
  bestWeight: number;
  bestReps: number;
  prevDate: number | null;
  hasAnyHistory: boolean;
};

export type PRBeat = {
  exerciseId: string;
  newWeight: number;
  newReps: number;
  prevWeight: number;
  prevReps: number;
  prevDate: number | null;
  reason: "weight" | "reps";
};

/**
 * Snapshot the current best (weight, reps) across:
 *   - all completed workouts (endedAt != null)
 *   - completed sets within the active workout, optionally excluding one set id
 *
 * Best is defined by the spec semantics used for celebration:
 *   1. higher weight wins
 *   2. tie on weight, more reps wins
 *
 * Sets with missing weight or reps are ignored.
 */
export function snapshotExercisePR(
  history: Workout[],
  active: Workout | null,
  exerciseId: string,
  excludeSetId?: string,
): PRSnapshot {
  let bestWeight = 0;
  let bestReps = 0;
  let prevDate: number | null = null;
  let any = false;

  const considerSet = (
    weight: number | null | undefined,
    reps: number | null | undefined,
    ts: number,
  ): void => {
    if (weight == null || reps == null) return;
    if (weight <= 0 || reps <= 0) return;
    any = true;
    const beats =
      weight > bestWeight || (weight === bestWeight && reps > bestReps);
    if (beats) {
      bestWeight = weight;
      bestReps = reps;
      prevDate = ts;
    }
  };

  for (const w of history) {
    if (w.endedAt == null) continue;
    for (const we of w.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const s of we.sets) {
        if (!s.done) continue;
        considerSet(s.weight, s.reps, w.endedAt ?? w.startedAt);
      }
    }
  }

  if (active) {
    for (const we of active.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const s of we.sets) {
        if (!s.done) continue;
        if (excludeSetId != null && s.id === excludeSetId) continue;
        considerSet(s.weight, s.reps, active.startedAt);
      }
    }
  }

  return {
    exerciseId,
    bestWeight,
    bestReps,
    prevDate,
    hasAnyHistory: any,
  };
}

/**
 * Returns a PRBeat description if (newWeight, newReps) beats the snapshot,
 * else null. Requires a meaningful history baseline; for a brand new
 * exercise we don't celebrate (otherwise every first set would trigger).
 */
export function checkPRBeat(
  snapshot: PRSnapshot,
  newWeight: number | null,
  newReps: number | null,
): PRBeat | null {
  if (!snapshot.hasAnyHistory) return null;
  if (newWeight == null || newReps == null) return null;
  if (newWeight <= 0 || newReps <= 0) return null;

  if (newWeight > snapshot.bestWeight) {
    return {
      exerciseId: snapshot.exerciseId,
      newWeight,
      newReps,
      prevWeight: snapshot.bestWeight,
      prevReps: snapshot.bestReps,
      prevDate: snapshot.prevDate,
      reason: "weight",
    };
  }
  if (newWeight === snapshot.bestWeight && newReps > snapshot.bestReps) {
    return {
      exerciseId: snapshot.exerciseId,
      newWeight,
      newReps,
      prevWeight: snapshot.bestWeight,
      prevReps: snapshot.bestReps,
      prevDate: snapshot.prevDate,
      reason: "reps",
    };
  }
  return null;
}

/**
 * Convenience: find the WorkoutExercise that owns a given set in the active
 * workout, returning {workoutExerciseId, exerciseId} or null.
 */
export function findOwningExercise(
  active: Workout,
  workoutExerciseId: string,
): WorkoutExercise | null {
  return active.exercises.find((e) => e.id === workoutExerciseId) ?? null;
}
