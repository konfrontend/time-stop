import { describe, expect, it } from 'vitest';
import { v7 as uuid } from 'uuid';
import { projectInputSchema, workspaceInputSchema } from './api.js';

const project = {
  workspaceId: uuid(),
  clientId: null,
  name: 'Acme API',
  rate: null,
  limitMin: null,
  limitMax: null,
  limitPeriod: null,
  startDate: null,
  endDate: null,
  color: '#4f6bd9',
};

describe('workspaceInputSchema', () => {
  it('normalizes the Currency to an upper-case three-letter code', () => {
    expect(workspaceInputSchema.parse({ name: ' Work ', currency: ' eur ' })).toEqual({
      name: 'Work',
      currency: 'EUR',
    });
    expect(workspaceInputSchema.safeParse({ name: 'Work', currency: 'Euro' }).success).toBe(false);
  });
});

describe('projectInputSchema', () => {
  it('needs a Period once a Limit is set', () => {
    const result = projectInputSchema.safeParse({ ...project, limitMax: 10 });
    expect(result.success).toBe(false);
    expect(
      projectInputSchema.safeParse({ ...project, limitMax: 10, limitPeriod: 'week' }).success,
    ).toBe(true);
  });

  it('keeps Min below Max and start before end', () => {
    expect(
      projectInputSchema.safeParse({ ...project, limitMin: 5, limitMax: 2, limitPeriod: 'month' })
        .success,
    ).toBe(false);
    expect(
      projectInputSchema.safeParse({ ...project, startDate: '2026-02-01', endDate: '2026-01-01' })
        .success,
    ).toBe(false);
  });

  it('accepts only hex colors', () => {
    expect(projectInputSchema.safeParse({ ...project, color: 'red' }).success).toBe(false);
  });
});
