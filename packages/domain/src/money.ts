import type { Project } from './entities.js';

/**
 * Where a Record's money comes from: the Rate on its Project and the Currency on its Workspace.
 * A Record stores neither; a v2 overrides table (one row per overridden entity) would resolve
 * into this shape before anything below sees it.
 */
export interface MoneySource {
  project: Pick<Project, 'rate'> | null;
  currency: string | null;
}

export function rateOf(source: MoneySource): number | null {
  return source.project?.rate ?? null;
}

/** A Record is Billable iff its Project has a Rate and its Workspace a Currency. */
export function isBillable(source: MoneySource): boolean {
  return rateOf(source) !== null && source.currency !== null;
}

/** Amount = Rate × hours; absent unless Billable. */
export function amountOf(source: MoneySource, hours: number): number | null {
  const rate = rateOf(source);
  return rate !== null && source.currency !== null ? rate * hours : null;
}
