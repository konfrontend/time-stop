# Time Stop

Self-hosted time tracking for one person: a local-first Electron desktop app with an optional server that mirrors what the app records.

## Layout

npm workspaces + Turborepo.

- [`apps/desktop`](apps/desktop/README.md) — Electron app: SQLite, Tracker, Dashboard, Settings, Toggl import.
- [`apps/server`](apps/server/README.md) — Hono server: ingests Changes into Postgres, mints Tokens.
- [`packages/domain`](packages/domain) — shared domain logic, the `TimeStopApi` interface, and zod contracts.
- [`packages/db`](packages/db) — Drizzle schemas and migrations for both SQLite (desktop) and Postgres (server).
- [`packages/toggl-import`](packages/toggl-import) — reads a Toggl Track CSV export into a Time Stop database.
- `packages/tsconfig`, `packages/eslint-config` — shared tooling configs.

Decisions: [docs/adr](docs/adr). Vocabulary: [CONTEXT.md](CONTEXT.md). Entity rules: [docs/data-hierarchy.md](docs/data-hierarchy.md).

## Prerequisites

- Node 24 ([`.nvmrc`](.nvmrc))
- npm 11
- Docker, for the server: its compose stack and its tests (see [apps/server](apps/server/README.md))

## Install

```bash
npm install
```

## Develop

Starts the desktop app and the server together:

```bash
npm run dev
```

The desktop app is local-first and needs nothing else. The server needs a Postgres and [`apps/server/.env`](apps/server/.env.example); without them it exits at once, and the desktop app keeps running.

Per app:

```bash
npm run dev --workspace=@time-stop/desktop
```

```bash
npm run dev --workspace=@time-stop/server
```

## Check

Build every workspace, then eslint, tsc and vitest across all of them:

```bash
npx turbo build lint typecheck test
```

Prettier, whole repo:

```bash
npm run format:check
```

Playwright driving the built desktop app; needs the build above:

```bash
npm run test:e2e --workspace=@time-stop/desktop
```

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push: both checks above, the desktop end-to-end suite under xvfb, and an electron-builder dry run. Server tests get their Postgres from a service container.
