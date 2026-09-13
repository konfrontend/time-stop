import type { Rounding } from '../dashboard/Rounding.js';
import { roundDurationMs } from '../dashboard/rules.js';
import type { Record } from '../record/Record.js';
import { amountOf, isBillable, rateOf } from '../money/MoneySource.js';
import { durationMs, formatClock, formatIsoDate } from '../time/time.js';
import type { BuildReportInput, Report, ReportRow } from './Report.js';

const HOUR_MS = 3_600_000;
const NO_PROJECT = 'No Project';
const NO_CLIENT = 'No Client';
const NO_CURRENCY = 'No Currency';
const COLUMNS = ['Date', 'Start', 'Stop', 'Name', 'Billable', 'Hours', 'Rate', 'Amount'];

/**
 * The CSV of a Dashboard view: header rows, one row per stopped Record sorted by Project then
 * start, then a Total and a Billable row per Currency. The running Timer and Limits stay out.
 * Several Projects add a Project column; several Currencies add one totals pair each.
 */
export function buildReport({ rows, from, to, rounding, zone }: BuildReportInput): Report {
  const stopped = rows.filter((row) => row.record.stop !== null);
  const sorted = [...stopped].sort(
    (a, b) =>
      projectLabel(a).localeCompare(projectLabel(b)) ||
      (a.record.start < b.record.start ? -1 : a.record.start > b.record.start ? 1 : 0),
  );
  const projects = distinct(sorted.map(projectLabel));
  const clients = distinct(sorted.map(clientLabel));
  const currencies = distinct(sorted.map(currencyLabel));
  const withProject = projects.length > 1;

  const lines: string[][] = [
    ['Project', ...projects],
    ['Client', ...clients],
    ['Range', formatIsoDate(from, zone), lastDayOf(to, zone)],
    ['Rounding', rounding],
    ['Currency', ...currencies],
    [],
    withProject ? ['Project', ...COLUMNS] : COLUMNS,
  ];
  // Totals add up the shown values, so the Hours and Amount columns sum on screen.
  const shown = sorted.map((row) => {
    const hours = hoursOf(row.record, rounding);
    return { row, hours: round2(hours), amount: mapNull(amountOf(row, hours), round2) };
  });
  for (const { row, hours, amount } of shown) {
    lines.push(recordLine(row, { withProject, hours, amount, zone }));
  }

  // A view with no Records still gets one pair, so the shape never changes.
  const groups = currencies.length > 0 ? currencies : [NO_CURRENCY];
  for (const currency of groups) {
    const group = shown.filter((one) => currencyLabel(one.row) === currency);
    const suffix = groups.length > 1 ? ` (${currency})` : '';
    const sumHours = (of: typeof group) => round2(of.reduce((sum, one) => sum + one.hours, 0));
    const amounts = group.map((one) => one.amount).filter((amount) => amount !== null);
    // Only a Billable Record carries an Amount, so both rows show the same one.
    const amount = amounts.length > 0 ? round2(amounts.reduce((sum, a) => sum + a, 0)) : null;
    lines.push(totalLine(`Total${suffix}`, sumHours(group), amount, withProject));
    const billable = group.filter((one) => isBillable(one.row));
    lines.push(totalLine(`Billable${suffix}`, sumHours(billable), amount, withProject));
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

/** Cents, the precision every Hours and Amount cell shows. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function mapNull(value: number | null, map: (value: number) => number): number | null {
  return value === null ? null : map(value);
}

function hoursOf(record: Record, rounding: Rounding): number {
  return roundDurationMs(durationMs(record.start, record.stop!), rounding) / HOUR_MS;
}

/** The day holding the last millisecond before the exclusive `to`. */
function lastDayOf(to: string, zone: string | undefined): string {
  return formatIsoDate(new Date(Date.parse(to) - 1).toISOString(), zone);
}

function recordLine(
  row: ReportRow,
  options: {
    withProject: boolean;
    hours: number;
    amount: number | null;
    zone: string | undefined;
  },
): string[] {
  const { record } = row;
  const { hours, amount, zone } = options;
  const rate = rateOf(row);
  return [
    ...(options.withProject ? [projectLabel(row)] : []),
    formatIsoDate(record.start, zone),
    formatClock(record.start, zone),
    formatClock(record.stop!, zone),
    record.name,
    isBillable(row) ? 'yes' : 'no',
    hours.toFixed(2),
    rate === null ? '' : String(rate),
    amount === null ? '' : amount.toFixed(2),
  ];
}

/** The label takes the leading column; Hours and Amount stay under their own. */
function totalLine(
  label: string,
  hours: number,
  amount: number | null,
  withProject: boolean,
): string[] {
  const line = Array<string>((withProject ? 1 : 0) + COLUMNS.length).fill('');
  line[0] = label;
  line[line.length - 3] = hours.toFixed(2);
  line[line.length - 1] = amount === null ? '' : amount.toFixed(2);
  return line;
}

function filenameOf(
  rows: readonly ReportRow[],
  from: string,
  to: string,
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
  return `${slug(label)}_${formatIsoDate(from, zone)}_${lastDayOf(to, zone)}.csv`;
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
