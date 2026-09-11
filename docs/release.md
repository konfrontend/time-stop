# Releasing

One git tag versions both artifacts: a macOS arm64 dmg attached to a GitHub Release, and the server image on GHCR. Versions are semver, `0.x` until MVP.

## Status: not wired yet

Until these land, pushing a tag produces nothing. Delete this section once they do.

- `.github/workflows/release.yml`, as described [below](#what-the-workflow-does).
- A `dmg` target for `arm64` in [`apps/desktop/electron-builder.yml`](../apps/desktop/electron-builder.yml); `mac.target` is `dir` today.
- `better-sqlite3` built for Electron on arm64; `electron-builder.yml` sets `npmRebuild: false`.
- The version shown in Settings, and the update check.

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

## What the workflow does

Triggered by pushing a `v*` tag. The version is the tag without its `v`; every `package.json` stays at `0.0.0` in git.

| Job   | Runner             | Steps                                                                                                                                                                       |
| ----- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dmg   | `macos-14` (arm64) | Stamp the version into `apps/desktop`, build, run `electron-builder --mac dmg --arm64`, attach the dmg to the GitHub Release for the tag                                    |
| image | `ubuntu-latest`    | Build [`apps/server/Dockerfile`](../apps/server/Dockerfile) with buildx and QEMU, push `ghcr.io/konfrontend/time-stop-server:<version>` for `linux/amd64` and `linux/arm64` |

It needs only `GITHUB_TOKEN`, with `contents: write` and `packages: write`. The dmg carries electron-builder's ad-hoc signature; there is no notarization.

The GHCR package starts private. Pulling it then needs `docker login`, as [self-host.md](self-host.md#5-start) describes; make the package public in its GitHub settings to drop that step.
