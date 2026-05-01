import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";

import { WEEKLY_SCHEDULE, type DaySlot } from "./schedule";
import type { Category } from "./types";

function isDefaultForDay(day: number, value: CustomScheduleValue): boolean {
  const base = WEEKLY_SCHEDULE[day];
  if (!base) return false;
  if (value === "Rest") return base.isRest;
  return !base.isRest && base.category === value;
}

export type CustomScheduleValue = Category | "Rest";
export type CustomScheduleMap = Partial<Record<number, CustomScheduleValue>>;

export const CUSTOM_SCHEDULE_OPTIONS: CustomScheduleValue[] = [
  "Chest",
  "Back",
  "Legs",
  "Arms",
  "Shoulders",
  "Full Body",
  "Rest",
];

const STORAGE_KEY = "gymlog.customSchedule.v1";

function isCustomScheduleValue(v: unknown): v is CustomScheduleValue {
  return (
    typeof v === "string" &&
    (CUSTOM_SCHEDULE_OPTIONS as string[]).includes(v)
  );
}

function sanitize(parsed: unknown): CustomScheduleMap {
  if (!parsed || typeof parsed !== "object") return {};
  const out: CustomScheduleMap = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    const day = Number(k);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (isCustomScheduleValue(v)) out[day] = v;
  }
  return out;
}

type Ctx = {
  overrides: CustomScheduleMap;
  setDay: (day: number, value: CustomScheduleValue) => Promise<void>;
  reset: () => Promise<void>;
  hydrated: boolean;
};

const CustomScheduleContext = React.createContext<Ctx>({
  overrides: {},
  setDay: async () => {},
  reset: async () => {},
  hydrated: false,
});

export function CustomScheduleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [overrides, setOverrides] = React.useState<CustomScheduleMap>({});
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && raw) {
          const parsed = JSON.parse(raw) as unknown;
          setOverrides(sanitize(parsed));
        }
      } catch {
        // ignore: corrupt or missing storage falls back to defaults
      } finally {
        if (mounted) setHydrated(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Write-through persistence. Skipped before hydration to avoid clobbering
  // stored values with the empty initial state.
  React.useEffect(() => {
    if (!hydrated) return;
    const keys = Object.keys(overrides);
    if (keys.length === 0) {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)).catch(
      () => {},
    );
  }, [hydrated, overrides]);

  const setDay = React.useCallback(
    async (day: number, value: CustomScheduleValue) => {
      setOverrides((prev) => {
        const next: CustomScheduleMap = { ...prev };
        // Storing the same value as the default is a no-op; drop it so the
        // map stays minimal and resets cleanly.
        if (isDefaultForDay(day, value)) {
          delete next[day];
        } else {
          next[day] = value;
        }
        return next;
      });
    },
    [],
  );

  const reset = React.useCallback(async () => {
    setOverrides({});
  }, []);

  const value = React.useMemo<Ctx>(
    () => ({ overrides, setDay, reset, hydrated }),
    [overrides, setDay, reset, hydrated],
  );

  return (
    <CustomScheduleContext.Provider value={value}>
      {children}
    </CustomScheduleContext.Provider>
  );
}

export function useCustomSchedule(): Ctx {
  return React.useContext(CustomScheduleContext);
}

export function getEffectiveSlot(
  day: number,
  overrides: CustomScheduleMap,
): DaySlot {
  const base = WEEKLY_SCHEDULE[day] ?? WEEKLY_SCHEDULE[0]!;
  const ov = overrides[day];
  if (ov === undefined) return base;
  const isRest = ov === "Rest";
  const desiredCategory: Category | null = isRest ? null : ov;
  if (base.category === desiredCategory && base.isRest === isRest) {
    return base;
  }
  return {
    ...base,
    category: desiredCategory,
    isRest,
    badge: undefined,
    note: isRest ? "Recover. Eat. Sleep." : undefined,
  };
}

export function getEffectiveWeek(overrides: CustomScheduleMap): DaySlot[] {
  return WEEKLY_SCHEDULE.map((s) => getEffectiveSlot(s.day, overrides));
}

export function getEffectiveTodaySlot(
  overrides: CustomScheduleMap,
): DaySlot {
  return getEffectiveSlot(new Date().getDay(), overrides);
}
