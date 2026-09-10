# @time-stop/desktop

Electron app: electron-vite, React renderer with TanStack Router, Tailwind v4 and shadcn/ui. Opens with the Tracker; Dashboard and Settings are routes of the same window.

Commands below run from `apps/desktop`.

## Run

Needs nothing else:

```bash
npm run dev
```

Main process owns SQLite and the domain behind the `TimeStopApi` interface ([`api.ts`](../../packages/domain/src/api.ts)), exposed to the renderer over zod-validated IPC ([`preload`](src/preload/index.ts), [`ipc.ts`](src/main/ipc.ts)). Renderer never touches a shell API directly.

### Database

One SQLite file, `timestop.sqlite3`, in Electron's user data folder ([`database.ts`](src/main/database.ts)). Folder is named after `productName`, `Time Stop`, in both dev and packaged builds:

- macOS: `~/Library/Application Support/Time Stop/`
- Linux: `~/.config/Time Stop/`
- Windows: `%APPDATA%\Time Stop\`

Settings → Server shows the exact path. Migrations apply on open.

### Environment

- `TIME_STOP_PROFILE_DIR` — user data folder override. End-to-end tests set it so they never touch the real database.
- `TIME_STOP_HEADLESS` — keep the window hidden and expose the shell probe the end-to-end tests read.

## Server

Optional. Under Settings → Server, enter the Server URL and a Token minted on the server ([apps/server](../server/README.md)). Both stored as plain text in the SQLite settings table.

Once configured, the pusher ([`pusher.ts`](../../packages/db/src/sqlite/pusher.ts)) sends unsent Changes in order after every commit and on launch. Network errors retry with backoff forever. A rejected Token or a batch the server calls malformed halts the pusher and leaves Changes queued; saving a new Token resumes it. Tracker and Settings show this as the sync status.

## Import from Toggl

In Toggl Track: **Reports → Detailed**, set the range, **Export → Download CSV**.

In the app: Settings → Import from Toggl Track. Pick the Workspace to import into, the time zone the export was written in, and the file. Toggl stamps local times without an offset, so a wrong zone shifts every Record.

Mapping lives in [`importToggl.ts`](src/main/imports/importToggl.ts). Every imported entity gets a Change, so history pushes to the server like any other data; importing the same export twice adds nothing.

## Tests

Vitest, main and renderer:

```bash
npm run test
```

Playwright driving the built app ([`playwright.config.ts`](playwright.config.ts), [`e2e/`](e2e)). Dock assertions run on macOS only:

```bash
npm run build
```

```bash
npm run test:e2e
```

## Package

Unpacked app in `release/` ([`electron-builder.yml`](electron-builder.yml)). Signing and installers not set up yet:

```bash
npm run build
```

```bash
npm run package
```
