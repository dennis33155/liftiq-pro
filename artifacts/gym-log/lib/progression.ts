import { formatWeightLabel } from "./format";
import type { Workout } from "./types";

export type LastPerformance = {
  weight: number;
  reps: number;
  date: number;
};

export type PersonalBest = {
  weight: number;
  reps: number;
  date: number;
};

export type Suggestion = {
  weight: number;
  reps: number;
  repsLow: number;
  repsHigh: number;
  hint: string;
  goal: string;
  isPRAttempt: boolean;
};

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

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

/**
 * Personal best across all logged workouts (and an optional active workout).
 * Higher weight wins; tie on weight, more reps wins.
 */
export function getPersonalBest(
  workouts: Workout[],
  exerciseId: string,
  active?: Workout | null,
): PersonalBest | null {
  let best: PersonalBest | null = null;

  const consider = (
    weight: number | null | undefined,
    reps: number | null | undefined,
    date: number,
  ): void => {
    if (weight == null || reps == null) return;
    if (weight < 0 || reps <= 0) return;
    if (
      best === null ||
      weight > best.weight ||
      (weight === best.weight && reps > best.reps)
    ) {
      best = { weight, reps, date };
    }
  };

  for (const w of workouts) {
    for (const we of w.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const s of we.sets) {
        if (!s.done) continue;
        consider(s.weight, s.reps, w.endedAt ?? w.startedAt);
      }
    }
  }

  if (active) {
    for (const we of active.exercises) {
      if (we.exerciseId !== exerciseId) continue;
      for (const s of we.sets) {
        if (!s.done) continue;
        consider(s.weight, s.reps, active.startedAt);
      }
    }
  }

  return best;
}

/**
 * Smart progressive-overload suggestion.
 *
 * Rules (in order):
 *   1. No history -> start light, learn the form.
 *   2. Last set hit 12+ reps -> bump weight noticeably (~5 lb), target 8-10.
 *   3. Last set matched the PB exactly -> small PR attempt (+2.5 lb,
 *      target reps just below PB reps).
 *   4. Last set under 8 reps -> keep weight, push for more reps.
 *   5. 10-11 reps -> standard +2.5 lb, target 8-10.
 *   6. 8-9 reps -> keep weight, push one more rep before going up.
 */
export function suggestNext(
  last: LastPerformance | null,
  pb: PersonalBest | null = null,
): Suggestion {
  if (!last) {
    return {
      weight: 0,
      reps: 8,
      repsLow: 8,
      repsHigh: 10,
      hint: "First time. Start light, learn the form.",
      goal: "",
      isPRAttempt: false,
    };
  }

  const pbGoal = pb
    ? "Beat " + formatWeightLabel(pb.weight) + " x " + pb.reps
    : "";

  const matchedPB =
    pb !== null && last.weight === pb.weight && last.reps === pb.reps;

  if (last.reps >= 12) {
    const next = roundToHalf(last.weight + 5);
    // If the bump puts us past the PB weight, this is also a PR attempt.
    const willBeatPB = pb !== null && next > pb.weight;
    return {
      weight: next,
      reps: 8,
      repsLow: 8,
      repsHigh: 10,
      hint: "Hit " + last.reps + " reps last time. Time to go heavier.",
      goal: pbGoal,
      isPRAttempt: willBeatPB,
    };
  }

  if (matchedPB) {
    const next = roundToHalf(last.weight + 2.5);
    const lowReps = Math.max(1, last.reps - 4);
    const highReps = Math.max(lowReps, last.reps - 2);
    return {
      weight: next,
      reps: lowReps,
      repsLow: lowReps,
      repsHigh: highReps,
      hint: "You matched your PB. Push past it.",
      goal: pbGoal,
      isPRAttempt: true,
    };
  }

  if (last.reps < 8) {
    return {
      weight: last.weight,
      reps: last.reps + 1,
      repsLow: last.reps + 1,
      repsHigh: last.reps + 2,
      hint: "Stay at this weight. Push for more reps.",
      goal: pbGoal,
      isPRAttempt: false,
    };
  }

  if (last.reps >= 10) {
    const next = roundToHalf(last.weight + 2.5);
    return {
      weight: next,
      reps: 8,
      repsLow: 8,
      repsHigh: 10,
      hint: "Hit " + last.reps + " reps last time. Bump weight up.",
      goal: pbGoal,
      isPRAttempt: false,
    };
  }

  return {
    weight: last.weight,
    reps: last.reps + 1,
    repsLow: last.reps + 1,
    repsHigh: 10,
    hint: "Almost there. One more rep, then add weight next time.",
    goal: pbGoal,
    isPRAttempt: false,
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
