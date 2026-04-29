# Threat Model

## Project Overview

This repository is a pnpm monorepo with two production-relevant artifacts and one development-only artifact.

- `artifacts/api-server` is an Express 5 API deployed on the shared proxy at `/api`. It exposes `GET /api/healthz`, `POST /api/workout-suggestion`, `POST /api/coach`, and `POST /api/analyze-progress-photo`.
- `artifacts/gym-log` is an Expo application deployed at `/`. In production it serves a static Expo build plus a custom landing page and platform manifests from `artifacts/gym-log/server/serve.js`. The mobile app stores most business data locally on-device and calls the API server for AI workout suggestions, coaching, and optional progress-photo analysis.
- `artifacts/mockup-sandbox` is a design/mockup environment and is development-only under the current deployment setup.

Assumptions for future scans:
- Production runs with `NODE_ENV=production`.
- TLS is terminated by the platform.
- `artifacts/mockup-sandbox/**` is never deployed to production.

## Assets

- **Workout history, personal records, body metrics, progress-photo metadata, and analyzed photo content** — user fitness data stored on-device and partially sent to the API for AI features.
- **AI feature availability and quota** — the public `workout-suggestion`, `coach`, and `analyze-progress-photo` endpoints consume paid upstream model capacity and can be abused for cost or availability impact.
- **Deployment domains, manifests, and static bundles** — the landing page and Expo manifest flow determine where clients fetch app code and assets.
- **Application secrets** — Anthropic integration credentials and any future database credentials must remain server-side.
- **Server logs and request metadata** — logs must not expose authentication material, secrets, or unnecessary user fitness data.

## Trust Boundaries

- **Client to API** — untrusted mobile/web clients send JSON bodies into `artifacts/api-server/src/app.ts` and route handlers under `artifacts/api-server/src/routes/**`.
- **API to Anthropic/OpenAI** — `workout-suggestion.ts` and `coach.ts` forward user-derived content to Anthropic, while `photo-analysis.ts` forwards user-supplied image data to OpenAI, all using server-held credentials.
- **Browser/mobile client to Expo landing/static server** — requests handled by `artifacts/gym-log/server/serve.js` cross a boundary where headers, paths, and manifest selection are untrusted.
- **Gym Log app to device storage** — local state crosses into AsyncStorage and local files in `artifacts/gym-log/lib/storage.ts`, `artifacts/gym-log/lib/bodyMetrics.ts`, and `artifacts/gym-log/lib/progressPhotos.ts`.
- **Server to database** — `lib/db/src/index.ts` can connect to PostgreSQL if future server features use it.
- **Development-only boundary** — `artifacts/mockup-sandbox/**`, Expo build scripts, and local preview tooling are out of scope unless production reachability changes.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/**`, `artifacts/gym-log/server/serve.js`
- **Highest-risk code areas**: request parsing and rate limiting order in `artifacts/api-server/src/app.ts`, AI endpoint request shaping and rate limiting in `artifacts/api-server/src/routes/workout-suggestion.ts`, `artifacts/api-server/src/routes/coach.ts`, and `artifacts/api-server/src/routes/photo-analysis.ts`, reverse-proxy-derived landing page generation in `artifacts/gym-log/server/serve.js`, landing page template `artifacts/gym-log/server/templates/landing-page.html`
- **Public surfaces**: `/`, `/manifest`, static bundle and asset paths served by `serve.js`, `/api/healthz`, `/api/workout-suggestion`, `/api/coach`, `/api/analyze-progress-photo`
- **Authenticated/admin surfaces**: none implemented in current production code
- **Dev-only surfaces to usually skip**: `artifacts/mockup-sandbox/**`, `artifacts/gym-log/scripts/build.js`, `.expo/**`

## Threat Categories

### Tampering

The production API and landing server both accept untrusted input from public clients. Request bodies, paths, and reverse-proxy headers must never be trusted implicitly when building prompts, file paths, manifests, landing-page URLs, deep links, or downstream API calls.

Required guarantees:
- Public request handlers must validate and constrain user-controlled input before using it in prompt construction, redirects, manifests, or filesystem paths.
- Reverse-proxy-derived headers must be trusted only when the proxy chain is explicitly configured and understood, and any values reflected into HTML or JavaScript must be validated and safely encoded for that output context.
- Future database access must use parameterized Drizzle queries only.

### Information Disclosure

The main confidentiality risks are leakage of Anthropic/OpenAI credentials, user fitness data, and deployment metadata that controls which bundles clients load. Logs are especially sensitive because AI failure paths can accidentally preserve user-derived content.

Required guarantees:
- Anthropic and database credentials must remain server-side and never appear in client bundles or landing-page output.
- Logs must continue redacting authentication material and must avoid storing unnecessary user fitness data or verbose upstream payloads.
- Landing-page and manifest generation must not let attackers steer clients to unintended origins.

### Denial of Service

All three AI endpoints are public and expensive relative to normal JSON APIs because they parse attacker-controlled request bodies and call an upstream model provider. The photo-analysis route is especially sensitive because it allows multi-megabyte image payloads. The landing/static server is also public and must fail safely on malformed requests.

Required guarantees:
- Public AI endpoints must enforce rate limits and request-size controls that remain effective behind the shared reverse proxy, including on malformed and oversized requests before expensive parsing or upstream work occurs.
- Expensive upstream AI calls must have bounded input sizes and safe failure behavior.
- Public request handlers must reject malformed requests without crashing or blocking other users.

### Elevation of Privilege

There are currently no authenticated or admin-only routes, so classic privilege escalation is limited today. The most relevant future privilege risk is misuse of shared HTTP helpers or future server features that start carrying bearer tokens or user-scoped data.

Required guarantees:
- If authenticated endpoints are added, authorization must be enforced server-side on every protected route.
- Shared HTTP client helpers must not leak bearer tokens to unintended origins.
- File serving and manifest generation must not allow clients to reach files or bundles outside the intended build output.
