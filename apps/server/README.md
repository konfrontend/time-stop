# @time-stop/server

Headless mirror of what the desktop app records. An Install pushes its Changes here; the server stores them and materializes entity tables in Postgres. No UI, no read API yet.

Commands below run from `apps/server` unless stated.

## Run

Needs `DATABASE_URL`; exits without it. Read from [`.env`](.env.example) when present:

```bash
cp .env.example .env
```

Postgres from the compose stack:

```bash
docker compose -f ../../compose.yaml up -d postgres
```

Server on `http://localhost:3000`; `GET /health` answers `{"status":"ok"}`:

```bash
npm run dev
```

### In Docker

Whole stack from repo root: server image ([`Dockerfile`](Dockerfile), root build context), Postgres 17 with a named volume, migrations on boot. Ports and credentials in [`compose.yaml`](../../compose.yaml):

```bash
docker compose up --build
```

## Tokens

An Install authenticates with a Token. Printed once at mint; only its SHA-256 hash is stored. CLI has two commands, `mint` and `revoke <token id>` ([`tokenCli.ts`](src/tokenCli.ts)).

Inside the compose stack:

```bash
docker compose exec server node apps/server/dist/cli.js mint
```

Outside Docker, with `.env` in place:

```bash
npm run cli -- mint
```

Paste the Token into the desktop app under Settings → Server.

## Pushing Changes

`POST /changes` takes `{ "changes": [...] }` with the Token as a Bearer header. Batch shape: `pushChangesRequestSchema` in [`sync.ts`](../../packages/domain/src/sync.ts), 1 to 1000 Changes from one Install and Actor; every id is a UUIDv7 ([`entities.ts`](../../packages/domain/src/entities.ts)).

Each Change is stored once by its id and materialized in the same transaction; reposting a batch is a no-op. First push binds the Token to that push's `installId` and `actorId`.

| Status | Meaning                                           |
| ------ | ------------------------------------------------- |
| 200    | Batch ingested; body reports what was stored      |
| 400    | Malformed batch, nothing written                  |
| 401    | Token missing, unknown, or revoked                |
| 403    | Token bound to a different Install and Actor pair |

The desktop app does this on its own. By hand:

```bash
curl -X POST http://localhost:3000/changes \
  -H "Authorization: Bearer tst_..." \
  -H "Content-Type: application/json" \
  -d '{"changes":[{"id":"<uuidv7>","entityKind":"workspace","entityId":"<uuidv7>","op":"create","payload":{"id":"<uuidv7>","name":"Work","currency":"USD","createdAt":0,"updatedAt":0},"updatedAt":0,"actorId":"<uuidv7>","installId":"<uuidv7>"}]}'
```

## Inspecting the mirror

`changes` is the log; entity tables are the materialized state; `tokens` holds hashes and bindings. Schema: [`schema.ts`](../../packages/db/src/postgres/schema.ts).

psql inside the compose stack:

```bash
docker compose exec postgres psql -U timestop -d timestop
```

Drizzle Studio in the browser; `DATABASE_URL` overrides the compose default:

```bash
npm run db:studio:postgres --workspace=@time-stop/db
```

## Tests

Need a Postgres. With `DATABASE_URL` set they use it, as CI does; otherwise [`testGlobalSetup.ts`](src/testGlobalSetup.ts) starts one through testcontainers, which needs Docker. Each test file gets its own database:

```bash
npm run test
```
