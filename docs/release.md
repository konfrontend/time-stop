# Releasing

One git tag versions every artifact: a macOS arm64 dmg and a Windows x64 installer attached to a GitHub Release, and the server image on GHCR. Versions are semver, `0.x` until MVP.

## Cut a release

1. Check that CI is green on `master`. Nothing enforces this — a tag on a red commit still releases.
2. Run the **Release** workflow from the [Actions tab](https://github.com/konfrontend/timestop/actions/workflows/release.yml), with the version in bare `0.2.0` form, no `v`. It creates and pushes the tag itself.

   Tagging by hand is the other way in, and runs the same checks:

   ```bash
   git switch master && git pull
   ```

   ```bash
   git tag v0.1.0
   ```

   ```bash
   git push origin v0.1.0
   ```

3. Wait for the Release workflow:

```bash
gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

4. Verify:
   - The GitHub Release `v0.1.0` has the arm64 dmg and `time-stop-0.1.0-x64.exe` attached.
   - The image has both platforms:

   ```bash
   docker buildx imagetools inspect ghcr.io/konfrontend/time-stop-server:0.1.0
   ```

   - The dmg installs and launches on an Apple Silicon Mac, and Settings shows `0.1.0`.
   - The Windows build needs no hands-on check: the `exe` job smoke-launches it before the Release exists (see [Windows](#windows)).

5. Upgrade the Server: [self-host.md → Upgrade](self-host.md#upgrade).

A pushed tag is never moved or reused. If a release is broken, fix it on `master` and release the next patch version.

## What preflight refuses

The `preflight` job runs before any artifact is built, and every other job waits on it. Three ways it stops a release:

- **`Version '<version>' is not X.Y.Z.`** — the version is malformed. Only reachable from the Actions tab: the tag trigger's own filter already rejects anything else, and pre-release suffixes with it.
- **`<sha> is not reachable from master.`** — the commit being released was never merged. Any commit on `master` passes, not only its tip, so a PR merged between tagging and pushing does not cost you the release.
- **`<tag> does not come after <tag>.`** — the version goes backwards or sideways. An existing tag is also refused outright rather than reused.

## Data across installs

Installing a new version replaces the app bundle or install directory; the database is elsewhere and the installers leave it alone. What keeps that true:

- **`appId` and `productName` never change.** `productName` (`Time Stop`, in [`apps/desktop/package.json`](../apps/desktop/package.json)) names the user-data directory — `~/Library/Application Support/Time Stop` on macOS, `%APPDATA%\Time Stop` on Windows — and `appId` is the identity the Windows installer upgrades in place. Either one changing strands the old database under the old name.
- **The database file name never changes.** `timestop.sqlite3`, next to its `-wal` and `-shm` files, set in [`profile.ts`](../apps/desktop/src/main/profile.ts).
- **Released migrations are never edited, only appended.** A migration already applied on someone's machine is a fixed point; editing one makes their database disagree with the build forever.
- **An uninstall keeps the data.** [`electron-builder.yml`](../apps/desktop/electron-builder.yml) sets `nsis.deleteAppDataOnUninstall: false`, so reinstalling finds the Records again.
- **One process per user-data directory.** The app takes Electron's single-instance lock and raises its window instead of opening a second process that would write the same file.
- **Dev runs are separate.** An unpackaged run stores its data under `<productName> Dev`, so an unreleased migration never touches the real database. `DESKTOP_PROFILE_DIR` still overrides both, which is what the e2e runs use.

On launch the app compares the migrations the database carries with the ones the build ships:

- **Newer database.** Migrations it does not know mean the file was written by a later Time Stop. The app shows an error dialog and quits without opening the file for writing. Installing that later version again is the way back.
- **Pending migrations.** Before applying them, the database is copied with `VACUUM INTO` — which folds in the WAL, as a plain file copy would not — to `timestop.sqlite3.<migration>.backup`, named after the migration it is upgrading from. A backup already standing under that name is never overwritten, and the three newest are kept. Nothing pending means no backup, and neither does a database with no migrations applied yet — it holds nothing to lose.

## Where the name lives

The product name appears only where a rename has to decide something. Code, tests, env vars and copy stay agnostic; the display name has one source, `productName`, which the main process, the renderer and the e2e title checks import. [`scripts/brandCheck.sh`](../scripts/brandCheck.sh), run by the root `npm run lint`, fails on `time[ _-]?stop` (any case) anywhere else. Its allowlist and this list match:

- [`apps/desktop/package.json`](../apps/desktop/package.json) — `productName`, the display name and the user-data directory name. Storage identity.
- [`apps/desktop/electron-builder.yml`](../apps/desktop/electron-builder.yml) — `appId` (storage identity: the Windows installer upgrades by it) and `artifactName`.
- [`apps/desktop/src/main/profile.ts`](../apps/desktop/src/main/profile.ts) — the database file name. Storage identity.
- [`apps/desktop/src/main/updateCheck.ts`](../apps/desktop/src/main/updateCheck.ts) and its test — the GitHub release URL.
- [`.github/workflows/release.yml`](../.github/workflows/release.yml) — the server image name, `time-stop-server`.
- `README.md`, `CONTEXT.md`, `CLAUDE.md`, `docs/**`, `.claude/**` — prose, including the image name and install paths in [self-host.md](self-host.md) and this file.
- `package-lock.json`.

A rename walks this list. Changing any storage identity strands existing installs unless it ships with a migration of the user-data directory and the database file.

## What the workflow does

[`.github/workflows/release.yml`](../.github/workflows/release.yml), triggered by pushing a `vX.Y.Z` tag or by running it from the Actions tab. Pre-release tags such as `v0.2.0-rc.1` start nothing: the update check only understands `X.Y.Z`. The version is the tag without its `v` — or the input, on the Actions path, where `preflight` creates the tag. Either way it reaches the other jobs as a `preflight` output, and every `package.json` stays at `0.0.0` in git. The image gets only the version tag, never `latest`.

Both triggers are one workflow because a tag pushed with `GITHUB_TOKEN` starts no workflow, so the Actions path cannot hand off to the tag path.

| Job       | Runner             | Steps                                                                                                                                                                       |
| --------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| preflight | `ubuntu-latest`    | Resolve the version from the tag or the input, check its shape, master ancestry and that it moves forward, and create the tag on the Actions path ([What preflight refuses](#what-preflight-refuses)) |
| dmg       | `macos-15` (arm64) | Stamp the version into `apps/desktop`, build, run `npm run dist:mac` ([`electron-builder.yml`](../apps/desktop/electron-builder.yml)), keep the dmg as a workflow artifact  |
| exe       | `windows-latest`   | Stamp the version, build, run `npm run dist:win`, smoke-launch the packaged build, keep the exe as a workflow artifact                                                      |
| image     | `ubuntu-latest`    | Build [`apps/server/Dockerfile`](../apps/server/Dockerfile) with buildx and QEMU, push `ghcr.io/konfrontend/time-stop-server:<version>` for `linux/amd64` and `linux/arm64` |
| release   | `ubuntu-latest`    | After all three jobs succeed, create the GitHub Release for the tag with generated notes and both installers attached                                                       |

A rejection in `preflight` publishes nothing at all. Past it, if any of the three artifact jobs fails, no Release is created, but an image already pushed stays on GHCR. Re-run the failed jobs from the Actions tab.

## Windows

`time-stop-<version>-x64.exe` is an NSIS one-click installer, x64 only. It installs per user, so it needs no admin rights, and puts Time Stop in the Start Menu, on the desktop, and in Windows' uninstall list; it runs the app when it finishes. Installing a newer version over an older one replaces the install in place and leaves the database where it is.

The installer is unsigned, as the dmg is only ad-hoc signed. The first run of a downloaded exe therefore shows SmartScreen's "Windows protected your PC": **More info** → **Run anyway**. Tell anyone you hand the installer to.

Nobody opens a release on a real Windows machine, so the `exe` job stands in for that: after `dist:win`, Playwright launches the packaged build out of `release/win-unpacked` and checks it starts and shows the Tracker ([`e2e/packaged.spec.ts`](../apps/desktop/e2e/packaged.spec.ts)). A failure leaves the exe unpublished and no Release created. What that does not cover is the installer itself: per-user install, the shortcuts and the in-place upgrade rest on the NSIS options alone, so a change to them wants a real install to check.

Every push also runs a `windows-latest` job in [`ci.yml`](../.github/workflows/ci.yml) — install, build, unit tests, the Playwright-Electron smoke and an unpacked package build — so native modules and path handling break there, not on a tag. The smoke is where the Windows-only shell affordances are checked: the tray glyph drawn for the taskbar theme, the left-click that opens the window, the taskbar overlay dot and the stop a session end writes ([`e2e/shell.spec.ts`](../apps/desktop/e2e/shell.spec.ts)).

## Icon

The app ships one 1024×1024 [`resources/icon.png`](../apps/desktop/resources/icon.png); electron-builder derives the macOS icns and the Windows ico from it, and the window and taskbar icon comes from the same file. **The artwork is a placeholder** — a ring and hand on a dark rounded square — waiting on real artwork. Replacing the file is the whole change.

It needs only `GITHUB_TOKEN`, with `contents: write` and `packages: write`. The dmg carries electron-builder's ad-hoc signature; there is no notarization. `better-sqlite3` ships Node-API prebuilds, so Electron loads it without a rebuild.

The GHCR package starts private. Pulling it then needs `docker login`, as [self-host.md](self-host.md#5-start) describes; make the package public in its GitHub settings to drop that step.
