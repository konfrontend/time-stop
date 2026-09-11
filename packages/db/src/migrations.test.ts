import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Dialect } from './dialectDifferences.js';

/** Until the v1 tag every schema change regenerates `drizzle/` from scratch with `db:reset`. */
describe('migrations before v1', () => {
  it.each<Dialect>(['sqlite', 'postgres'])('%s has the single 0000_init', (dialect) => {
    const journal = JSON.parse(
      readFileSync(new URL(`../drizzle/${dialect}/meta/_journal.json`, import.meta.url), 'utf8'),
    ) as { entries: Array<{ tag: string }> };

    expect(journal.entries.map((entry) => entry.tag)).toEqual(['0000_init']);
  });
});
