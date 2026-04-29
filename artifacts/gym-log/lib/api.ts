export function getApiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) {
    throw new Error(
      "EXPO_PUBLIC_DOMAIN is not configured; cannot reach API server.",
    );
  }
  return "https://" + domain;
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
  const url = getApiBaseUrl() + "/api/workout-suggestion";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
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
  const url = getApiBaseUrl() + "/api/coach";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
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
  tier?: "free" | "premium";
};

export type AnalyzeProgressPhotoUsage = {
  tier: "free" | "premium";
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
  readonly tier: "free" | "premium";
  readonly limit: number;
  readonly used: number;
  readonly resetAt: number;
  constructor(opts: {
    tier: "free" | "premium";
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
    this.tier = opts.tier;
    this.limit = opts.limit;
    this.used = opts.used;
    this.resetAt = opts.resetAt;
  }
}

export async function requestPhotoAnalysis(
  input: AnalyzeProgressPhotoRequest,
): Promise<AnalyzeProgressPhotoResponse> {
  const url = getApiBaseUrl() + "/api/analyze-progress-photo";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    if (
      res.status === 429 &&
      body &&
      typeof body === "object" &&
      (body as { error?: unknown }).error === "weekly_limit_reached"
    ) {
      const b = body as {
        tier?: "free" | "premium";
        limit?: number;
        used?: number;
        resetAt?: number;
        message?: string;
      };
      throw new WeeklyAiLimitError({
        tier: b.tier ?? "free",
        limit: typeof b.limit === "number" ? b.limit : 0,
        used: typeof b.used === "number" ? b.used : 0,
        resetAt:
          typeof b.resetAt === "number"
            ? b.resetAt
            : Date.now() + 7 * 24 * 60 * 60 * 1000,
        message: b.message,
      });
    }
    const detail =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "request_failed";
    throw new Error("Photo analysis failed: " + detail);
  }
  return (await res.json()) as AnalyzeProgressPhotoResponse;
}
