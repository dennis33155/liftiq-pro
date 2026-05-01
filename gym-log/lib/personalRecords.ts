import type { Exercise, Workout } from "./types";

export type PersonalRecord = {
  exerciseId: string;
  exerciseName: string;
  category: string;
  estimated1RM: number;
  bestWeight: number;
  bestReps: number;
  bestDate: number;
  lastWeight: number | null;
  lastReps: number | null;
  lastDate: number | null;
  totalSessions: number;
  totalCompletedSets: number;
};

export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function computePersonalRecords(
  workouts: Workout[],
  exercises: Exercise[],
): PersonalRecord[] {
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  type Acc = Omit<PersonalRecord, "exerciseName" | "category"> & {
    seenSessions: Set<string>;
  };
  const accByExercise = new Map<string, Acc>();

  const completed = workouts.filter((w) => w.endedAt !== null);

  for (const w of completed) {
    for (const we of w.exercises) {
      let acc = accByExercise.get(we.exerciseId);
      if (!acc) {
        acc = {
          exerciseId: we.exerciseId,
          estimated1RM: 0,
          bestWeight: 0,
          bestReps: 0,
          bestDate: 0,
          lastWeight: null,
          lastReps: null,
          lastDate: null,
          totalSessions: 0,
          totalCompletedSets: 0,
          seenSessions: new Set<string>(),
        };
        accByExercise.set(we.exerciseId, acc);
      }
      const completedSets = we.sets.filter(
        (s) => s.done && s.weight != null && s.reps != null,
      );
      if (completedSets.length === 0) continue;
      acc.totalCompletedSets += completedSets.length;
      acc.seenSessions.add(w.id);

      for (const s of completedSets) {
        const weight = s.weight ?? 0;
        const reps = s.reps ?? 0;
        const e1rm = epley1RM(weight, reps);
        if (e1rm > acc.estimated1RM) {
          acc.estimated1RM = e1rm;
          acc.bestWeight = weight;
          acc.bestReps = reps;
          acc.bestDate = w.endedAt ?? w.startedAt;
        }
      }

      const ts = w.endedAt ?? w.startedAt;
      if (acc.lastDate == null || ts > acc.lastDate) {
        const last = completedSets[completedSets.length - 1];
        if (last) {
          acc.lastWeight = last.weight;
          acc.lastReps = last.reps;
          acc.lastDate = ts;
        }
      }
    }
  }

  const records: PersonalRecord[] = [];
  for (const acc of accByExercise.values()) {
    const ex = exerciseById.get(acc.exerciseId);
    if (!ex) continue;
    records.push({
      exerciseId: acc.exerciseId,
      exerciseName: ex.name,
      category: ex.category,
      estimated1RM: Math.round(acc.estimated1RM * 10) / 10,
      bestWeight: acc.bestWeight,
      bestReps: acc.bestReps,
      bestDate: acc.bestDate,
      lastWeight: acc.lastWeight,
      lastReps: acc.lastReps,
      lastDate: acc.lastDate,
      totalSessions: acc.seenSessions.size,
      totalCompletedSets: acc.totalCompletedSets,
    });
  }

  records.sort((a, b) => b.estimated1RM - a.estimated1RM);
  return records;
}

export function topPersonalRecords(
  records: PersonalRecord[],
  n: number,
): PersonalRecord[] {
  return records.slice(0, n);
}
