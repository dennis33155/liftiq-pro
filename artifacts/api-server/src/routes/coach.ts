import { Router, type IRouter, type RequestHandler } from "express";
import express from "express";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_SWEEP_MS = 5 * 60_000;
const ipHits = new Map<string, number[]>();
let lastSweep = Date.now();

function sweepIfNeeded(now: number): void {
  if (now - lastSweep < RATE_LIMIT_SWEEP_MS) return;
  lastSweep = now;
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  for (const [k, v] of ipHits.entries()) {
    const fresh = v.filter((t) => t > cutoff);
    if (fresh.length === 0) ipHits.delete(k);
    else ipHits.set(k, fresh);
  }
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  sweepIfNeeded(now);
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  hits.push(now);
  if (hits.length === 0) ipHits.delete(ip);
  else ipHits.set(ip, hits);
  return hits.length > RATE_LIMIT_MAX;
}

// Middleware: check rate limit BEFORE body parsing so oversized bodies cannot
// bypass the per-IP quota by crashing the parser before the handler runs.
const ipRateLimit: RequestHandler = (req, res, next) => {
  const ip = req.ip ?? "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }
  next();
};

const parseBody = express.json({ limit: "64kb" });

const PRSchema = z.object({
  exerciseName: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  estimated1RM: z.number().nonnegative(),
  bestWeight: z.number().nonnegative(),
  bestReps: z.number().int().nonnegative(),
  lastWeight: z.number().nullable(),
  lastReps: z.number().int().nullable(),
  lastDate: z.string().max(20).nullable(),
  totalSessions: z.number().int().nonnegative(),
});

const RecentWorkoutSchema = z.object({
  date: z.string().max(20),
  category: z.string().max(40),
  exerciseNames: z.array(z.string().max(80)).max(20),
});

const AvailableExerciseSchema = z.object({
  name: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  primaryMuscles: z.array(z.string().max(40)).max(8).optional(),
});

const BodyMetricSchema = z.object({
  date: z.string().max(20),
  weightLb: z.number().nonnegative().nullable(),
  bodyFatPct: z.number().nonnegative().max(80).nullable(),
});

const RequestSchema = z.object({
  notes: z.string().max(400).optional(),
  // Pro entitlement claim (self-attested today). Server returns 403 when
  // false. When real billing is wired, replace this client-supplied flag
  // with a server-verified entitlement (signed token / authenticated /me
  // lookup) before treating Pro as paid.
  isPro: z.boolean(),
  personalRecords: z.array(PRSchema).max(60),
  recentWorkouts: z.array(RecentWorkoutSchema).max(15),
  availableExercises: z.array(AvailableExerciseSchema).min(1).max(200),
  bodyMetrics: z.array(BodyMetricSchema).max(20).optional(),
  progressPhotosCount: z.number().int().nonnegative().max(10000).optional(),
});

const RecommendationsSchema = z.object({
  headline: z.string().min(1).max(160),
  focusExercises: z
    .array(
      z.object({
        exerciseName: z.string().min(1).max(80),
        reason: z.string().min(1).max(280),
      }),
    )
    .min(1)
    .max(5),
  progressionPlan: z
    .array(
      z.object({
        exerciseName: z.string().min(1).max(80),
        suggestedSets: z.number().int().min(1).max(10),
        suggestedReps: z.number().int().min(1).max(50),
        suggestedWeight: z.number().nonnegative(),
        note: z.string().min(1).max(240),
      }),
    )
    .min(1)
    .max(6),
  neglectedAreas: z
    .array(
      z.object({
        area: z.string().min(1).max(60),
        recommendedExercise: z.string().min(1).max(80),
        reason: z.string().min(1).max(240),
      }),
    )
    .max(4),
  weeklyTip: z.string().min(1).max(400),
});

type Recommendations = z.infer<typeof RecommendationsSchema>;

const SYSTEM_PROMPT = `You are a senior strength and hypertrophy coach reviewing
an athlete's training log. You will be given:
- Personal records per exercise (estimated 1RM via Epley, plus best weight x reps,
  most recent weight x reps, total sessions).
- A list of recent workouts (date + category + exercises performed).
- Optional athlete notes (energy, soreness, focus areas).
- Recent body metrics (body weight, body fat %) when logged.
- Count of progress photos on file (visual log activity).
- A list of every exercise the athlete has access to in their app library.

Produce a concise, ACTIONABLE coaching summary. Rules:
1. Recommend exercises ONLY from the supplied availableExercises list.
   Use the exact "name" string. Do not invent new exercises.
2. focusExercises: 3-5 exercises the athlete should prioritize next, drawn
   from their existing PR list when sensible. Reason should reference their
   actual numbers (e.g. "1RM 110kg with no session in 12 days, time to retest").
3. progressionPlan: 3-5 concrete next-session prescriptions for the top lifts.
   suggestedWeight should be a small overload from lastWeight (typical: +2.5kg
   for upper, +5kg for lower) when reps are in target range, OR keep weight and
   add a rep when reps are below target. If lastWeight is unknown, use bestWeight.
4. neglectedAreas: 1-3 muscle groups or movement patterns underrepresented in
   recent workouts; pair each with a specific available exercise.
5. weeklyTip: one short paragraph (2-3 sentences) with a single high-impact
   piece of advice for the week.
6. headline: a single sentence summarizing the athlete's current state.

Return ONLY valid JSON matching the schema below. No markdown, no commentary.

Schema:
{
  "headline": string,
  "focusExercises": [{ "exerciseName": string, "reason": string }],
  "progressionPlan": [{ "exerciseName": string, "suggestedSets": number,
                        "suggestedReps": number, "suggestedWeight": number,
                        "note": string }],
  "neglectedAreas": [{ "area": string, "recommendedExercise": string,
                       "reason": string }],
  "weeklyTip": string
}`;

router.post("/coach", ipRateLimit, parseBody, async (req, res) => {
  const ip = req.ip ?? "unknown";

  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "invalid_request",
      details: parsed.error.flatten(),
    });
    return;
  }

  if (parsed.data.isPro !== true) {
    res.status(403).json({
      error: "pro_required",
      message: "Pro subscription required",
    });
    return;
  }

  const {
    notes,
    personalRecords,
    recentWorkouts,
    availableExercises,
    bodyMetrics,
    progressPhotosCount,
  } = parsed.data;

  const baseURL = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"];
  if (!baseURL || !apiKey) {
    req.log.error("Anthropic AI integration env vars missing");
    res.status(500).json({ error: "ai_not_configured" });
    return;
  }

  const client = new Anthropic({ baseURL, apiKey });

  const userText = [
    notes ? "Athlete notes: " + notes : null,
    "",
    bodyMetrics && bodyMetrics.length > 0
      ? "Body metrics (newest first):\n" +
        bodyMetrics
          .map(
            (m) =>
              "- " +
              m.date +
              ": " +
              (m.weightLb != null ? m.weightLb + " lb" : "weight ?") +
              (m.bodyFatPct != null ? " / " + m.bodyFatPct + "% BF" : ""),
          )
          .join("\n")
      : "Body metrics: (none logged)",
    progressPhotosCount != null
      ? "Progress photos on file: " + progressPhotosCount
      : null,
    "",
    "Personal records (best 1RM first):",
    personalRecords.length > 0
      ? personalRecords
          .map(
            (p) =>
              "- " +
              p.exerciseName +
              " [" +
              p.category +
              "]: 1RM=" +
              p.estimated1RM.toFixed(1) +
              " best=" +
              p.bestWeight +
              "x" +
              p.bestReps +
              " last=" +
              (p.lastWeight != null && p.lastReps != null
                ? p.lastWeight + "x" + p.lastReps + " on " + (p.lastDate ?? "?")
                : "(none)") +
              " sessions=" +
              p.totalSessions,
          )
          .join("\n")
      : "(no personal records yet)",
    "",
    "Recent workouts (newest first):",
    recentWorkouts.length > 0
      ? recentWorkouts
          .map(
            (w) =>
              "- " +
              w.date +
              " [" +
              w.category +
              "]: " +
              w.exerciseNames.join(", "),
          )
          .join("\n")
      : "(none)",
    "",
    "Available exercises (use exact names ONLY from this list):",
    availableExercises
      .map(
        (e) =>
          "- " +
          e.name +
          " [" +
          e.category +
          "]" +
          (e.primaryMuscles && e.primaryMuscles.length > 0
            ? " primary=" + e.primaryMuscles.join("/")
            : ""),
      )
      .join("\n"),
    "",
    "Respond with JSON only.",
  ]
    .filter((s) => s !== null)
    .join("\n");

  const PROMPT_CHAR_LIMIT = 24_000;
  if (userText.length > PROMPT_CHAR_LIMIT) {
    req.log.warn({ promptLength: userText.length }, "Prompt exceeds size limit");
    res.status(400).json({ error: "request_too_large" });
    return;
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      req.log.error({ response }, "Anthropic returned no text block");
      res.status(502).json({ error: "ai_no_text" });
      return;
    }

    const raw = textBlock.text.trim();
    const jsonText = extractJson(raw);
    let recommendations: Recommendations;
    try {
      recommendations = RecommendationsSchema.parse(JSON.parse(jsonText));
    } catch (err) {
      req.log.error({ err }, "Failed to parse coach JSON");
      res.status(502).json({ error: "ai_invalid_json" });
      return;
    }

    res.json({
      recommendations,
      createdAt: Date.now(),
    });
  } catch (err) {
    req.log.error({ err }, "Anthropic coach call failed");
    res.status(502).json({ error: "ai_call_failed" });
  }
});

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw;
}

export default router;
