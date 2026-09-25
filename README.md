# Time Stop

Time tracking that shows what things really take, for you and your agents.

Over days and weeks your records add up to an honest picture of what your work actually takes, with nothing guessed or remembered. Read it back by project, by week, or down to one task. It reports what happened and leaves the conclusions to you.

Working with agents? Let them record too. Their tokens and their time land on the same tasks as yours, so the picture stays whole. Not there yet; see the [roadmap](docs/roadmap.md).

Yours, locally, forever. Have a team, or a second machine? An optional self-hosted server keeps every copy in sync and, later, brings other people in with their own records and roles.

## Install the app

macOS on Apple Silicon only.

1. Download `time-stop-<version>-arm64.dmg` from the latest [GitHub Release](https://github.com/konfrontend/timestop/releases/latest).
2. Open the dmg and drag Time Stop into Applications.
3. Open Time Stop from Applications.

### Gatekeeper

The app is ad-hoc signed, not notarized, so macOS blocks the first launch with "Apple could not verify". Allow it once:

1. Close the dialog.
2. Open System Settings → Privacy & Security, scroll to Security, and click Open Anyway next to the message about Time Stop.
3. Confirm with your password, then Open.

If macOS instead says the app "is damaged", clear the download quarantine flag and open it again:

```bash
xattr -dr com.apple.quarantine "/Applications/Time Stop.app"
```

Every new version needs this once more.

### Data

The database, `timestop.sqlite3` with its `-wal` and `-shm` files, lives in `~/Library/Application Support/Time Stop/`, next to Electron's own caches. Settings → Server shows the exact path. The app writes no log files; to see its output, start it from Terminal:

```bash
"/Applications/Time Stop.app/Contents/MacOS/Time Stop"
```

### Backup

Time Machine is the backup: it covers `~/Library/Application Support` unless you exclude it. The [Server](docs/self-host.md) is a mirror, not a restore source; it never sends data back.

To restore, quit Time Stop from its tray menu, restore the whole `Time Stop` folder from Time Machine, and open the app. Restore the folder, not only `timestop.sqlite3`: recent writes can sit in the `-wal` file.

### Updates

On launch the app checks GitHub Releases. When a newer version exists, a notice under the tabs links to its download; install it the same way, replacing the app in Applications. The check stays silent when it cannot reach GitHub.

Settings shows the running version at the bottom.

### Server

Optional. Deploying it and minting a Token: [docs/self-host.md](docs/self-host.md). Paste the Token under Settings → Server.

## Layout

npm workspaces + Turborepo.

- [`apps/desktop`](apps/desktop/README.md) — Electron app: SQLite, Tracker, Dashboard, Settings, Toggl import.
- [`apps/server`](apps/server/README.md) — Hono server: ingests Changes into Postgres, mints Tokens.
- [`packages/domain`](packages/domain) — shared domain logic, the `Api` contract, and zod schemas.
- [`packages/db`](packages/db) — Drizzle schemas and migrations for both SQLite (desktop) and Postgres (server).
- `packages/tsconfig`, `packages/eslint-config` — shared tooling configs.

Decisions: [docs/adr](docs/adr). Vocabulary: [CONTEXT.md](CONTEXT.md). Entity rules: [docs/data-hierarchy.md](docs/data-hierarchy.md). Deploying the Server: [docs/self-host.md](docs/self-host.md). Cutting a release: [docs/release.md](docs/release.md).

## Onboarding

1. `CONTEXT.md` — the vocabulary; every identifier in the code uses these words.
2. `docs/data-hierarchy.md` — the rules, especially "Storage and sync" and "Authentication".
3. `docs/adr/0001-v1-tech-stack.md` — why Electron + SQLite + Hono + Postgres + Drizzle, in one page.
4. `package.json` + `turbo.json` — workspaces and the `^build` task graph.
5. `packages/domain/src/<concept>/` — one folder per `CONTEXT.md` term; the entity schema sits in its PascalCase file (`project/Project.ts`), the Change envelope in `change/Change.ts`.
6. `packages/domain/src/<concept>/api.ts` — one descriptor group per concept, `Api` derived from them in `src/api/index.ts`; the shape of everything.
7. `packages/domain/src/sync/` — the push wire format (`PushedChange.ts`) and `materializeChange` (`EntityStore.ts`).
8. `packages/db/src/sqlite/schema.ts` — how those entities land in SQLite (+ `settings`, `changes.pushed_at`).
9. `packages/db/src/sqlite/changes.ts` — `upsertEntity`/`removeEntity`: one transaction, row + Change.
10. `packages/db/src/sqlite/api.ts` — `createSqliteApi` and `commit`: permissions, kick, notifications.
11. `packages/db/src/sqlite/sync/pusher.ts` — the push loop, batching, retry/halt classes.
12. `apps/desktop/src/main/index.ts` → `database.ts` → `ipc.ts` — lifecycle, DB location, IPC from the contract.
13. `apps/desktop/src/preload/index.ts` + `src/shared/*.ts` — `window.api` and `window.desktop`, bridged from their contracts.
14. `apps/server/src/app.ts` + `packages/db/src/postgres/ingest.ts` + `tokens.ts` — the receiving side.
15. `apps/server/Dockerfile` + `compose.yaml` + `.github/workflows/ci.yml` — how it ships and is checked.
16. `apps/desktop/src/main/imports/importToggl.ts` — a complete example of driving `Api` from outside the UI.

## Dependency graph

```
                 ┌───────────────────────┐
                 │      @app/domain      │   zod, luxon
                 └───────────┬───────────┘
                             │
          ┌──────────────────┼──────────────────────┐
          ▼                  ▼                      ▼
┌──────────────────┐ ┌────────────────────┐ ┌───────────────────┐
│  @app/db         │ │ @app/desktop       │ │ @app/server       │
│ better-sqlite3,  │ │ (renderer imports  │ │ hono,             │
│ postgres, drizzle│ │  domain only; main │ │ @hono/node-server │
│                  │ │  adds luxon for    │ │                   │
│                  │ │  the Toggl import) │ │                   │
└───────┬──────────┘ └───────▲────────────┘ └───────▲───────────┘
        │                    │                      │
        └────────────────────┴──────────────────────┘  (server imports @app/db/postgres)
```

## Data flow

```
 ┌────────────────────────── one machine (an Install) ──────────────────────────┐
 │                                                                              │
 │  Renderer (Chromium, React)                                                  │
 │    api.record.startTimer() …                api.record.onTimerChanged()      │
 │          │  invoke('api:record.startTimer')                ▲ 'api:record.onTimerChanged'
 │          ▼                                                 │                 │
 │  Preload (contextBridge)  ── narrow, typed bridge ─────────┘                 │
 │          │                                                                   │
 │          ▼                                                                   │
 │  Main (Node)                                                                 │
 │    ipcMain.handle → zod parse → Api (createSqliteApi)                        │
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

## Install dependencies

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
npm run dev --workspace=@app/desktop
```

```bash
npm run dev --workspace=@app/server
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
npm run test:e2e --workspace=@app/desktop
```

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push: both checks above, the desktop end-to-end suite under xvfb, and an electron-builder dry run. Server tests get their Postgres from a service container.
