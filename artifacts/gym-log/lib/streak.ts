import type { Workout } from "./types";

function localDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Number of consecutive calendar days, ending today or yesterday, on which
 * at least one completed workout (endedAt != null) was finished.
 *
 * Today is included only if a workout was completed today. Otherwise the
 * streak is computed ending at yesterday so a streak does not "break" until
 * the day finishes without a session.
 */
export function computeStreak(workouts: Workout[], reference: Date = new Date()): number {
  const completedDays = new Set<string>();
  for (const w of workouts) {
    if (w.endedAt == null) continue;
    completedDays.add(localDateKey(w.endedAt));
  }
  if (completedDays.size === 0) return 0;

  let cursor = new Date(reference);
  cursor.setHours(0, 0, 0, 0);

  if (!completedDays.has(localDateKey(cursor.getTime()))) {
    cursor = addDays(cursor, -1);
    if (!completedDays.has(localDateKey(cursor.getTime()))) {
      return 0;
    }
  }

  let streak = 0;
  while (completedDays.has(localDateKey(cursor.getTime()))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
