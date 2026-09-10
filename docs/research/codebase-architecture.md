# Codebase architecture (onboarding)

Ticket: none. Date: 2026-09-10.

Question: how is the `time-stop` monorepo put together — packages, apps, build pipeline, the Electron
process split, the SQLite → PostgreSQL push, Docker and CI — for a front-end developer who knows
TypeScript and React but is new to databases, Electron, Docker and monorepos?

Method: primary sources only. Every claim below cites a repo-relative path (with line numbers where
useful). Third-party docs are linked only where a concept needs a definition. Things the code leaves
unclear are collected in section 6 rather than guessed at. Excluded from the walk-through: tests,
`apps/desktop/src/renderer`, `packages/eslint-config`, `packages/tsconfig`, `prototypes/`.

---

## 0. Big picture

### 0.1 The product, in the glossary's words

Time Stop is "self-hosted time tracking for one person across everything they do" (`CONTEXT.md:3`).
The vocabulary is fixed in `CONTEXT.md` and the rules between the terms in `docs/data-hierarchy.md`;
this document uses those terms verbatim.

- An **Actor** tracks time; v1 has one Actor per install, holding the **Owner** Role
  (`CONTEXT.md:9-19`, `docs/data-hierarchy.md:20`).
- Data is contained as **Workspace → Client / Project / Record** (`docs/data-hierarchy.md:5-16`).
  A **Record** is "a single span of tracked time by one Actor"; a **Timer** is a Record still
  running (`CONTEXT.md:43-48`).
- The **Tracker** is the compact window the desktop app opens with; the **Dashboard** shows Records
  over a **Range**; **Settings** is where the Owner configures the app and its connection to the
  **Server** (`CONTEXT.md:91-100`).
- An **Install** is "the desktop app on one machine, as the Server sees it". The **Server** is "the
  self-hosted mirror that receives Changes from Installs". A **Change** is "one recorded mutation to a
  Record, Project, Client, or Workspace, kept so the Server can replay it". A **Token** is "the secret
  a CLI mints on the Server that an Install presents to push Changes". **Push** is "sending unsent
  Changes from an Install to the Server" (`CONTEXT.md:101-120`).
- Storage is local-first: "the desktop app is the source of truth and works fully offline; the
  Server only mirrors it" (`docs/data-hierarchy.md:60`). The Server "never sends data back in v1"
  (`docs/data-hierarchy.md:65`).

### 0.2 Repository map

```
time-stop/
├── package.json            npm workspaces root; scripts delegate to turbo
├── turbo.json              task graph (build/dev/lint/typecheck/test)
├── tsconfig.json           TS project references (solution file)
├── compose.yaml            Docker Compose: server + postgres
├── CONTEXT.md              glossary
├── docs/
│   ├── data-hierarchy.md   entity rules, storage & sync, auth
│   ├── adr/0001-v1-tech-stack.md
│   └── research/           (this file lives here)
├── packages/
│   ├── domain/             zod schemas, entity types, TimeStopApi contract, pure business rules
│   ├── db/                 drizzle schemas + migrations; SQLite api & pusher; Postgres ingest & tokens
│   ├── tsconfig/           shared tsconfig bases (not covered here)
│   └── eslint-config/      shared eslint flat config (not covered here)
├── apps/
    ├── desktop/            Electron app: main (Node), preload (bridge), renderer (React); Toggl import
    └── server/             Hono HTTP server: POST /changes, GET /health, Token CLI, Dockerfile
```

### 0.3 Dependency graph

Workspace packages depend on each other only through their `package.json` `dependencies`
(`"@time-stop/…": "*"`), which npm resolves to symlinks (see 0.5).

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

Sources: `packages/db/package.json:29-35`, `apps/desktop/package.json:19-34`, `apps/server/package.json:15-20`. The renderer imports only
`@time-stop/domain` (40 import sites, none from `db`), which is the point of the `TimeStopApi`
interface described in section 1.

### 0.4 Data flow

```
 ┌────────────────────────── one machine (an Install) ──────────────────────────┐
 │                                                                              │
 │  Renderer (Chromium, React)                                                  │
 │    window.timeStop.startTimer() …           window.timeStop.subscribeTimer() │
 │          │  ipcRenderer.invoke('timeStop:startTimer')      ▲ 'timeStop:timerChanged'
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
            no arrow back: the Server never sends data to an Install in v1
```

### 0.5 How the monorepo builds

**Monorepo, in one paragraph.** A monorepo is one git repository holding several npm packages that
depend on each other. Instead of publishing `@time-stop/domain` to npm and installing it in the
desktop app, the desktop app declares a dependency on it and the package manager links the local
folder. The two tools that make this work here are npm workspaces (linking and installing) and
Turborepo (running scripts across packages in dependency order, with caching).

**npm workspaces.** `package.json:11-14` declares `"workspaces": ["packages/*", "apps/*"]`. A single
`npm install` at the root installs every package's dependencies into the root `node_modules` and
creates a symlink per workspace under `node_modules/@time-stop/` (verified: `node_modules/@time-stop/db
-> ../../packages/db`, etc.). The lockfile records these as
`"node_modules/@time-stop/db": { "resolved": "packages/db", "link": true }` (`package-lock.json:4939-4942`).
`.npmrc` sets `engine-strict=true`, so the `engines` block (`package.json:7-10`, Node 24 / npm 11)
is enforced, not advisory. `.nvmrc` pins `24`.

**How `"*"` deps resolve.** Every internal dependency is written as `"@time-stop/domain": "*"`
(e.g. `packages/db/package.json:30`). `*` means "any version"; because a workspace with that name
exists locally, npm satisfies it with the symlink rather than the registry. This repo does not use
the pnpm/yarn-specific `workspace:*` protocol — plain `*` is the npm idiom.

**How imports reach `dist`.** A consumer writes `import { openSqlite } from '@time-stop/db'`. Node
follows the symlink to `packages/db/package.json` and reads its `exports` map
(`packages/db/package.json:6-19`):

```json
"exports": {
  ".":          { "types": "./dist/index.d.ts",          "default": "./dist/index.js" },
  "./postgres": { "types": "./dist/postgres/index.d.ts", "default": "./dist/postgres/index.js" },
  "./testing":  { "types": "./dist/testing.d.ts",        "default": "./dist/testing.js" }
}
```

So the package must be **built** (`tsc -b`, emitting `dist/`) before anything can import it — at
runtime and for TypeScript. The `types` condition tells `tsc` where the `.d.ts` lives; `default`
tells Node/Vite what to load. `domain` exposes only `"."`
(`packages/domain/package.json:6-11`). The Electron app is
not a library, so it has `"main": "./out/main/index.js"` instead (`apps/desktop/package.json:8`) —
the file Electron starts.

`dist` is git-ignored (`.gitignore:13`), which is why the turbo graph below exists.

**TypeScript project references.** Each library's `tsconfig.json` extends
`@time-stop/tsconfig/node.json` (strict flags, `composite: true`, `declaration: true` —
`packages/tsconfig/base.json`), sets `rootDir: src` / `outDir: dist`, excludes tests, and lists
`references` to the packages it imports (`packages/db/tsconfig.json:9`,
`apps/server/tsconfig.json:9`). `tsc -b` ("build mode")
then builds referenced projects first. The root `tsconfig.json` is a solution file with `files: []`
and `references` to domain, db, server, and the two desktop configs.

**Turborepo.** The root scripts are one-liners: `"build": "turbo build"`, `"dev": "turbo dev"`,
`"typecheck": "turbo typecheck"`, `"test": "turbo test"` (`package.json:16-20`). `turbo <task>`
runs the script of that name in every workspace that has one, ordered by `turbo.json`:

```jsonc
// turbo.json
"build":     { "dependsOn": ["^build"], "outputs": ["dist/**", "out/**"] },   // :4-7
"dev":       { "dependsOn": ["^build"], "cache": false, "persistent": true },  // :8-12
"lint":      { "dependsOn": ["^build"] },                                       // :13-15
"typecheck": { "dependsOn": ["^build"] },                                       // :16-18
"test":      { "dependsOn": ["^build"] }                                        // :19-21
```

`^build` (with the caret) means "the `build` task of my *dependencies*, not my own". So before
`server#typecheck` runs, `domain#build` and `db#build` have run and their `dist/*.d.ts` exist;
before `desktop#dev` starts, `domain` and `db` are built. `outputs` tells turbo
which folders to cache and restore on a cache hit (`dist/**` for libraries, `out/**` for the
Electron app). `dev` is `persistent` (a long-running watcher) and uncached. `"ui": "tui"` selects
the interactive terminal UI. Reference: <https://turborepo.com/docs/reference/configuration>.

**What each root command does end to end.**

- `npm run build` → `turbo build`: `domain#build` (`tsc -b`) → `db#build`, then in parallel
  `server#build` (`tsc -b`), `desktop#build` (`electron-vite build`, emitting
  `out/main`, `out/preload`, `out/renderer`). Scripts: `packages/domain/package.json:13`,
  `packages/db/package.json:21`, `apps/server/package.json:8`, `apps/desktop/package.json:11`.
- `npm run dev` → `turbo dev`: builds the libraries once, then runs both `dev` scripts persistently:
  `electron-vite dev` for the desktop (`apps/desktop/package.json:10`) and
  `tsx watch --env-file-if-exists=.env src/index.ts` for the server (`apps/server/package.json:7`).
  The README notes the server exits with `DATABASE_URL is not set` when there is no `.env` and the
  desktop keeps running (`README.md:43`). Library changes are *not* watched: `dev` depends on
  `^build` once; editing `packages/domain/src` requires a rebuild of `domain` for the server to see it
  (see 6).
- `npm run typecheck` → `turbo typecheck`: libraries run `tsc -b` (which is also their build);
  the desktop runs `tsc -b tsconfig.node.json tsconfig.web.json` (`apps/desktop/package.json:14`),
  two separate programs because main/preload are Node code and the renderer is DOM code
  (`apps/desktop/tsconfig.node.json`, `apps/desktop/tsconfig.web.json`).
- `npm run test` → `turbo test`: `vitest run` in every workspace (`packages/*/vitest.config.ts`,
  `apps/*/vitest.config.ts`). The server's tests need PostgreSQL: `apps/server/vitest.config.ts:6`
  registers `src/testGlobalSetup.ts`, which uses `DATABASE_URL` if set and otherwise starts a
  `postgres:17` testcontainer (`apps/server/src/testGlobalSetup.ts:10-22`; Docker required).
- `npm run lint`, `format`, `format:check` (`package.json:17,21-22`): eslint per workspace,
  prettier at the root (`.prettierrc`, `.prettierignore`).

---

## 1. Packages

### 1.1 `packages/domain` — the shared contract

**Purpose.** Everything two or more runtimes must agree on, with no I/O: zod schemas for entities and
API inputs, the `TimeStopApi` interface, pure calculations (Duration, Amount, Overlap, Limits,
Reports), and the sync contract (the wire shape of a pushed Change and the materialization rule).
ADR-0001 states the intent: "share one runtime and one domain package between the Electron main
process and the server" (`docs/adr/0001-v1-tech-stack.md:7`).

**Why a separate package.** Three consumers need identical definitions: the Electron main process
(validates IPC input, runs the SQLite implementation), the Electron renderer (types only, plus the
method table the preload bridge is generated from), and the server (validates HTTP bodies, materializes
Changes). Putting it in `apps/desktop` would force the server to depend on an Electron app; putting it
in `db` would drag `better-sqlite3` into the renderer's type graph. The renderer imports *only* this
package (0.3).

**Dependencies.** `zod` and `luxon` only (`packages/domain/package.json:18-21`). Luxon is confined
to `src/time.ts` by design: "this module is the only place Luxon is imported, and the only place a
time zone enters" (`packages/domain/src/time.ts:3-7`; ADR consequence at
`docs/adr/0001-v1-tech-stack.md:16`).

**Public interface** — `packages/domain/src/index.ts` re-exports, grouped by source file:

| File | Exports | Role |
| --- | --- | --- |
| `src/entities.ts` | `idSchema` (`z.uuidv7()`, line 4), `workspaceSchema`, `clientSchema`, `projectSchema`, `recordSchema`, `changeSchema`, `changePayloadSchema`, `entityKindSchema`, `changeOpSchema`, `limitPeriodSchema` + inferred types | The four entities and the Change envelope. All timestamps are `epochMs = z.int().nonnegative()` (line 6). `Record.rate` is "copied from the Project at creation and frozen" (line 54). A Change's `payload` is "the whole entity after the change; empty on delete" (line 75); `pushedAt` is the Install's local bookkeeping (line 85). |
| `src/time.ts` | `durationMs`, `formatDuration`, `periodBounds`, `shiftPeriod`, `dayStart`, `parseIsoDate`, `formatIsoDate`, `isClock`, `parseClock`, `formatClock`, types `Period`, `Bounds` | Calendar math over epoch ms; weeks start Monday via Luxon's `startOf('week')` (line 36). |
| `src/record.ts` | `newRecord`, `placeInProject`, `recordDurationMs`, `NewRecordInput` | The creation rule: Workspace comes from the Project, Rate is snapshotted, an Archived Project is refused (lines 30-44), Billable defaults to "has a Rate" (line 25). |
| `src/dashboard.ts` | `hoursOf`, `amountOf`, `overlappingIds`, `totalsOf`, `outsideLimits`, types `DashboardRow`, `DashboardView`, `LimitsUsage`, `Totals`, `CurrencyAmount` | Derived-on-read values: Amount requires Billable + Rate + Workspace Currency (line 47-51); Overlap is an O(n²)-with-early-break sweep over start-sorted Records (lines 53-70). |
| `src/report.ts` | `buildReport`, `roundDurationMs`, types `Report`, `ReportRow`, `Rounding`, `BuildReportInput` | The CSV Report exactly as `docs/data-hierarchy.md:48-56` specifies: header rows, per-Record rows sorted by Project then start, Total/Billable per Currency, filename fallback Project → Client → Workspace → `all` (lines 162-179). |
| `src/permissions.ts` | `can`, `permissions`, `roles`, `roleSchema`, types `Permission`, `Role` | One Role (`owner`) holding every permission; "call sites check permissions, never Role names" (line 3). |
| `src/api.ts` | Input schemas (`workspaceInputSchema`, `projectInputSchema`, `createRecordInputSchema`, `dashboardInputSchema`, `exportReportInputSchema`, …), `checkProject`, `checkRecordSpan`, the `TimeStopApi` interface, `apiMethods`, `apiEvents`, and the generic `MethodTable` / `EventTable` / `MethodInput` / `EventValue` types | The application's whole API surface. See below. |
| `src/sync.ts` | `materializeChange`, `pushedChangeSchema`, `pushChangesRequestSchema`, `pushChangesResponseSchema`, `serverInputSchema`, types `EntityStore`, `PushedChange`, `SyncStatus`, `SyncError`, `ServerSettings`, … | The push wire format and the Server-side merge rule. See section 3.4. |

**`TimeStopApi` and the method table** (`packages/domain/src/api.ts:173-314`). `TimeStopApi` is the
interface every UI talks to: Workspaces/Clients/Projects CRUD, `countRecords`, `getContext`/
`setContext`, `startTimer`/`stopTimer`/`getTimer`, Record CRUD, `listRecentNames`, `getDashboard`,
`exportReport`, `subscribeTimer`/`subscribeContext`, and the Server section: `getServer`,
`setServer`, `getSyncStatus`, `subscribeSync`. The ADR explains why it is an interface: "the React
renderer never touches a shell API and a v2 web Dashboard can implement the same interface over
HTTP" (`docs/adr/0001-v1-tech-stack.md:7`).

Two constants make the interface *transport-generic*:

- `apiMethods` (lines 275-308) maps every promise-returning method to its zod input schema, or
  `undefined` when it takes no argument. It is typed `satisfies MethodTable<TimeStopApi>`, and
  `MethodTable` (line 261) is computed from the interface, so "an extra or a missing method fails
  typecheck" (line 258). Transports "register handlers and build bridges from it, so adding a method
  is one table entry plus its implementation" (lines 259-260).
- `apiEvents` (lines 310-314) maps each `subscribe*` method to an event name
  (`timerChanged`, `syncChanged`, `contextChanged`).

Section 2 shows how `apps/desktop/src/main/ipc.ts` and `apps/desktop/src/preload/index.ts` are
driven entirely by these two tables.

**Consumers.** `packages/db` (every SQLite module and `postgres/ingest.ts`), `apps/server` (`app.ts`),
`apps/desktop` main (including `main/imports/importToggl.ts`), preload, shared and the renderer.

### 1.2 `packages/db` — drizzle schemas, migrations, and both storage implementations

**Databases, briefly.** SQLite is a database that lives in a single file on disk and is opened
in-process by a library (`better-sqlite3` here) — no server, no network, ideal for a desktop app.
PostgreSQL is a database *server*: a separate process you connect to over TCP with a URL like
`postgres://user:password@host:5432/dbname`. Drizzle ORM is a TypeScript library that lets you
describe tables as TypeScript objects (a "schema"), build SQL queries with type safety, and generate
"migrations" — numbered `.sql` files that bring an existing database from one schema version to the
next. Reference: <https://orm.drizzle.team/docs/migrations>.

**Purpose.** One package holds *both* dialects, as ADR-0001 decided: "Drizzle spans `better-sqlite3`
on the client and the `postgres` driver on the server with one schema file per dialect"
(`docs/adr/0001-v1-tech-stack.md:7`). The SQLite side also contains the full `TimeStopApi`
implementation and the Pusher; the Postgres side contains ingest and Token handling. It is a
"storage + application services" package, not a thin data layer.

**Why a separate package.** The SQLite `TimeStopApi` is used by the Electron main process
(`apps/desktop/src/main/database.ts`).
The Postgres side is used by the server and, through `@time-stop/db/postgres`, by server tests.
Keeping the drizzle schemas next to their migrations in one folder also lets `drizzle-kit` generate
migrations from one config per dialect.

**Public interface** — three entry points (`packages/db/package.json:6-19`):

- `@time-stop/db` (`src/index.ts`): `openSqlite`, `SqliteDb`, `bootstrap`, `DEFAULT_WORKSPACE`,
  `DEFAULT_WORKSPACE_KEY`, `createSqliteApi`, `sqliteSchema`, `stopAbandonedTimer`, `readSetting`,
  `writeSetting`, `createPusher`, `Pusher`, `PusherOptions`.
- `@time-stop/db/postgres` (`src/postgres/index.ts`): `openPostgres`, `closePostgres`,
  `PostgresDb`, `findToken`, `mintToken`, `revokeToken`, `TokenError`, `ingestChanges`,
  `postgresSchema`.
- `@time-stop/db/testing` (`src/testing.ts`): `testApi`, `projectInput`, `UNKNOWN_ID` — an
  in-memory harness for tests in other packages.

Splitting Postgres into a subpath means the desktop never loads the `postgres` driver and the server
never loads `better-sqlite3` — although both are *installed* wherever `db` is (see 6 on the Docker
image).

**Two schemas, two migration folders.**

| | SQLite | PostgreSQL |
| --- | --- | --- |
| Schema | `src/sqlite/schema.ts` (`sqliteTable`, `text`/`integer`/`real`) | `src/postgres/schema.ts` (`pgTable`, `text`/`bigint`/`doublePrecision`/`boolean`/`jsonb`) |
| drizzle-kit config | `drizzle.config.ts` (`dialect: 'sqlite'`, out `./drizzle/sqlite`) | `drizzle.postgres.config.ts` (`dialect: 'postgresql'`, out `./drizzle/postgres`, `dbCredentials.url` from `DATABASE_URL`) |
| Migrations | `drizzle/sqlite/0000_init.sql`, `0001_currency_optional.sql`, `meta/_journal.json` | `drizzle/postgres/0000_init.sql`, `meta/_journal.json` |
| Generate | `npm run db:generate` (`package.json:25`) | `npm run db:generate:postgres` (`:26`); `db:studio:postgres` opens Drizzle Studio (`:27`) |
| Tables | `workspaces`, `clients`, `projects`, `records`, `changes` (with `pushed_at`), `settings` | `workspaces`, `clients`, `projects`, `records`, `changes` (no `pushed_at`), `tokens` |

Differences that matter:

- **Foreign keys.** SQLite declares them (`src/sqlite/schema.ts:15-17,31,50-53`). Postgres has
  none, on purpose: "The mirror carries no foreign keys: Changes land in Install order across batches,
  and a stale-skipped Change must never make a batch fail" (`src/postgres/schema.ts:14-17`).
- **Booleans and JSON.** SQLite has no boolean or JSON type, so `archived`/`billable` are
  `integer(..., { mode: 'boolean' })` and `changes.payload` is `text(..., { mode: 'json' })`
  (`src/sqlite/schema.ts:40,59,77`); Postgres uses native `boolean` and `jsonb`.
- **Epoch ms.** SQLite `integer`; Postgres `bigint(name, { mode: 'number' })`
  (`src/postgres/schema.ts:12`) so drizzle returns JS numbers, not BigInt.
- **`settings`** exists only in SQLite: a key/value table for `installId`, `actorId`, `actorRole`,
  `defaultWorkspaceId`, the Context, the Server URL and Token, and window preferences.
- **`tokens`** exists only in Postgres.

**Opening SQLite and running migrations** (`src/sqlite/open.ts`). `openSqlite(path)`:

1. `new Database(path)` — better-sqlite3 opens or creates the file (line 10).
2. `journal_mode = WAL` unless `:memory:` (line 11). WAL (write-ahead log) lets readers proceed while
   a write is in flight and is the usual choice for a desktop app.
3. `drizzle(sqlite, { schema })` wraps the connection (line 12).
4. Foreign keys are switched **off**, `migrate(...)` runs every unapplied file from
   `drizzle/sqlite` (resolved relative to the compiled module via `import.meta.url`, line 16), then
   foreign keys are switched back on and `PRAGMA foreign_key_check` must return zero rows or the
   open throws (lines 13-21). The comment explains: "SQLite rebuilds a table to alter it; the
   migrator's transaction cannot toggle the pragma" — which is exactly what `0001_currency_optional.sql`
   does (`CREATE TABLE __new_workspaces … INSERT … DROP … RENAME`).

Migrations therefore run **on every open**, at app start; there is no separate "migrate" step for
the desktop.

**Opening PostgreSQL** (`src/postgres/open.ts`). `openPostgres(url)` creates a `postgres` client
with notices silenced (line 12, so the CLI prints only its own output), wraps it in drizzle, and runs
`migrate` from `drizzle/postgres` (lines 13-15). Again migrations run at process start — the server
and the Token CLI both call it. `closePostgres` ends the connection pool (line 20).

**Bootstrap** (`src/sqlite/bootstrap.ts`). `bootstrap(db)` reads `installId`, `actorId`,
`actorRole` from `settings` (lines 32-34). If all exist it returns them (and back-fills
`defaultWorkspaceId` for pre-key databases, lines 23-29). Otherwise, in one transaction, it mints
UUIDv7 `installId` and `actorId`, stores `actorRole = 'owner'`, and creates the default Workspace
`{ name: 'Default', currency: null }` through `upsertEntity`, so the very first Workspace already has
a Change (lines 45-68). This implements "The Install generates its own `installId` and `actorId` on
first launch, before any Server exists" (`docs/data-hierarchy.md:75`).

**The write path: entity row + Change in one transaction** (`src/sqlite/changes.ts`). `upsertEntity`
inserts or updates the entity table *and* appends a Change (lines 22-37); `removeEntity` deletes
the row and appends a `delete` Change with an empty payload (lines 39-49). The Change id is a UUIDv7
seeded with the entity's `updatedAt` (line 57), so ids sort by time. Every entity module
(`workspaces.ts`, `clients.ts`, `projects.ts`, `records.ts`) writes only through these two
functions, which is how "every mutation also appends a Change" (`docs/data-hierarchy.md:63`) is
guaranteed structurally rather than by discipline.

Cascades are explicit and each step is its own Change: deleting a Workspace removes its Records,
Projects (which first detach their Records), and Clients (which first detach their Projects), then
the Workspace (`src/sqlite/workspaces.ts:57-71`, `projects.ts:82-89`, `clients.ts:46-53`). The
default Workspace cannot be deleted (`workspaces.ts:60`).

**Records and the Timer** (`src/sqlite/records.ts`). `insertRecord` is "the one creation path"
(line 34): it validates Workspace and Project, then delegates the placement rule to
`newRecord` from `domain`. `startTimer` stops the running Timer at the new one's start and inserts a
Record with `stop: null` in the Context (lines 60-77). `stopAbandonedTimer` closes a Timer found at
boot at its own `updatedAt`, not at `now` — "under-counting beats logging hours nobody worked"
(lines 83-93; rule at `docs/data-hierarchy.md:67`). `updateRecordRow` refuses to turn a stopped
Record into a second Timer (line 113-115).

**The `TimeStopApi` implementation** (`src/sqlite/api.ts`). `createSqliteApi({ db, installId,
actorId, role, now?, pusher? })` returns the interface. Every method first calls
`require(permission)` (lines 95-97) using `can` from `domain`. Every *write* goes through
`commit(write)` (lines 74-93), which:

1. snapshots the Timer and Context,
2. runs the write in `db.transaction`,
3. calls `pusher.kick()` — this is what makes the push happen "after each commit"
   (`docs/data-hierarchy.md:65`),
4. re-reads the Timer and Context and notifies `subscribeTimer`/`subscribeContext` listeners only if
   something changed.

The Server section (`getServer`, `setServer`, `getSyncStatus`, `subscribeSync`, lines 269-290) is
a thin layer over `server.ts` and the Pusher: `setServer` re-parses with `serverInputSchema` so
"every caller stores one URL shape", writes URL and (if provided) Token, then either `kick()`s or,
when a Token was replaced, `resume()`s the pusher to clear a halt (lines 273-283). `ServerSettings`
never returns the Token itself, only `tokenSet` (line 101; contract at `domain/src/sync.ts:139-141`).

**Settings storage** (`src/sqlite/settings.ts`, `server.ts`). `readSetting`/`writeSetting` are a
key/value upsert/delete over the `settings` table. `server.ts` stores `serverUrl` and `serverToken`
"both plaintext in the settings table" (line 8); clearing the URL also drops the Token (line 27).

**The Pusher** (`src/sqlite/pusher.ts`) is described in detail in section 3.4.

**Dashboard and Report** (`src/sqlite/dashboard.ts`, `report.ts`). `readDashboard` loads every
Record of the Actor "touching the Range" (start before `to`, stop after `from` or running), computes
Overlap over that whole set, then filters rows by Workspace/Project/Client/Billable and attaches
Client, Currency and Limits usage (memoized per Project and Period) before delegating totals to
`domain`. `readReport` reuses `readDashboard` and adds Workspace names for the filename.

**Consumers.** `apps/desktop/src/main/database.ts` and `shell.ts` (SQLite side),
`apps/server/src/*.ts` (Postgres side).

### 1.3 `apps/desktop/src/main/imports` — Toggl Track CSV → Time Stop

**Purpose.** Reads the CSV that Toggl Track's *Reports → Detailed → Export* produces and writes it
into a Time Stop database through `TimeStopApi`, "so every entity lands with its Change"
(`importToggl.ts:161-162`).

**Why inside desktop main.** The desktop Settings page is the only entry point (the IPC handler in
`index.ts` of the same folder); there is no CLI. Parsing depends on `luxon`, which is why the
desktop app carries it as a direct dependency alongside `domain`.

**Interface**: `parseTogglCsv` (`togglCsv.ts`), `importToggl` (`importToggl.ts`), types `TogglEntry`,
`ParseOptions`, `ImportOptions`, `ImportSummary`.

**Parsing** (`togglCsv.ts`). A hand-written RFC-4180-style CSV reader (`parseRows`, lines
30-68, handles quotes, doubled quotes, CRLF). `parseTogglCsv(text, { zone })` strips the BOM Toggl
writes (line 87), requires the columns `Description`, `Billable`, `Start date`, `Start time` (lines
22, 89-90), treats a bare `-` as unset (lines 24-28), and resolves `Start date`+`Start time` and
`Stop date`+`Stop time` to epoch ms **in the given IANA zone** because "Toggl stamps local times
without an offset" (lines 17-20, 78-83). `Duration` (`h:mm:ss`), `Amount`, `Currency`, `Project`,
`Client` are carried along. Output: `TogglEntry[]` (lines 3-15).

**Mapping to domain types** (`importToggl.ts`). `importToggl(api, entries, options)`:

1. `targetWorkspace` — by `workspaceId` (must exist), else by `workspaceName` (created if missing,
   with the first Currency seen in the export), else the first (default) Workspace (lines 70-90).
2. `importClients` — each distinct Toggl client name becomes a Client in that Workspace unless one
   with that name exists (lines 92-107).
3. `importProjects` — each distinct Toggl project becomes a Project with a deterministic colour
   hashed from its name (lines 23-39), the Client of the first entry that names one, and a Rate
   inferred from the first entry that has an Amount: `Amount / (billed hours)`, using Toggl's own
   `Duration` when present because "Toggl bills its own duration, which a rounded export leaves
   shorter than the span of the entry" (lines 41-53).
4. Records — every stopped entry becomes a Record via `api.createRecord` (so the Project's Rate is
   frozen onto it by `newRecord`), with `billable` from the CSV. Running entries are skipped.
   Idempotency is a key of `start|stop|projectId|name` against existing stopped Records in the
   Workspace (lines 55-57, 142-158), so "Importing the same export twice adds nothing"
   (`README.md:77`).

---

## 2. Electron desktop app — `apps/desktop` (main, preload, shared)

### 2.1 Electron's process model in ten lines

An Electron app runs at least two kinds of OS process. The **main process** is a Node.js program: it
has the filesystem, native modules (here `better-sqlite3`), the `app`, `BrowserWindow`, `Tray`,
`Menu`, `dialog` APIs, and it creates windows. Each window's page runs in a **renderer process**,
which is Chromium: it renders HTML/CSS and runs your React code, but — when configured securely —
has *no* Node and no Electron APIs. The **preload script** runs inside the renderer process *before*
the page, with a limited bridge to Electron; with `contextIsolation: true` it lives in a separate
JavaScript world, and the only way it can hand anything to the page is
`contextBridge.exposeInMainWorld(name, value)`, which copies a plain object (functions included)
onto `window[name]`. Main and renderer talk over **IPC** on named channels:
`ipcRenderer.invoke(channel, payload)` in the preload ↔ `ipcMain.handle(channel, handler)` in main
for request/response, and `webContents.send(channel, value)` ↔ `ipcRenderer.on(channel, listener)`
for main-to-renderer events. Reference: <https://www.electronjs.org/docs/latest/tutorial/process-model>,
<https://www.electronjs.org/docs/latest/tutorial/context-isolation>,
<https://www.electronjs.org/docs/latest/tutorial/ipc>.

This repo turns those settings all the way up: `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true` (`src/main/window.ts:22-24`), a Content-Security-Policy of `default-src 'self'` in
production (`electron.vite.config.ts:12`), and an eslint rule forbidding `import 'electron'` anywhere
in the renderer: "The renderer reaches the main process only through window.timeStop"
(`apps/desktop/eslint.config.js:24-36`).

### 2.2 Source layout and why it is split this way

```
apps/desktop/
├── electron.vite.config.ts   three Vite builds: main, preload, renderer
├── electron-builder.yml      packaging (unpacked dir per OS)
├── package.json              main: ./out/main/index.js
├── tsconfig.node.json        main + preload + shared + e2e   (Node types)
├── tsconfig.web.json         renderer + preload/index.d.ts   (DOM types)
├── resources/                tray icons (template PNGs)
└── src/
    ├── main/                 Node: lifecycle, window, DB, IPC handlers, tray/menus, dialogs
    │   ├── index.ts          entry: app.whenReady → openDatabase → registerShell → register IPC → window
    │   ├── database.ts       userData path → openSqlite → bootstrap → stopAbandonedTimer → pusher → api
    │   ├── ipc.ts            generic registerMethods / broadcastEvents driven by method tables
    │   ├── window.ts         BrowserWindow factory, sizes, security webPreferences
    │   ├── shell.ts          Tray, app menu, global hotkey, Dock badge, window title, 'shell:*' IPC
    │   ├── shellText.ts      pure string builders for tray line and window title
    │   ├── files.ts          'files:saveText' → save dialog + writeFile (Report export)
    │   └── imports/          'imports:importToggl' → open dialog + Toggl CSV parsing and mapping
    ├── preload/
    │   ├── index.ts          builds window.timeStop / shell / files / imports from the same tables
    │   └── index.d.ts        declares those globals on Window for the renderer's tsconfig
    ├── shared/               contracts imported by BOTH main and preload (and typed into renderer)
    │   ├── shell.ts          ShellApi + shellMethods (window mode, always-on-top)
    │   ├── files.ts          FilesApi + filesMethods
    │   └── imports.ts        ImportsApi + importsMethods
    └── renderer/             React app (out of scope here)
```

The organizing idea: **every IPC surface is a `{ interface, methods table }` pair**. The table
(`MethodTable<Api>` from `domain`) lists each method with its zod input schema. `main/ipc.ts`
consumes a table to register `ipcMain.handle` handlers that validate input; `preload/index.ts`
consumes the *same* table to generate `ipcRenderer.invoke` wrappers. Channel names are derived
(`${prefix}:${method}`), so main and preload cannot disagree on them, and the renderer sees a typed
`window.timeStop` that is structurally the `TimeStopApi` interface. `shared/` exists because main and
preload both import these tables but are compiled as separate Vite bundles; `domain` holds the
application API's table (`apiMethods`), and `shared/` holds the three desktop-only ones.

### 2.3 Reading order, file by file

**`src/main/index.ts` — lifecycle.**

- Lines 9-11: if `TIME_STOP_PROFILE_DIR` is set, `app.setPath('userData', …)` redirects the profile
  so tests "never touch the real database".
- Line 14: after `app.whenReady()`, `openDatabase(app.getPath('userData'))` returns `{ api, db,
  pusher }`. `userData` is Electron's per-user app-data folder; with the workspace name
  `@time-stop/desktop` it resolves to `~/Library/Application Support/@time-stop/desktop` on macOS.
- Lines 19-28: `registerShell` (tray, menus, hotkey) is created first with callbacks to find or open
  the window.
- Line 31: IPC handlers are registered — `registerIpc(api)`, `registerFilesIpc()`,
  `registerImportsIpc(api)` — *before* the window opens "so the renderer's first calls always land".
- Line 32: `open()` creates the window with the persisted always-on-top preference.
- Line 35: `pusher.kick()` — "Whatever the last session left unsent goes out now." This is the
  launch-time push.
- Lines 38-43: `before-quit` disposes the shell, removes IPC handlers, **stops the pusher**, then
  `api.stopTimer()` — "a Timer never outlives the app". Note the order: the stop Change written here
  is not pushed until the next launch (the pusher was already stopped).
- Lines 45-51: macOS `activate` reopens a window; `window-all-closed` is a no-op so closing the
  window leaves the app in the tray.

**`src/main/database.ts` — DB location and initialization.** `openDatabase(userData)` creates the
folder, joins `timestop.sqlite3` (line 13), calls `openSqlite` (migrations run here), `bootstrap`
(identity + default Workspace), `stopAbandonedTimer`, creates the Pusher, and returns
`createSqliteApi({ db, ...identity, pusher })` (lines 22-30). This is the only place the desktop
touches `@time-stop/db`'s SQLite side besides `shell.ts`'s two `readSetting`/`writeSetting` calls.

**`src/main/ipc.ts` — the generic transport.**

- `registerMethods(prefix, table, handlers)` (lines 12-32): for each method in the table, register
  `ipcMain.handle(`${prefix}:${method}`, …)`; the handler parses the raw payload with the table's
  schema (or passes `undefined`), then calls the implementation with `(input, BrowserWindow |
  null)`. The second argument lets dialog-based handlers parent their dialog to the calling window.
  Returns a function that removes all handlers.
- `broadcastEvents(prefix, table, api)` (lines 34-49): for each `subscribe*` in `apiEvents`,
  subscribe once on the api and forward every value to **every** renderer via
  `webContents.getAllWebContents()` — "so a second window follows the Timer too".
- `registerIpc(api)` (lines 51-58) wires `apiMethods`/`apiEvents` under the prefix `timeStop`.
  Resulting channel names: `timeStop:startTimer`, `timeStop:getDashboard`, …, and events
  `timeStop:timerChanged`, `timeStop:syncChanged`, `timeStop:contextChanged`.

Because `apiMethods` is `satisfies MethodTable<TimeStopApi>`, adding a method to the interface
without adding it to the table (or vice versa) fails `typecheck` in `domain`, and the handlers type
`Handlers<Api>` (lines 5-10) forces main to implement it.

**`src/preload/index.ts` — the bridge.** `bridgeMethods(prefix, table)` (lines 8-18) builds an
object whose every key is `(input) => ipcRenderer.invoke(`${prefix}:${method}`, input)`;
`bridgeEvents` (lines 20-37) builds `subscribeX(listener)` functions that `ipcRenderer.on` the
channel and return an unsubscribe. Four globals are exposed (lines 47-50):

| Global | Type | Table | Main handler |
| --- | --- | --- | --- |
| `window.timeStop` | `TimeStopApi` | `apiMethods` + `apiEvents` (domain) | `registerIpc` → `createSqliteApi` |
| `window.shell` | `ShellApi` | `shellMethods` (`shared/shell.ts`) | `registerShell` |
| `window.files` | `FilesApi` | `filesMethods` (`shared/files.ts`) | `registerFilesIpc` |
| `window.imports` | `ImportsApi` | `importsMethods` (`shared/imports.ts`) | `registerImportsIpc` |

`src/preload/index.d.ts` declares these on `Window` and is included in the renderer's
`tsconfig.web.json:10`, which is how React code gets types without importing anything from
preload.

The preload is built as CommonJS (`electron.vite.config.ts:40-44`, entry `index.cjs`) and bundles
`@time-stop/domain`, `zod` and `luxon` into itself (line 39) because "A sandboxed preload cannot
require packages, so the method tables it reads are bundled in." The main bundle, by contrast,
externalizes all dependencies (line 35) so `better-sqlite3`'s native binary is loaded from
`node_modules` at runtime.

**`src/shared/*.ts` — desktop-only contracts.**

- `shell.ts`: `WindowMode = 'compact' | 'expanded'` ("The Tracker fits the compact window; the
  Dashboard and Settings need the expanded one"), `ShellApi { isAlwaysOnTop, setAlwaysOnTop,
  setWindowMode }`, `shellMethods`.
- `files.ts`: `saveText({ filename, text }) → boolean` ("False when the Owner cancels the dialog");
  the renderer builds the Report CSV via `window.timeStop.exportReport` and hands it here to write.
- `imports.ts`: `importToggl({ workspaceId: uuidv7, zone }) → ImportTogglResult | null`.

**`src/main/window.ts` — window creation.** `createWindow(alwaysOnTop)` opens a hidden 420×640
window (`windowSizes.compact`, lines 6-9), with the preload path resolved relative to the built main
bundle (`../preload/index.cjs`, line 21) and the security flags noted above. It shows on
`ready-to-show` unless `TIME_STOP_HEADLESS` (line 31), blocks the page from changing the title
(line 33; the Timer owns it), restores the tab's size after un-maximize (lines 34-37), opens
external links in the OS browser and denies new windows (lines 39-43), and loads either the dev
server URL `ELECTRON_RENDERER_URL` (set by `electron-vite dev`) or the built `renderer/index.html`
(lines 45-49). `applyWindowMode` resizes in place (lines 54-60).

**`src/main/shell.ts` — tray, menus, hotkey, badge, title.** `registerShell({ api, db, getWindow,
showWindow })`:

- Creates a `Tray` (tolerating desktops without one, lines 78-85) with template icons from
  `resources/` (lines 41-50).
- Subscribes to `api.subscribeTimer` and `api.subscribeContext` (lines 185-188). On a Timer it ticks
  every second (`TICK_MS`, line 38) to update the tray title/tooltip and window title with the
  elapsed Duration (`tickShell`, lines 104-111; text from `shellText.ts`), and re-renders the menus,
  tray image and Dock badge only when the running state or Name changes (`renderMenu`, lines
  122-148) because "replacing a menu while it is open under the pointer closes it".
- Registers a global shortcut `CommandOrControl+Alt+S` to toggle the Timer from any app (lines
  19-20, 192-195) and an in-app accelerator `CommandOrControl+S` via the application menu (lines
  22-23, 113-120).
- Registers the `shell:*` IPC handlers: `isAlwaysOnTop`/`setAlwaysOnTop` persist to the `settings`
  table under `windowAlwaysOnTop` (lines 37, 52-54, 201-209), `setWindowMode` resizes the calling
  window (lines 210-212).
- `dispose()` unsubscribes, clears the tick, unregisters the hotkey, destroys the tray and removes
  the handlers (lines 215-223).

`TIME_STOP_HEADLESS` also installs a `globalThis.timeStopShell.trayLine` probe (lines 27-35) so e2e
tests can read the tray text where the OS offers no getter.

**`src/main/shellText.ts`** — pure functions `trayLabel`, `trayLine`, `windowTitle` (Name → Project
→ Workspace fallback; 24-character cap). Kept separate so they are unit-testable without Electron.

**`src/main/files.ts`** — `files:saveText`: `dialog.showSaveDialog` (parented to the calling window
when known) then `writeFile`; returns `false` on cancel.

**`src/main/imports/index.ts` — Toggl import wiring.** `imports:importToggl`: `dialog.showOpenDialog`
filtered to `.csv`, then `parseTogglCsv(text, { zone })` and `importToggl(api, entries, {
workspaceId })` from the sibling modules, returning counts and the filename. The import runs in
the main process against the *live* `api`, so each created entity goes through `commit` and thus
kicks the Pusher.

### 2.4 Settings storage on the desktop

There is no JSON settings file. Everything user-configurable lives in the SQLite `settings` table via
`readSetting`/`writeSetting`:

| Key | Written by | Meaning |
| --- | --- | --- |
| `installId`, `actorId`, `actorRole` | `packages/db/src/sqlite/bootstrap.ts:58-65` | Identity minted on first launch |
| `defaultWorkspaceId` | same | The Workspace that catches Records with no Project and cannot be deleted |
| `contextWorkspaceId`, `contextProjectId` | `packages/db/src/sqlite/context.ts:9-10` | The Context |
| `serverUrl`, `serverToken` | `packages/db/src/sqlite/server.ts:5-6` | Server section of Settings (plaintext) |
| `windowAlwaysOnTop` | `apps/desktop/src/main/shell.ts:37` | Window preference |

### 2.5 The "desktop pusher" as the desktop sees it

Commit `1e3deea` ("Desktop pusher and Settings Server section (GEM-153)") added `pusher.ts`,
`server.ts`, the Server methods on `TimeStopApi`, the renderer's `ServerSection` and `useSync`
hook. From the desktop's side the pieces are:

- `database.ts:28-29` creates the Pusher and hands it to the api, keeping the handle "it needs to
  stop at quit" (`packages/db/src/sqlite/api.ts:62`).
- `index.ts:35` kicks it at launch; `index.ts:41` stops it at quit.
- `createSqliteApi.commit` kicks it after every write (`packages/db/src/sqlite/api.ts:83`).
- The renderer reads `getServer`/`getSyncStatus` and subscribes to `syncChanged` through
  `window.timeStop` (`src/renderer/src/hooks/useSync.ts`, noted only as the consumer); the main
  process "pushes every move of the sync state, so nothing here polls".

The Pusher's own algorithm is in section 3.4.

### 2.6 Build and packaging config

- **`electron.vite.config.ts`.** electron-vite runs three Vite builds from one file
  (<https://electron-vite.org/guide/>). `main` externalizes deps (line 35). `preload` externalizes
  all but `domain`/`zod`/`luxon` and emits CJS `index.cjs` (lines 37-45). `renderer` aliases `@` to
  `src/renderer/src`, adds React and Tailwind v4 plugins, and a custom `csp()` plugin that injects
  a `<meta http-equiv="Content-Security-Policy">`: `default-src 'self'` in production, relaxed for
  React Refresh, injected styles and the HMR websocket in dev (lines 7-31, 46-54). Output goes to
  `out/main/index.js`, `out/preload/index.cjs`, `out/renderer/index.html` (observed in
  `apps/desktop/out/`).
- **`electron-builder.yml`.** `appId: dev.gembag.time-stop`, `productName: Time Stop`, output
  `release/`, files `out/**` and `resources/**`, `asar: true`, `npmRebuild: false`, and every OS
  target is `dir` (an unpacked app folder, not an installer). `npm run package` is
  `electron-builder --dir` (`package.json:13`); CI runs it as a dry run (`.github/workflows/ci.yml:39-40`).
- **`package.json` scripts** (lines 9-18): `dev`, `build`, `preview` (electron-vite), `package`,
  `typecheck` (two tsconfigs), `lint`, `test` (vitest, jsdom for renderer tests), `test:e2e`
  (Playwright against the built app — `playwright.config.ts:3`).
- **Electron version** is pinned exactly: `"electron": "44.1.1"` (line 46), unlike every other dep.
- **`components.json`** is shadcn/ui's config for the renderer (style `new-york`, CSS variables,
  Lucide icons); relevant to the ADR's skin-engine constraint (`docs/adr/0001-v1-tech-stack.md:17`)
  but outside this doc's scope.

---

## 3. Server app — `apps/server`

### 3.1 What it is

A headless HTTP service whose only job is to receive Changes and mirror them into PostgreSQL. ADR-0001:
"The server exposes a single REST endpoint, `POST /changes`, with zod contracts in the shared
package; tRPC is deferred until the API surface grows in v2" (`docs/adr/0001-v1-tech-stack.md:7`).
Framework: Hono (`hono`, a small web framework with a `fetch`-style handler) served by
`@hono/node-server` (`apps/server/package.json:16-19`).

### 3.2 Every source file, in start-up order

1. **`src/env.ts`** — `databaseUrl()` reads `DATABASE_URL` or throws `DATABASE_URL is not set`.
   Env comes from the process environment, or from `apps/server/.env` via Node's
   `--env-file-if-exists=.env` flag in the `dev`, `start` and `cli` scripts (`package.json:7,9,13`).
   `.env.example` documents `DATABASE_URL=postgres://timestop:timestop@localhost:5432/timestop` and
   `PORT=3000`.
2. **`src/index.ts`** — the entry point. Reads `PORT` (default 3000, line 6), **awaits
   `openPostgres(databaseUrl())`** (line 7) — which connects *and runs migrations* (section 1.2) —
   then `serve({ fetch: createApp(db).fetch, port })` and logs the URL (lines 9-11). Top-level
   `await` is legal because the package is ESM (`"type": "module"`). If Postgres is unreachable the
   process exits before listening; there is no retry.
3. **`src/app.ts`** — `createApp(db)` builds the Hono app:
   - `GET /health` → `{ status: 'ok' }` (line 12). Used by the Dockerfile `HEALTHCHECK`.
   - `app.onError` maps `TokenError` reasons to status codes via `statusOf` — `unknown` and
     `revoked` → 401, `mismatch` → 403 (lines 7, 14-19); anything else logs and returns 500.
   - `POST /changes` (lines 21-33): require `Authorization: Bearer <token>` (401 `Token missing`
     otherwise); `findToken(db, token)` throws `TokenError` for unknown/revoked; parse the body with
     `pushChangesRequestSchema.safeParse` — failure is 400 `Malformed batch` with zod issues and
     nothing is written; then `ingestChanges(db, token.id, changes)` and return `{ inserted }`.
4. **`src/tokenCli.ts`** — `runTokenCli(args, db, print)`: `mint` prints the Token id and the Token
   "(shown once)"; `revoke <id>` revokes or throws `not found or already revoked`; anything else
   throws the usage line. Pure function taking `print` so it is testable.
5. **`src/cli.ts`** — the CLI entry: `openPostgres`, `runTokenCli(process.argv.slice(2), db,
   console.log)`, exit code 1 on error, always `closePostgres`. Invoked as
   `node apps/server/dist/cli.js mint` inside the container or `npm run cli --workspace=@time-stop/server -- mint`
   locally (`README.md:89-101`).
6. **`src/testDb.ts`, `src/testGlobalSetup.ts`** — test-only helpers (a fresh database per test file;
   testcontainers or `DATABASE_URL`). Excluded from the build by `tsconfig.json:8`
   (`"exclude": ["src/**/*.test.ts", "src/test*.ts"]`).

**Auth model** (implemented in `packages/db/src/postgres/tokens.ts`, specified in
`docs/data-hierarchy.md:70-79`): a Token is `tst_` + 32 random bytes base64url (line 36); only its
SHA-256 hex is stored (`tokenHash`, unique index); `findToken` hashes the presented value and
looks it up. **Trust on first use**: `bindToken` runs inside the ingest transaction with
`SELECT … FOR UPDATE`; an unbound Token takes the batch's `installId`/`actorId`; a bound one must
match or `TokenError('mismatch')` → 403 (lines 63-78). Tokens never expire; rotation is manual.

### 3.3 Local-only mode: what happens with no Server configured

Nothing in the desktop requires a Server. Concretely:

- `openDatabase` always opens the local SQLite file and always creates a Pusher
  (`apps/desktop/src/main/database.ts:25-29`).
- Every write still appends a Change with `pushedAt: null` (`packages/db/src/sqlite/changes.ts:65`),
  so the log accumulates locally.
- `Pusher.drain()` reads `readServer(db)` and **returns immediately** when either `url` or `token`
  is null (`packages/db/src/sqlite/pusher.ts:160-161`). `kick()` still calls `emit()`, so the
  renderer's `SyncStatus` shows `configured: false` and a growing `pending` count (lines 70-84,
  193-199).
- Reads never touch the Server at all — there is no code path that fetches from it.

So "local-only" is not a mode switch; it is the Pusher finding no URL/Token and doing nothing. Once
the Owner enters both in Settings, `setServer` calls `resume()`/`kick()` and the entire backlog —
including the very first Change from `bootstrap` — drains to the Server.

### 3.4 The SQLite → PostgreSQL push, end to end

**Trigger.** Three events wake the loop: launch (`apps/desktop/src/main/index.ts:35`), every
committed write (`packages/db/src/sqlite/api.ts:83`), and Settings changes (`api.ts:280-281`).
`kick()` sets `again = true` and starts `run()` if none is in flight (`pusher.ts:193-199`); `run()`
loops `drain()` while `again` is set, so kicks during a run coalesce into one more pass
(lines 176-191).

**What is sent.** `nextBatch()` selects Changes `WHERE pushed_at IS NULL ORDER BY rowid LIMIT 200`
(`BATCH_SIZE`, lines 7, 91-102) — insertion order, "which two Changes stamped in the same millisecond
still separate". `post()` strips `pushedAt` and sends
`POST {url}/changes` with `{ changes: [...] }`, `content-type: application/json`,
`authorization: Bearer {token}` (lines 109-119). The wire shape of one Change is `pushedChangeSchema`
(`domain/src/sync.ts:30-61`): `{ id, entityKind, entityId, op, payload, updatedAt, actorId,
installId }` where `payload` must be the whole entity (validated against the kind's schema, with
`payload.id === entityId` and `payload.updatedAt === updatedAt`) or `{}` for a delete. A batch is
1–1000 Changes from **one** Install and Actor (`pushChangesRequestSchema`, lines 63-80), the pair the
Token binds to.

**Outcome classes** (`attempt`, lines 126-155):

| Response | Outcome | Effect |
| --- | --- | --- |
| Network error / non-2xx other than 400/401/403 | `retry` | `lastError.kind = 'network'`, exponential backoff 1 s → 2 s → … capped at 300 s (lines 8-9, 171-173), retried "forever" |
| 2xx | `sent` | `pushedAt = now()` stamped on the batch (lines 104-107), `lastError` cleared, backoff reset, next batch immediately |
| 401 / 403 | `halt` | `lastError.kind = 'auth'`, `halted = true`; Changes stay queued until the Owner replaces the Token (`resume()`) |
| 400 | `halt` | `lastError.kind = 'request'`, logged as "a bug here, not a condition that waiting fixes" |

This matches `docs/data-hierarchy.md:77`: bad Token → stop and say so; network/Server errors →
retry indefinitely. A local exception in the loop is also treated as `request`/halt (lines 183-187).
Backoff timers are `unref()`'d so a pending retry never holds the process open at quit (lines 53-59).

**Ids and timestamps.** All ids are UUIDv7 minted by the Install (`uuid({ msecs: at })` in
`bootstrap.ts`, `changes.ts`, `records.ts`, `workspaces.ts`, `clients.ts`, `projects.ts`); all
timestamps are the Install's `updatedAt` epoch ms. The Server "assigns nothing and records no
receipt time" (`docs/data-hierarchy.md:64`) — and indeed the Postgres `changes` table has no
server-side column (`packages/db/src/postgres/schema.ts:77-92`).

**Idempotency and conflict handling on the Server** (`packages/db/src/postgres/ingest.ts`,
`domain/src/sync.ts:86-115`). `ingestChanges` runs one transaction per batch:

1. `bindToken` (TOFU check, above).
2. For each Change: `INSERT INTO changes … ON CONFLICT DO NOTHING RETURNING id`. If nothing was
   returned the Change was already stored — skip it. This makes re-posting a batch a no-op
   (`inserted: 0`).
3. For a new Change, `materializeChange(store, change)`: read `MAX(updated_at)` from the **Change
   log** for that entity; if it is strictly newer than this Change's `updatedAt`, return `'stale'`
   and touch nothing; else upsert the payload (`INSERT … ON CONFLICT (id) DO UPDATE`) or delete the
   row. "Whole-entity last-write-wins on updatedAt; a tie applies, so replays are idempotent"
   (`sync.ts:99-102`). Reading the log rather than the entity row is deliberate so an older update
   cannot resurrect a deleted row (`sync.ts:86-90`). Because the Change was inserted in step 2 before
   the read, the max includes itself, which is why the comparison is strict `>`.

A failed batch (any thrown error) rolls back everything, "so a failed batch leaves nothing behind"
(`ingest.ts:38-41`), and the desktop will retry the same batch.

**Where the Change log and the materialized state live.** Postgres `changes` is the append-only log;
`workspaces`, `clients`, `projects`, `records` are the materialized current state; `tokens` holds
hashes and bindings (`README.md:120`).

### 3.5 Backward sync (Server → desktop)

It does not exist, and it is documented as out of scope:

- "The Server applies them in order and never sends data back in v1"; "A second Install for the same
  Actor, Server-to-Install sync, and anyone other than the Owner reading the Server are v2"
  (`docs/data-hierarchy.md:65,68`).
- "Reads never go to the Server" (`docs/data-hierarchy.md:62`).
- The server has exactly two routes, `GET /health` and `POST /changes` (`apps/server/src/app.ts`).
  There is no `GET /changes`, no cursor, no per-Install watermark.
- The one forward-looking hook is in the ADR: "the materializer lives in `packages/domain` so the
  v2 pull path reuses it" (`docs/adr/0001-v1-tech-stack.md:18`) — `materializeChange` is written
  against the abstract `EntityStore` interface (`domain/src/sync.ts:91-95`) precisely so a SQLite
  store could implement it later. No SQLite `EntityStore` exists today.

### 3.6 `apps/server/Dockerfile`, line by line

**Docker, briefly.** A Docker *image* is a frozen filesystem plus a start command; a *container* is a
running instance of one. A `Dockerfile` is the recipe; each instruction adds a *layer* that is cached
and reused on the next build as long as the instruction and everything it copies are unchanged. A
*multi-stage* Dockerfile has several `FROM … AS name` sections; only the last stage ends up in the
final image, and earlier stages exist to build things or to be copied from with
`COPY --from=`. Reference: <https://docs.docker.com/build/building/multi-stage/>. The build context
is the repo root (`compose.yaml:4-5`), filtered by `.dockerignore` (excludes `node_modules`,
`dist`, `out`, `.git`, `docs`, `prototypes`, …).

```dockerfile
# syntax=docker/dockerfile:1                     # 1: opt into the current Dockerfile syntax
FROM node:24-alpine AS base                      # 3: stage "base": tiny Alpine Linux + Node 24
WORKDIR /app                                     # 4: every later path is relative to /app

FROM base AS deps                                # 7: stage "deps" — install ALL deps once
COPY package.json package-lock.json .npmrc ./    # 8: root manifests only
COPY packages/tsconfig/package.json packages/tsconfig/         # 9-15: one package.json per
COPY packages/eslint-config/package.json packages/eslint-config/ #      workspace, and nothing
COPY packages/domain/package.json packages/domain/             #      else. npm ci needs every
COPY packages/db/package.json packages/db/                     #      workspace manifest to
COPY apps/server/package.json apps/server/                     #      reproduce the lockfile
                                                               #      exactly.
COPY apps/desktop/package.json apps/desktop/
RUN npm ci --ignore-scripts                      # 16: install from lockfile; skip postinstall
                                                 #     scripts (no native builds, no electron dl)
FROM deps AS build                               # 18: stage "build" starts from deps
COPY tsconfig.json turbo.json ./                 # 19: solution tsconfig + turbo task graph
COPY packages/tsconfig packages/tsconfig         # 20-23: the sources the server needs —
COPY packages/domain packages/domain             #        and only those (no desktop, no
COPY packages/db packages/db                     #        desktop sources)
COPY apps/server apps/server
RUN npx turbo build --filter=@time-stop/server   # 24: builds domain → db → server (^build)

FROM base AS runtime                             # 26: final image starts clean from "base"
ENV NODE_ENV=production                          # 27
COPY --from=build /app/package.json /app/package-lock.json /app/.npmrc ./   # 28
COPY --from=build /app/packages/domain/package.json packages/domain/        # 29-35: only
COPY --from=build /app/packages/domain/dist packages/domain/dist            #   manifests, dist
COPY --from=build /app/packages/db/package.json packages/db/                #   output and the
COPY --from=build /app/packages/db/dist packages/db/dist                    #   Postgres
COPY --from=build /app/packages/db/drizzle/postgres packages/db/drizzle/postgres  # migrations
COPY --from=build /app/apps/server/package.json apps/server/                #   (read at boot by
COPY --from=build /app/apps/server/dist apps/server/dist                    #   openPostgres)
RUN npm ci --omit=dev --ignore-scripts --workspace=@time-stop/server \      # 36: prod deps of
    && npm cache clean --force                   #     the server workspace (+ linked db/domain)
USER node                                        # 37: drop root
EXPOSE 3000                                      # 38: documents the port (compose publishes it)
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \     # 39-40: Docker
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1                      #   polls GET /health
CMD ["node", "apps/server/dist/index.js"]        # 41: the process the container runs
```

Why it is shaped this way:

- **Deps before sources (lines 8-16).** Copying only `package.json` files and running `npm ci` in
  its own layer means source edits do not invalidate the (slow) install layer; the cache is busted
  only when a manifest or the lockfile changes.
- **Every workspace manifest is copied, even desktop's (line 15).** `npm ci` refuses to run unless
  the workspace tree matches `package-lock.json`, so the desktop's manifest must be present even
  though its code is never built here. A side effect is that the deps stage installs the desktop's
  dependencies too (React, Electron package, …) — `--ignore-scripts` at least prevents Electron's
  binary download and `better-sqlite3`'s native compile.
- **Workspace pruning is manual.** There is no `turbo prune`; the Dockerfile hand-picks which
  folders to copy into `build` and `runtime`. `turbo build --filter=@time-stop/server` follows
  `^build` to build `domain` and `db` first.
- **Runtime carries the Postgres migrations (line 33)** because `openPostgres` resolves
  `../../drizzle/postgres` relative to `dist/postgres/open.js` at boot
  (`packages/db/src/postgres/open.ts:14`). The SQLite migrations are deliberately not copied.
- **`--omit=dev --workspace=@time-stop/server` (line 36)** installs the server's production deps and,
  since `@time-stop/db` and `@time-stop/domain` are workspace links, theirs too. That includes
  `better-sqlite3` (a dependency of `db`), which with `--ignore-scripts` ends up present but without
  a compiled binary; the server never imports the SQLite subpath, so this is harmless today (see 6).
- **`USER node`** runs the process unprivileged. **`EXPOSE`** is documentation; the actual port
  mapping is in `compose.yaml`.

---

## 4. `compose.yaml` and CI

### 4.1 Docker Compose, briefly

Compose describes a set of containers ("services") and how they connect, in one YAML file, so
`docker compose up` starts them together on a private network where each service is reachable by
its name as a hostname. Volumes keep data outside the container's ephemeral filesystem.
Reference: <https://docs.docker.com/compose/>.

### 4.2 `compose.yaml`

```yaml
services:
  server:                                   # 2
    build: { context: ., dockerfile: apps/server/Dockerfile }   # 3-5: build from repo root
    ports: ['3000:3000']                    # 6-7: host 3000 → container 3000
    environment:                            # 8-10
      PORT: '3000'
      DATABASE_URL: postgres://timestop:timestop@postgres:5432/timestop   # hostname = service name
    depends_on:
      postgres: { condition: service_healthy }   # 11-13: wait for the healthcheck, not just start
  postgres:                                 # 15
    image: postgres:17                      # 16: official image, no build
    environment: { POSTGRES_USER: timestop, POSTGRES_PASSWORD: timestop, POSTGRES_DB: timestop }  # 17-20
    ports: ['5432:5432']                    # 21-22: published so psql / Drizzle Studio / the local
                                            #        dev server can reach it from the host
    volumes: ['postgres-data:/var/lib/postgresql/data']   # 23-24: durable data
    healthcheck:                            # 25-29
      test: ['CMD-SHELL', 'pg_isready -U timestop -d timestop']
      interval: 5s
      timeout: 3s
      retries: 10
volumes:
  postgres-data:                            # 31-32: named volume, survives `down` (not `down -v`)
```

Observations:

- **No explicit `networks`** block: both services join Compose's default network, which is why
  `postgres` works as a hostname inside `DATABASE_URL` while `.env.example` uses `localhost` for the
  host-side dev server.
- **`depends_on … service_healthy`** is what lets `openPostgres` succeed on first boot; without it the
  server would race Postgres's start-up and exit (`apps/server/src/index.ts:7`).
- **The server has no compose-level healthcheck**; it relies on the `HEALTHCHECK` baked into the
  image. `docker compose ps` shows it as healthy once `/health` answers.
- **No volume for the server** — it is stateless; all state is in Postgres.
- Credentials are development defaults committed in plain text; the same triple appears in
  `.env.example`, `drizzle.postgres.config.ts:8` and the CI workflow.

### 4.3 `.github/workflows/ci.yml`

```yaml
name: CI
on: { push: }                                   # 3-4: every push to any branch; no pull_request
env: { TURBO_TELEMETRY_DISABLED: '1' }          # 6-7
jobs:
  checks:                                       # 10: a single job, no matrix
    runs-on: ubuntu-latest
    services:
      postgres:                                 # 12-25: a sidecar container for the server tests
        image: postgres:17
        env: { POSTGRES_USER: timestop, POSTGRES_PASSWORD: timestop, POSTGRES_DB: timestop }
        ports: ['5432:5432']
        options: --health-cmd "pg_isready -U timestop -d timestop" --health-interval 5s …
    env:
      DATABASE_URL: postgres://timestop:timestop@localhost:5432/timestop   # 26-27
    steps:
      - uses: actions/checkout@v4                                       # 29
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }                 # 30-33: Node 24, npm cache
      - run: npm ci                                                     # 34
      - run: npx turbo build lint typecheck test                        # 35
      - run: npm run format:check                                       # 36
      - name: Playwright-Electron smoke
        run: xvfb-run -a npm run test:e2e --workspace=@time-stop/desktop   # 37-38
      - name: electron-builder dry run
        run: npm run package --workspace=@time-stop/desktop             # 39-40
```

- **Trigger**: `push` only. The README's "on every push and pull request" (`README.md:136`) is
  broader than the file (see 6). Pushes to a PR branch do run it, so PRs are covered indirectly.
- **Caching**: only npm's download cache via `setup-node` (`cache: npm`). Turbo's local cache is not
  persisted between runs, so every run builds from scratch.
- **Postgres**: the `services.postgres` sidecar plus `DATABASE_URL` makes `testGlobalSetup.ts` take
  the "CI provides a Postgres service" branch instead of testcontainers
  (`apps/server/src/testGlobalSetup.ts:10-16`).
- **What fails the build**: any workspace's `build`, `lint`, `typecheck` or `test` (turbo runs them
  all and fails on the first failing task, honouring the `^build` order); a Prettier diff; the
  Playwright e2e suite against the built Electron app under a virtual X display (`xvfb-run`); or
  electron-builder failing to package (`--dir`, so no code-signing or installer step).
- **Not done**: no artifact upload, no Docker image build, no deploy, no matrix across OSes.

---

## 5. Reading order for a newcomer

1. `CONTEXT.md` — the vocabulary; every identifier in the code uses these words.
2. `docs/data-hierarchy.md` — the rules, especially "Storage and sync" and "Authentication".
3. `docs/adr/0001-v1-tech-stack.md` — why Electron + SQLite + Hono + Postgres + Drizzle, in one page.
4. `package.json` + `turbo.json` — workspaces and the `^build` task graph.
5. `packages/domain/src/entities.ts` — the four entities and the Change envelope.
6. `packages/domain/src/api.ts` — `TimeStopApi`, `apiMethods`, `apiEvents`; the shape of everything.
7. `packages/domain/src/sync.ts` — the push wire format and `materializeChange`.
8. `packages/db/src/sqlite/schema.ts` — how those entities land in SQLite (+ `settings`, `changes.pushed_at`).
9. `packages/db/src/sqlite/changes.ts` — `upsertEntity`/`removeEntity`: one transaction, row + Change.
10. `packages/db/src/sqlite/api.ts` — `createSqliteApi` and `commit`: permissions, kick, notifications.
11. `packages/db/src/sqlite/pusher.ts` — the push loop, batching, retry/halt classes.
12. `apps/desktop/src/main/index.ts` → `database.ts` → `ipc.ts` — lifecycle, DB location, IPC from tables.
13. `apps/desktop/src/preload/index.ts` + `src/shared/*.ts` — the four `window.*` bridges.
14. `apps/server/src/app.ts` + `packages/db/src/postgres/ingest.ts` + `tokens.ts` — the receiving side.
15. `apps/server/Dockerfile` + `compose.yaml` + `.github/workflows/ci.yml` — how it ships and is checked.
16. `apps/desktop/src/main/imports/importToggl.ts` — a complete example of driving `TimeStopApi` from outside the UI.

---

## 6. Open questions / inconsistencies noticed

Nothing here was changed; these are observations for whoever owns the area.

1. **README is behind the code on the pusher.** `README.md:107` says "Until the desktop pusher
   exists, push by hand with Postman" and points at `docs/postman/time-stop-server.postman_collection.json`
   and `…postman_environment.json`. The pusher landed in `1e3deea` (GEM-153), and `docs/postman/`
   does not exist in the repository (`ls docs` shows `adr`, `agents`, `data-hierarchy.md`,
   `research`). Either the files were never committed or the paragraph is stale.
2. **README vs CI trigger.** `README.md:136` says CI runs "on every push and pull request";
   `.github/workflows/ci.yml:3-4` has only `on: push`.
3. **Token stored in plaintext.** `packages/db/src/sqlite/server.ts:8` states it: the Server Token
   sits unencrypted in the SQLite `settings` table alongside the URL. The renderer never receives it
   (`ServerSettings.tokenSet`), but anyone with the file has it. Electron's `safeStorage` is not
   used. Whether this is accepted for a single-user local-first app is not recorded in an ADR.
4. **Dev does not watch library changes.** `turbo.json:8-12` gives `dev` a one-time `^build`
   dependency. Editing `packages/domain/src/*` or `packages/db/src/*` while `npm run dev` is running
   requires re-running `npm run build --workspace=…` (or a second `tsc -b --watch`) before the
   server picks it up. The desktop's Vite dev server may or may not re-bundle `domain` into the
   preload on change — not verified here.
5. **Migration `0001` toggles `PRAGMA foreign_keys` itself, but the migrator wraps it in a
   transaction.** `packages/db/drizzle/sqlite/0001_currency_optional.sql:1,13` contains
   `PRAGMA foreign_keys=OFF/ON`, and `packages/db/src/sqlite/open.ts:13-18` explains that "the
   migrator's transaction cannot toggle the pragma" and does it outside instead. The in-file
   pragmas are therefore no-ops; future generated migrations will carry the same lines and rely on
   `open.ts` continuing to wrap them.
6. **Server image ships `better-sqlite3` without a binary.** `apps/server/Dockerfile:36` installs
   `@time-stop/db`'s dependencies with `--ignore-scripts`, so `better-sqlite3` is present but never
   compiled. Safe only as long as nothing in the server's import graph touches
   `@time-stop/db`'s root entry (`src/index.ts` re-exports `openSqlite`). A future accidental
   `import … from '@time-stop/db'` in the server would fail at runtime, not at typecheck.
7. **Deps stage installs the whole monorepo.** `Dockerfile:8-16` copies every workspace manifest so
   `npm ci` can run; that pulls the desktop's React/Electron/Playwright trees into the build cache
   layer even though only three packages are built. Works, but slower and larger than a pruned
   lockfile (`turbo prune`) would be.
8. **Last Change of a session is not pushed until next launch.** `apps/desktop/src/main/index.ts:38-43`
   calls `pusher.stop()` before `api.stopTimer()`, so the Timer-stop Change written at quit stays
   `pushed_at IS NULL` until the next start's `pusher.kick()`. Consistent with "retries until they
   land", but the Server's mirror lags by one session for a running Timer.
9. **Index parity between dialects.** SQLite has `records_actor_stop_idx` (`sqlite/schema.ts:64`)
    and Postgres does not; Postgres has `records_workspace_idx` (`postgres/schema.ts:72`) and SQLite
    does not. Neither is wrong (the two sides serve different queries), but there is no note saying
    the divergence is intentional.
10. **Import idempotency key includes `projectId`.** `apps/desktop/src/main/imports/importToggl.ts:55-57`
    keys existing Records by `start|stop|projectId|name`. If a Project imported from Toggl is later
    deleted (Records keep their Workspace and lose the Project reference, `projects.ts:82-89`), a
    re-import will create duplicates of those Records under a freshly created Project.
11. **Overlap detection is quadratic in the worst case.** `packages/domain/src/dashboard.ts:53-70`
    breaks early on sorted starts, so typical data is fine, but a Range containing many long
    Records (or one never-stopped Timer) degrades toward O(n²). No pagination exists on the
    Dashboard query (`packages/db/src/sqlite/dashboard.ts:16-27` loads every touching Record).
12. **`records.actorId` is stored but v1 has one Actor.** SQLite and Postgres both carry
    `actor_id` on Records and Changes; the Server "keeps no Actor records in v1; `actorId` on a
    Change is stored uninterpreted" (`docs/data-hierarchy.md:79`). The desktop scopes every Record
    query by `actorId` (`api.ts:169,241`, `records.ts:17,28`). What happens to data if the
    `settings` row for `actorId` were lost (bootstrap would mint a new one and existing Records
    would become invisible) is not covered by any doc.
13. **Stale `dist` artefacts.** `packages/db/dist/sqlite/timer.d.ts` exists locally with no
    matching `src/sqlite/timer.ts` — a leftover from a rename (`dc218eb` "Record module owns
    creation and the Timer"). Harmless (git-ignored) but a reminder that `tsc -b` does not clean
    `dist`.
