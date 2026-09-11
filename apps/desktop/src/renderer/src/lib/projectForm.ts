import { z } from 'zod';
import { validateProject } from '@time-stop/domain';
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

/** Validates the text values; cross-field rules come from the domain, reported per field. */
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
  .superRefine((values, ctx) => validateProject(toProjectFields(values), ctx));

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
