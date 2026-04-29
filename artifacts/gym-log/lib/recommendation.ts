import type { Category, Exercise, Workout } from "./types";

export type ExerciseUsage = {
  exerciseId: string;
  lastUsed: number | null;
  totalSets: number;
};

export function buildExerciseUsage(
  workouts: Workout[],
): Map<string, ExerciseUsage> {
  const map = new Map<string, ExerciseUsage>();
  for (const w of workouts) {
    for (const we of w.exercises) {
      const setCount = we.sets.filter((s) => s.done).length;
      if (setCount === 0) continue;
      const existing = map.get(we.exerciseId);
      if (!existing) {
        map.set(we.exerciseId, {
          exerciseId: we.exerciseId,
          lastUsed: w.startedAt,
          totalSets: setCount,
        });
      } else {
        existing.totalSets += setCount;
        if (w.startedAt > (existing.lastUsed ?? 0)) {
          existing.lastUsed = w.startedAt;
        }
      }
    }
  }
  return map;
}

/**
 * Score an exercise for "freshness" recommendation. Higher = better candidate.
 * Never-used exercises get the highest score. Long-unused next.
 * Recently-used exercises get pushed down.
 */
function freshnessScore(
  exerciseId: string,
  usage: Map<string, ExerciseUsage>,
  now: number,
): number {
  const u = usage.get(exerciseId);
  if (!u || u.lastUsed === null) return 1_000_000;
  const daysSince = (now - u.lastUsed) / (1000 * 60 * 60 * 24);
  return daysSince - Math.min(u.totalSets, 30) * 0.1;
}

/**
 * Recommend exercises in a category that the user hasn't done recently.
 * Returns up to `limit` exercises sorted by freshness.
 */
export function recommendExercises(
  exercises: Exercise[],
  category: Category | "All",
  workouts: Workout[],
  limit = 5,
): Exercise[] {
  const usage = buildExerciseUsage(workouts);
  const now = Date.now();
  const inCat =
    category === "All"
      ? exercises
      : exercises.filter((e) => e.category === category);
  const scored = inCat
    .map((e) => ({ exercise: e, score: freshnessScore(e.id, usage, now) }))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.exercise);
}

/**
 * Build a complete suggested workout for a category.
 * Picks a spread of exercises:
 *  - 1-2 compound lifts (barbell preferred)
 *  - 2-3 accessory lifts
 *  - 1 isolation finisher
 * Falls back gracefully if metadata is missing.
 */
export function buildSuggestedWorkout(
  exercises: Exercise[],
  category: Category,
  workouts: Workout[],
  totalCount = 5,
): Exercise[] {
  const inCat = exercises.filter((e) => e.category === category);
  if (inCat.length === 0) return [];

  const usage = buildExerciseUsage(workouts);
  const now = Date.now();

  const isCompound = (e: Exercise) =>
    e.equipment === "Barbell" ||
    (e.primaryMuscles?.length ?? 0) >= 2 ||
    /press|squat|deadlift|row|clean|pull up|chin up|dip/i.test(e.name);

  const compounds = inCat
    .filter(isCompound)
    .map((e) => ({ exercise: e, score: freshnessScore(e.id, usage, now) }))
    .sort((a, b) => b.score - a.score);

  const accessories = inCat
    .filter((e) => !isCompound(e))
    .map((e) => ({ exercise: e, score: freshnessScore(e.id, usage, now) }))
    .sort((a, b) => b.score - a.score);

  const picked: Exercise[] = [];
  const seen = new Set<string>();

  const take = (e: Exercise) => {
    if (seen.has(e.id)) return;
    picked.push(e);
    seen.add(e.id);
  };

  for (const c of compounds.slice(0, 2)) take(c.exercise);
  for (const a of accessories.slice(0, totalCount - picked.length)) {
    if (picked.length >= totalCount) break;
    take(a.exercise);
  }
  // Top up with anything else in category if still short
  if (picked.length < totalCount) {
    const rest = inCat
      .filter((e) => !seen.has(e.id))
      .map((e) => ({ exercise: e, score: freshnessScore(e.id, usage, now) }))
      .sort((a, b) => b.score - a.score);
    for (const r of rest) {
      if (picked.length >= totalCount) break;
      take(r.exercise);
    }
  }
  return picked;
}

export function describeFreshness(
  exerciseId: string,
  workouts: Workout[],
): string {
  const usage = buildExerciseUsage(workouts);
  const u = usage.get(exerciseId);
  if (!u || u.lastUsed === null) return "New for you";
  const days = Math.floor((Date.now() - u.lastUsed) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Done today";
  if (days === 1) return "Done yesterday";
  if (days < 7) return "Done " + days + " days ago";
  if (days < 30) return "Done " + Math.floor(days / 7) + "w ago";
  return "Done " + Math.floor(days / 30) + "mo ago";
}
