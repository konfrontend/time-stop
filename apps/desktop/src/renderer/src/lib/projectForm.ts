import { z } from 'zod';
import type { Project, ProjectInput } from '@time-stop/domain';

/** Text-field friendly shape of a Project; empty strings stand for "not set". */
export interface ProjectFormValues {
  name: string;
  clientId: string;
  rate: string;
  limitMin: string;
  limitMax: string;
  limitPeriod: '' | 'week' | 'month';
  startDate: string;
  endDate: string;
  color: string;
}

const hours = z
  .string()
  .trim()
  .refine((s) => s === '' || (Number.isFinite(Number(s)) && Number(s) >= 0), 'Enter a number');

export const projectFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    clientId: z.string(),
    rate: hours,
    limitMin: hours,
    limitMax: hours,
    limitPeriod: z.enum(['', 'week', 'month']),
    startDate: z.string(),
    endDate: z.string(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a color'),
  })
  .superRefine((values, ctx) => {
    const min = values.limitMin === '' ? null : Number(values.limitMin);
    const max = values.limitMax === '' ? null : Number(values.limitMax);
    if ((min !== null || max !== null) && values.limitPeriod === '') {
      ctx.addIssue({ code: 'custom', path: ['limitPeriod'], message: 'Limits need a Period' });
    }
    if (min !== null && max !== null && min > max) {
      ctx.addIssue({ code: 'custom', path: ['limitMax'], message: 'Max must not be below Min' });
    }
    if (values.startDate && values.endDate && values.startDate > values.endDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End must not precede start' });
    }
  });

const blank = (s: string) => (s.trim() === '' ? null : s.trim());
const number = (s: string) => (s.trim() === '' ? null : Number(s));

export function toProjectFields(values: ProjectFormValues): Omit<ProjectInput, 'workspaceId'> {
  return {
    name: values.name.trim(),
    clientId: blank(values.clientId),
    rate: number(values.rate),
    limitMin: number(values.limitMin),
    limitMax: number(values.limitMax),
    limitPeriod: values.limitPeriod === '' ? null : values.limitPeriod,
    startDate: blank(values.startDate),
    endDate: blank(values.endDate),
    color: values.color,
  };
}

export const DEFAULT_COLOR = '#4f6bd9';

export function projectFormValues(project?: Project): ProjectFormValues {
  return {
    name: project?.name ?? '',
    clientId: project?.clientId ?? '',
    rate: project?.rate?.toString() ?? '',
    limitMin: project?.limitMin?.toString() ?? '',
    limitMax: project?.limitMax?.toString() ?? '',
    limitPeriod: project?.limitPeriod ?? '',
    startDate: project?.startDate ?? '',
    endDate: project?.endDate ?? '',
    color: project?.color ?? DEFAULT_COLOR,
  };
}
