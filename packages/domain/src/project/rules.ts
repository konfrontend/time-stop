import type { z } from 'zod';

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
