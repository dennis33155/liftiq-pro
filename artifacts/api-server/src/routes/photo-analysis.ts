import { Router, type IRouter } from "express";
import { z } from "zod";
import OpenAI from "openai";

const router: IRouter = Router();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 6;
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

// Accept up to ~7MB of base64 (≈ 5MB binary), enough for a quality 0.85
// 1080p photo from the camera roll.
const MAX_DATA_URI_LEN = 7 * 1024 * 1024;
const DATA_URI_PATTERN = /^data:image\/(jpeg|jpg|png|webp|heic);base64,[A-Za-z0-9+/=]+$/;

const RequestSchema = z.object({
  imageDataUri: z
    .string()
    .min(64)
    .max(MAX_DATA_URI_LEN)
    .regex(DATA_URI_PATTERN, "expected data:image/<type>;base64,<...>"),
  photoDate: z.number().int().positive(),
});

const SYSTEM_PROMPT = `You are a supportive strength and physique coach reviewing a single progress photo for an athlete who logs their training in a personal app.

YOU MUST FOCUS ON, AND ONLY ON:
- Visible muscle development (e.g. shoulders look broader, lats showing more flare, calves filling out)
- Symmetry and proportion between major muscle groups
- Posture and standing alignment cues you can see in the frame
- Apparent body composition direction in qualitative terms only (leaner, fuller, holding water)
- A concrete training focus to address what is visible (e.g. "add lateral raises to widen shoulders")

YOU MUST NEVER:
- Give medical diagnoses or health advice of any kind
- Estimate an exact body fat percentage, weight, BMI, or any precise number
- Shame, mock, insult, or use negative language about body size or appearance
- Make sexual, romantic, or attractiveness-based comments
- Comment on age, gender, race, ethnicity, or any identity attribute
- Try to identify the person, name them, or speculate about who they are
- Recommend supplements, prescription drugs, restrictive diets, or anything outside training

OUTPUT FORMAT:
- 2 to 4 short sentences, plain text only.
- No markdown, no bullets, no numbered lists, no headers.
- Speak directly to the athlete in second person ("Your back...").
- End with one concrete, training-focused suggestion.

If the image is not a clear progress / physique photo (no person visible, only a face, blurry, or unrelated content), respond with exactly: "Could not analyze this photo. Try a clear, well-lit standing shot showing the muscle group you want feedback on."`;

router.post("/analyze-progress-photo", async (req, res) => {
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

  const { imageDataUri, photoDate } = parsed.data;

  const baseURL = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!baseURL || !apiKey) {
    req.log.error("OpenAI AI integration env vars missing");
    res.status(500).json({ error: "ai_not_configured" });
    return;
  }

  const client = new OpenAI({ baseURL, apiKey });

  const photoDateLabel = new Date(photoDate).toISOString().slice(0, 10);
  const userPromptText = `Photo date: ${photoDateLabel}. Give brief fitness feedback as instructed.`;

  try {
    const response = await client.responses.create({
      model: "gpt-5-mini",
      max_output_tokens: 400,
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: userPromptText },
            {
              type: "input_image",
              image_url: imageDataUri,
              detail: "low",
            },
          ],
        },
      ],
    });

    const raw = (response.output_text ?? "").trim();
    if (raw.length === 0) {
      req.log.error({ response }, "OpenAI returned empty output_text");
      res.status(502).json({ error: "ai_no_text" });
      return;
    }

    // Hard cap so a runaway response can't bloat local storage.
    const analysis = raw.length > 800 ? raw.slice(0, 800).trim() + "..." : raw;

    res.json({
      analysis,
      analyzedAt: Date.now(),
      model: "gpt-5-mini",
    });
  } catch (err) {
    req.log.error({ err }, "OpenAI photo analysis call failed");
    res.status(502).json({ error: "ai_call_failed" });
  }
});

export default router;
