import { Router, type IRouter } from "express";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
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

const AvailableExerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  primaryMuscles: z.array(z.string()).optional(),
  equipment: z.string().optional(),
});

const RecentWorkoutSchema = z.object({
  date: z.string(),
  category: z.string(),
  exerciseNames: z.array(z.string()),
});

const RequestSchema = z.object({
  category: z.string().min(1).max(40),
  count: z.number().int().min(2).max(10).optional(),
  notes: z.string().max(300).optional(),
  recentWorkouts: z.array(RecentWorkoutSchema).max(10),
  availableExercises: z.array(AvailableExerciseSchema).min(1).max(150),
});

const SuggestedExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(1).max(8),
  reps: z.number().int().min(1).max(50),
  note: z.string().max(140).optional(),
});

const SuggestionSchema = z.object({
  exercises: z.array(SuggestedExerciseSchema).min(1).max(12),
  rationale: z.string().max(400),
});

type Suggestion = z.infer<typeof SuggestionSchema>;

const SYSTEM_PROMPT = `You are an experienced strength coach building a single
gym session for the athlete. You will be given:
- The target muscle group (category) for today.
- A list of valid exercises with ids the athlete actually has access to.
- Recent workouts so you can avoid repeating the exact same lifts back-to-back
  and rotate movement patterns intelligently.
- Optional athlete notes (energy level, soreness, focus areas).

Pick "count" exercises from the available list (default 5). Always pick at
least one compound (multi-joint) movement first when available. Order from
heavy compound to isolation. Respect the requested category (favor exercises
matching it; small Full Body crossover is fine if useful for symmetry).

Return ONLY valid JSON matching the schema. Do not invent exercise ids.
Every exerciseId you return MUST exist in availableExercises.

Schema:
{
  "exercises": [
    { "exerciseId": string, "sets": number (3-5 typical), "reps": number (5-15 typical), "note": string (optional, short cue) }
  ],
  "rationale": string (2-3 sentence explanation of the choice)
}`;

router.post("/workout-suggestion", async (req, res) => {
  const ip = req.ip ?? "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ error: "rate_limited" });
    return;
  }

  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "invalid_request",
      details: parsed.error.flatten(),
    });
    return;
  }

  const { category, count, notes, recentWorkouts, availableExercises } =
    parsed.data;

  const baseURL = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"];
  if (!baseURL || !apiKey) {
    req.log.error("Anthropic AI integration env vars missing");
    res.status(500).json({ error: "ai_not_configured" });
    return;
  }

  const client = new Anthropic({ baseURL, apiKey });

  const validIds = new Set(availableExercises.map((e) => e.id));
  const targetCount = count ?? 5;

  const userText = [
    "Target category: " + category,
    "Desired exercise count: " + targetCount,
    notes ? "Athlete notes: " + notes : null,
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
    "Available exercises (pick exerciseId from this list ONLY):",
    availableExercises
      .map(
        (e) =>
          "- id=" +
          e.id +
          " name=\"" +
          e.name +
          "\" cat=" +
          e.category +
          (e.primaryMuscles && e.primaryMuscles.length > 0
            ? " primary=" + e.primaryMuscles.join("/")
            : "") +
          (e.equipment ? " equip=" + e.equipment : ""),
      )
      .join("\n"),
    "",
    "Respond with JSON only.",
  ]
    .filter((s) => s !== null)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
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
    let suggestion: Suggestion;
    try {
      suggestion = SuggestionSchema.parse(JSON.parse(jsonText));
    } catch (err) {
      req.log.error({ err, raw }, "Failed to parse AI JSON");
      res.status(502).json({ error: "ai_invalid_json" });
      return;
    }

    const filtered = suggestion.exercises.filter((e) =>
      validIds.has(e.exerciseId),
    );
    if (filtered.length === 0) {
      req.log.error({ suggestion }, "All AI ids invalid");
      res.status(502).json({ error: "ai_invalid_ids" });
      return;
    }

    res.json({
      exercises: filtered,
      rationale: suggestion.rationale,
      category,
      createdAt: Date.now(),
    });
  } catch (err) {
    req.log.error({ err }, "Anthropic call failed");
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
