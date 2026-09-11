# @time-stop/db

Storage for both ends of the sync: the Install's SQLite database behind `TimeStopApi`, and the Server's Postgres tables that mirror it. No Electron, no HTTP; the apps own both.

## What db owns

- **Entity row + Change in one transaction.** Every write to a Workspace, Client, Project or Record goes through `upsertEntity` or `removeEntity` (`src/sqlite/changes.ts`), which writes the row and appends the Change in the same transaction. `createSqliteApi` (`src/sqlite/api.ts`) implements `TimeStopApi` over that: permissions, `commit`, Timer and Context notifications.
- **The Pusher** (`src/sqlite/pusher.ts`): mirrors unsent Changes to the Server in batches after every commit and on launch; network errors retry with backoff, a refused Token or a malformed batch halts.
- **Postgres ingest and Tokens** (`src/postgres/`): `ingestChanges` inserts a batch idempotently and materializes it last-write-wins; `mintToken`, `findToken`, `revokeToken` bind a Token to the Install that first pushes with it.

## Entry points

- `@time-stop/db` — `openLocalStore(path)`: migrates, bootstraps the identity and the default Workspace, stops a Timer the previous session abandoned, builds the Pusher, and returns `{ api, pusher, preferences, path }`. `preferences` holds the window settings the desktop shell keeps in the settings table. The desktop main process imports nothing else.
- `@time-stop/db/postgres` — `openPostgres`, `closePostgres`, `ingestChanges`, the Token functions and `postgresSchema`, for the Server.
- `@time-stop/db/testing` — `testApi` (an api over a fresh in-memory database with a settable clock) and what a test needs beside it: `createPusher`, `sqliteSchema`, `projectInput`, `UNKNOWN_ID`.

Inside the package, each entity file (`workspaces.ts`, `clients.ts`, `projects.ts`, `records.ts`) uses one verb set: `list`, `read`, `insert`, `update`, `remove`, plus a named verb where it means something else (`archiveProject`, `renameRecord`, `startTimer`, `stopTimer`).

## Schemas

Two drizzle schemas by design: the Install keeps SQLite (`src/sqlite/schema.ts`) and the Server keeps Postgres (`src/postgres/schema.ts`). They are written by hand, twice, and two catchers make any drift between them loud (ADR-0003).

## Drift catchers

1. **Compile-time parity with the domain.** The bottom of each schema file asserts strict type equality between every table's `$inferSelect` and its entity in `@time-stop/domain`. Postgres `changes` checks against `PushedChange`, because `pushedAt` never leaves the Install. `settings` (SQLite) and `tokens` (Postgres) are storage bookkeeping with no entity and are exempt. A column typed wider or narrower than the entity fails `typecheck`.
2. **Snapshot diff between the dialects.** `src/parity.test.ts` loads the latest drizzle-kit snapshot of each dialect and compares every table's columns, indexes and foreign keys. Any difference not listed in `src/dialectDifferences.ts` fails `test`, and so does a listed difference that no longer exists.

`src/dialectDifferences.ts` is the complete list of intentional differences, each with its reason. Postgres has no foreign keys on purpose: the Server materializes a replay log where Changes land in push order, not dependency order, so a foreign key would reject a batch whose parent row has not arrived yet or was stale-skipped, and the Install would retry that batch forever. Referential integrity is enforced where writes originate; SQLite keeps its foreign keys on and checks them at open.

## Changing a schema

1. Edit both schema files.
2. Run `npm run db:generate -w @time-stop/db`. It generates both dialects and needs no database.
3. Commit the schema files together with everything under `drizzle/`.

CI reruns `db:generate` and fails when `drizzle/` is dirty, which is what keeps the snapshot test honest: a forgotten generate would leave two stale snapshots that compare green.

## What is under `drizzle/`

`drizzle/sqlite` and `drizzle/postgres` are drizzle-kit's output, generated and committed, never edited by hand.

- `NNNN_name.sql` — one migration per generate. `migrate()` replays the ones a database has not seen yet: at `openLocalStore` for SQLite, at `openPostgres` for Postgres.
- `meta/_journal.json` — the ordered list of those migrations with their timestamps; it is what `migrate()` reads to know which files exist and in what order.
- `meta/NNNN_snapshot.json` — the whole schema as it stood after that migration. `drizzle-kit generate` diffs the schema file against the latest snapshot to write the next migration, and `src/parity.test.ts` compares the latest snapshot of each dialect.
