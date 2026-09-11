# @time-stop/domain

Entities, rules and the `TimeStopApi` contract shared by the Electron main process, the renderer and the Server. Vocabulary: `CONTEXT.md` at the repo root.

## API contract

`TimeStopApi` is the surface the renderer calls through `window.timeStop`. It is not hand-written. Each method is one descriptor, descriptors are grouped per concept, and the interface is derived from the groups.

```ts
// src/api/record.ts
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
export const TIME_STOP_PREFIX = 'timeStop';
export const timeStop = { workspace, client, project, record, context, dashboard, report, sync };
export type TimeStopApi = ApiOf<typeof timeStop>;
```

### Descriptors (`src/api/contract.ts`)

- `method({ input?, output })` describes an invokable method. `input` is a zod schema; it is the only value the descriptor holds at runtime, because transports parse inputs at the seam. No `input` key means the method takes no argument; `schema.optional()` means the argument is optional. `output` is type-only: `type<T>()` is a phantom marker with no runtime value, so the return type is declared next to the input without a second generic parameter.
- `event<T>()` describes a subscription. On the derived interface it is a function `(listener: (value: T) => void) => () => void`; the returned function unsubscribes.
- `ApiOf<Groups>` is the one mapped type. It turns each group into a nested object of methods and subscriptions: `api.record.create(input)`, `api.record.onTimerChanged(listener)`.

Why outputs carry no schema: main and renderer ship in one build, so a return-shape mismatch is a type error, not a runtime one. Output schemas are worth adding only on a transport that crosses versions, such as the v2 web Dashboard over HTTP.

### Groups

One file per concept under `src/api/`, named after the `CONTEXT.md` term: `workspace`, `client`, `project`, `record`, `context`, `dashboard`, `report`, `sync`. Members drop the concept noun (`record.create`, not `record.createRecord`) except where the member is itself a term (`record.startTimer`, `dashboard.get`, `report.export`). Events are `on<Thing>Changed`: `record.onTimerChanged`, `context.onContextChanged`, `sync.onSyncChanged`.

Input schemas the renderer's forms use (`workspaceInputSchema`, `checkProject`, `serverInputSchema`, …) stay exported by name from the concept files; descriptors reference them.

### Transports

Every transport reads the same object. Channel names are derived: `${PREFIX}:${group}.${member}`, so `timeStop:record.create`. The prefix is a constant exported next to the contract and imported by both ends of the transport.

- `apps/desktop/src/main/ipc.ts` registers one `ipcMain.handle` per method and broadcasts each event to every renderer. Handlers receive `(input, window)`; an implementation that ignores `window` is still assignable.
- `apps/desktop/src/preload/index.ts` builds `window.timeStop` from the same object.
- `packages/db/src/sqlite/api.ts` implements it: `createSqliteApi(): TimeStopApi`. A missing or extra member fails typecheck through the return type.

The desktop-only surfaces (`shell`, `files`, `imports`) use the same descriptors as one contract, `desktop`, in `apps/desktop/src/shared/`, exposed as `window.desktop`.
