const DEFAULT_PROD_DOMAIN = "gym-log-fast.replit.app";

let cachedBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  if (cachedBaseUrl) return cachedBaseUrl;

  const raw = process.env.EXPO_PUBLIC_DOMAIN ?? DEFAULT_PROD_DOMAIN;
  const host = raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  const safeHost = host || DEFAULT_PROD_DOMAIN;

  cachedBaseUrl = "https://" + safeHost + "/api";

  if (__DEV__) {
    console.log("[api] base URL:", cachedBaseUrl);
  }

  return cachedBaseUrl;
}

/**
 * Thrown when the server responds 403 because the caller is not on the Pro
 * tier. UIs can catch this and surface the upgrade modal.
 */
export class ProRequiredError extends Error {
  readonly code = "pro_required" as const;
  constructor(message?: string) {
    super(message ?? "Pro subscription required");
    this.name = "ProRequiredError";
  }
}

async function readErrorBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function isProRequired(body: unknown): boolean {
  return (
    !!body &&
    typeof body === "object" &&
    (body as { error?: unknown }).error === "pro_required"
  );
}

export type AiSuggestedExercise = {
  exerciseId: string;
  sets: number;
  reps: number;
  note?: string;
};

export type WorkoutSuggestionResponse = {
  exercises: AiSuggestedExercise[];
  rationale: string;
  category: string;
  createdAt: number;
};

export type WorkoutSuggestionRequest = {
  category: string;
  count?: number;
  notes?: string;
  isPro: boolean;
  recentWorkouts: {
    date: string;
    category: string;
    exerciseNames: string[];
  }[];
  availableExercises: {
    id: string;
    name: string;
    category: string;
    primaryMuscles?: string[];
    equipment?: string;
  }[];
};

export async function requestWorkoutSuggestion(
  input: WorkoutSuggestionRequest,
): Promise<WorkoutSuggestionResponse> {
  const url = getApiBaseUrl() + "/workout-suggestion";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await readErrorBody(res);
    if (res.status === 403 && isProRequired(body)) {
      throw new ProRequiredError(
        (body as { message?: string }).message,
      );
    }
    const detail =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "request_failed";
    throw new Error("Workout suggestion failed: " + detail);
  }
  return (await res.json()) as WorkoutSuggestionResponse;
}

export type CoachPersonalRecord = {
  exerciseName: string;
  category: string;
  estimated1RM: number;
  bestWeight: number;
  bestReps: number;
  lastWeight: number | null;
  lastReps: number | null;
  lastDate: string | null;
  totalSessions: number;
};

export type CoachAvailableExercise = {
  name: string;
  category: string;
  primaryMuscles?: string[];
};

export type CoachRecentWorkout = {
  date: string;
  category: string;
  exerciseNames: string[];
};

export type CoachBodyMetric = {
  date: string;
  weightLb: number | null;
  bodyFatPct: number | null;
};

export type CoachRequest = {
  notes?: string;
  isPro: boolean;
  personalRecords: CoachPersonalRecord[];
  recentWorkouts: CoachRecentWorkout[];
  availableExercises: CoachAvailableExercise[];
  bodyMetrics?: CoachBodyMetric[];
  progressPhotosCount?: number;
};

export type CoachFocusExercise = {
  exerciseName: string;
  reason: string;
};

export type CoachProgressionItem = {
  exerciseName: string;
  suggestedSets: number;
  suggestedReps: number;
  suggestedWeight: number;
  note: string;
};

export type CoachNeglectedArea = {
  area: string;
  recommendedExercise: string;
  reason: string;
};

export type CoachRecommendations = {
  headline: string;
  focusExercises: CoachFocusExercise[];
  progressionPlan: CoachProgressionItem[];
  neglectedAreas: CoachNeglectedArea[];
  weeklyTip: string;
};

export type CoachResponse = {
  recommendations: CoachRecommendations;
  createdAt: number;
};

export async function requestCoachRecommendations(
  input: CoachRequest,
): Promise<CoachResponse> {
  const url = getApiBaseUrl() + "/coach";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await readErrorBody(res);
    if (res.status === 403 && isProRequired(body)) {
      throw new ProRequiredError(
        (body as { message?: string }).message,
      );
    }
    const detail =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "request_failed";
    throw new Error("Coach request failed: " + detail);
  }
  return (await res.json()) as CoachResponse;
}

export type AnalyzeProgressPhotoRequest = {
  imageDataUri: string;
  photoDate: number;
  isPro: boolean;
};

export type AnalyzeProgressPhotoUsage = {
  used: number;
  limit: number;
  remaining: number;
  resetAt: number;
};

export type AnalyzeProgressPhotoResponse = {
  analysis: string;
  analyzedAt: number;
  model: string;
  usage?: AnalyzeProgressPhotoUsage;
};

export class WeeklyAiLimitError extends Error {
  readonly code = "weekly_limit_reached" as const;
  readonly limit: number;
  readonly used: number;
  readonly resetAt: number;
  constructor(opts: {
    limit: number;
    used: number;
    resetAt: number;
    message?: string;
  }) {
    super(
      opts.message ??
        "You've reached your weekly AI limit. Upgrade to continue.",
    );
    this.name = "WeeklyAiLimitError";
    this.limit = opts.limit;
    this.used = opts.used;
    this.resetAt = opts.resetAt;
  }
}

export async function requestPhotoAnalysis(
  input: AnalyzeProgressPhotoRequest,
): Promise<AnalyzeProgressPhotoResponse> {
  const url = getApiBaseUrl() + "/analyze-progress-photo";
  // [DIAG] Temporary: log outgoing request size and target URL.
  if (__DEV__) {
    console.log(
      "[api] POST",
      url,
      "imageBytes=",
      input.imageDataUri.length,
    );
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (networkErr) {
    // [DIAG] Temporary: surface network-level failures (DNS/TLS/timeout) with the URL.
    const m =
      networkErr instanceof Error ? networkErr.message : String(networkErr);
    throw new Error(
      "Photo analysis network error (" + m + ") — URL: " + url,
    );
  }
  if (!res.ok) {
    const body = await readErrorBody(res);
    if (res.status === 403 && isProRequired(body)) {
      throw new ProRequiredError(
        (body as { message?: string }).message,
      );
    }
    if (
      res.status === 429 &&
      body &&
      typeof body === "object" &&
      (body as { error?: unknown }).error === "weekly_limit_reached"
    ) {
      const b = body as {
        limit?: number;
        used?: number;
        resetAt?: number;
        message?: string;
      };
      throw new WeeklyAiLimitError({
        limit: typeof b.limit === "number" ? b.limit : 0,
        used: typeof b.used === "number" ? b.used : 0,
        resetAt:
          typeof b.resetAt === "number"
            ? b.resetAt
            : Date.now() + 7 * 24 * 60 * 60 * 1000,
        message: b.message,
      });
    }
    // [DIAG] Temporary: include HTTP status, backend error code, and
    // backend message text so the in-app alert shows the real failure.
    const errCode =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "request_failed";
    const errMsg =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : "";
    const upstream =
      body && typeof body === "object" && "upstreamStatus" in body
        ? " upstream=" + String((body as { upstreamStatus: unknown }).upstreamStatus)
        : "";
    throw new Error(
      "HTTP " +
        res.status +
        " " +
        errCode +
        upstream +
        (errMsg ? ": " + errMsg : ""),
    );
  }
  return (await res.json()) as AnalyzeProgressPhotoResponse;
}
