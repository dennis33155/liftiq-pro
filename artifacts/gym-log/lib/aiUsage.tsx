import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Tier = "free" | "premium";

export const AI_WEEKLY_LIMITS: Record<Tier, number> = {
  free: 3,
  premium: 20,
};

const STORAGE_KEY = "gymlog.aiUsage.v1";

type StoredState = {
  tier: Tier;
  weekStart: number;
  used: number;
};

type Ctx = {
  ready: boolean;
  tier: Tier;
  used: number;
  limit: number;
  remaining: number;
  weekStartAt: number;
  weekResetAt: number;
  setTier: (next: Tier) => Promise<void>;
  /** Increment after a successful AI call. */
  incrementUsage: () => Promise<void>;
  /** Returns true if the user is allowed at least one more analysis this week. */
  canUseNow: () => boolean;
  /** Reset usage counter (does not change tier). For dev/testing only. */
  resetUsage: () => Promise<void>;
};

const AiUsageContext = createContext<Ctx | null>(null);

/**
 * Returns the timestamp (ms) of the most recent Monday 00:00 in the user's
 * local timezone. Weeks are Monday-start because that's the conventional
 * gym/training week.
 */
function getCurrentWeekStart(now: Date = new Date()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const offsetToMonday = (day + 6) % 7; // Mon→0, Sun→6
  d.setDate(d.getDate() - offsetToMonday);
  return d.getTime();
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function defaultState(): StoredState {
  return { tier: "free", weekStart: getCurrentWeekStart(), used: 0 };
}

function rollIfNewWeek(s: StoredState): StoredState {
  const currentWeek = getCurrentWeekStart();
  if (s.weekStart === currentWeek) return s;
  return { ...s, weekStart: currentWeek, used: 0 };
}

export function AiUsageProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<StoredState>(defaultState);

  // Hydrate from storage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as Partial<StoredState> | null;
          if (parsed && typeof parsed === "object") {
            const tier: Tier =
              parsed.tier === "premium" ? "premium" : "free";
            const used =
              typeof parsed.used === "number" && parsed.used >= 0
                ? Math.floor(parsed.used)
                : 0;
            const weekStart =
              typeof parsed.weekStart === "number" && parsed.weekStart > 0
                ? parsed.weekStart
                : getCurrentWeekStart();
            setState(rollIfNewWeek({ tier, used, weekStart }));
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

  // Persist after hydration only, to avoid wiping stored data on first paint.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const json = JSON.stringify(state);
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
  }, [ready, state]);

  // Auto-roll the week when the calendar ticks over while the app is open.
  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => {
        const rolled = rollIfNewWeek(s);
        return rolled === s ? s : rolled;
      });
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const setTier = useCallback(async (next: Tier) => {
    setState((s) => ({ ...rollIfNewWeek(s), tier: next }));
  }, []);

  const incrementUsage = useCallback(async () => {
    setState((s) => {
      const rolled = rollIfNewWeek(s);
      return { ...rolled, used: rolled.used + 1 };
    });
  }, []);

  const resetUsage = useCallback(async () => {
    setState((s) => ({ ...s, weekStart: getCurrentWeekStart(), used: 0 }));
  }, []);

  const limit = AI_WEEKLY_LIMITS[state.tier];
  const remaining = Math.max(0, limit - state.used);
  const weekResetAt = state.weekStart + ONE_WEEK_MS;

  const canUseNow = useCallback(() => remaining > 0, [remaining]);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      tier: state.tier,
      used: state.used,
      limit,
      remaining,
      weekStartAt: state.weekStart,
      weekResetAt,
      setTier,
      incrementUsage,
      canUseNow,
      resetUsage,
    }),
    [
      ready,
      state.tier,
      state.used,
      state.weekStart,
      limit,
      remaining,
      weekResetAt,
      setTier,
      incrementUsage,
      canUseNow,
      resetUsage,
    ],
  );

  return (
    <AiUsageContext.Provider value={value}>{children}</AiUsageContext.Provider>
  );
}

export function useAiUsage(): Ctx {
  const ctx = useContext(AiUsageContext);
  if (!ctx) {
    throw new Error("useAiUsage must be used inside AiUsageProvider");
  }
  return ctx;
}

export const AI_LIMIT_MESSAGE =
  "You've reached your weekly AI limit. Upgrade to continue.";
