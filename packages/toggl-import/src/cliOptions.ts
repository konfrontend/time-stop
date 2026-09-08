import { parseArgs } from 'node:util';

const USAGE = `Usage: npm run import --workspace=@time-stop/toggl-import -- \\
  --csv <toggl-export.csv> --db <time-stop.db> [--workspace <name>] [--zone <IANA zone>]`;

export interface CliOptions {
  csv: string;
  db: string;
  workspaceName?: string;
  /** Toggl stamps local times without an offset; defaults to the zone of the machine running this. */
  zone: string;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      csv: { type: 'string' },
      db: { type: 'string' },
      workspace: { type: 'string' },
      zone: { type: 'string' },
    },
  });
  if (!values.csv || !values.db) throw new Error(USAGE);
  return {
    csv: values.csv,
    db: values.db,
    ...(values.workspace === undefined ? {} : { workspaceName: values.workspace }),
    zone: values.zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
