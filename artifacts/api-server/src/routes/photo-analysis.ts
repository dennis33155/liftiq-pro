import { Router, type IRouter, type RequestHandler } from "express";
import express from "express";
import { z } from "zod";
import OpenAI from "openai";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Burst rate limit: short-window per-IP, prevents floods.
// ---------------------------------------------------------------------------
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

// Body parser applied after rate limiting. The 8 MB window is intentionally
// scoped here (not globally) so it only applies once the rate check passes.
const parseBody = express.json({ limit: "8mb" });

// ---------------------------------------------------------------------------
// Pro / Free model
//
// Free users are blocked entirely (403). Pro users are bounded by a hard
// weekly cap to keep OpenAI cost-per-IP-per-week finite.
//
// Threat model & limits this code DOES enforce:
//
// 1. Pro gate: a missing or false `isPro` returns 403 before any AI work.
//
// 2. Absolute weekly ceiling: even with `isPro: true` claimed, no IP can
//    exceed PRO_WEEKLY_LIMIT successful analyses in a calendar week. So
//    total OpenAI cost-per-IP-per-week is bounded. The burst limit above
//    bounds rate.
//
// 3. Atomic reservation: slots are reserved synchronously *before* the
//    async OpenAI call. This closes the check-then-act race where multiple
//    concurrent requests from the same IP could each pass a pre-check
//    before any hit is recorded. If the OpenAI call then fails the slot is
//    refunded so transient failures don't burn the user's budget.
//
// What this DOES NOT enforce (acknowledged scope limits):
//
// - Pro authenticity. There is no auth/entitlement system in this app, so
//   a client can claim `isPro: true` without paying. For this personal,
//   single-user app the upgrade flow is a local-only self-attestation
//   gated through Settings; costs stay bounded by the hard cap above.
//   When a real billing/auth integration is added the `isPro` value should
//   be replaced with a server-verified entitlement (e.g. a signed token
//   from RevenueCat/Stripe/Apple webhook → DB lookup).
//
// - Counter durability. State lives in-process Map<>; a server restart
//   resets all counters. Acceptable for a single-instance personal app;
//   would need Redis/DB for horizontal scale or strict accounting.
// ---------------------------------------------------------------------------
const PRO_WEEKLY_LIMIT = 20;

const weeklyHits = new Map<string, number[]>();
let lastWeeklySweep = Date.now();

/** Returns the timestamp (ms) of the most recent Monday 00:00 UTC. */
function getCurrentWeekStart(now: number = Date.now()): number {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const offsetToMonday = (day + 6) % 7; // Mon→0, Sun→6
  d.setUTCDate(d.getUTCDate() - offsetToMonday);
  return d.getTime();
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function sweepWeeklyIfNeeded(now: number): void {
  if (now - lastWeeklySweep < 60 * 60 * 1000) return;
  lastWeeklySweep = now;
  const weekStart = getCurrentWeekStart(now);
  for (const [k, v] of weeklyHits.entries()) {
    const fresh = v.filter((t) => t >= weekStart);
    if (fresh.length === 0) weeklyHits.delete(k);
    else weeklyHits.set(k, fresh);
  }
}

type WeeklyState = {
  used: number;
  limit: number;
  resetAt: number;
};

/** Read current week count (does not mutate). */
function readWeeklyState(ip: string): WeeklyState {
  const now = Date.now();
  sweepWeeklyIfNeeded(now);
  const weekStart = getCurrentWeekStart(now);
  const fresh = (weeklyHits.get(ip) ?? []).filter((t) => t >= weekStart);
  if (fresh.length === 0) weeklyHits.delete(ip);
  else weeklyHits.set(ip, fresh);
  return {
    used: fresh.length,
    limit: PRO_WEEKLY_LIMIT,
    resetAt: weekStart + ONE_WEEK_MS,
  };
}

/**
 * Atomically reserve one weekly slot if available, returning the new state.
 * Returns ok:false if the limit would be exceeded.
 *
 * This is the single mutation point for the weekly counter. It runs entirely
 * synchronously between read and write so concurrent in-flight requests
 * cannot both observe `used < limit` and then both record a hit.
 */
function reserveWeeklySlot(
  ip: string,
): { ok: true; state: WeeklyState } | { ok: false; state: WeeklyState } {
  const now = Date.now();
  sweepWeeklyIfNeeded(now);
  const weekStart = getCurrentWeekStart(now);
  const fresh = (weeklyHits.get(ip) ?? []).filter((t) => t >= weekStart);
  if (fresh.length >= PRO_WEEKLY_LIMIT) {
    if (fresh.length === 0) weeklyHits.delete(ip);
    else weeklyHits.set(ip, fresh);
    return {
      ok: false,
      state: {
        used: fresh.length,
        limit: PRO_WEEKLY_LIMIT,
        resetAt: weekStart + ONE_WEEK_MS,
      },
    };
  }
  fresh.push(now);
  weeklyHits.set(ip, fresh);
  return {
    ok: true,
    state: {
      used: fresh.length,
      limit: PRO_WEEKLY_LIMIT,
      resetAt: weekStart + ONE_WEEK_MS,
    },
  };
}

/** Refund a previously reserved slot — used when the AI call itself fails. */
function refundWeeklySlot(ip: string): void {
  const now = Date.now();
  const weekStart = getCurrentWeekStart(now);
  const fresh = (weeklyHits.get(ip) ?? []).filter((t) => t >= weekStart);
  if (fresh.length > 0) fresh.pop();
  if (fresh.length === 0) weeklyHits.delete(ip);
  else weeklyHits.set(ip, fresh);
}

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------
const MAX_DATA_URI_LEN = 7 * 1024 * 1024;
const DATA_URI_PATTERN =
  /^data:image\/(jpeg|jpg|png|webp|heic);base64,[A-Za-z0-9+/=]+$/;

const RequestSchema = z.object({
  imageDataUri: z
    .string()
    .min(64)
    .max(MAX_DATA_URI_LEN)
    .regex(DATA_URI_PATTERN, "expected data:image/<type>;base64,<...>"),
  photoDate: z.number().int().positive(),
  isPro: z.boolean(),
});

const USER_PROMPT = `Analyze these fitness progress photos. Give short, practical gym-focused feedback.
Comment on muscle development, symmetry, posture, and areas to improve.
Keep it concise and motivating. No medical advice.`;

router.post("/analyze-progress-photo", ipRateLimit, parseBody, async (req, res) => {
  const ip = req.ip ?? "unknown";

  // [DIAG] Step 1: confirm the request reached Replit and inspect payload shape.
  const bodyKeys =
    req.body && typeof req.body === "object" ? Object.keys(req.body) : [];
  const rawImg =
    req.body && typeof req.body === "object"
      ? (req.body as { imageDataUri?: unknown }).imageDataUri
      : undefined;
  const imageFieldType = typeof rawImg;
  const imageFieldLength = typeof rawImg === "string" ? rawImg.length : 0;
  const imageFieldPrefix =
    typeof rawImg === "string" ? rawImg.slice(0, 32) : null;
  req.log.info(
    {
      diag: "photo_analysis_request_received",
      ip,
      contentLength: req.headers["content-length"] ?? null,
      contentType: req.headers["content-type"] ?? null,
      bodyKeys,
      imageFieldName: "imageDataUri",
      imageFieldType,
      imageFieldLength,
      imageFieldPrefix,
    },
    "[DIAG] /analyze-progress-photo: request received",
  );

  const parsed = RequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    req.log.warn(
      { diag: "photo_analysis_invalid_request", details: flat, status: 400 },
      "[DIAG] /analyze-progress-photo: rejected by schema",
    );
    res.status(400).json({
      error: "invalid_request",
      details: flat,
    });
    return;
  }

  if (parsed.data.isPro !== true) {
    req.log.info(
      { diag: "photo_analysis_pro_required", status: 403 },
      "[DIAG] /analyze-progress-photo: not Pro",
    );
    res.status(403).json({
      error: "pro_required",
      message: "Pro subscription required",
    });
    return;
  }

  const { imageDataUri, photoDate } = parsed.data;

  // Atomically reserve a weekly slot. This both checks AND consumes in the
  // same synchronous step so concurrent in-flight requests can't bypass the
  // cap. We refund the slot below if the OpenAI call itself fails.
  const reservation = reserveWeeklySlot(ip);
  if (!reservation.ok) {
    req.log.info(
      {
        diag: "photo_analysis_weekly_limit",
        used: reservation.state.used,
        limit: reservation.state.limit,
        status: 429,
      },
      "[DIAG] /analyze-progress-photo: weekly limit reached",
    );
    res.status(429).json({
      error: "weekly_limit_reached",
      limit: reservation.state.limit,
      used: reservation.state.used,
      resetAt: reservation.state.resetAt,
      message: "You've reached your weekly AI limit. Upgrade to continue.",
    });
    return;
  }

  const apiKey = process.env["OPENAI_API_KEY"];
  // [DIAG] Step 2: confirm OPENAI_API_KEY is loaded (never log the value).
  req.log.info(
    {
      diag: "photo_analysis_api_key_check",
      apiKeyLoaded: !!apiKey,
      apiKeyLength: apiKey ? apiKey.length : 0,
    },
    "[DIAG] /analyze-progress-photo: OPENAI_API_KEY check",
  );
  if (!apiKey) {
    req.log.error(
      { diag: "photo_analysis_no_key", status: 500 },
      "[DIAG] /analyze-progress-photo: OPENAI_API_KEY env var missing",
    );
    refundWeeklySlot(ip);
    res
      .status(500)
      .json({ error: "ai_not_configured", message: "OPENAI_API_KEY missing on server" });
    return;
  }

  const client = new OpenAI({ apiKey });

  void photoDate;

  // [DIAG] Step 3: about to call OpenAI.
  req.log.info(
    {
      diag: "photo_analysis_openai_call_start",
      model: "gpt-4o-mini",
      imageBytes: imageDataUri.length,
    },
    "[DIAG] /analyze-progress-photo: calling OpenAI",
  );

  const tStart = Date.now();
  try {
    const response = await client.responses.create({
      model: "gpt-4o-mini",
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

    const elapsedMs = Date.now() - tStart;
    let extracted = (response.output_text ?? "").trim();
    let extractedFrom: "output_text" | "output_array" | "none" =
      extracted.length > 0 ? "output_text" : "none";

    if (extracted.length === 0) {
      const outputs = (response as { output?: unknown }).output;
      if (Array.isArray(outputs) && outputs.length > 0) {
        const first = outputs[0] as { content?: unknown } | undefined;
        const content = first?.content;
        if (Array.isArray(content) && content.length > 0) {
          const block = content[0] as { text?: unknown } | undefined;
          if (block && typeof block.text === "string") {
            extracted = block.text.trim();
            if (extracted.length > 0) extractedFrom = "output_array";
          }
        }
      }
    }

    // [DIAG] Step 4: OpenAI returned. Log shape so we can see why it might be empty.
    req.log.info(
      {
        diag: "photo_analysis_openai_call_ok",
        elapsedMs,
        model: (response as { model?: unknown }).model ?? null,
        responseId: (response as { id?: unknown }).id ?? null,
        outputTextLen: (response.output_text ?? "").length,
        extractedLen: extracted.length,
        extractedFrom,
        usage: (response as { usage?: unknown }).usage ?? null,
      },
      "[DIAG] /analyze-progress-photo: OpenAI responded",
    );

    if (extracted.length === 0) {
      // Previously this silently returned the literal string
      // "Could not analyze photo. Try again." as if it were the analysis,
      // hiding the real failure. Now we log the full response shape AND
      // return a real error so the client can surface what happened.
      req.log.error(
        {
          diag: "photo_analysis_empty_response",
          response,
          status: 502,
        },
        "[DIAG] /analyze-progress-photo: OpenAI returned no text",
      );
      refundWeeklySlot(ip);
      res.status(502).json({
        error: "ai_empty_response",
        message: "OpenAI returned no text. Try again.",
      });
      return;
    }

    const analysis =
      extracted.length > 800
        ? extracted.slice(0, 800).trim() + "..."
        : extracted;

    // Slot was reserved before the call; report the post-reserve state back.
    const after = readWeeklyState(ip);

    // [DIAG] Step 5: response status sent back to the app.
    req.log.info(
      {
        diag: "photo_analysis_response_sent",
        status: 200,
        analysisLen: analysis.length,
        weeklyUsed: after.used,
        weeklyLimit: after.limit,
      },
      "[DIAG] /analyze-progress-photo: 200 OK",
    );

    res.json({
      analysis,
      analyzedAt: Date.now(),
      model: "gpt-4o-mini",
      usage: {
        used: after.used,
        limit: after.limit,
        remaining: Math.max(0, after.limit - after.used),
        resetAt: after.resetAt,
      },
    });
  } catch (err) {
    const elapsedMs = Date.now() - tStart;
    // [DIAG] Step 3b: capture the exact OpenAI error so we can see what failed.
    const e = err as {
      name?: string;
      message?: string;
      status?: number;
      code?: string | number;
      type?: string;
      error?: unknown;
      response?: { status?: number; data?: unknown };
    };
    req.log.error(
      {
        diag: "photo_analysis_openai_call_failed",
        elapsedMs,
        errName: e?.name ?? null,
        errMessage: e?.message ?? null,
        errStatus: e?.status ?? e?.response?.status ?? null,
        errCode: e?.code ?? null,
        errType: e?.type ?? null,
        errBody: e?.error ?? e?.response?.data ?? null,
        err,
        status: 502,
      },
      "[DIAG] /analyze-progress-photo: OpenAI call threw",
    );
    // Refund the reserved slot — the user shouldn't lose budget to a 502.
    refundWeeklySlot(ip);
    const upstreamMsg =
      typeof e?.message === "string" && e.message.length > 0
        ? e.message
        : "Upstream AI call failed";
    res.status(502).json({
      error: "ai_call_failed",
      message: upstreamMsg,
      upstreamStatus: e?.status ?? e?.response?.status ?? null,
      upstreamCode: e?.code ?? null,
    });
  }
});

export default router;
