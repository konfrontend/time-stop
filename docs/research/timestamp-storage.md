# Timestamp storage: ISO 8601 text vs epoch milliseconds vs `timestamptz`

Research for [GEM-176](https://linear.app/gembag/issue/GEM-176). Question: how should Time Stop store instants (Record `start`/`stop`, `updatedAt`, `createdAt`, `pushedAt`, Token `createdAt`/`revokedAt`) given a SQLite Install as source of truth, a Postgres mirror, parity checks between the two schemas (ADR-0003), and time zones that matter for day, week and month boundaries? Options: ISO 8601 UTC `text`, epoch-ms `bigint`/`integer`, native `timestamptz` (with `timestamp` as the rejected baseline).

Facts from primary sources (fetched 2026-09-11) and this repo's working tree on `feature/gem-176-store-timestamps-as-iso-8601-utc-text`. Versions in use: drizzle-orm 0.45.2, postgres.js 3.4.9, better-sqlite3 13, Postgres 17 (`compose.yaml:16`), SQLite 3.51 locally. Sources at the bottom.

## How the app uses time today

- Domain type is a string: `timestampSchema = z.iso.datetime({ precision: 3 })` (`packages/domain/src/schema.ts:6`). Zod: offsets disallowed by default, `precision: 3` means exactly three fraction digits [zod]. So only `YYYY-MM-DDTHH:mm:ss.sssZ` passes.
- Stamps come from `new Date(now()).toISOString()` (`packages/db/src/sqlite/api.ts:44`, `sync/pusher.ts:53`, `postgres/tokens.ts:39`) or Luxon `toUTC().toISO()` (`packages/domain/src/time/time.ts:22`). Both emit `Z` and milliseconds by default [ecma-toISOString] [luxon].
- Range reads compare strings: `gte(records.start, from), lt(records.start, to)` (`packages/db/src/sqlite/record/rows.ts:37`, `dashboard/read.ts:21-22`); `rangeInOrder` compares `from <= to` as strings (`schema.ts:15`).
- Last-write-wins on the Server compares strings: `latest > change.updatedAt` (`packages/domain/src/sync/EntityStore.ts:26`).
- Durations are `Date.parse(stop) - Date.parse(start)` (`time.ts:25`); the live Timer ticks on `Date.now()` ms.
- Zones exist only in `time.ts` (Luxon, default `'local'`): `periodBounds`, `dayStart` (`time.ts:38`, `:52`), the Report (`report/rules.ts`), and the Toggl import, which resolves zone-less Toggl wall clocks with an explicit IANA zone (`apps/desktop/src/main/imports/togglCsv.ts:17`, `:77`).
- The Server does no date math: it is a replay mirror (`docs/data-hierarchy.md`, Storage and sync). No SQL `date_trunc`, no server-side Range reads yet.

## The three options at the storage layer

| | ISO text (`text`) | Epoch ms (`bigint` / SQLite `integer`) | `timestamptz` |
|---|---|---|---|
| Postgres size | 24 chars + 1-byte header = 25 bytes [pg-char] | 8 bytes [pg-numeric] | 8 bytes [pg-datetime] |
| Resolution | whatever the format fixes (ms here) | ms | µs [pg-datetime] |
| Type enforcement | none; any string fits, unless a CHECK [pg-check] | any integer fits | only valid instants parse |
| Order | chronological only under fixed format + byte-wise collation [rfc3339-5.1] | numeric, always | native |
| SQLite equivalent | TEXT, compared with BINARY `memcmp` [sqlite-types §4.1] | INTEGER | none; SQLite has no date type [sqlite-types §2.2] |
| Readable in `psql`/`sqlite3` | yes | no | yes (Postgres output style) [pg-datetime §8.5.2] |
| JS value from driver | string | string by default (postgres.js), `number` via Drizzle `mode: 'number'` | `Date`, or raw Postgres text with Drizzle `mode: 'string'` |

## Dimension by dimension

### Ordering correctness

- RFC 3339 §5.1: strings sort chronologically "Assuming that the time zones … are the same (e.g., all in UTC), expressed using the same string (e.g., all "Z" or all "+00:00"), and all times have the same number of fractional second digits … (e.g., using the strcmp() function in C)" [rfc3339-5.1]. The zod schema enforces exactly those three conditions at the domain boundary (`schema.test.ts` rejects no-fraction, 4-digit fraction, `+02:00`, zone-less and numeric forms).
- Fixed width holds only for years 0000–9999: ECMAScript's format uses four-digit years "or … an expanded year of "+" or "-" followed by six decimal digits" [ecma-dtsf], and `toISOString` emits whatever the time value needs [ecma-toISOString]. Irrelevant for real Records, but a typo'd year 10000 from manual entry would sort before year 2026 if it ever got past validation.
- SQLite compares TEXT with BINARY `memcmp` by default [sqlite-types §4.1], which is exactly RFC 3339's `strcmp` condition. Safe.
- Postgres compares `text` with the column's collation, which defaults to the database locale [pg-collation §23.2.1]; the `postgres:17` image sets `ENV LANG en_US.utf8` [docker-pg17]. Only `C`/`POSIX` is specified as byte-value order [pg-collation §23.2.2.1]. With identical punctuation at identical positions, a linguistic collation very likely still orders the digits correctly, but no Postgres doc guarantees it (see Unverified). `COLLATE "C"` on the columns removes the question.
- Mixing producers breaks order silently: SQLite's own `datetime()` outputs `YYYY-MM-DD HH:MM:SS[.SSS]`, space separator, no `Z` [sqlite-datefunc]. Checked locally: `'2026-09-11 10:00:00' < '2026-09-11T09:00:00.000Z'` is true (space 0x20 < `T` 0x54). Nothing in the repo uses SQL-side defaults today; keep it that way.
- Epoch integers and `timestamptz` have none of these conditions.

### Precision

- ECMAScript time values are "integral Number[s] representing an instant in time to millisecond precision", range ±8.64 × 10^15 ms [ecma-timevalues]; `Number.MAX_SAFE_INTEGER` is 2^53 − 1 [ecma-max-safe]. Current epoch ms (~1.76 × 10^12) is far inside.
- `timestamptz` resolves µs [pg-datetime]. Values stamped by JS never use the extra digits, so a round trip through `timestamptz` is lossless for this app. Temporal `Instant` is ns [temporal-docs]; storing ns later would fit none of the three as-is (ms text schema, ms integers, µs `timestamptz`).
- Avoid `timestamptz(0)`: it rounds rather than truncates [pg-wiki-dontdothis].

### Storage and index size

- `text` short strings: "1 byte plus the actual string" up to 126 bytes [pg-char] → 25 bytes vs 8 for `bigint`/`timestamptz` [pg-numeric] [pg-datetime]. `records_actor_start_idx` (`postgres/schema.ts:67`) grows accordingly. At single-person volume (thousands of Records per year) this is noise.
- BRIN minmax opclasses exist for `text`, `int8` and `timestamptz` alike [pg-brin]; BRIN suits "natural correlation with their physical location" [pg-brin]. Not needed at this scale with any option.

### Range queries and index use

- All three work with B-tree range scans on `(actor_id, start)`. For text on Postgres, the index uses the column's collation by default [pg-createindex]; a non-`C` collation costs comparison CPU but stays a range scan.
- Converting text on the fly (`start::timestamptz`) inside a WHERE defeats the plain index. An expression index would need an immutable cast: "All functions and operators used in an index definition must be immutable" [pg-createindex]. Whether `text → timestamptz` qualifies is not verified here (see Unverified); the input depends on session settings, so assume no.

### Time zone semantics

- `timestamptz` is an instant, not a zoned value: "the value is stored internally as UTC, and the originally stated or assumed time zone is not retained" [pg-datetime §8.5.1.3]. ISO-`Z` text and epoch ms carry exactly the same information. None of the three stores the user's zone.
- `timestamp without time zone` is wall clock: Postgres "will silently ignore any time zone indication" in its input [pg-datetime §8.5.1.3]. The Postgres wiki: don't use it, and specifically don't use it to store UTC, "Because there is no way for the database to know that UTC is the intended timezone" [pg-wiki-dontdothis]. Unsuitable for Records: an ISO `Z` string inserted into it loses the `Z` meaning.
- Where the zone lives: day/week/month boundaries need an IANA zone name, not an offset. Postgres: abbreviations are a fixed offset, "full names imply a local daylight-savings time rule, and so have two possible UTC offsets" [pg-datetime §8.5.3]. The IANA tz database is updated for "changes made by political bodies to … UTC offsets, and daylight-saving rules" (2026c: Alberta permanent UTC−06, Morocco permanent UTC+00) [iana-tz]. So a stored offset or a precomputed local date goes stale; an IANA name plus the instant does not. Today the zone is implicit (`'local'` in `time.ts`) and never stored; the Toggl import is the one place a zone is passed explicitly.
- DST: a day is not always 24 h. Postgres `timestamptz + interval '1 day'` keeps the clock time across DST, `+ interval '24 hours'` does not [pg-functions-datetime §9.9]. Luxon `startOf('day')`/`plus({ day: 1 })` in `time.ts` covers this in JS; Temporal `ZonedDateTime` is "optimized for use cases that require a time zone, including DST-safe arithmetic" [temporal-docs]. Temporal is Stage 4 and ships in Node 26 [temporal-repo]; the repo runs Node 24 (ADR-0001), so Luxon stays for now.
- "Today" / week reports are computed on the Install with the Install's zone, then stored as UTC bounds. The consequence is the same under all three storage options: a Record's day is decided by the viewer's current zone, not the zone it was tracked in. Recording the zone at tracking time would be a separate column in any option.

### DB-side date math and grouping

- Only `timestamptz` gets it natively: `date_trunc(field, source [, time_zone])`, with the zone argument for DST-correct truncation [pg-functions-datetime §9.9.2], and `AT TIME ZONE` conversions [pg-functions-datetime §9.9.4].
- Epoch ms needs `to_timestamp(ms / 1000.0)` first [pg-functions-datetime §9.9.1]; text needs a cast. Both work in ad-hoc SQL, neither indexes cleanly.
- SQLite has no zone database: `localtime`/`utc` modifiers use the C library, "normally only works for years between 1970 and 2037", and older Windows supports one DST rule set [sqlite-datefunc §5]. So calendar math belongs in JS on the Install regardless of storage type, which is what `time.ts` already does.
- For this app today: the Server does no grouping. The advantage is v2-only (server-side Dashboard/Reports).

### Validation and constraints

- `timestamptz`: invalid instants fail at input. `text`/`bigint`: anything of the column type is accepted; guarding needs a `CHECK` [pg-check]. A regex CHECK only checks shape (`2026-02-30T…` passes a naive regex).
- The repo validates with zod at the domain boundary and asserts `$inferSelect` equals the domain entity (ADR-0003). That catches type drift, not stored values; a raw SQL write or a migration can still put a non-conforming string in the column (see the migration conflict below).

### JSON / API wire format

- `JSON.stringify` of a `Date` goes through `toISOString` → the exact zod format [ecma-toISOString]. ISO text is therefore also the wire format; storage, IPC and `POST /changes` payloads (`changes.payload` jsonb) share one representation with no mapping.
- Epoch ms serializes as a JSON number, fine up to 2^53 [ecma-max-safe]; `bigint` JS values do not `JSON.stringify` at all, which is why postgres.js returns int8 as string [postgres-js].
- `timestamptz` on the wire is whatever the app formats; Postgres text output is ISO style `1997-12-17 07:37:16-08` (space, numeric offset) [pg-datetime §8.5.2], not the zod format.

### JS driver ergonomics (the repo uses postgres.js, not `pg`)

- postgres.js: int8 is returned "as a string" because `BigInt` "doesn't work with JSON.stringify"; opt into `postgres.BigInt` via `types` [postgres-js]. Its built-in date type parses OIDs 1082/1114/1184 with `new Date(x)` and serializes with `toISOString()` (`node_modules/postgres/src/types.js:28-33`).
- node-postgres behaves the same for int8: "node-postgres cannot confidently parse int8 data type results as numbers", override with `setTypeParser(20, …)` [pg-types].
- Drizzle `bigint({ mode: 'number' })` maps with `Number(value)` (`node_modules/drizzle-orm/pg-core/columns/bigint.js:20-24`); docs position it for values "above 2^31 but below 2^53" [drizzle-pg].
- Drizzle's postgres-js driver disables postgres.js date parsing: parsers and serializers for 1184, 1082, 1083, 1114, 1182, 1185, 1115, 1231 become identity (`node_modules/drizzle-orm/postgres-js/driver.js:16-20`). Consequences:
  - `timestamp({ withTimezone: true, mode: 'string' })` returns Postgres output text as-is (`pg-core/columns/timestamp.js:66-67`), i.e. `2026-09-11 14:37:16.979+00` under default `DateStyle`, which fails `timestampSchema`. `$inferSelect` is still `string`, so the ADR-0003 type-equality check would pass while every read fails zod. Docs: "The string mode does not perform any mappings for you" [drizzle-pg].
  - `mode: 'date'` parses via `new Date(value)` and writes `value.toISOString()` (`timestamp.js:30-36`), which infers `Date`, not `string`, breaking type equality with the domain unless the domain changes too.
  - Either way `timestamptz` needs a custom column type (read `to_char`/`Date → toISOString`) to keep domain and wire as ISO strings.
- `Date` round-trip hazard: `Date.parse` of non-conforming strings "may fall back to any implementation-specific heuristics" [ecma-date-parse]. Everything the app parses is the conforming format, so fine; Postgres `timestamptz` output text is not that format and must not be fed to `Date.parse` blindly.

### SQLite–Postgres parity for sync

- SQLite has no date storage class; dates are TEXT, REAL or INTEGER [sqlite-types §2.2]. Its date functions accept `YYYY-MM-DDTHH:MM:SS.SSS` with trailing `Z` [sqlite-datefunc].
- ISO text and epoch integer both map one-to-one across dialects; the parity test's `postgresTypesFor` (`packages/db/src/parity.test.ts:11-15`) already maps `text → text`.
- `timestamptz` on Postgres with text on SQLite would be a type difference the parity test flags; it needs `postgresTypesFor.text` to include `timestamp with time zone` plus a custom Drizzle column for the domain-equality check. Acceptable, but it is the only option that makes the two schemas diverge by design.

### Debuggability

- ISO text: readable in `sqlite3`, `psql`, logs, JSON payloads, Change log rows. RFC 3339 §5.2 names readability as reducing debugging cost [rfc3339].
- Epoch ms: needs conversion in every ad-hoc query. `timestamptz`: readable, but shown in the session `TimeZone` [pg-datetime §8.5.1.3], so two people querying the same row can see different clock text.

### Migration cost

- epoch → text (this branch): must rewrite values, not just types (see conflicts).
- text → `timestamptz` later on Postgres only: `ALTER COLUMN … TYPE timestamptz USING start::timestamptz` works for conforming values (ISO 8601 with `Z` is valid Postgres input [pg-datetime §8.5.1.3]), plus a custom Drizzle column and a parity allowlist entry. SQLite untouched, wire untouched. Cheap to defer.

## Recommendation for Time Stop

Keep ISO 8601 UTC text with fixed ms precision on both dialects, as this branch does, with three fixes and one deferral.

Why text wins here:
- Install is source of truth on SQLite, which has no date type [sqlite-types §2.2]; text is the SQLite-native choice with readable rows and `memcmp` order [sqlite-types §4.1].
- One representation from `Date#toISOString` through IPC, Change payload JSON, `POST /changes` and both tables; no mapping layer, and ADR-0003's type equality stays `string = string`.
- Calendar math must live in JS anyway: the zone is the Install's, and SQLite's zone handling is limited [sqlite-datefunc §5]. `timestamptz`'s main advantage, DB-side `date_trunc … AT TIME ZONE`, has no consumer until a v2 server-side Dashboard.
- Costs accepted: 25 vs 8 bytes per value and index key; ordering depends on a format invariant the DB does not enforce; no DB-side date math.

Why not the others:
- Epoch ms: smallest and order-safe, but unreadable, int8-as-string driver friction on Postgres [postgres-js], and no benefit the app currently uses. It was the previous design; nothing in the sources argues for going back.
- `timestamptz`: best on Postgres in isolation, but on this stack it breaks the domain string type (Drizzle `mode: 'string'` returns Postgres output format, not ISO `Z`), adds a deliberate dialect difference, and buys DB-side zone math nobody calls. Revisit when the Server gains Range reads or grouping; migrate Postgres only, via `USING col::timestamptz` and a custom Drizzle column.
- `timestamp without time zone`: no, for any instant [pg-wiki-dontdothis] [pg-datetime §8.5.1.3].

Trade-off to record in ADR-0001's amendment: text order correctness is a convention (zod + `toISOString`), not a type guarantee; Postgres needs byte-wise collation for that convention to be documented-safe.

## Where this branch conflicts with the sources

1. **Migrations change column types without converting values.** `packages/db/drizzle/postgres/0002_timestamps_iso_text.sql:4` (and the other nine columns) is `ALTER COLUMN … SET DATA TYPE text` with no `USING`; `packages/db/drizzle/sqlite/0003_timestamps_iso_text.sql:66` copies integer `start`/`stop`/`updated_at` straight into TEXT columns. SQLite: numeric data inserted into a TEXT-affinity column "is converted into text form" [sqlite-types §3.1], so `1757601436979` becomes `'1757601436979'`. Every pre-existing row then fails `timestampSchema`, sorts before any ISO string (`'1' < '2'`), drops out of Range queries, and on the Server always loses LWW against a new ISO `updatedAt`. Unpushed Changes in `changes.payload` (JSON, `sqlite/schema.ts:77`) also still carry numeric fields. If any real data exists (dogfooding Install, Server volume), the migrations need value rewrites, e.g.:
   - SQLite: `strftime('%Y-%m-%dT%H:%M:%fZ', col / 1000.0, 'unixepoch')` (`%f` is `SS.SSS` [sqlite-datefunc]; verified locally: `1757601436979 → 2025-09-11T14:37:16.979Z`), plus a `json_set` pass over pending `changes.payload`.
   - Postgres: `USING to_char(to_timestamp(col / 1000.0) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` [pg-functions-datetime]. Not executed here; verify `.MS` rounding on a sample before relying on it.
   If no data exists, say so in the PR; the migrations are then only fine by accident.
2. **ADR-0001 amendment overstates the Postgres guarantee.** "the fixed width keeps lexical order chronological, so Range queries stay string comparisons" holds under RFC 3339's `strcmp` condition [rfc3339-5.1], which SQLite meets (BINARY) and Postgres does not by default: columns use the database locale [pg-collation], `en_US.utf8` in the image [docker-pg17]. Fix: `text('start').…` with `COLLATE "C"` on the timestamp columns (and index), or state the collation assumption in the ADR. Today only `EntityStore.ts:26`'s `>` runs on Postgres data, in JS, so the practical risk is small; it grows with any server-side Range query.
3. **Fixed width is bounded to years 0000–9999** [ecma-dtsf]. Worth one line in the ADR or a zod refinement; not urgent.
4. **No DB-level guard on format.** Zod is the only check; migration 1 above is exactly the class of write it cannot see. Optional: a `CHECK (start ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$')` on Postgres [pg-check]; it would need a parity allowlist entry or a matching SQLite CHECK.

## Unverified

- Whether glibc `en_US.utf8` collation orders fixed-format ISO strings identically to byte order. Likely, but no Postgres doc states it; `COLLATE "C"` avoids relying on it.
- Whether the `text → timestamptz` cast is immutable (usable in an expression index). Not checked against `pg_proc`; assumed not.
- The Postgres `to_char … .MS` conversion in conflict 1 was not run against a live database.
- Drizzle `timestamptz mode: 'string'` output shape was read from source (`timestamp.js:66-67`, `driver.js:16-20`), not observed against a live Postgres; exact text depends on server `DateStyle` and session `TimeZone`.
- ECMA-262 quotes come from `tc39/ecma262` `main` `spec.html` (ES2027 draft), not a ratified edition; the cited clauses are long-standing.

## Sources

- [pg-datetime] PostgreSQL, Date/Time Types (Table 8.9, §8.5.1.3, §8.5.2, §8.5.3): https://www.postgresql.org/docs/current/datatype-datetime.html
- [pg-functions-datetime] PostgreSQL, Date/Time Functions and Operators (§9.9, §9.9.1, §9.9.2, §9.9.4): https://www.postgresql.org/docs/current/functions-datetime.html
- [pg-char] PostgreSQL, Character Types: https://www.postgresql.org/docs/current/datatype-character.html
- [pg-numeric] PostgreSQL, Numeric Types (Table 8.2): https://www.postgresql.org/docs/current/datatype-numeric.html
- [pg-collation] PostgreSQL, Collation Support (§23.2.1, §23.2.2.1): https://www.postgresql.org/docs/current/collation.html
- [pg-brin] PostgreSQL, BRIN Indexes: https://www.postgresql.org/docs/current/brin.html
- [pg-check] PostgreSQL, Constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- [pg-createindex] PostgreSQL, CREATE INDEX: https://www.postgresql.org/docs/current/sql-createindex.html
- [pg-wiki-dontdothis] PostgreSQL wiki, Don't Do This: https://wiki.postgresql.org/wiki/Don't_Do_This
- [docker-pg17] docker-library `postgres:17` Dockerfile: https://github.com/docker-library/postgres/blob/master/17/bookworm/Dockerfile
- [sqlite-types] SQLite, Datatypes In SQLite (§2.2, §3.1, §4.1): https://www.sqlite.org/datatype3.html
- [sqlite-datefunc] SQLite, Date And Time Functions: https://www.sqlite.org/lang_datefunc.html
- [drizzle-pg] Drizzle ORM, PostgreSQL column types: https://orm.drizzle.team/docs/column-types/pg
- [postgres-js] postgres.js README (Numbers, bigint, numeric): https://github.com/porsager/postgres/blob/master/README.md
- [pg-types] node-pg-types README: https://github.com/brianc/node-pg-types/blob/master/README.md
- [ecma-timevalues] ECMA-262, Time Values and Time Range: https://tc39.es/ecma262/#sec-time-values-and-time-range
- [ecma-dtsf] ECMA-262, Date Time String Format: https://tc39.es/ecma262/#sec-date-time-string-format
- [ecma-date-parse] ECMA-262, Date.parse: https://tc39.es/ecma262/#sec-date.parse
- [ecma-toISOString] ECMA-262, Date.prototype.toISOString: https://tc39.es/ecma262/#sec-date.prototype.toisostring
- [ecma-max-safe] ECMA-262, Number.MAX_SAFE_INTEGER: https://tc39.es/ecma262/#sec-number.max_safe_integer
- [rfc3339] / [rfc3339-5.1] RFC 3339, §4.3, §5.1, §5.2, §5.6: https://www.rfc-editor.org/rfc/rfc3339
- [temporal-docs] TC39 Temporal documentation: https://tc39.es/proposal-temporal/docs/
- [temporal-repo] TC39 Temporal proposal (stage, engine status): https://github.com/tc39/proposal-temporal
- [iana-tz] IANA Time Zone Database: https://www.iana.org/time-zones
- [zod] Zod, ISO datetimes: https://zod.dev/api?id=iso-datetimes
- [luxon] Luxon API, DateTime#toISO: https://moment.github.io/luxon/api-docs/index.html
- Driver source: `node_modules/drizzle-orm` 0.45.2 (`postgres-js/driver.js`, `pg-core/columns/timestamp.js`, `pg-core/columns/bigint.js`), `node_modules/postgres` 3.4.9 (`src/types.js`)
