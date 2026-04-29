# Threat Model

## Project Overview

This repository is a pnpm monorepo with two production-relevant artifacts and one development-only artifact.

- `artifacts/api-server` is an Express 5 API deployed at `/api`. In the current codebase it exposes only a health endpoint.
- `artifacts/gym-log` is an Expo application deployed at `/`. Its current business data is local-first: workout history, active workouts, and custom exercises are persisted on-device via AsyncStorage rather than a backend API.
- `artifacts/mockup-sandbox` is a design/mockup environment mounted at `/__mockup` in development only and should be treated as out of scope unless a future production service block is added.

Assumptions for future scans:
- Production runs with `NODE_ENV=production`.
- TLS is terminated by the platform.
- Mockup sandbox is never deployed to production.

## Assets

- **Workout data stored by the Gym Log app** — workout history, active sessions, and custom exercise names. This is user data, even though it is currently stored locally rather than in the server database.
- **Application availability** — the public landing page at `/` and API health endpoint at `/api/healthz` must remain reachable and resilient to malformed requests.
- **Generated Expo manifests and bundles** — the landing page and manifest endpoints tell Expo Go where to fetch bundles and assets; tampering here could redirect users to attacker-controlled code.
- **Environment secrets** — `DATABASE_URL` and any future API secrets. The shared DB package is present even though the current API does not yet use the database.
- **HTTP request metadata and logs** — request headers, cookies, and authorization data must not be exposed in logs.

## Trust Boundaries

- **Client to production servers** — untrusted browsers, Expo Go clients, and mobile/web app requests cross into `artifacts/api-server/src/app.ts` and `artifacts/gym-log/server/serve.js`.
- **Gym Log app to device storage** — application state crosses from React components/context into AsyncStorage in `artifacts/gym-log/lib/storage.ts`. Stored data must be treated as user-controlled when read back.
- **Server to database** — `lib/db/src/index.ts` can connect to PostgreSQL if provisioned. Any future route using this boundary must resist injection and over-broad queries.
- **Server to third-party content/CDNs** — the Expo landing page loads a remote QR-code library and uses deployment-domain-derived URLs to build deep links and manifests.
- **Development-only boundary** — `artifacts/mockup-sandbox/**`, Expo build scripts, and local preview tooling are not production-reachable under the current deployment configuration and should normally be ignored unless production reachability changes.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/**`, `artifacts/gym-log/server/serve.js`
- **Highest-risk code areas**: request/response handling in `serve.js`, any future API routes under `artifacts/api-server/src/routes/**`, token handling in `lib/api-client-react/src/custom-fetch.ts`, local persistence in `artifacts/gym-log/lib/storage.ts`
- **Public surfaces**: `/`, `/manifest`, static bundle and asset paths served by `artifacts/gym-log/server/serve.js`, `/api/healthz`
- **Authenticated/admin surfaces**: none implemented in the current production code
- **Dev-only surfaces to usually skip**: `artifacts/mockup-sandbox/**`, `artifacts/gym-log/scripts/build.js`, `.expo/**`

## Threat Categories

### Tampering

The current application accepts untrusted input at the public API and public landing page/static server. Any future expansion of the API must continue validating request bodies and query parameters server-side rather than trusting client state. For the Gym Log app, data loaded from AsyncStorage must be treated as untrusted because it can be modified on a rooted/jailbroken device or by local debugging tools.

Required guarantees:
- Public request handlers must validate and constrain user-controlled inputs before using them in file paths, redirects, manifests, or database queries.
- Future database access must use parameterized Drizzle queries only.
- Client-side business state must never be trusted as authoritative for protected server actions if backend features are added later.

### Information Disclosure

The most relevant confidentiality risks are leakage of local workout data, environment secrets, and sensitive headers in logs. The Gym Log artifact currently stores only workout data locally, while the API logger already attempts to redact `authorization`, `cookie`, and `set-cookie` fields.

Required guarantees:
- Secrets such as `DATABASE_URL` and any future API keys must remain server-side and never appear in client bundles.
- Logs must continue redacting authentication material and avoid exposing stack traces or secret-bearing headers in production responses.
- Any future API responses must disclose only the fields required by the client.

### Denial of Service

Both production services are public. The landing page/static server and `/api/healthz` endpoint should remain robust under malformed requests and should not perform expensive work per unauthenticated request.

Required guarantees:
- Public request handlers must fail safely on malformed input and avoid crashing the process.
- Any future public endpoints that perform expensive work or proxy external services should add explicit timeouts and rate limiting.

### Elevation of Privilege

There are currently no authenticated or admin-only routes, so classic privilege-escalation paths are limited today. The main future risk is that the shared DB and API client packages are already present, which makes it easy to add server features later without full authorization enforcement.

Required guarantees:
- If authenticated endpoints are added, authorization must be enforced server-side on every protected route.
- Shared HTTP client helpers must not leak bearer tokens to unintended origins.
- File serving and manifest generation must not allow users to reach files or bundles outside the intended deployment output.
