# @time-stop/db

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
