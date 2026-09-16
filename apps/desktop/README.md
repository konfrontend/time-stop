# @time-stop/desktop

Electron app: electron-vite, React renderer with TanStack Router, Tailwind v4 and shadcn/ui. Opens with the Tracker; Dashboard and Settings are routes of the same window.

Commands below run from `apps/desktop`.

## Run

Needs nothing else:

```bash
npm run dev
```

Main process owns SQLite and the domain behind the `TimeStopApi` contract ([`api/`](../../packages/domain/src/api/index.ts)), exposed to the renderer as `window.timeStop` over zod-validated IPC ([`preload`](src/preload/index.ts), [`ipc.ts`](src/main/ipc.ts)). Shell, file and import affordances form the `desktop` contract ([`shared/desktop.ts`](src/shared/desktop.ts)), exposed as `window.desktop`. Renderer never touches a shell API directly.

### Database

One SQLite file, `timestop.sqlite3`, in Electron's user data folder, opened with `openLocalStore` from `@time-stop/db` ([`index.ts`](src/main/index.ts)). Folder is named after `productName`, `Time Stop`, in both dev and packaged builds:

- macOS: `~/Library/Application Support/Time Stop/`
- Linux: `~/.config/Time Stop/`
- Windows: `%APPDATA%\Time Stop\`

Settings → Server shows the exact path. Migrations apply on open.

### Environment

- `TIME_STOP_PROFILE_DIR` — user data folder override. End-to-end tests set it so they never touch the real database.
- `TIME_STOP_HEADLESS` — keep the window hidden and expose the shell probe the end-to-end tests read.
- `TIME_STOP_PACKAGED_APP` — executable the packaged smoke test launches. Unset, that test skips.

## Server

Optional. Under Settings → Server, enter the Server URL and a Token minted on the server ([apps/server](../server/README.md)). Both stored as plain text in the SQLite settings table.

Once configured, the pusher ([`pusher.ts`](../../packages/db/src/sqlite/sync/pusher.ts)) sends unsent Changes in order after every commit and on launch. Network errors retry with backoff forever. A rejected Token or a batch the server calls malformed halts the pusher and leaves Changes queued; saving a new Token resumes it. Tracker and Settings show this as the sync status.

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

[`electron-builder.yml`](electron-builder.yml), output in `release/`. Build first:

```bash
npm run build
```

Unpacked app, any platform; CI runs this as a dry run:

```bash
npm run package
```

Ad-hoc signed arm64 dmg, `time-stop-<version>-arm64.dmg`, on macOS only:

```bash
npm run dist:mac
```

Unsigned x64 NSIS installer, `time-stop-<version>-x64.exe`, on Windows only:

```bash
npm run dist:win
```

Smoke-launch a packaged build — what the release workflow runs against the Windows installer's payload before publishing, in PowerShell:

```powershell
$env:TIME_STOP_PACKAGED_APP = "release\win-unpacked\Time Stop.exe"; npm run test:e2e:packaged
```

The icon for both, and for the window and taskbar, is [`resources/icon.png`](resources/icon.png); electron-builder derives the icns and the ico from it. The artwork is a placeholder.

Releases: [docs/release.md](../../docs/release.md).

## Update check

On launch a packaged build asks the GitHub Releases API for the latest Release ([`updateCheck.ts`](src/main/updateCheck.ts)) and the Layout shows a dismissible notice when it is newer. Any failure — offline, rate-limited, the repo private — shows nothing. Dev and e2e runs are unpackaged and never call GitHub. The version comes from `app.getVersion()`, which reads `package.json`; the release stamps it from the tag.
