import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

import { makeId } from "./storage";

export type ProgressPhoto = {
  id: string;
  uri: string;
  date: number;
  note?: string;
};

const KEY = "gymlog.progressPhotos.v1";
const SUBDIR = "progress-photos";

function ensurePhotosDir(): Directory {
  const dir = new Directory(Paths.document, SUBDIR);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

function detectExtension(sourceUri: string): string {
  const m = sourceUri.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
  if (!m) return "jpg";
  const ext = m[1].toLowerCase();
  if (ext === "jpeg" || ext === "jpg" || ext === "png" || ext === "heic" || ext === "webp") {
    return ext;
  }
  return "jpg";
}

export async function loadProgressPhotos(): Promise<ProgressPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProgressPhoto[];
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (p) =>
        p != null &&
        typeof p.id === "string" &&
        typeof p.uri === "string" &&
        typeof p.date === "number",
    );
    // Prune entries whose backing file no longer exists on disk.
    const alive: ProgressPhoto[] = [];
    let pruned = 0;
    for (const p of valid) {
      let exists = true;
      try {
        exists = new File(p.uri).exists;
      } catch {
        exists = false;
      }
      if (exists) {
        alive.push(p);
      } else {
        pruned += 1;
      }
    }
    if (pruned > 0) {
      try {
        await AsyncStorage.setItem(KEY, JSON.stringify(alive));
      } catch {
        // best-effort; metadata can be re-pruned on next load
      }
    }
    return alive.sort((a, b) => b.date - a.date);
  } catch {
    return [];
  }
}

async function saveAll(items: ProgressPhoto[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

/**
 * Copies the picked image into the app's persistent document directory and
 * records a metadata entry. Returns the updated full list (newest-first).
 */
export async function addProgressPhoto(
  sourceUri: string,
  date: number,
  note?: string,
): Promise<ProgressPhoto[]> {
  const dir = ensurePhotosDir();
  const id = makeId();
  const ext = detectExtension(sourceUri);
  const dest = new File(dir, id + "." + ext);

  const src = new File(sourceUri);
  src.copy(dest);

  const entry: ProgressPhoto = {
    id,
    uri: dest.uri,
    date,
    note,
  };

  const existing = await loadProgressPhotos();
  const merged = [entry, ...existing].sort((a, b) => b.date - a.date);
  await saveAll(merged);
  return merged;
}

export async function deleteProgressPhoto(id: string): Promise<ProgressPhoto[]> {
  const existing = await loadProgressPhotos();
  const target = existing.find((p) => p.id === id);
  if (target) {
    try {
      const f = new File(target.uri);
      if (f.exists) f.delete();
    } catch {
      // ignore — the metadata removal still succeeds below
    }
  }
  const next = existing.filter((p) => p.id !== id);
  await saveAll(next);
  return next;
}
