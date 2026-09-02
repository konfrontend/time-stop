---
status: accepted
---

# v1 tech stack

Time Stop v1 is a local-first Electron app plus a headless push-mirror server, so the stack is chosen to share one runtime and one domain package between the Electron main process and the server. Node 24 runs everywhere (Bun rejected: Electron's main process is Node anyway). The server is Hono on `@hono/node-server` exposing a single REST endpoint, `POST /changes`, with zod v4 contracts in the shared package; tRPC is deferred until the API surface grows in v2. Drizzle ORM spans `better-sqlite3` on the client and the `postgres` driver on the server with one schema file per dialect and migrations applied on startup on both sides. The desktop app is built with electron-vite and packaged with electron-builder; the main process owns SQLite and the domain behind a `TimeStopApi` interface exposed over zod-validated IPC, so the React renderer never touches a shell API and a v2 web Dashboard can implement the same interface over HTTP. The renderer uses TanStack Router, Query and Form with Tailwind v4 + shadcn/ui. The repo is npm workspaces + Turborepo (`packages/domain`, `packages/db`, `apps/desktop`, `apps/server`), ESLint + Prettier, Vitest everywhere with testcontainers for Postgres and a Playwright-Electron smoke test, GitHub Actions for CI.

## Considered options

- **Cloudflare Workers / D1** for the server — rejected. No Node runtime, no long-lived Postgres connections, and D1 would pull the server onto SQLite, contradicting the headless-Postgres decision. The server targets a Docker compose stack on a Hetzner VPS with Cloudflare DNS + Tunnel in front; Hono keeps Workers reachable if that ever changes.
- **Kysely** instead of Drizzle — rejected; Drizzle's schema-as-code and drizzle-kit migrations outweigh Kysely's single cross-dialect schema type.
- **date-fns / Temporal** instead of Luxon — Luxon's `DateTime`/`Duration`/`Interval` map directly onto the glossary's Duration, Record span, Range and Period, and bundle size is irrelevant in Electron. Temporal lacks Node 24 support. Luxon is confined to `domain/time.ts` and display so the swap stays one file.
- **react-hook-form** instead of TanStack Form — equal weight for five small forms; TanStack chosen for consistency with Router and Query.

## Consequences

- Storage keeps epoch milliseconds in UTC; time zones exist only at the edges.
- Every shadcn primitive carries a `data-slot` attribute and all visual tokens live as CSS variables in Tailwind's `@theme`, preserving the post-v1 skin-engine constraint.
- `changes` ingest inserts into the log idempotently and materializes entity tables in the same transaction; the materializer lives in `packages/domain` so the v2 pull path reuses it.
