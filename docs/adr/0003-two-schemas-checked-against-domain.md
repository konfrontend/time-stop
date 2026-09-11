---
status: accepted
---

# Two drizzle schemas, checked against the domain at compile time

The desktop keeps SQLite and the server keeps Postgres, so `packages/db` keeps one drizzle schema file per dialect, as ADR-0001 states. What changes is that the schemas are no longer unchecked copies of the zod entities: each schema file asserts strict type equality between every table's `$inferSelect` and the matching entity in `packages/domain`, both files take column names and the `epochMs` helper from one shared vocabulary, and the intentional index and foreign-key differences between the dialects are listed in the db README. A field change that misses a schema fails `typecheck`; two `db:generate` runs per change remain the price.

## Considered options

- **Postgres on both sides via PGlite** (Postgres in WASM, file-backed, in the Electron main process; one `pg-core` schema, one migration tree, no native module) — rejected on measurement. On the same machine and data, PGlite 0.5.8 holds about 850 MB RSS after reopening a database and about 1.3 GB right after initdb, against about 52 MB for better-sqlite3; the budget agreed before measuring was 150 MB. The Tracker sits in the background all day. A second reason, not decisive alone: PGlite minor versions can break the on-disk format, and the documented upgrade path is `pg_dump` then restore, which the desktop would have to own for every dependency bump. Everything else checked out: `drizzle-orm/pglite` and its migrator work, the single connection queues overlapping transactions, reopen takes about 140 ms. Findings are in `docs/research/pglite-electron.md`.
- **SQLite on both sides** — rejected earlier; the server stays on Postgres (ADR-0001).
- **A looser structural parity check** (assignability rather than equality) — rejected. It passes when a column is typed wider than the entity, which is exactly the drift the check exists to catch.

## Consequences

- Every column that drizzle infers more loosely than zod types it (json payloads, enums, epoch integers) carries a `$type<>()` or mode annotation so the equality holds.
- The dialects may differ only in what the README lists. Postgres keeps its foreign keys; a difference not on the list is a bug.
- Revisit PGlite only if its resident memory drops by an order of magnitude and its on-disk format is declared stable across minor versions.
