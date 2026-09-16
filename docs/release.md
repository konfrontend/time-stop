# Releasing

One git tag versions both artifacts: a macOS arm64 dmg attached to a GitHub Release, and the server image on GHCR. Versions are semver, `0.x` until MVP.

## Cut a release

1. Check that CI is green on `master`.
2. Tag the tip of `master` and push the tag:

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
   - The GitHub Release `v0.1.0` has the arm64 dmg attached.
   - The image has both platforms:

   ```bash
   docker buildx imagetools inspect ghcr.io/konfrontend/time-stop-server:0.1.0
   ```

   - The dmg installs and launches on an Apple Silicon Mac, and Settings shows `0.1.0`.

5. Upgrade the Server: [self-host.md → Upgrade](self-host.md#upgrade).

A pushed tag is never moved or reused. If a release is broken, fix it on `master` and release the next patch version.

## Data across installs

Installing a new version replaces the app bundle or install directory; the database is elsewhere and the installers leave it alone. What keeps that true:

- **`appId` and `productName` never change.** `productName` (`Time Stop`, in [`apps/desktop/package.json`](../apps/desktop/package.json)) names the user-data directory — `~/Library/Application Support/Time Stop` on macOS, `%APPDATA%\Time Stop` on Windows — and `appId` is the identity the Windows installer upgrades in place. Either one changing strands the old database under the old name.
- **The database file name never changes.** `timestop.sqlite3`, next to its `-wal` and `-shm` files.
- **Released migrations are never edited, only appended.** A migration already applied on someone's machine is a fixed point; editing one makes their database disagree with the build forever.
- **An uninstall keeps the data.** [`electron-builder.yml`](../apps/desktop/electron-builder.yml) sets `nsis.deleteAppDataOnUninstall: false`, so reinstalling finds the Records again.
- **One process per user-data directory.** The app takes Electron's single-instance lock and raises its window instead of opening a second process that would write the same file.
- **Dev runs are separate.** An unpackaged run stores its data under `Time Stop Dev`, so an unreleased migration never touches the real database. `TIME_STOP_PROFILE_DIR` still overrides both, which is what the e2e runs use.

On launch the app compares the migrations the database carries with the ones the build ships:

- **Newer database.** Migrations it does not know mean the file was written by a later Time Stop. The app shows an error dialog and quits without opening the file for writing. Installing that later version again is the way back.
- **Pending migrations.** Before applying them, the database is copied with `VACUUM INTO` — which folds in the WAL, as a plain file copy would not — to `timestop.sqlite3.<migration>.backup`, named after the migration it is upgrading from. A backup already standing under that name is never overwritten, and the three newest are kept. Nothing pending means no backup, and neither does a database with no migrations applied yet — it holds nothing to lose.

## What the workflow does

[`.github/workflows/release.yml`](../.github/workflows/release.yml), triggered by pushing a `vX.Y.Z` tag. Pre-release tags such as `v0.2.0-rc.1` start nothing: the update check only understands `X.Y.Z`. The version is the tag without its `v`; every `package.json` stays at `0.0.0` in git. The image gets only the version tag, never `latest`.

| Job     | Runner             | Steps                                                                                                                                                                       |
| ------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dmg     | `macos-15` (arm64) | Stamp the version into `apps/desktop`, build, run `npm run dist` ([`electron-builder.yml`](../apps/desktop/electron-builder.yml)), keep the dmg as a workflow artifact      |
| image   | `ubuntu-latest`    | Build [`apps/server/Dockerfile`](../apps/server/Dockerfile) with buildx and QEMU, push `ghcr.io/konfrontend/time-stop-server:<version>` for `linux/amd64` and `linux/arm64` |
| release | `ubuntu-latest`    | After both jobs succeed, create the GitHub Release for the tag with generated notes and the dmg attached                                                                    |

If the dmg or the image fails, no Release is created; an image already pushed stays on GHCR. Re-run the failed jobs from the Actions tab.

It needs only `GITHUB_TOKEN`, with `contents: write` and `packages: write`. The dmg carries electron-builder's ad-hoc signature; there is no notarization. `better-sqlite3` ships Node-API prebuilds, so Electron loads it without a rebuild.

The GHCR package starts private. Pulling it then needs `docker login`, as [self-host.md](self-host.md#5-start) describes; make the package public in its GitHub settings to drop that step.
