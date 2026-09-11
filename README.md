# Time Stop

Self-hosted time tracking for one person: a local-first Electron desktop app with an optional server that mirrors what the app records.

## Layout

npm workspaces + Turborepo.

- [`apps/desktop`](apps/desktop/README.md) — Electron app: SQLite, Tracker, Dashboard, Settings, Toggl import.
- [`apps/server`](apps/server/README.md) — Hono server: ingests Changes into Postgres, mints Tokens.
- [`packages/domain`](packages/domain) — shared domain logic, the `TimeStopApi` contract, and zod schemas.
- [`packages/db`](packages/db) — Drizzle schemas and migrations for both SQLite (desktop) and Postgres (server).
- `packages/tsconfig`, `packages/eslint-config` — shared tooling configs.

Decisions: [docs/adr](docs/adr). Vocabulary: [CONTEXT.md](CONTEXT.md). Entity rules: [docs/data-hierarchy.md](docs/data-hierarchy.md).

## Onboarding

1. `CONTEXT.md` — the vocabulary; every identifier in the code uses these words.
2. `docs/data-hierarchy.md` — the rules, especially "Storage and sync" and "Authentication".
3. `docs/adr/0001-v1-tech-stack.md` — why Electron + SQLite + Hono + Postgres + Drizzle, in one page.
4. `package.json` + `turbo.json` — workspaces and the `^build` task graph.
5. `packages/domain/src/<concept>/` — one folder per `CONTEXT.md` term; the entity schema sits in its PascalCase file (`project/Project.ts`), the Change envelope in `change/Change.ts`.
6. `packages/domain/src/<concept>/api.ts` — one descriptor group per concept, `TimeStopApi` derived from them in `src/api/index.ts`; the shape of everything.
7. `packages/domain/src/sync/` — the push wire format (`PushedChange.ts`) and `materializeChange` (`EntityStore.ts`).
8. `packages/db/src/sqlite/schema.ts` — how those entities land in SQLite (+ `settings`, `changes.pushed_at`).
9. `packages/db/src/sqlite/changes.ts` — `upsertEntity`/`removeEntity`: one transaction, row + Change.
10. `packages/db/src/sqlite/api.ts` — `createSqliteApi` and `commit`: permissions, kick, notifications.
11. `packages/db/src/sqlite/sync/pusher.ts` — the push loop, batching, retry/halt classes.
12. `apps/desktop/src/main/index.ts` → `database.ts` → `ipc.ts` — lifecycle, DB location, IPC from the contract.
13. `apps/desktop/src/preload/index.ts` + `src/shared/*.ts` — `window.timeStop` and `window.desktop`, bridged from their contracts.
14. `apps/server/src/app.ts` + `packages/db/src/postgres/ingest.ts` + `tokens.ts` — the receiving side.
15. `apps/server/Dockerfile` + `compose.yaml` + `.github/workflows/ci.yml` — how it ships and is checked.
16. `apps/desktop/src/main/imports/importToggl.ts` — a complete example of driving `TimeStopApi` from outside the UI.

## Dependency graph

```
                 ┌───────────────────────┐
                 │   @time-stop/domain   │   zod, luxon
                 └───────────┬───────────┘
                             │
          ┌──────────────────┼──────────────────────┐
          ▼                  ▼                      ▼
┌──────────────────┐ ┌────────────────────┐ ┌───────────────────┐
│  @time-stop/db   │ │ @time-stop/desktop │ │ @time-stop/server │
│ better-sqlite3,  │ │ (renderer imports  │ │ hono,             │
│ postgres, drizzle│ │  domain only; main │ │ @hono/node-server │
│                  │ │  adds luxon for    │ │                   │
│                  │ │  the Toggl import) │ │                   │
└───────┬──────────┘ └───────▲────────────┘ └───────▲───────────┘
        │                    │                      │
        └────────────────────┴──────────────────────┘  (server imports @time-stop/db/postgres)
```

## Data flow

```
 ┌────────────────────────── one machine (an Install) ──────────────────────────┐
 │                                                                              │
 │  Renderer (Chromium, React)                                                  │
 │    timeStop.record.startTimer() …           timeStop.record.onTimerChanged() │
 │          │  invoke('timeStop:record.startTimer')           ▲ 'timeStop:record.onTimerChanged'
 │          ▼                                                 │                 │
 │  Preload (contextBridge)  ── narrow, typed bridge ─────────┘                 │
 │          │                                                                   │
 │          ▼                                                                   │
 │  Main (Node)                                                                 │
 │    ipcMain.handle → zod parse → TimeStopApi (createSqliteApi)                │
 │          │                                                                   │
 │          ▼  one transaction: entity row + Change row                         │
 │    SQLite file  <userData>/timestop.sqlite3  (WAL)                           │
 │          │                                                                   │
 │          ▼  pusher.kick() after every commit                                 │
 │    Pusher: SELECT changes WHERE pushed_at IS NULL ORDER BY rowid LIMIT 200   │
 │          │  POST {url}/changes  Authorization: Bearer tst_…                  │
 └──────────┼───────────────────────────────────────────────────────────────────┘
            ▼   (only if Settings has a Server URL and a Token)
 ┌──────────────────────────── the Server (Docker) ─────────────────────────────┐
 │  Hono: findToken → pushChangesRequestSchema → ingestChanges                  │
 │          │  one transaction: bind Token, INSERT changes ON CONFLICT DO       │
 │          │  NOTHING, materialize new ones (last-write-wins on updatedAt)     │
 │          ▼                                                                   │
 │  PostgreSQL: changes (log) + workspaces/clients/projects/records + tokens    │
 └──────────────────────────────────────────────────────────────────────────────┘
```

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
