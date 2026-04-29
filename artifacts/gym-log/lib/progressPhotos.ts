import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

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
  if (
    ext === "jpeg" ||
    ext === "jpg" ||
    ext === "png" ||
    ext === "heic" ||
    ext === "webp"
  ) {
    return ext;
  }
  return "jpg";
}

function isInlineUri(uri: string): boolean {
  return uri.startsWith("data:") || uri.startsWith("blob:");
}

async function uriToDataUri(uri: string): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("FileReader produced non-string result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
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
    // Prune entries whose backing file no longer exists on disk. Inline
    // (data:) URIs are always considered alive because they carry their own
    // bytes; blob: URIs from a previous web session are never resurrectable
    // and get pruned.
    const alive: ProgressPhoto[] = [];
    let pruned = 0;
    for (const p of valid) {
      if (p.uri.startsWith("data:")) {
        alive.push(p);
        continue;
      }
      if (p.uri.startsWith("blob:")) {
        // blob URLs do not survive a page reload on web.
        pruned += 1;
        continue;
      }
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
 * Persists the picked image. On native we copy the asset into the app's
 * document directory (durable across launches). On web (or for inline
 * blob/data sources) we serialize the image to a base64 data URI and store
 * it in AsyncStorage so the photo survives page reloads.
 *
 * Returns the updated full list (newest-first).
 */
export async function addProgressPhoto(
  sourceUri: string,
  date: number,
  note?: string,
): Promise<ProgressPhoto[]> {
  const id = makeId();
  let uri: string;

  try {
    if (Platform.OS === "web" || isInlineUri(sourceUri)) {
      uri = await uriToDataUri(sourceUri);
    } else {
      const dir = ensurePhotosDir();
      const ext = detectExtension(sourceUri);
      const dest = new File(dir, id + "." + ext);
      const src = new File(sourceUri);
      src.copy(dest);
      uri = dest.uri;
    }
  } catch (err) {
    // Fallback: try the cross-platform data URI path so the user always
    // ends up with a usable image, even if the native copy fails (e.g. for
    // a ph:// PhotoKit URI on iOS).
    try {
      uri = await uriToDataUri(sourceUri);
    } catch {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  const entry: ProgressPhoto = { id, uri, date, note };
  const existing = await loadProgressPhotos();
  const merged = [entry, ...existing].sort((a, b) => b.date - a.date);
  await saveAll(merged);
  return merged;
}

export async function deleteProgressPhoto(id: string): Promise<ProgressPhoto[]> {
  const existing = await loadProgressPhotos();
  const target = existing.find((p) => p.id === id);
  if (target && !target.uri.startsWith("data:") && !target.uri.startsWith("blob:")) {
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
