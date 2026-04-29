# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Artifacts

- **Gym Log** (`artifacts/gym-log`) — Native iOS app built with Expo + Expo Router. Most data persists on-device via AsyncStorage; the body-analysis feature calls the api-server. Dark theme with crimson accent. Tabs: Train, History, Analyze, Settings. Stack screens: workout (active session with rest timer + progression suggestion + per-exercise muscle chips), exercise-picker (modal, with "Recommended for you" carousel + muscle chips per row), custom-exercise (modal), exercise-detail/[id] (modal with Primary/Secondary muscle tabs + scrollable muscle list, last/suggest stats, preparation/execution/comment), workout-detail/[id] (with muscle chips per block). Categories: Chest, Back, Legs, Arms, Shoulders, Full Body. ~70 seeded exercises with primaryMuscles, secondaryMuscles, equipment, preparation, execution, tip metadata. components/MuscleChips renders primary muscles as filled crimson chips and secondary as outlined chips; reused across workout, picker, and workout-detail. lib/recommendation.ts ranks exercises by freshness and builds suggested workouts. lib/schedule.ts encodes the user's fixed weekly split (Wed Arms, Thu Back, Fri Shoulders [INJECTION DAY], Sat Chest [T PEAK], Sun Legs [T PEAK], Mon/Tue rest), plus universal warm-up (Triceps Dip 15 + Pull Up 12) and finisher (Hip Abductor) IDs. WorkoutContext seeds warm-up + finisher into every startWorkout/startSuggestedWorkout. Home shows TODAY card + 7-day strip + ALL CATEGORIES override section. Analyze tab: photo picker (camera/library via expo-image-picker), angle selector (front/side/back), POSTs base64 image to `/api/body-analysis`, displays AI feedback (overall summary, BF range, symmetry score, strengths, development areas with muscle chips, recommended exercises with reasons, posture notes, nutrition tip), saves history in AsyncStorage (lib/bodyAnalysisStorage). API URL resolved via `process.env.EXPO_PUBLIC_DOMAIN` in lib/api.ts. NativeTabs with isLiquidGlassAvailable() fallback. AI Workout Suggestion: each CategoryCard and the TodayCard show a crimson "AI" pill (cpu icon); tapping opens a modal with optional notes (e.g. "low energy", "focus on chest peak") and a Generate button that calls `POST /api/workout-suggestion` (Claude sonnet-4-5, Zod-validated request/response, in-memory rate limit 10/min/IP with periodic eviction sweep). Server filters returned exerciseIds against availableExercises; client (WorkoutContext.startAiWorkout) dedupes IDs, requires >=2 valid exercises, wraps with universal warmup+finisher, sets active workout, and shows the rationale via Alert. Generation is guarded by a useRef in-flight lock to prevent double-submit races.

- **API Server** (`artifacts/api-server`) — Express 5 API on the shared proxy under `/api`. Routes: `/healthz`, `POST /body-analysis`, `POST /workout-suggestion`. Body-analysis route accepts `{ imageBase64, mimeType, angle, notes? }`, calls Anthropic Claude vision (claude-sonnet-4-5) via Replit AI Integrations (env vars `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` and `AI_INTEGRATIONS_ANTHROPIC_API_KEY`), parses the JSON-only response with Zod, returns `{ analysis, angle, createdAt }`. Workout-suggestion route accepts `{ category, count?, notes?, recentWorkouts, availableExercises }`, asks Claude for a JSON plan of `exercises[{exerciseId,sets,reps,note?}]` plus `rationale`, validates the response with Zod, filters returned IDs against `availableExercises`, returns the curated suggestion. Both routes share an in-memory token-bucket rate limiter (10/min/IP) with periodic eviction. JSON body limit is 20mb to accommodate base64 photos.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
