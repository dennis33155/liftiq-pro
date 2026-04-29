# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Artifacts

- **Gym Log** (`artifacts/gym-log`) — Native iOS app built with Expo + Expo Router. Pure frontend, no backend. All data persists on-device via AsyncStorage. Dark theme with crimson accent. Tabs: Train (category picker), History, Settings. Stack screens: workout (active session with rest timer + progression suggestion), exercise-picker (modal, with "Recommended for you" carousel), custom-exercise (modal), exercise-detail/[id] (modal with Primary/Secondary muscle tabs + scrollable muscle list, last/suggest stats, preparation/execution/comment), workout-detail/[id]. Categories: Chest, Back, Legs, Arms, Shoulders, Full Body. ~70 seeded exercises with primaryMuscles, secondaryMuscles, equipment, preparation, execution, tip metadata. lib/recommendation.ts ranks exercises by freshness (never used / long unused) and builds suggested workouts (compounds + accessories) with optional excludeIds param. lib/schedule.ts encodes the user's fixed weekly split (Wed Arms, Thu Back, Fri Shoulders [INJECTION DAY], Sat Chest [T PEAK], Sun Legs [T PEAK], Mon/Tue rest), plus universal warm-up (Triceps Dip 15 + Pull Up 12) and finisher (Hip Abductor) IDs. WorkoutContext seeds warm-up + finisher into every startWorkout/startSuggestedWorkout, addExerciseToActive inserts new exercises before the finisher block, populateSuggested excludes warm-up/finisher/existing IDs from the candidate pool. Home screen shows TODAY card (with category, day-specific note, optional badge, Start + Suggest buttons) on workout days, a "Rest day" card on Mon/Tue, plus a 7-day strip with today highlighted. NativeTabs with isLiquidGlassAvailable() fallback. Provider gated on AsyncStorage hydration.

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
