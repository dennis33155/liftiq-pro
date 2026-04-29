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
};

export type AnalyzeProgressPhotoResponse = {
  analysis: string;
  analyzedAt: number;
  model: string;
};

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
    const detail =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : "request_failed";
    throw new Error("Photo analysis failed: " + detail);
  }
  return (await res.json()) as AnalyzeProgressPhotoResponse;
}
