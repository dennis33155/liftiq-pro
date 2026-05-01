import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSubscription } from "@/lib/subscription";

/**
 * Tracks weekly AI photo-analysis usage for Pro users.
 *
 * Free users have no AI photo-analysis budget at all (the entire feature is
 * locked behind the upgrade prompt). Pro users are capped at
 * PRO_WEEKLY_PHOTO_LIMIT successful analyses per calendar week (Monday start),
 * matching the absolute hard cap enforced server-side.
 *
 * The server is the source of truth for the cap (see photo-analysis.ts);
 * this client-side mirror exists purely for instant feedback so the UI can
 * pre-check before paying network round-trips.
 */
export const PRO_WEEKLY_PHOTO_LIMIT = 20;

const STORAGE_KEY = "gymlog.aiUsage.v1";

type StoredState = {
  weekStart: number;
  used: number;
};

type Ctx = {
  ready: boolean;
  isPro: boolean;
  used: number;
  limit: number;
  remaining: number;
  weekStartAt: number;
  weekResetAt: number;
  /** Increment after a successful AI call (Pro users only). */
  incrementUsage: () => Promise<void>;
  /** Returns true if the user is Pro AND has at least one analysis left. */
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
  return { weekStart: getCurrentWeekStart(), used: 0 };
}

function rollIfNewWeek(s: StoredState): StoredState {
  const currentWeek = getCurrentWeekStart();
  if (s.weekStart === currentWeek) return s;
  return { ...s, weekStart: currentWeek, used: 0 };
}

export function AiUsageProvider({ children }: { children: React.ReactNode }) {
  const { isPro } = useSubscription();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<StoredState>(defaultState);

  // Hydrate from storage. Tolerates the legacy shape that included a `tier`
  // field; the field is ignored in the new model.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as Partial<StoredState> | null;
          if (parsed && typeof parsed === "object") {
            const used =
              typeof parsed.used === "number" && parsed.used >= 0
                ? Math.floor(parsed.used)
                : 0;
            const weekStart =
              typeof parsed.weekStart === "number" && parsed.weekStart > 0
                ? parsed.weekStart
                : getCurrentWeekStart();
            setState(rollIfNewWeek({ used, weekStart }));
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

  // Persist after hydration only.
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
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

  const incrementUsage = useCallback(async () => {
    setState((s) => {
      const rolled = rollIfNewWeek(s);
      return { ...rolled, used: rolled.used + 1 };
    });
  }, []);

  const resetUsage = useCallback(async () => {
    setState({ weekStart: getCurrentWeekStart(), used: 0 });
  }, []);

  const limit = isPro ? PRO_WEEKLY_PHOTO_LIMIT : 0;
  const remaining = Math.max(0, limit - state.used);
  const weekResetAt = state.weekStart + ONE_WEEK_MS;

  const canUseNow = useCallback(
    () => isPro && remaining > 0,
    [isPro, remaining],
  );

  const value = useMemo<Ctx>(
    () => ({
      ready,
      isPro,
      used: state.used,
      limit,
      remaining,
      weekStartAt: state.weekStart,
      weekResetAt,
      incrementUsage,
      canUseNow,
      resetUsage,
    }),
    [
      ready,
      isPro,
      state.used,
      state.weekStart,
      limit,
      remaining,
      weekResetAt,
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
