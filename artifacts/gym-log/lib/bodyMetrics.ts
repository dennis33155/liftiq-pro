import AsyncStorage from "@react-native-async-storage/async-storage";

import { makeId } from "./storage";

export type BodyMetric = {
  id: string;
  date: number;
  weightLb: number | null;
  bodyFatPct: number | null;
  note?: string;
};

const KEY = "gymlog.bodyMetrics.v1";

export async function loadBodyMetrics(): Promise<BodyMetric[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BodyMetric[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m) =>
          m != null &&
          typeof m.id === "string" &&
          typeof m.date === "number",
      )
      .map((m) => ({
        id: m.id,
        date: m.date,
        weightLb: m.weightLb ?? null,
        bodyFatPct: m.bodyFatPct ?? null,
        note: m.note,
      }))
      .sort((a, b) => b.date - a.date);
  } catch {
    return [];
  }
}

async function saveAll(items: BodyMetric[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function addBodyMetric(
  data: { date: number; weightLb: number | null; bodyFatPct: number | null; note?: string },
): Promise<BodyMetric[]> {
  const existing = await loadBodyMetrics();
  const next: BodyMetric = {
    id: makeId(),
    date: data.date,
    weightLb: data.weightLb,
    bodyFatPct: data.bodyFatPct,
    note: data.note,
  };
  const merged = [next, ...existing].sort((a, b) => b.date - a.date);
  await saveAll(merged);
  return merged;
}

export async function deleteBodyMetric(id: string): Promise<BodyMetric[]> {
  const existing = await loadBodyMetrics();
  const next = existing.filter((m) => m.id !== id);
  await saveAll(next);
  return next;
}
