import AsyncStorage from "@react-native-async-storage/async-storage";

import type { BodyAnalysisAngle, BodyAnalysisResult } from "./api";

const STORAGE_KEY = "gym-log:body-analyses:v1";

export type StoredBodyAnalysis = {
  id: string;
  createdAt: number;
  angle: BodyAnalysisAngle;
  photoUris: string[];
  notes?: string;
  analysis: BodyAnalysisResult;
};

type LegacyStoredBodyAnalysis = Omit<StoredBodyAnalysis, "photoUris"> & {
  photoUri?: string;
  photoUris?: string[];
};

function normalize(entry: LegacyStoredBodyAnalysis): StoredBodyAnalysis {
  if (entry.photoUris && entry.photoUris.length > 0) {
    return {
      id: entry.id,
      createdAt: entry.createdAt,
      angle: entry.angle,
      analysis: entry.analysis,
      notes: entry.notes,
      photoUris: entry.photoUris,
    };
  }
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    angle: entry.angle,
    analysis: entry.analysis,
    notes: entry.notes,
    photoUris: entry.photoUri ? [entry.photoUri] : [],
  };
}

export async function loadBodyAnalyses(): Promise<StoredBodyAnalysis[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LegacyStoredBodyAnalysis[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalize).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function saveBodyAnalysis(
  entry: StoredBodyAnalysis,
  onEvictedPhotoUris?: (uris: string[]) => void,
): Promise<StoredBodyAnalysis[]> {
  const existing = await loadBodyAnalyses();
  const combined = [entry, ...existing];
  const next = combined.slice(0, 50);
  if (combined.length > next.length && onEvictedPhotoUris) {
    const evicted = combined.slice(next.length).flatMap((e) => e.photoUris);
    if (evicted.length > 0) onEvictedPhotoUris(evicted);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function deleteBodyAnalysis(id: string): Promise<StoredBodyAnalysis[]> {
  const existing = await loadBodyAnalyses();
  const next = existing.filter((e) => e.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
