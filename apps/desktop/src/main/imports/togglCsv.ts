import { DateTime } from 'luxon';

/** One Toggl time entry, its start and stop already resolved to UTC timestamps. */
export interface TogglEntry {
  name: string;
  project: string | null;
  client: string | null;
  /** Toggl's own duration, which may be rounded and so disagree with stop minus start. */
  duration: number | null;
  amount: number | null;
  currency: string | null;
  start: string;
  stop: string | null;
}

export interface ParseOptions {
  /** The IANA zone the export was written in; Toggl stamps local times without an offset. */
  zone: string;
}

const REQUIRED = ['Description', 'Billable', 'Start date', 'Start time'] as const;

/** Toggl writes an unset cell as a bare dash. */
function cell(row: Map<string, string>, column: string): string | null {
  const value = row.get(column)?.trim();
  return value === undefined || value === '' || value === '-' ? null : value;
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let pending = false;
  const endField = (): void => {
    row.push(field);
    field = '';
    pending = false;
  };
  const endRow = (): void => {
    if (pending || row.length > 0) endField();
    if (row.length > 0) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = false;
      continue;
    }
    if (char === '"') {
      quoted = true;
      pending = true;
    } else if (char === ',') endField();
    else if (char === '\n') endRow();
    else if (char !== '\r') {
      field += char;
      pending = true;
    }
  }
  endRow();
  return rows;
}

function parseDuration(value: string | null): number | null {
  if (value === null) return null;
  const parts = value.split(':').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [hours, minutes, seconds] = parts as [number, number, number];
  return ((hours * 60 + minutes) * 60 + seconds) * 1000;
}

function parseInstant(date: string | null, time: string | null, zone: string): string | null {
  if (!date) return null;
  const parsed = DateTime.fromISO(`${date}T${time ?? '00:00:00'}`, { zone });
  if (!parsed.isValid) throw new Error(`Unreadable time ${date} ${time ?? ''}`);
  return parsed.toUTC().toISO()!;
}

export function parseTogglCsv(text: string, { zone }: ParseOptions): TogglEntry[] {
  // Toggl writes the export with a BOM, which would otherwise stick to the first column name.
  const [header, ...body] = parseRows(text.replace(/^\uFEFF/, ''));
  if (!header) throw new Error('The export is empty');
  const missing = REQUIRED.filter((column) => !header.includes(column));
  if (missing.length > 0) throw new Error(`The export is missing ${missing.join(', ')}`);

  return body.map((values) => {
    const row = new Map(header.map((column, index) => [column, values[index] ?? '']));
    const start = parseInstant(cell(row, 'Start date'), cell(row, 'Start time'), zone);
    if (start === null) throw new Error(`A row has no start: ${values.join(',')}`);
    const amount = cell(row, 'Amount');
    // A thousands separator or a stray label leaves an unusable Amount rather than a NaN Rate.
    const billed = amount === null ? Number.NaN : Number(amount);
    return {
      name: cell(row, 'Description') ?? '',
      project: cell(row, 'Project'),
      client: cell(row, 'Client'),
      duration: parseDuration(cell(row, 'Duration')),
      amount: Number.isFinite(billed) ? billed : null,
      currency: cell(row, 'Currency'),
      start,
      stop: parseInstant(cell(row, 'Stop date'), cell(row, 'Stop time'), zone),
    };
  });
}
