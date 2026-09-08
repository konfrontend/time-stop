import type { DashboardRow } from './dashboard.js';
import type { Record } from './entities.js';
import { formatClock, formatIsoDate } from './time.js';

/** Chosen at Export and applied per Record to its Duration, before any total. */
export type Rounding = 'none' | '15m';

const HOUR_MS = 3_600_000;
const QUARTER_MS = 900_000;
const NO_PROJECT = 'No Project';
const NO_CLIENT = 'No Client';
const NO_CURRENCY = 'No Currency';
const COLUMNS = ['Date', 'Start', 'Stop', 'Name', 'Billable', 'Hours', 'Rate', 'Amount'];

export interface ReportRow extends Pick<
  DashboardRow,
  'record' | 'project' | 'client' | 'currency'
> {
  // Name of the Record's Workspace; the last filename fallback before `all`.
  workspace: string | null;
}

export interface BuildReportInput {
  rows: readonly ReportRow[];
  // Inclusive.
  from: number;
  // Exclusive; the header and the filename name the day before it.
  to: number;
  rounding: Rounding;
  zone?: string;
}

export interface Report {
  filename: string;
  csv: string;
}

/** Plain nearest: 7 minutes becomes 0 and 0 stays 0. */
export function roundDurationMs(ms: number, rounding: Rounding): number {
  return rounding === '15m' ? Math.round(ms / QUARTER_MS) * QUARTER_MS : ms;
}

/**
 * The CSV of a Dashboard view: header rows, one row per stopped Record sorted by Project then
 * start, then a Total and a Billable row per Currency. The running Timer, Overlap and Limits stay
 * out. Several Projects add a Project column; several Currencies add one totals pair each.
 */
export function buildReport({ rows, from, to, rounding, zone }: BuildReportInput): Report {
  const stopped = rows.filter((row) => row.record.stop !== null);
  const sorted = [...stopped].sort(
    (a, b) => projectLabel(a).localeCompare(projectLabel(b)) || a.record.start - b.record.start,
  );
  const projects = distinct(sorted.map(projectLabel));
  const clients = distinct(sorted.map(clientLabel));
  const currencies = distinct(sorted.map(currencyLabel));
  const withProject = projects.length > 1;

  const lines: string[][] = [
    ['Project', ...projects],
    ['Client', ...clients],
    ['Range', formatIsoDate(from, zone), formatIsoDate(to - 1, zone)],
    ['Rounding', rounding],
    ['Currency', ...currencies],
    [],
    withProject ? ['Project', ...COLUMNS] : COLUMNS,
  ];
  for (const row of sorted) lines.push(recordLine(row, { withProject, rounding, zone }));

  // A view with no Records still gets one pair, so the shape never changes.
  const groups = currencies.length > 0 ? currencies : [NO_CURRENCY];
  for (const currency of groups) {
    const group = sorted.filter((row) => currencyLabel(row) === currency);
    const suffix = groups.length > 1 ? ` (${currency})` : '';
    const hours = group.reduce((sum, row) => sum + hoursOf(row.record, rounding), 0);
    const billable = group.filter((row) => row.record.billable);
    const amounts = group.map((row) => amountOf(row, rounding)).filter((a) => a !== null);
    const total = amounts.length > 0 ? amounts.reduce((sum, a) => sum + a, 0) : null;
    lines.push(totalLine(`Total${suffix}`, hours, total, withProject));
    lines.push(
      totalLine(
        `Billable${suffix}`,
        billable.reduce((sum, row) => sum + hoursOf(row.record, rounding), 0),
        total,
        withProject,
      ),
    );
  }

  return {
    filename: filenameOf(sorted, from, to, zone),
    csv: lines.map((line) => line.map(cell).join(',')).join('\n') + '\n',
  };
}

const projectLabel = (row: ReportRow) => row.project?.name ?? NO_PROJECT;
const clientLabel = (row: ReportRow) => row.client?.name ?? NO_CLIENT;
const currencyLabel = (row: ReportRow) => row.currency ?? NO_CURRENCY;

function distinct(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function hoursOf(record: Record, rounding: Rounding): number {
  return roundDurationMs(record.stop! - record.start, rounding) / HOUR_MS;
}

function amountOf(row: ReportRow, rounding: Rounding): number | null {
  const { record } = row;
  if (!record.billable || record.rate === null || row.currency === null) return null;
  return record.rate * hoursOf(record, rounding);
}

function recordLine(
  row: ReportRow,
  options: { withProject: boolean; rounding: Rounding; zone: string | undefined },
): string[] {
  const { record } = row;
  const { rounding, zone } = options;
  const amount = amountOf(row, rounding);
  return [
    ...(options.withProject ? [projectLabel(row)] : []),
    formatIsoDate(record.start, zone),
    formatClock(record.start, zone),
    formatClock(record.stop!, zone),
    record.name,
    record.billable ? 'yes' : 'no',
    hoursOf(record, rounding).toFixed(2),
    record.rate === null ? '' : String(record.rate),
    amount === null ? '' : amount.toFixed(2),
  ];
}

/** The label takes the Date column; Hours and Amount stay under their own. */
function totalLine(
  label: string,
  hours: number,
  amount: number | null,
  withProject: boolean,
): string[] {
  const lead = withProject ? 5 : 4;
  return [
    label,
    ...Array<string>(lead).fill(''),
    hours.toFixed(2),
    '',
    amount === null ? '' : amount.toFixed(2),
  ];
}

function filenameOf(
  rows: readonly ReportRow[],
  from: number,
  to: number,
  zone: string | undefined,
): string {
  const shared = (values: Array<string | null>): string | null => {
    const unique = new Set(values);
    const [only] = unique;
    return unique.size === 1 && only ? only : null;
  };
  const label =
    shared(rows.map((row) => row.project?.name ?? null)) ??
    shared(rows.map((row) => row.client?.name ?? null)) ??
    shared(rows.map((row) => row.workspace)) ??
    'all';
  return `${slug(label)}_${formatIsoDate(from, zone)}_${formatIsoDate(to - 1, zone)}.csv`;
}

function slug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'all'
  );
}

function cell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
