import { describe, expect, it } from 'vitest';
import { v7 as uuid } from 'uuid';
import {
  createRecordInputSchema,
  updateRecordInputSchema,
  updateRecordNameInputSchema,
} from './inputs.js';

const start = '2026-09-11T09:00:00.000Z';
const stop = '2026-09-11T10:00:00.000Z';

describe('Record inputs', () => {
  it('trim the Name on every write', () => {
    const id = uuid();
    const fields = { projectId: null, name: '  Build header ', start, stop };
    expect(updateRecordNameInputSchema.parse({ id, name: ' Review  ' }).name).toBe('Review');
    expect(createRecordInputSchema.parse({ workspaceId: uuid(), ...fields }).name).toBe(
      'Build header',
    );
    expect(updateRecordInputSchema.parse({ id, ...fields }).name).toBe('Build header');
  });
});
