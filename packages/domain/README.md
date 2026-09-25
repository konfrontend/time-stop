# @app/domain

Entities, rules and the `Api` contract shared by the Electron main process, the renderer and the Server. Vocabulary: `CONTEXT.md` at the repo root; relationships and behavior: `docs/data-hierarchy.md`.

## Purpose

The one place a business rule is written down. A Workspace holds Clients, Projects and Records and names the Currency; a Client groups Projects; a Project carries the Rate, the Limits and the Archived flag; a Record is a span of time with a Name, assigned to a Project or to the Workspace alone. Every write to one of the four produces a Change, the whole entity after the write, which an Install pushes to the Server and the Server materializes last-write-wins. Money is never stored: Rate, Billable and Amount are derived from the Project and the Workspace on read.

Dependents: `packages/db` (implements the contract over SQLite and Postgres), `apps/desktop` main (IPC transport), `apps/desktop` renderer (forms and formatting) and `apps/server` (push ingest). Domain imports nothing from `db` or Electron; its only runtime dependencies are `zod` and `luxon`.

## Layout

Folder per concept, file per kind inside. A concept is a `CONTEXT.md` term: `workspace/`, `client/`, `project/`, `record/`, `change/`, `context/`, `dashboard/`, `report/`, `sync/`, `money/`, `time/`, `permissions/`. Kind files are lowercase and drawn from a fixed set: `rules.ts` (functions), `inputs.ts` (zod input schemas the API and the forms parse), `api.ts` (the concept's descriptor group), `index.ts` (its public surface). A file whose main export is a single type or schema takes that export's PascalCase name: `project/Project.ts`, `sync/SyncStatus.ts`. Tests sit beside the file they test.

Public means exported from a concept's `index.ts`, and a concept index carries only what a consumer outside the package uses; `src/index.ts` re-exports each concept index plus `IdInput` from `schema.ts`. The indexes serve consumers outside the package; inside it, a concept imports another concept's files directly (`../project/Project.js`), so a schema only the package needs never has to become public. Primitives shared by every concept (`idSchema`, `timestampSchema`, `idInputSchema`, `nameSchema`, `rangeFields`, `rangeInOrder`) live in `src/schema.ts`, the only file outside a concept folder. `api/` holds the descriptor machinery (`contract.ts`) and the assembly of `api` from each concept's `api.ts`.

## API contract

`Api` is the surface the renderer calls through `window.api`. It is not hand-written. Each method is one descriptor, descriptors are grouped per concept, and the interface is derived from the groups.

```ts
// src/record/api.ts
export const record = {
  create: method({ input: createRecordInputSchema, output: type<Record>() }),
  update: method({ input: updateRecordInputSchema, output: type<Record>() }),
  delete: method({ input: idInputSchema, output: type<void>() }),
  list: method({ input: listRecordsInputSchema, output: type<Record[]>() }),
  count: method({ input: countRecordsInputSchema, output: type<number>() }),
  recentNames: method({ input: listRecentNamesInputSchema, output: type<string[]>() }),
  startTimer: method({ output: type<Record>() }),
  stopTimer: method({ output: type<Record | null>() }),
  getTimer: method({ output: type<Record | null>() }),
  updateName: method({ input: updateRecordNameInputSchema, output: type<Record>() }),
  onTimerChanged: event<Record | null>(),
};

// src/api/index.ts
export const API_PREFIX = 'api';
export const api = { workspace, client, project, record, context, dashboard, report, sync };
export type Api = ApiOf<typeof api>;
```

### Descriptors (`src/api/contract.ts`)

- `method({ input?, output })` describes an invokable method. `input` is a zod schema; it is the only value the descriptor holds at runtime, because transports parse inputs at the seam. No `input` key means the method takes no argument; `schema.optional()` means the argument is optional. `output` is type-only: `type<T>()` is a phantom marker with no runtime value, so the return type is declared next to the input without a second generic parameter.
- `event<T>()` describes a subscription. On the derived interface it is a function `(listener: (value: T) => void) => () => void`; the returned function unsubscribes.
- `ApiOf<Groups>` is the one mapped type. It turns each group into a nested object of methods and subscriptions: `api.record.create(input)`, `api.record.onTimerChanged(listener)`.

Why outputs carry no schema: main and renderer ship in one build, so a return-shape mismatch is a type error, not a runtime one. Output schemas are worth adding only on a transport that crosses versions, such as the v2 web Dashboard over HTTP.

### Groups

One `api.ts` per concept folder, named after the `CONTEXT.md` term: `workspace`, `client`, `project`, `record`, `context`, `dashboard`, `report`, `sync`. Members drop the concept noun (`record.create`, not `record.createRecord`) except where the member is itself a term (`record.startTimer`, `dashboard.get`, `report.export`). Events are `on<Thing>Changed`: `record.onTimerChanged`, `context.onContextChanged`, `sync.onSyncChanged`.

Input schemas and refinements the renderer's forms use (`workspaceInputSchema`, `validateProject`, `serverInputSchema`, …) are exported from the concept's `index.ts`; descriptors reference them from `inputs.ts` and `rules.ts`.

### Transports

Every transport reads the same object. Channel names are derived: `${PREFIX}:${group}.${member}`, so `api:record.create`. The prefix is a constant exported next to the contract and imported by both ends of the transport.

- `apps/desktop/src/main/ipc.ts` registers one `ipcMain.handle` per method and broadcasts each event to every renderer. Handlers receive `(input, window)`; an implementation that ignores `window` is still assignable.
- `apps/desktop/src/preload/index.ts` builds `window.api` from the same object.
- `packages/db/src/sqlite/api.ts` implements it: `createSqliteApi(): Api`. A missing or extra member fails typecheck through the return type.

The desktop-only surfaces (`shell`, `files`, `imports`) use the same descriptors as one contract, `desktop`, in `apps/desktop/src/shared/`, exposed as `window.desktop`.
