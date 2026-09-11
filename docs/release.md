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
