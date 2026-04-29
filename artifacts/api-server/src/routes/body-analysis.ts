import express, { Router, type IRouter } from "express";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 6;
const ipHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > cutoff);
  hits.push(now);
  ipHits.set(ip, hits);
  return hits.length > RATE_LIMIT_MAX;
}

const RequestSchema = z.object({
  imageBase64: z.string().min(100),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  angle: z.enum(["front", "side", "back"]),
  notes: z.string().max(500).optional(),
});

const DevelopmentAreaSchema = z.object({
  muscle: z.string(),
  note: z.string(),
});

const RecommendedExerciseSchema = z.object({
  name: z.string(),
  muscle: z.string(),
  reason: z.string(),
});

const AnalysisSchema = z.object({
  overallSummary: z.string(),
  estimatedBodyFatRange: z.string(),
  estimatedSymmetryScore: z.number().min(0).max(10),
  strengths: z.array(z.string()).max(10),
  developmentAreas: z.array(DevelopmentAreaSchema).max(10),
  recommendedExercises: z.array(RecommendedExerciseSchema).max(12),
  postureNotes: z.string(),
  nutritionTip: z.string(),
});

type Analysis = z.infer<typeof AnalysisSchema>;

const SYSTEM_PROMPT = `You are an experienced strength and physique coach.
You analyze gym progress photos and provide candid, actionable feedback focused
on muscle development, symmetry, posture, and exercise recommendations.

Important rules:
- Be respectful, non-judgmental, and supportive in tone.
- Focus on training advice, not appearance critique unrelated to fitness.
- Never make medical claims. Body fat ranges are visual estimates only.
- If the photo is not clearly a body / physique photo, return an error.
- Output ONLY valid JSON matching the schema. No markdown, no commentary.

Schema:
{
  "overallSummary": string (2-3 sentences),
  "estimatedBodyFatRange": string (e.g. "12-15%"),
  "estimatedSymmetryScore": number (0-10),
  "strengths": string[] (1-6 items, plain phrases),
  "developmentAreas": [{ "muscle": string, "note": string }] (1-6 items),
  "recommendedExercises": [{ "name": string, "muscle": string, "reason": string }] (3-8 items),
  "postureNotes": string (1-2 sentences),
  "nutritionTip": string (1 sentence)
}`;

router.post("/body-analysis", express.json({ limit: "20mb" }), async (req, res) => {
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

  const { imageBase64, mimeType, angle, notes } = parsed.data;

  const baseURL = process.env["AI_INTEGRATIONS_ANTHROPIC_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_ANTHROPIC_API_KEY"];
  if (!baseURL || !apiKey) {
    req.log.error("Anthropic AI integration env vars missing");
    res.status(500).json({ error: "ai_not_configured" });
    return;
  }

  const client = new Anthropic({ baseURL, apiKey });

  const userText = [
    "This is a " + angle + " angle progress photo.",
    notes ? "Athlete notes: " + notes : null,
    "Analyze the visible muscle development and respond with JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: imageBase64,
              },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      req.log.error({ response }, "Anthropic returned no text block");
      res.status(502).json({ error: "ai_no_text" });
      return;
    }

    const raw = textBlock.text.trim();
    const jsonText = extractJson(raw);
    let parsedAnalysis: Analysis;
    try {
      const parsedJson = JSON.parse(jsonText);
      parsedAnalysis = AnalysisSchema.parse(parsedJson);
    } catch (err) {
      req.log.error({ err, raw }, "Failed to parse AI JSON");
      res.status(502).json({ error: "ai_invalid_json", raw });
      return;
    }

    res.json({
      analysis: parsedAnalysis,
      angle,
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
