# Time Stop

[![CI](https://img.shields.io/github/actions/workflow/status/konfrontend/timestop/ci.yml?branch=master&label=CI)](https://github.com/konfrontend/timestop/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/konfrontend/timestop)](https://github.com/konfrontend/timestop/releases/latest)
![Platform](https://img.shields.io/badge/platform-macOS%20arm64%20%7C%20Windows%20x64-lightgrey)
![Node](<https://img.shields.io/badge/dynamic/regex?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkonfrontend%2Ftimestop%2Fmaster%2F.nvmrc&search=(%5Cd%2B)&replace=%241&label=node>)
[![License](https://img.shields.io/github/license/konfrontend/timestop)](LICENSE)

Time tracking that shows what things really take, for you and your agents.

Over days and weeks your records add up to an honest picture of what your work actually takes, with nothing guessed or remembered. Read it back by project, by week, or down to one task. It reports what happened and leaves the conclusions to you.

Working with agents? Let them record too. Their tokens and their time land on the same tasks as yours, so the picture stays whole. Not there yet; see the [roadmap](docs/roadmap.md).

Yours, locally, forever. Have a team, or a second machine? An optional self-hosted server keeps every copy in sync and, later, brings other people in with their own records and roles.

<p align="center">
  <img src="docs/images/tracker-running-dark.png" width="256" alt="Tracker, dark: a Timer running on a Project">
  <img src="docs/images/tracker-running.png" width="256" alt="Tracker, light: the same Timer">
  <img src="docs/images/tracker-idle.png" width="256" alt="Tracker, idle: the last Record, ready to continue">
</p>

<p align="center">
  <img src="docs/images/dashboard.png" width="790" alt="Dashboard: Records of a month, grouped by day">
</p>

## Install the app

macOS on Apple Silicon and Windows x64. Download the installer for your platform from the latest [GitHub Release](https://github.com/konfrontend/timestop/releases/latest) and open it.

The installers are unsigned, so macOS and Windows each warn once on first launch; allow it. Every new version asks once more.

### Updates

On launch the app checks GitHub Releases. When a newer version exists, a notice under the tabs links to its download; install it the same way, replacing the app in Applications. The check stays silent when it cannot reach GitHub.

Settings shows the running version at the bottom.

### Server

Optional. The app works offline, forever; a Server keeps a mirror of what it records.

```
  Your machine                              Your Server (optional)
 ┌────────────────────────────┐            ┌────────────────────────────┐
 │  Time Stop                 │            │  the same Workspaces,      │
 │  every edit lands in the   │    Push    │  Clients, Projects and     │
 │  local database, plus one  │ ─────────▶ │  Records                   │
 │  Change in a log           │  one way,  │  + the full Change history │
 │                            │  queued    │                            │
 │  works offline, forever    │  offline   │  never sends data back     │
 └────────────────────────────┘            └────────────────────────────┘
```

Deploying one and minting a Token: [docs/self-host.md](docs/self-host.md). Paste the Token under Settings → Server.

<p align="center">
  <img src="docs/images/settings-server.png" width="502" alt="Settings → Server: Server URL, Token, sync status">
</p>

## Development

npm workspaces + Turborepo.

### Layout

- [`apps/desktop`](apps/desktop/README.md) — Electron app: SQLite, Tracker, Dashboard, Settings, Toggl import.
- [`apps/server`](apps/server/README.md) — Hono server: ingests Changes into Postgres, mints Tokens.
- [`packages/domain`](packages/domain) — one folder per glossary term with its schema and `Api` descriptors; the sync wire format.
- [`packages/db`](packages/db) — Drizzle schemas and migrations for SQLite (desktop) and Postgres (server); the `Api` implementation and the push loop.
- `packages/tsconfig`, `packages/eslint-config` — shared tooling configs.
- [`CONTEXT.md`](CONTEXT.md) — the vocabulary; every identifier in the code uses these words.
- [`docs`](docs) — [decisions](docs/adr), starting with [why this stack](docs/adr/0001-v1-tech-stack.md); [entity rules](docs/data-hierarchy.md); [self-hosting](docs/self-host.md); [releasing](docs/release.md).

### Dependency graph

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
