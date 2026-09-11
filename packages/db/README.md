# @time-stop/db

Storage for both ends of the sync: the Install's SQLite database behind `TimeStopApi`, and the Server's Postgres tables that mirror it. No Electron, no HTTP; the apps own both.

## What db owns

- **Entity row + Change in one transaction.** Every write to a Workspace, Client, Project or Record goes through `upsertEntity` or `removeEntity` (`src/sqlite/changes.ts`), which writes the row and appends the Change in the same transaction. `createSqliteApi` (`src/sqlite/api.ts`) implements `TimeStopApi` over that: permissions, `commit`, Timer and Context notifications.
- **The Pusher** (`src/sqlite/sync/pusher.ts`): mirrors unsent Changes to the Server in batches after every commit and on launch; network errors retry with backoff, a refused Token or a malformed batch halts.
- **Postgres ingest and Tokens** (`src/postgres/`): `ingestChanges` inserts a batch idempotently and materializes it last-write-wins; `mintToken`, `findToken`, `revokeToken` bind a Token to the Install that first pushes with it.

## Entry points

- `@time-stop/db` — `openLocalStore(path)`: migrates, bootstraps the identity and the default Workspace, stops a Timer the previous session abandoned, builds the Pusher, and returns `{ api, pusher, preferences, path }`. `preferences` holds the window settings the desktop shell keeps in the settings table. The desktop main process imports nothing else.
- `@time-stop/db/postgres` — `openPostgres`, `closePostgres`, `ingestChanges`, the Token functions and `postgresSchema`, for the Server.
- `@time-stop/db/testing` — `testApi` (an api over a fresh in-memory database with a settable clock) and what a test needs beside it: `createPusher`, `sqliteSchema`, `projectInput`, `UNKNOWN_ID`.

## Layout of `src/sqlite`

Folder per concept, file per kind, as in `packages/domain`. Concepts are `CONTEXT.md` terms: `workspace/`, `client/`, `project/`, `record/`, `context/`, `dashboard/`, `report/`, `sync/`, `install/`. Kind files:

- `rows.ts` — the concept's table operations, one verb set: `list`, `read`, `insert`, `update`, `remove`, plus a named verb where it means something else (`archiveProject`, `renameRecord`, `startTimer`, `stopTimer`). Every write pairs with a Change through `upsertEntity`/`removeEntity`.
- `read.ts` — a derived view over several tables with no writes (`dashboard/`, `report/`).
- `api.ts` — the concept's `TimeStopApi` group, built over `ApiContext` (`db`, `identity`, `now`, `pusher`, `commit`, `require`). Typed as `TimeStopApi['<group>']`, so a missing member fails at the group.

`install/` holds what identifies this Install rather than an entity: `bootstrap.ts`, `Identity.ts`, `Preferences.ts`. `sync/` holds `pusher.ts`, `server.ts` (the Server URL and Token) and the `sync` group. Shared by every concept, at the root: `schema.ts`, `open.ts`, `changes.ts`, `settings.ts`, `ApiContext.ts`; `api.ts` assembles the groups and owns `commit`; `localStore.ts` is the entry point. A concept imports another's files directly (`../workspace/rows.js`); tests sit beside the file they test.

## Schemas

Two drizzle schemas by design: the Install keeps SQLite (`src/sqlite/schema.ts`) and the Server keeps Postgres (`src/postgres/schema.ts`). They are written by hand, twice, and two catchers make any drift between them loud (ADR-0003).

## Drift catchers

1. **Compile-time parity with the domain.** The bottom of each schema file asserts strict type equality between every table's `$inferSelect` and its entity in `@time-stop/domain`. Postgres `changes` checks against `PushedChange`, because `pushedAt` never leaves the Install. `settings` (SQLite) and `tokens` (Postgres) are storage bookkeeping with no entity and are exempt. A column typed wider or narrower than the entity fails `typecheck`.
2. **Snapshot diff between the dialects.** `src/parity.test.ts` loads the latest drizzle-kit snapshot of each dialect and compares every table's columns, indexes and foreign keys. Any difference not listed in `src/dialectDifferences.ts` fails `test`, and so does a listed difference that no longer exists.

`src/dialectDifferences.ts` is the complete list of intentional differences, each with its reason. Postgres has no foreign keys on purpose: the Server materializes a replay log where Changes land in push order, not dependency order, so a foreign key would reject a batch whose parent row has not arrived yet or was stale-skipped, and the Install would retry that batch forever. Referential integrity is enforced where writes originate; SQLite enforces its foreign keys.

## Changing a schema

Until the v1 tag there is no migration history: each dialect has exactly one migration, `0000_init`, regenerated from scratch on every schema change. Real history starts at v1.

1. Edit both schema files.
2. Run `npm run db:reset -w @time-stop/db`. It deletes `drizzle/` and generates `0000_init` for both dialects; it needs no database.
3. Delete the local databases, which the new `0000_init` cannot migrate: the desktop's `timestop.sqlite3` (its path is shown in Settings) and the Server's volume (`docker compose down -v`). A Toggl import refills the desktop.
4. Commit the schema files together with everything under `drizzle/`.

`src/migrations.test.ts` fails when a dialect has any migration other than `0000_init`. CI runs `db:generate` and fails when `drizzle/` is dirty, which is what keeps the snapshot test honest: a forgotten regenerate would leave two stale snapshots that compare green.

## What is under `drizzle/`

`drizzle/sqlite` and `drizzle/postgres` are drizzle-kit's output, generated and committed, never edited by hand.

- `0000_init.sql` — the migration that creates the whole schema. `migrate()` runs it on a database that has not seen it: at `openLocalStore` for SQLite, at `openPostgres` for Postgres. The migrator needs a folder, so one migration always exists.
- `meta/_journal.json` — the ordered list of migrations with their timestamps, one entry before v1; `migrate()` reads it to know which files exist and in what order.
- `meta/0000_snapshot.json` — the whole schema as drizzle-kit last generated it. `drizzle-kit generate` diffs the schema file against the latest snapshot to write a migration, and `src/parity.test.ts` compares the latest snapshot of each dialect.
