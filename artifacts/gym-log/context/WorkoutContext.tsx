import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, View } from "react-native";

import {
  clearAll as storageClearAll,
  loadActiveWorkout,
  loadCustomExercises,
  loadPRSeedDone,
  loadWorkouts,
  makeId,
  markPRSeedDone,
  saveActiveWorkout,
  saveCustomExercises,
  saveWorkouts,
} from "@/lib/storage";
import { buildPRSeedWorkouts } from "@/lib/initialPRSeed";
import { requestWorkoutSuggestion, type AiSuggestedExercise } from "@/lib/api";
import {
  checkPRBeat,
  snapshotExercisePR,
  type PRBeat,
} from "@/lib/prDetection";
import { buildSuggestedWorkout } from "@/lib/recommendation";
import {
  CATEGORY_DEFAULT_EXERCISES,
  FINISHER_EXERCISE_IDS,
  WARMUP_EXERCISE_IDS,
  WARMUP_PRESETS,
} from "@/lib/schedule";
import { SEED_EXERCISES } from "@/lib/seedExercises";
import type {
  Category,
  Exercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from "@/lib/types";

export type PendingPR = {
  beat: PRBeat;
  exerciseName: string;
};

type Ctx = {
  loaded: boolean;
  workouts: Workout[];
  customExercises: Exercise[];
  allExercises: Exercise[];
  active: Workout | null;
  startWorkout: (category: Category) => Workout;
  endWorkout: () => void;
  cancelWorkout: () => void;
  addExerciseToActive: (exerciseId: string) => void;
  populateSuggested: (count?: number) => void;
  startSuggestedWorkout: (category: Category, count?: number) => Workout;
  startAiWorkout: (
    category: Category,
    options?: { count?: number; notes?: string },
  ) => Promise<{ workout: Workout; rationale: string }>;
  removeExerciseFromActive: (workoutExerciseId: string) => void;
  addSetToExercise: (workoutExerciseId: string) => void;
  removeSet: (workoutExerciseId: string, setId: string) => void;
  updateSet: (
    workoutExerciseId: string,
    setId: string,
    patch: Partial<WorkoutSet>,
  ) => void;
  addCustomExercise: (name: string, category: Category) => Exercise;
  deleteCustomExercise: (id: string) => void;
  deleteWorkout: (id: string) => void;
  clearAllData: () => Promise<void>;
  pendingPR: PendingPR | null;
  clearPendingPR: () => void;
};

const WorkoutCtx = createContext<Ctx | null>(null);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [active, setActive] = useState<Workout | null>(null);
  const [pendingPR, setPendingPR] = useState<PendingPR | null>(null);
  const clearPendingPR = useCallback(() => setPendingPR(null), []);

  useEffect(() => {
    (async () => {
      const [w, c, a, prSeedDone] = await Promise.all([
        loadWorkouts(),
        loadCustomExercises(),
        loadActiveWorkout(),
        loadPRSeedDone(),
      ]);

      let initialWorkouts = w;
      if (!prSeedDone) {
        const seeded = buildPRSeedWorkouts();
        const merged = [...seeded, ...w];
        merged.sort((a, b) => b.startedAt - a.startedAt);
        initialWorkouts = merged;
        await saveWorkouts(merged);
        await markPRSeedDone();
      }

      setWorkouts(initialWorkouts);
      setCustomExercises(c);
      setActive(a);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) saveWorkouts(workouts);
  }, [workouts, loaded]);

  useEffect(() => {
    if (loaded) saveCustomExercises(customExercises);
  }, [customExercises, loaded]);

  useEffect(() => {
    if (loaded) saveActiveWorkout(active);
  }, [active, loaded]);

  const allExercises = useMemo<Exercise[]>(
    () => [...SEED_EXERCISES, ...customExercises],
    [customExercises],
  );

  const makeWorkoutExercise = useCallback(
    (
      exerciseId: string,
      preset?: { weight: number | null; reps: number | null },
    ): WorkoutExercise => ({
      id: makeId(),
      exerciseId,
      sets: [
        {
          id: makeId(),
          weight: preset?.weight ?? null,
          reps: preset?.reps ?? null,
          done: false,
        },
      ],
    }),
    [],
  );

  const buildFinisherBlocks = useCallback((): WorkoutExercise[] => {
    return FINISHER_EXERCISE_IDS.filter((id) =>
      [...SEED_EXERCISES, ...customExercises].some((e) => e.id === id),
    ).map((id) => makeWorkoutExercise(id));
  }, [customExercises, makeWorkoutExercise]);

  const buildCategoryDefaultBlocks = useCallback(
    (category: Category): WorkoutExercise[] => {
      const ids = CATEGORY_DEFAULT_EXERCISES[category] ?? [];
      const pool = [...SEED_EXERCISES, ...customExercises];
      return ids
        .filter((id) => pool.some((e) => e.id === id))
        .map((id) => makeWorkoutExercise(id));
    },
    [customExercises, makeWorkoutExercise],
  );

  const insertBeforeFinisher = useCallback(
    (
      exercises: WorkoutExercise[],
      additions: WorkoutExercise[],
    ): WorkoutExercise[] => {
      if (additions.length === 0) return exercises;
      const finisherSet = new Set(FINISHER_EXERCISE_IDS);
      const idx = exercises.findIndex((e) => finisherSet.has(e.exerciseId));
      if (idx === -1) return [...exercises, ...additions];
      return [
        ...exercises.slice(0, idx),
        ...additions,
        ...exercises.slice(idx),
      ];
    },
    [],
  );

  const startWorkout = useCallback(
    (category: Category): Workout => {
      const exercises = [
        ...buildCategoryDefaultBlocks(category),
        ...buildFinisherBlocks(),
      ];
      const newWorkout: Workout = {
        id: makeId(),
        category,
        startedAt: Date.now(),
        endedAt: null,
        exercises,
      };
      setPendingPR(null);
      setActive(newWorkout);
      return newWorkout;
    },
    [buildCategoryDefaultBlocks, buildFinisherBlocks],
  );

  const endWorkout = useCallback(() => {
    setPendingPR(null);
    setActive((curr) => {
      if (!curr) return null;
      const finished: Workout = { ...curr, endedAt: Date.now() };
      setWorkouts((prev) => [finished, ...prev]);
      return null;
    });
  }, []);

  const cancelWorkout = useCallback(() => {
    setPendingPR(null);
    setActive(null);
  }, []);

  const addExerciseToActive = useCallback(
    (exerciseId: string) => {
      setActive((curr) => {
        if (!curr) return curr;
        if (curr.exercises.some((e) => e.exerciseId === exerciseId)) return curr;
        const we = makeWorkoutExercise(exerciseId);
        return {
          ...curr,
          exercises: insertBeforeFinisher(curr.exercises, [we]),
        };
      });
    },
    [insertBeforeFinisher, makeWorkoutExercise],
  );

  const populateSuggested = useCallback(
    (count: number = 5) => {
      setActive((curr) => {
        if (!curr) return curr;
        const existingIds = new Set(curr.exercises.map((e) => e.exerciseId));
        const exclude = [
          ...WARMUP_EXERCISE_IDS,
          ...FINISHER_EXERCISE_IDS,
          ...curr.exercises.map((e) => e.exerciseId),
        ];
        const suggestions = buildSuggestedWorkout(
          [...SEED_EXERCISES, ...customExercises],
          curr.category,
          workouts,
          count,
          exclude,
        );
        const additions: WorkoutExercise[] = suggestions
          .filter((s) => !existingIds.has(s.id))
          .map((s) => makeWorkoutExercise(s.id));
        return {
          ...curr,
          exercises: insertBeforeFinisher(curr.exercises, additions),
        };
      });
    },
    [customExercises, workouts, makeWorkoutExercise, insertBeforeFinisher],
  );

  const buildWorkoutExerciseFromAi = useCallback(
    (s: AiSuggestedExercise): WorkoutExercise => ({
      id: makeId(),
      exerciseId: s.exerciseId,
      sets: Array.from({ length: Math.max(1, Math.min(8, s.sets)) }, () => ({
        id: makeId(),
        weight: null,
        reps: s.reps,
        done: false,
      })),
    }),
    [],
  );

  const startAiWorkout = useCallback(
    async (
      category: Category,
      options?: { count?: number; notes?: string },
    ): Promise<{ workout: Workout; rationale: string }> => {
      const pool = [...SEED_EXERCISES, ...customExercises];
      const excludeSet = new Set([
        ...WARMUP_EXERCISE_IDS,
        ...FINISHER_EXERCISE_IDS,
      ]);
      const available = pool
        .filter((e) => !excludeSet.has(e.id))
        .filter((e) => e.category === category || e.category === "Full Body")
        .map((e) => ({
          id: e.id,
          name: e.name,
          category: e.category,
          primaryMuscles: e.primaryMuscles,
          equipment: e.equipment,
        }));

      const recent = workouts.slice(0, 5).map((w) => ({
        date: new Date(w.startedAt).toISOString().slice(0, 10),
        category: w.category,
        exerciseNames: w.exercises
          .filter((we) => !excludeSet.has(we.exerciseId))
          .map(
            (we) =>
              pool.find((p) => p.id === we.exerciseId)?.name ?? we.exerciseId,
          ),
      }));

      const result = await requestWorkoutSuggestion({
        category,
        count: options?.count ?? 5,
        notes: options?.notes,
        recentWorkouts: recent,
        availableExercises: available,
      });

      const validIds = new Set(available.map((a) => a.id));
      const seen = new Set<string>();
      const aiBlocks = result.exercises
        .filter((s) => {
          if (!validIds.has(s.exerciseId)) return false;
          if (seen.has(s.exerciseId)) return false;
          seen.add(s.exerciseId);
          return true;
        })
        .map(buildWorkoutExerciseFromAi);

      if (aiBlocks.length < 2) {
        throw new Error(
          "AI returned too few exercises. Try again or use Suggest.",
        );
      }

      const finisher = buildFinisherBlocks();
      const newWorkout: Workout = {
        id: makeId(),
        category,
        startedAt: Date.now(),
        endedAt: null,
        exercises: [...aiBlocks, ...finisher],
      };
      setPendingPR(null);
      setActive(newWorkout);
      return { workout: newWorkout, rationale: result.rationale };
    },
    [
      customExercises,
      workouts,
      buildFinisherBlocks,
      buildWorkoutExerciseFromAi,
    ],
  );

  const startSuggestedWorkout = useCallback(
    (category: Category, count: number = 5): Workout => {
      const finisher = buildFinisherBlocks();
      const exclude = [...WARMUP_EXERCISE_IDS, ...FINISHER_EXERCISE_IDS];
      const suggestions = buildSuggestedWorkout(
        [...SEED_EXERCISES, ...customExercises],
        category,
        workouts,
        count,
        exclude,
      );
      const mains: WorkoutExercise[] = suggestions.map((s) =>
        makeWorkoutExercise(s.id),
      );
      const newWorkout: Workout = {
        id: makeId(),
        category,
        startedAt: Date.now(),
        endedAt: null,
        exercises: [...mains, ...finisher],
      };
      setPendingPR(null);
      setActive(newWorkout);
      return newWorkout;
    },
    [
      customExercises,
      workouts,
      buildFinisherBlocks,
      makeWorkoutExercise,
    ],
  );

  const removeExerciseFromActive = useCallback(
    (workoutExerciseId: string) => {
      setActive((curr) => {
        if (!curr) return curr;
        return {
          ...curr,
          exercises: curr.exercises.filter((e) => e.id !== workoutExerciseId),
        };
      });
    },
    [],
  );

  const addSetToExercise = useCallback((workoutExerciseId: string) => {
    setActive((curr) => {
      if (!curr) return curr;
      return {
        ...curr,
        exercises: curr.exercises.map((e) => {
          if (e.id !== workoutExerciseId) return e;
          const last = e.sets[e.sets.length - 1];
          return {
            ...e,
            sets: [
              ...e.sets,
              {
                id: makeId(),
                weight: last?.weight ?? null,
                reps: last?.reps ?? null,
                done: false,
              },
            ],
          };
        }),
      };
    });
  }, []);

  const removeSet = useCallback(
    (workoutExerciseId: string, setId: string) => {
      setActive((curr) => {
        if (!curr) return curr;
        return {
          ...curr,
          exercises: curr.exercises.map((e) =>
            e.id !== workoutExerciseId
              ? e
              : { ...e, sets: e.sets.filter((s) => s.id !== setId) },
          ),
        };
      });
    },
    [],
  );

  const updateSet = useCallback(
    (
      workoutExerciseId: string,
      setId: string,
      patch: Partial<WorkoutSet>,
    ) => {
      setActive((curr) => {
        if (!curr) return curr;
        return {
          ...curr,
          exercises: curr.exercises.map((e) =>
            e.id !== workoutExerciseId
              ? e
              : {
                  ...e,
                  sets: e.sets.map((s) =>
                    s.id !== setId ? s : { ...s, ...patch },
                  ),
                },
          ),
        };
      });
    },
    [],
  );

  // Detect newly-completed sets that beat the current PR by diffing the
  // previous active workout against the latest one. Runs purely off
  // committed state, so it is StrictMode-safe and never fires inside a
  // state-updater body.
  const prevActiveRef = useRef<Workout | null>(null);
  useEffect(() => {
    const prev = prevActiveRef.current;
    prevActiveRef.current = active;

    // Only consider transitions within the same active workout. Starting,
    // ending, or cancelling a workout never produces a celebration.
    if (!active || !prev || prev.id !== active.id) return;

    for (const we of active.exercises) {
      const prevWe = prev.exercises.find((e) => e.id === we.id);
      if (!prevWe) continue;
      for (const s of we.sets) {
        if (!s.done) continue;
        const prevSet = prevWe.sets.find((ps) => ps.id === s.id);
        if (prevSet?.done) continue; // already done before this commit
        // Newly completed set — check against PRs using the prior state so
        // this set's contribution is excluded from the baseline.
        const snap = snapshotExercisePR(workouts, prev, we.exerciseId, s.id);
        const beat = checkPRBeat(snap, s.weight, s.reps);
        if (beat) {
          const ex = allExercises.find((e) => e.id === we.exerciseId);
          const exerciseName = ex?.name ?? "Exercise";
          setPendingPR((existing) =>
            existing ? existing : { beat, exerciseName },
          );
          return; // surface at most one celebration per commit
        }
      }
    }
  }, [active, workouts, allExercises]);

  const addCustomExercise = useCallback(
    (name: string, category: Category): Exercise => {
      const ex: Exercise = {
        id: "custom_" + makeId(),
        name: name.trim(),
        category,
        isCustom: true,
      };
      setCustomExercises((prev) => [...prev, ex]);
      return ex;
    },
    [],
  );

  const deleteCustomExercise = useCallback((id: string) => {
    setCustomExercises((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const deleteWorkout = useCallback((id: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const clearAllData = useCallback(async () => {
    await storageClearAll();
    setWorkouts([]);
    setCustomExercises([]);
    setActive(null);
    setPendingPR(null);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      loaded,
      workouts,
      customExercises,
      allExercises,
      active,
      startWorkout,
      endWorkout,
      cancelWorkout,
      addExerciseToActive,
      populateSuggested,
      startSuggestedWorkout,
      startAiWorkout,
      removeExerciseFromActive,
      addSetToExercise,
      removeSet,
      updateSet,
      addCustomExercise,
      deleteCustomExercise,
      deleteWorkout,
      clearAllData,
      pendingPR,
      clearPendingPR,
    }),
    [
      loaded,
      workouts,
      customExercises,
      allExercises,
      active,
      startWorkout,
      endWorkout,
      cancelWorkout,
      addExerciseToActive,
      populateSuggested,
      startSuggestedWorkout,
      startAiWorkout,
      removeExerciseFromActive,
      addSetToExercise,
      removeSet,
      updateSet,
      addCustomExercise,
      deleteCustomExercise,
      deleteWorkout,
      clearAllData,
      pendingPR,
      clearPendingPR,
    ],
  );

  if (!loaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0a0a0a",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#2979FF" />
      </View>
    );
  }

  return <WorkoutCtx.Provider value={value}>{children}</WorkoutCtx.Provider>;
}

export function useWorkout(): Ctx {
  const ctx = useContext(WorkoutCtx);
  if (!ctx) throw new Error("useWorkout must be used inside WorkoutProvider");
  return ctx;
}
