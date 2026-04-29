import AsyncStorage from "@react-native-async-storage/async-storage";

import type { BodyAnalysisAngle, BodyAnalysisResult } from "./api";

const STORAGE_KEY = "gym-log:body-analyses:v1";

export type StoredBodyAnalysis = {
  id: string;
  createdAt: number;
  angle: BodyAnalysisAngle;
  photoUri: string;
  notes?: string;
  analysis: BodyAnalysisResult;
};

export async function loadBodyAnalyses(): Promise<StoredBodyAnalysis[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredBodyAnalysis[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function saveBodyAnalysis(
  entry: StoredBodyAnalysis,
): Promise<StoredBodyAnalysis[]> {
  const existing = await loadBodyAnalyses();
  const next = [entry, ...existing].slice(0, 50);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function deleteBodyAnalysis(id: string): Promise<StoredBodyAnalysis[]> {
  const existing = await loadBodyAnalyses();
  const next = existing.filter((e) => e.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
