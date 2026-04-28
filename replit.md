# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Artifacts

- **Gym Log** (`artifacts/gym-log`) — Native iOS app built with Expo + Expo Router. Pure frontend, no backend. All data persists on-device via AsyncStorage. Dark theme with crimson accent. Tabs: Train (category picker), History, Settings. Stack screens: workout (active session with rest timer + progression suggestion), exercise-picker (modal), custom-exercise (modal), workout-detail/[id]. Categories: Chest, Back, Legs, Arms, Shoulders, Full Body. Uses NativeTabs with isLiquidGlassAvailable() fallback to classic Tabs. Single WorkoutContext provider holds workouts, customExercises, and active workout, gated on AsyncStorage hydration.

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
