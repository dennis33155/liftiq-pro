import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "gymlog.exerciseImageOverrides.v1";

function pexels(id: number): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200&dpr=2`;
}

export const EXERCISE_IMAGE_URLS: Record<string, string> = {
  ex_bench: pexels(7371361),
  ex_inc_bb: pexels(34651540),
  ex_inc_db: pexels(29526383),
  ex_dec_bench: pexels(3916762),
  ex_db_bench: pexels(7289245),
  ex_db_fly: pexels(14616295),
  ex_cable_fly: pexels(11800270),
  ex_pec_deck: pexels(14616295),
  ex_pushup: pexels(209969),
  ex_pullup: pexels(8520197),
  ex_chinup: pexels(4803699),
  ex_deadlift: pexels(461682),
  ex_bb_row: pexels(17210045),
  ex_lat_pull: pexels(3888413),
  ex_seated_row: pexels(4162482),
  ex_db_row: pexels(17210045),
  ex_chest_row: pexels(4162482),
  ex_squat: pexels(1552249),
  ex_leg_press: pexels(14037022),
  ex_rdl: pexels(14623670),
  ex_leg_ext: pexels(3928538),
  ex_leg_curl: pexels(6539793),
  ex_lunges: pexels(4793258),
  ex_bb_curl: pexels(29780130),
  ex_db_curl: pexels(6550875),
  ex_hammer: pexels(5837271),
  ex_incline_curl: pexels(5837258),
  ex_tri_pushdown: pexels(6243176),
  ex_rope_pushdown: pexels(6243176),
  ex_dips_tri: pexels(3888104),
  ex_close_bench: pexels(7289250),
  ex_ohp: pexels(4720786),
  ex_db_press_sh: pexels(7289371),
  ex_arnold: pexels(7289367),
};

type Overrides = Record<string, string>;

type Ctx = {
  ready: boolean;
  overrides: Overrides;
  setOverride: (exerciseId: string, uri: string) => Promise<void>;
  clearOverride: (exerciseId: string) => Promise<void>;
};

const ExerciseImagesContext = createContext<Ctx | null>(null);

export function ExerciseImagesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [overrides, setOverrides] = useState<Overrides>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            const clean: Overrides = {};
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === "string" && v.length > 0) clean[k] = v;
            }
            setOverrides(clean);
          }
        }
      } catch {
        // ignore corrupt storage
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist whenever overrides change, but only after hydration so we never
  // overwrite stored data with the initial empty object.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const json = JSON.stringify(overrides);
        if (!cancelled) {
          await AsyncStorage.setItem(STORAGE_KEY, json);
        }
      } catch {
        // ignore write failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, overrides]);

  const setOverride = useCallback(async (exerciseId: string, uri: string) => {
    setOverrides((prev) => ({ ...prev, [exerciseId]: uri }));
  }, []);

  const clearOverride = useCallback(async (exerciseId: string) => {
    setOverrides((prev) => {
      if (!(exerciseId in prev)) return prev;
      const next = { ...prev };
      delete next[exerciseId];
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ ready, overrides, setOverride, clearOverride }),
    [ready, overrides, setOverride, clearOverride],
  );

  return (
    <ExerciseImagesContext.Provider value={value}>
      {children}
    </ExerciseImagesContext.Provider>
  );
}

function useCtx(): Ctx {
  const ctx = useContext(ExerciseImagesContext);
  if (!ctx) {
    throw new Error(
      "useExerciseImage must be used inside ExerciseImagesProvider",
    );
  }
  return ctx;
}

/**
 * Resolve the effective image URL for an exercise.
 * Priority: user override > seed map (Pexels) > exercise.imageUrl from data > undefined.
 */
export function useExerciseImage(
  exerciseId: string | null | undefined,
  fallbackUrl?: string | null,
): string | undefined {
  const { overrides } = useCtx();
  if (!exerciseId) return fallbackUrl ?? undefined;
  return (
    overrides[exerciseId] ??
    EXERCISE_IMAGE_URLS[exerciseId] ??
    fallbackUrl ??
    undefined
  );
}

export function useExerciseImageOverride(exerciseId: string | null | undefined) {
  const { overrides, setOverride, clearOverride, ready } = useCtx();
  const hasOverride = !!(exerciseId && overrides[exerciseId]);
  const set = useCallback(
    (uri: string) => {
      if (!exerciseId) return Promise.resolve();
      return setOverride(exerciseId, uri);
    },
    [exerciseId, setOverride],
  );
  const clear = useCallback(() => {
    if (!exerciseId) return Promise.resolve();
    return clearOverride(exerciseId);
  }, [exerciseId, clearOverride]);
  return { ready, hasOverride, setOverride: set, clearOverride: clear };
}
