import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dialectDifferences } from './dialectDifferences.js';
import type { Dialect, DialectDifference, DifferenceKind } from './dialectDifferences.js';

/**
 * Postgres column types each SQLite storage class may map to. SQLite has no boolean or json type,
 * so one SQLite type can stand for several Postgres ones; the domain parity check on each schema
 * pins which one a given column means.
 */
const postgresTypesFor: Record<string, string[]> = {
  text: ['text', 'jsonb'],
  integer: ['boolean'],
  real: ['double precision'],
};

interface Column {
  type: string;
  notNull: boolean;
  default: unknown;
}

interface Index {
  columns: string[];
  isUnique: boolean;
}

interface ForeignKey {
  tableTo: string;
  columnsFrom: string[];
  columnsTo: string[];
}

interface Table {
  columns: Record<string, Column>;
  indexes: Record<string, Index>;
  foreignKeys: Record<string, ForeignKey>;
}

type Snapshot = Record<string, Table>;

interface RawSnapshot {
  tables: Record<
    string,
    {
      name: string;
      columns: Record<string, { type: string; notNull: boolean; default?: unknown }>;
      indexes: Record<
        string,
        { columns: Array<string | { expression: string }>; isUnique: boolean }
      >;
      foreignKeys: Record<string, ForeignKey>;
    }
  >;
}

function latestSnapshot(dialect: Dialect): Snapshot {
  const dir = new URL(`../drizzle/${dialect}/meta/`, import.meta.url);
  const journal = JSON.parse(readFileSync(new URL('_journal.json', dir), 'utf8')) as {
    entries: Array<{ idx: number }>;
  };
  const idx = String(journal.entries.at(-1)!.idx).padStart(4, '0');
  const raw = JSON.parse(readFileSync(new URL(`${idx}_snapshot.json`, dir), 'utf8')) as RawSnapshot;
  const snapshot: Snapshot = {};
  for (const table of Object.values(raw.tables)) {
    snapshot[table.name] = {
      columns: Object.fromEntries(
        Object.entries(table.columns).map(([name, column]) => [
          name,
          { type: column.type, notNull: column.notNull, default: column.default ?? null },
        ]),
      ),
      indexes: Object.fromEntries(
        Object.entries(table.indexes).map(([name, index]) => [
          name,
          {
            columns: index.columns.map((c) => (typeof c === 'string' ? c : c.expression)),
            isUnique: index.isUnique,
          },
        ]),
      ),
      foreignKeys: Object.fromEntries(
        Object.entries(table.foreignKeys).map(([name, fk]) => [
          name,
          { tableTo: fk.tableTo, columnsFrom: fk.columnsFrom, columnsTo: fk.columnsTo },
        ]),
      ),
    };
  }
  return snapshot;
}

interface Difference {
  kind: DifferenceKind;
  table: string;
  name: string;
  /** Set when the object exists in one dialect only; a mismatch has it undefined. */
  only?: Dialect;
  detail: string;
}

function presence<T>(
  kind: DifferenceKind,
  table: string,
  sqlite: Record<string, T>,
  postgres: Record<string, T>,
  compare: (a: T, b: T) => string | null,
): Difference[] {
  const out: Difference[] = [];
  for (const name of new Set([...Object.keys(sqlite), ...Object.keys(postgres)])) {
    const a = sqlite[name];
    const b = postgres[name];
    if (a === undefined) out.push({ kind, table, name, only: 'postgres', detail: 'postgres only' });
    else if (b === undefined)
      out.push({ kind, table, name, only: 'sqlite', detail: 'sqlite only' });
    else {
      const detail = compare(a, b);
      if (detail) out.push({ kind, table, name, detail });
    }
  }
  return out;
}

const byJson = (x: unknown, y: unknown) =>
  JSON.stringify(x) === JSON.stringify(y) ? null : `${JSON.stringify(x)} vs ${JSON.stringify(y)}`;

function diff(sqlite: Snapshot, postgres: Snapshot): Difference[] {
  const out: Difference[] = [];
  for (const name of new Set([...Object.keys(sqlite), ...Object.keys(postgres)])) {
    const a = sqlite[name];
    const b = postgres[name];
    if (a === undefined) {
      out.push({ kind: 'table', table: name, name, only: 'postgres', detail: 'postgres only' });
      continue;
    }
    if (b === undefined) {
      out.push({ kind: 'table', table: name, name, only: 'sqlite', detail: 'sqlite only' });
      continue;
    }
    out.push(
      ...presence('column', name, a.columns, b.columns, (x, y) => {
        const problems: string[] = [];
        if (!(postgresTypesFor[x.type] ?? []).includes(y.type)) {
          problems.push(`type ${x.type} vs ${y.type}`);
        }
        if (x.notNull !== y.notNull) problems.push(`notNull ${x.notNull} vs ${y.notNull}`);
        if (JSON.stringify(x.default) !== JSON.stringify(y.default)) {
          problems.push(`default ${JSON.stringify(x.default)} vs ${JSON.stringify(y.default)}`);
        }
        return problems.length ? problems.join(', ') : null;
      }),
      ...presence('index', name, a.indexes, b.indexes, byJson),
      ...presence('foreignKey', name, a.foreignKeys, b.foreignKeys, byJson),
    );
  }
  return out;
}

function covers(entry: DialectDifference, difference: Difference): boolean {
  return (
    entry.kind === difference.kind &&
    entry.only === difference.only &&
    (entry.table === undefined || entry.table === difference.table) &&
    (entry.name === undefined || entry.name === difference.name)
  );
}

const describeDifference = (d: Difference) => `${d.kind} ${d.table}.${d.name}: ${d.detail}`;
const describeEntry = (e: DialectDifference) =>
  `${e.kind} ${e.table ?? '*'}.${e.name ?? '*'} only in ${e.only}`;

describe('dialect parity', () => {
  const differences = diff(latestSnapshot('sqlite'), latestSnapshot('postgres'));

  it('lists every difference between the SQLite and Postgres schemas in dialectDifferences', () => {
    const unlisted = differences.filter((d) => !dialectDifferences.some((e) => covers(e, d)));
    expect(unlisted.map(describeDifference)).toEqual([]);
  });

  it('has no stale dialectDifferences entry', () => {
    const stale = dialectDifferences.filter((e) => !differences.some((d) => covers(e, d)));
    expect(stale.map(describeEntry)).toEqual([]);
  });
});
