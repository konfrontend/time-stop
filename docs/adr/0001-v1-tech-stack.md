---
status: accepted
---

# v1 tech stack

Time Stop v1 is a local-first Electron app plus a headless push-mirror server, so the stack is chosen to share one runtime and one domain package between the Electron main process and the server. Node 24 runs everywhere. The server exposes a single REST endpoint, `POST /changes`, with zod contracts in the shared package; tRPC is deferred until the API surface grows in v2. Drizzle spans `better-sqlite3` on the client and the `postgres` driver on the server with one schema file per dialect. The main process owns SQLite and the domain behind a `TimeStopApi` interface exposed over zod-validated IPC, so the React renderer never touches a shell API and a v2 web Dashboard can implement the same interface over HTTP.

## Considered options

- **Cloudflare Workers / D1** for the server — rejected. No Node runtime, no long-lived Postgres connections, and D1 would pull the server onto SQLite, contradicting the headless-Postgres decision. The server targets a Docker compose stack on a Hetzner VPS with Cloudflare DNS + Tunnel in front; Hono keeps Workers reachable if that ever changes.

## Consequences

- Storage keeps timestamps as ISO 8601 UTC text at millisecond precision (`YYYY-MM-DDTHH:mm:ss.sssZ`), in `text` columns on both dialects; time zones exist only at the edges. Readable stored data outweighs integer arithmetic, and the fixed width keeps byte-wise order chronological, so Range queries stay string comparisons. Byte-wise order is SQLite's default and pinned with `COLLATE "C"` on Postgres, whose locale collation does not guarantee it. Live clocks and Durations stay in milliseconds and become timestamps only when stamped onto a row. (Amended: originally epoch milliseconds.)
- Luxon is confined to `domain/time.ts` and display, so replacing it stays a one-file change.
- Every shadcn primitive carries a `data-slot` attribute and all visual tokens live as CSS variables in Tailwind's `@theme`, preserving the post-v1 skin-engine constraint.
- `changes` ingest inserts into the log idempotently and materializes entity tables in the same transaction; the materializer lives in `packages/domain` so the v2 pull path reuses it.
