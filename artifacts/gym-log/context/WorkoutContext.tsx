import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ActivityIndicator, View } from "react-native";

import {
  clearAll as storageClearAll,
  loadActiveWorkout,
  loadCustomExercises,
  loadWorkouts,
  makeId,
  saveActiveWorkout,
  saveCustomExercises,
  saveWorkouts,
} from "@/lib/storage";
import { buildSuggestedWorkout } from "@/lib/recommendation";
import { SEED_EXERCISES } from "@/lib/seedExercises";
import type {
  Category,
  Exercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from "@/lib/types";

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
};

const WorkoutCtx = createContext<Ctx | null>(null);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [active, setActive] = useState<Workout | null>(null);

  useEffect(() => {
    (async () => {
      const [w, c, a] = await Promise.all([
        loadWorkouts(),
        loadCustomExercises(),
        loadActiveWorkout(),
      ]);
      setWorkouts(w);
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

  const startWorkout = useCallback((category: Category): Workout => {
    const newWorkout: Workout = {
      id: makeId(),
      category,
      startedAt: Date.now(),
      endedAt: null,
      exercises: [],
    };
    setActive(newWorkout);
    return newWorkout;
  }, []);

  const endWorkout = useCallback(() => {
    setActive((curr) => {
      if (!curr) return null;
      const finished: Workout = { ...curr, endedAt: Date.now() };
      setWorkouts((prev) => [finished, ...prev]);
      return null;
    });
  }, []);

  const cancelWorkout = useCallback(() => {
    setActive(null);
  }, []);

  const addExerciseToActive = useCallback((exerciseId: string) => {
    setActive((curr) => {
      if (!curr) return curr;
      if (curr.exercises.some((e) => e.exerciseId === exerciseId)) return curr;
      const we: WorkoutExercise = {
        id: makeId(),
        exerciseId,
        sets: [
          { id: makeId(), weight: null, reps: null, done: false },
        ],
      };
      return { ...curr, exercises: [...curr.exercises, we] };
    });
  }, []);

  const populateSuggested = useCallback(
    (count: number = 5) => {
      setActive((curr) => {
        if (!curr) return curr;
        const suggestions = buildSuggestedWorkout(
          [...SEED_EXERCISES, ...customExercises],
          curr.category,
          workouts,
          count,
        );
        const existingIds = new Set(curr.exercises.map((e) => e.exerciseId));
        const additions: WorkoutExercise[] = suggestions
          .filter((s) => !existingIds.has(s.id))
          .map((s) => ({
            id: makeId(),
            exerciseId: s.id,
            sets: [{ id: makeId(), weight: null, reps: null, done: false }],
          }));
        return { ...curr, exercises: [...curr.exercises, ...additions] };
      });
    },
    [customExercises, workouts],
  );

  const startSuggestedWorkout = useCallback(
    (category: Category, count: number = 5): Workout => {
      const suggestions = buildSuggestedWorkout(
        [...SEED_EXERCISES, ...customExercises],
        category,
        workouts,
        count,
      );
      const exercises: WorkoutExercise[] = suggestions.map((s) => ({
        id: makeId(),
        exerciseId: s.id,
        sets: [{ id: makeId(), weight: null, reps: null, done: false }],
      }));
      const newWorkout: Workout = {
        id: makeId(),
        category,
        startedAt: Date.now(),
        endedAt: null,
        exercises,
      };
      setActive(newWorkout);
      return newWorkout;
    },
    [customExercises, workouts],
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
      removeExerciseFromActive,
      addSetToExercise,
      removeSet,
      updateSet,
      addCustomExercise,
      deleteCustomExercise,
      deleteWorkout,
      clearAllData,
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
      removeExerciseFromActive,
      addSetToExercise,
      removeSet,
      updateSet,
      addCustomExercise,
      deleteCustomExercise,
      deleteWorkout,
      clearAllData,
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
        <ActivityIndicator color="#dc2626" />
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
