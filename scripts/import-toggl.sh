#!/usr/bin/env bash
# Imports a Toggl Track CSV export into a Time Stop database. The desktop app's
# Settings page does the same thing; this is the headless path.
set -euo pipefail

usage() {
  cat <<'TXT'
Usage: scripts/import-toggl.sh <toggl-export.csv> [options]

Options:
  --db <path>          Database to write to; defaults to the desktop app's own.
  --workspace <name>   Workspace to import into, created when missing.
  --zone <IANA zone>   Time zone the export was written in; defaults to this machine's.
  -h, --help           This text.

Quit the desktop app before importing: it holds the database open.
TXT
}

case "${1-}" in
  '' | -h | --help)
    usage
    [ -n "${1-}" ]
    exit
    ;;
esac

csv=$1
shift

case "$(uname -s)" in
  Darwin) default_db="$HOME/Library/Application Support/@time-stop/desktop/timestop.sqlite3" ;;
  *) default_db="${XDG_CONFIG_HOME:-$HOME/.config}/@time-stop/desktop/timestop.sqlite3" ;;
esac

db=$default_db
extra=()
while [ $# -gt 0 ]; do
  case $1 in
    --db)
      db=$2
      shift 2
      ;;
    --workspace | --zone)
      extra+=("$1" "$2")
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

[ -f "$csv" ] || {
  echo "No such export: $csv" >&2
  exit 1
}
[ -f "$db" ] || {
  echo "No database at $db; launch the app once, or pass --db." >&2
  exit 1
}

cd "$(dirname "$0")/.."
exec npm run --silent import --workspace=@time-stop/toggl-import -- \
  --csv "$csv" --db "$db" "${extra[@]}"
