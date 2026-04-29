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

const USER_PROMPT = `Analyze these fitness progress photos. Give short, practical gym-focused feedback.
Comment on muscle development, symmetry, posture, and areas to improve.
Keep it concise and motivating. No medical advice.`;

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

  void photoDate;

  try {
    const response = await client.responses.create({
      model: "gpt-5-mini",
      max_output_tokens: 400,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: USER_PROMPT },
            {
              type: "input_image",
              image_url: imageDataUri,
              detail: "low",
            },
          ],
        },
      ],
    });

    let extracted = (response.output_text ?? "").trim();
    if (extracted.length === 0) {
      // Fallback: dig into output[0].content[0].text if output_text was empty.
      const outputs = (response as { output?: unknown }).output;
      if (Array.isArray(outputs) && outputs.length > 0) {
        const first = outputs[0] as { content?: unknown } | undefined;
        const content = first?.content;
        if (Array.isArray(content) && content.length > 0) {
          const block = content[0] as { text?: unknown } | undefined;
          if (block && typeof block.text === "string") {
            extracted = block.text.trim();
          }
        }
      }
    }

    if (extracted.length === 0) {
      req.log.warn({ response }, "OpenAI returned no text in either path");
      extracted = "Could not analyze photo. Try again.";
    }

    // Hard cap so a runaway response can't bloat local storage.
    const analysis =
      extracted.length > 800 ? extracted.slice(0, 800).trim() + "..." : extracted;

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
