export function getApiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) {
    throw new Error(
      "EXPO_PUBLIC_DOMAIN is not configured; cannot reach API server.",
    );
  }
  return "https://" + domain;
}

export type BodyAnalysisAngle = "front" | "side" | "back";

export type BodyAnalysisDevelopmentArea = {
  muscle: string;
  note: string;
};

export type BodyAnalysisRecommendedExercise = {
  name: string;
  muscle: string;
  reason: string;
};

export type BodyAnalysisResult = {
  overallSummary: string;
  estimatedBodyFatRange: string;
  estimatedSymmetryScore: number;
  strengths: string[];
  developmentAreas: BodyAnalysisDevelopmentArea[];
  recommendedExercises: BodyAnalysisRecommendedExercise[];
  postureNotes: string;
  nutritionTip: string;
};

export type BodyAnalysisResponse = {
  analysis: BodyAnalysisResult;
  angle: BodyAnalysisAngle;
  createdAt: number;
};

export async function requestBodyAnalysis(input: {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  angle: BodyAnalysisAngle;
  notes?: string;
}): Promise<BodyAnalysisResponse> {
  const url = getApiBaseUrl() + "/api/body-analysis";
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
    throw new Error("Body analysis failed: " + detail);
  }
  return (await res.json()) as BodyAnalysisResponse;
}
