# Time Stop

Self-hosted time tracking for one person: a local-first Electron desktop app plus a headless server that mirrors its changes. Glossary in `CONTEXT.md`, entity rules in `docs/data-hierarchy.md`, decisions in `docs/adr/`.

## Layout

npm workspaces + Turborepo.

- `packages/domain` — shared domain logic and zod contracts. Luxon lives only in `src/time.ts`.
- `packages/db` — Drizzle schemas and migrations (SQLite on the desktop, Postgres on the server).
- `apps/desktop` — electron-vite app: main process, preload script exposing `window.timeStop`, React renderer (TanStack Router, Tailwind v4, shadcn/ui).
- `apps/server` — Hono on `@hono/node-server`.
- `packages/tsconfig`, `packages/eslint-config` — shared tooling configs.

## Prerequisites

- Node 24 (`.nvmrc`; `nvm use`)
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

## Server in Docker

```bash
docker compose up --build
```

Builds the server image, starts Postgres 17 with a named volume, and reports both healthy. The server answers on `http://localhost:3000/health`.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs build, lint, typecheck, tests (with a Postgres 17 service), the Prettier check, and an electron-builder dry run on every push and pull request.
