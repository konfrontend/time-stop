---
status: accepted
---

# Two drizzle schemas, checked against the domain at compile time and against each other in tests

The desktop keeps SQLite and the server keeps Postgres, so `packages/db` keeps one plain drizzle schema file per dialect, as ADR-0001 states. What changes is that the schemas are no longer unchecked copies of the zod entities. Two catchers make any drift loud: each schema file asserts strict type equality between every table's `$inferSelect` and the matching entity in `packages/domain` (Postgres `changes` against `PushedChange`, since `pushedAt` never leaves the Install), and a test diffs the two drizzle-kit snapshots table by table and fails on any difference not listed in an allowlist module of intentional differences. One `db:generate` regenerates both dialects, and CI fails when the committed migrations do not match the schemas, which is what keeps the snapshot test honest. A field change that misses a schema fails `typecheck`; a column, index or constraint that differs without being listed fails `test`.

## Considered options

- **Postgres on both sides via PGlite** (Postgres in WASM, file-backed, in the Electron main process; one `pg-core` schema, one migration tree, no native module) — rejected on measurement, twice. PGlite 0.5.8 on Node 24: about 1.3 GB RSS after initdb, 576 to 852 MB after reopening a database, and `footprint` attributes 556 MB of that to dirty `MALLOC_LARGE` pages, so it is resident memory, not a virtual reservation; `initialMemory` cannot go below the 128 MB the module declares. better-sqlite3 on the same data holds about 52 MB; the budget agreed before measuring was 150 MB, and the Tracker sits in the background all day. A second reason, not decisive alone: PGlite minor versions can break the on-disk format, and the documented upgrade path is `pg_dump` then restore. Everything else checked out: `drizzle-orm/pglite` and its migrator work, the single connection queues overlapping transactions, reopen takes about 140 ms. Findings are in `docs/research/pglite-electron.md`.
- **SQLite on both sides** — rejected earlier; the server stays on Postgres (ADR-0001).
- **A dialect-neutral table spec with two builders** emitting `sqliteTable` and `pgTable` — rejected. A generic builder risks widening `$inferSelect` (enum literals, nullability), which would silently defeat the parity check, and it is a local DSL guarding about a hundred duplicated lines across six tables. It would pay off at a much larger table count or a third dialect, and neither is coming; later server-only tables add nothing to the duplication.
- **A shared `columns.ts` of column-name constants** — rejected. It adds noise at every column for a guarantee the snapshot-diff test already gives.
- **Deriving the zod entities from one drizzle schema** — rejected. The domain package is the source of truth and must not depend on the db package.
- **A looser structural parity check** (assignability rather than equality) — rejected. It passes when a column is typed wider than the entity, which is exactly the drift the check exists to catch.

## Consequences

- Every column that drizzle infers more loosely than zod types it (json payloads, enums) carries a `$type<>()` or mode annotation so the equality holds.
- The dialects may differ only in what the allowlist lists, each entry with its reason; the db README points at it. A difference not on the list is a bug.
- Postgres has no foreign keys, and this is intentional. The server materializes a replay log of Changes that land in push order, not dependency order; a foreign key would reject a batch whose parent row has not arrived yet or was stale-skipped, and the Install would retry that batch forever. Referential integrity is enforced where writes originate: SQLite keeps its foreign keys on and checks them at open.
- `settings` (SQLite only) and `tokens` (Postgres only) are storage bookkeeping with no domain entity and are exempt from the entity parity check.
- A schema change is not done until `db:generate` has run and its output is committed; CI enforces this.
- Revisit PGlite only if its resident memory drops by an order of magnitude and its on-disk format is declared stable across minor versions.
