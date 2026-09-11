import type { Project } from '../project/Project.js';

/**
 * Where a Record's money comes from: the Rate on its Project and the Currency on its Workspace.
 * A Record stores neither (ADR-0002).
 */
export interface MoneySource {
  project: Pick<Project, 'rate'> | null;
  currency: string | null;
}

export function rateOf(source: MoneySource): number | null {
  return source.project?.rate ?? null;
}

export function isBillable(source: MoneySource): boolean {
  return rateOf(source) !== null && source.currency !== null;
}

export function amountOf(source: MoneySource, hours: number): number | null {
  return isBillable(source) ? rateOf(source)! * hours : null;
}
