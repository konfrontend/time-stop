#!/usr/bin/env bash
# Fails when the product name appears outside the sites listed under "Where the name lives" in
# docs/release.md. Keep this allowlist and that list identical.
set -euo pipefail
cd "$(dirname "$0")/.."

allowlist=(
  apps/desktop/package.json
  apps/desktop/electron-builder.yml
  apps/desktop/src/main/profile.ts
  apps/desktop/src/main/updateCheck.ts
  apps/desktop/src/main/updateCheck.test.ts
  .github/workflows/release.yml
  README.md
  CONTEXT.md
  CLAUDE.md
  'docs/**'
  '.claude/**'
  package-lock.json
)

excludes=()
for path in "${allowlist[@]}"; do excludes+=(":(exclude,glob)$path"); done

if git grep --untracked -nIiE 'time[ _-]?stop' -- . "${excludes[@]}"; then
  echo 'The product name appears outside the allowlist; see "Where the name lives" in docs/release.md.' >&2
  exit 1
fi
