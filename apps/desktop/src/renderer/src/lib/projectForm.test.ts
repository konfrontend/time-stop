import { describe, expect, it } from 'vitest';
import { projectFormSchema, projectFormValues, toProjectFields } from './projectForm';

const empty = projectFormValues();

describe('projectFormSchema', () => {
  it('accepts a name and color alone', () => {
    expect(projectFormSchema.safeParse({ ...empty, name: 'Acme' }).success).toBe(true);
  });

  it('needs a Period once a Limit is typed and keeps Min below Max', () => {
    const issues = (values: object) =>
      projectFormSchema.safeParse(values).error?.issues.map((i) => i.path.join('.')) ?? [];
    expect(issues({ ...empty, name: 'A', limitMax: '10' })).toEqual(['limitPeriod']);
    expect(
      issues({ ...empty, name: 'A', limitMin: '5', limitMax: '2', limitPeriod: 'week' }),
    ).toEqual(['limitMax']);
    expect(issues({ ...empty, name: 'A', rate: 'ten' })).toEqual(['rate']);
  });
});

describe('toProjectFields', () => {
  it('turns empty strings into null and numbers into numbers', () => {
    expect(
      toProjectFields({
        ...empty,
        name: ' Acme ',
        rate: '110',
        limitMax: '40',
        limitPeriod: 'week',
      }),
    ).toEqual({
      name: 'Acme',
      clientId: null,
      rate: 110,
      limitMin: null,
      limitMax: 40,
      limitPeriod: 'week',
      startDate: null,
      endDate: null,
      color: '#4f6bd9',
    });
  });

  it('round-trips a Project through the form values', () => {
    const project = {
      id: 'p',
      workspaceId: 'w',
      clientId: 'c',
      name: 'Acme',
      rate: 0,
      limitMin: 1.5,
      limitMax: null,
      limitPeriod: 'month' as const,
      startDate: '2026-01-01',
      endDate: null,
      color: '#000000',
      archived: false,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(toProjectFields(projectFormValues(project))).toEqual({
      clientId: 'c',
      name: 'Acme',
      rate: 0,
      limitMin: 1.5,
      limitMax: null,
      limitPeriod: 'month',
      startDate: '2026-01-01',
      endDate: null,
      color: '#000000',
    });
  });
});
