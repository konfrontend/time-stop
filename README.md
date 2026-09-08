# Time Stop

Self-hosted time tracking for one person: a local-first Electron desktop app plus a headless server that mirrors its changes.

## Layout

npm workspaces + Turborepo.

- `packages/domain` — shared domain logic and zod contracts.
- `packages/db` — Drizzle schemas and migrations (SQLite on the desktop, Postgres on the server).
- `apps/desktop` — electron-vite app: main process, preload script exposing `window.timeStop`, React renderer (TanStack Router, Tailwind v4, shadcn/ui).
- `apps/server` — Hono on `@hono/node-server`.
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

Builds the server image, starts Postgres 17 with a named volume, and reports both healthy. The server answers on `http://localhost:3000/health`.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs build, lint, typecheck, tests, prettier, and an electron-builder dry run on every push and pull request.
