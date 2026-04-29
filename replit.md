# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Artifacts

- **Gym Log** (`artifacts/gym-log`) — Native iOS app built with Expo + Expo Router. Pure frontend, no backend. All data persists on-device via AsyncStorage. Dark theme with crimson accent. Tabs: Train (category picker), History, Settings. Stack screens: workout (active session with rest timer + progression suggestion), exercise-picker (modal, with "Recommended for you" carousel), custom-exercise (modal), exercise-detail/[id] (modal with Primary/Secondary muscle tabs + scrollable muscle list, last/suggest stats, preparation/execution/comment), workout-detail/[id]. Categories: Chest, Back, Legs, Arms, Shoulders, Full Body. ~70 seeded exercises, each with primaryMuscles, secondaryMuscles, equipment, preparation, execution, tip metadata. lib/recommendation.ts ranks exercises by freshness (never used / long unused) and builds suggested workouts (compounds + accessories). WorkoutContext exposes startSuggestedWorkout(category) and populateSuggested(count) for auto-built sessions. Categorycard supports onPress (start blank) + onSuggest (auto-build). Empty workout state offers a "Suggest Exercises" CTA. Exercise blocks in workout screen are tappable to open detail. NativeTabs with isLiquidGlassAvailable() fallback to classic Tabs. Provider gated on AsyncStorage hydration.

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
