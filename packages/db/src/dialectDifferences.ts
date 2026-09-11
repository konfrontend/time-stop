export type Dialect = 'sqlite' | 'postgres';

export type DifferenceKind = 'table' | 'column' | 'index' | 'foreignKey';

/**
 * One intentional difference between the SQLite and Postgres schemas. A field left out matches
 * anything, so `{ kind: 'foreignKey', only: 'sqlite' }` covers every foreign key. The parity test
 * fails on a difference no entry covers, and on an entry that covers nothing.
 */
export interface DialectDifference {
  kind: DifferenceKind;
  /** Table the object belongs to (or the table itself for kind 'table'). */
  table?: string;
  /** Column, index or foreign-key name. */
  name?: string;
  /** Dialect that has the object. */
  only: Dialect;
  reason: string;
}

export const dialectDifferences: DialectDifference[] = [
  {
    kind: 'foreignKey',
    only: 'sqlite',
    reason:
      'The Server is a replay log: Changes land in push order, not dependency order, so a foreign key would reject a batch whose parent has not arrived or was stale-skipped. SQLite enforces integrity where writes originate.',
  },
  {
    kind: 'table',
    table: 'settings',
    only: 'sqlite',
    reason: 'Install-local key/value storage; no domain entity.',
  },
  {
    kind: 'table',
    table: 'tokens',
    only: 'postgres',
    reason: 'Server-side push Tokens; no domain entity.',
  },
  {
    kind: 'column',
    table: 'changes',
    name: 'pushed_at',
    only: 'sqlite',
    reason: 'pushedAt is the Install’s own bookkeeping and never leaves it.',
  },
  {
    kind: 'index',
    table: 'records',
    name: 'records_actor_stop_idx',
    only: 'sqlite',
    reason: 'Serves the Timer lookup (stop IS NULL), which only the Install performs.',
  },
  {
    kind: 'index',
    table: 'changes',
    name: 'changes_pushed_idx',
    only: 'sqlite',
    reason: 'Serves the pending-Changes scan by pushed_at, which only the Install performs.',
  },
  {
    kind: 'index',
    table: 'records',
    name: 'records_workspace_idx',
    only: 'postgres',
    reason: 'Serves server-side per-Workspace reads; the Install reads Records by Actor.',
  },
  {
    kind: 'index',
    table: 'changes',
    name: 'changes_entity_idx',
    only: 'postgres',
    reason: 'Serves the latestUpdatedAt lookup during ingest, which only the Server performs.',
  },
];
