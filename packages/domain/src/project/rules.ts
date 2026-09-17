import type { z } from 'zod';
import type { LimitPeriod } from './Project.js';

export function validateProject(
  project: {
    limitMin: number | null;
    limitMax: number | null;
    limitPeriod: 'week' | 'month' | null;
    startDate: string | null;
    endDate: string | null;
  },
  ctx: z.RefinementCtx,
): void {
  const hasLimit = project.limitMin !== null || project.limitMax !== null;
  if (hasLimit && project.limitPeriod === null) {
    ctx.addIssue({ code: 'custom', path: ['limitPeriod'], message: 'Limits need a Period' });
  }
  if (
    project.limitMin !== null &&
    project.limitMax !== null &&
    project.limitMin > project.limitMax
  ) {
    ctx.addIssue({ code: 'custom', path: ['limitMax'], message: 'Max must not be below Min' });
  }
  if (project.startDate && project.endDate && project.startDate > project.endDate) {
    ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End must not precede start' });
  }
}

/**
 * The Limits as one label: `≥ 2 h / week`, `≤ 4 h / month`, `2–4 h / week`, null with
 * neither bound. The Settings editor and the Report both show this form, so they share it; the
 * editor passes its trimmed drafts, which are strings.
 */
export function limitsLabel(
  min: string | number | null,
  max: string | number | null,
  period: LimitPeriod | null,
): string | null {
  if (min === null && max === null) return null;
  const bounds =
    min !== null && max !== null ? `${min}–${max}` : min !== null ? `≥ ${min}` : `≤ ${max}`;
  return `${bounds} h${period ? ` / ${period}` : ''}`;
}
