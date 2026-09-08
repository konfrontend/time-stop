# Time Stop

Self-hosted time tracking for one person: a local-first Electron desktop app plus a headless server that mirrors its changes.

## Layout

npm workspaces + Turborepo.

- `packages/domain` — shared domain logic and zod contracts.
- `packages/db` — Drizzle schemas and migrations (SQLite on the desktop, Postgres on the server via `@time-stop/db/postgres`).
- `apps/desktop` — electron-vite app: main process, preload script exposing `window.timeStop`, React renderer (TanStack Router, Tailwind v4, shadcn/ui).
- `apps/server` — Hono on `@hono/node-server`: `POST /changes` ingest, `GET /health`, and the Token CLI.
- `packages/toggl-import` — reads a Toggl Track CSV export into a database; used by the app's Settings page and by `scripts/import-toggl.sh`.
- `packages/tsconfig`, `packages/eslint-config` — shared tooling configs.

## Prerequisites

- Node 24
- npm 11
- Docker (only for the server compose stack)

## Install

```bash
npm install
```

## Develop

Starts the Electron app (with HMR) and the server (`http://localhost:3000`, `GET /health`) together:

```bash
npm run dev
```

Per package: `npm run dev --workspace=@time-stop/desktop` or `--workspace=@time-stop/server`.

## Check

```bash
npm run lint
npm run typecheck
npm run test
npm run format:check
```

Or everything at once: `npx turbo build lint typecheck test`.

## Build and package

```bash
npm run build
npm run package --workspace=@time-stop/desktop   # unpacked app in apps/desktop/release
```

## Import from Toggl

In Toggl Track, open **Reports → Detailed**, set the range, and **Export → Download CSV**.

Then, in the app: **Settings → Import from Toggl Track**. Pick the Workspace to import into and the time zone the export was written in — Toggl stamps local times without an offset, so a wrong zone shifts every Record — and choose the file. This is the way to import.

Headless, with the app quit (it holds the database open):

```bash
scripts/import-toggl.sh ~/Downloads/toggl.csv --workspace Toggl --zone Europe/Berlin
```

The script defaults to the desktop app's own database; `--db <path>` points it elsewhere, `--workspace <name>` names the Workspace to import into and creates it when missing, and `--zone` defaults to the zone of this machine.

Toggl clients become Clients and Toggl projects become Projects, each with a color and, when the export carries Amounts, the hourly Rate they imply. Every time entry becomes a Record with its start, stop, Name, and Billable flag, and the Project's Rate frozen onto it. Tags and everything else are dropped, and a still-running entry is passed over. Each imported entity gets a Change, so the history pushes to the server like any other data. Importing the same export twice adds nothing.

## Server in Docker

```bash
docker compose up --build
```

Builds the server image, starts Postgres 17 with a named volume, applies the migrations on boot, and reports both healthy. The server answers on `http://localhost:3000/health`.

### Tokens

An Install pushes its Changes with a Token. Mint one inside the running server container; it is printed once and only its SHA-256 hash is stored:

```bash
docker compose exec server node apps/server/dist/cli.js mint
```

Revoke by the id printed at mint time:

```bash
docker compose exec server node apps/server/dist/cli.js revoke <token id>
```

Outside Docker, with `DATABASE_URL` set: `npm run cli --workspace=@time-stop/server -- mint`.

### Pushing Changes

`POST /changes` takes `{ "changes": [...] }` (1 to 1000 Changes from one Install and Actor) with the Token as a Bearer header. Each Change is stored once by its id and materialized into the entity tables; reposting a batch is a no-op. The first push binds the Token to that push's `installId` and `actorId`; a different pair later gets 403, an unknown or revoked Token 401, a malformed batch 400 with nothing written.

```bash
curl -X POST http://localhost:3000/changes \
  -H "Authorization: Bearer tst_..." \
  -H "Content-Type: application/json" \
  -d '{"changes":[{"id":"<uuidv7>","entityKind":"workspace","entityId":"<uuidv7>","op":"create","payload":{"id":"<uuidv7>","name":"Work","currency":"USD","createdAt":0,"updatedAt":0},"updatedAt":0,"actorId":"<uuidv7>","installId":"<uuidv7>"}]}'
```

Server tests run against Postgres from testcontainers (Docker required); set `DATABASE_URL` to use an existing database instead, as CI does.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs build, lint, typecheck, tests, prettier, and an electron-builder dry run on every push and pull request.
