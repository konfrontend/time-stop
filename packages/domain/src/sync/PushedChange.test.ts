import { describe, expect, it } from 'vitest';
import { v7 as uuid } from 'uuid';
import type { Workspace } from '../workspace/Workspace.js';
import { pushChangesRequestSchema, type PushedChange } from './PushedChange.js';

const installId = uuid();
const actorId = uuid();
const T1 = '2026-09-11T10:00:00.000Z';
const T2 = '2026-09-11T11:00:00.000Z';

function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: uuid(),
    name: 'Work',
    currency: 'USD',
    color: '#4f6bd9',
    createdAt: T1,
    updatedAt: T1,
    ...overrides,
  };
}

function change(
  overrides: Partial<PushedChange> & { payload: PushedChange['payload'] },
): PushedChange {
  const entity = overrides.payload as { id?: string; updatedAt?: string };
  return {
    id: uuid(),
    entityKind: 'workspace',
    entityId: entity.id ?? uuid(),
    op: 'create',
    updatedAt: entity.updatedAt ?? T1,
    actorId,
    installId,
    ...overrides,
  };
}

describe('pushChangesRequestSchema', () => {
  it('accepts a batch of one Install and Actor', () => {
    const ws = workspace();
    const result = pushChangesRequestSchema.safeParse({ changes: [change({ payload: ws })] });
    expect(result.success).toBe(true);
  });

  it('keeps every field of a Record payload', () => {
    const record = {
      id: uuid(),
      workspaceId: uuid(),
      projectId: null,
      actorId,
      name: 'Fix login',
      start: T1,
      stop: T2,
      updatedAt: T1,
    };
    const parsed = pushChangesRequestSchema.parse({
      changes: [change({ entityKind: 'record', payload: record })],
    });
    expect(parsed.changes[0]?.payload).toEqual(record);
  });

  it('rejects an empty batch, a payload of the wrong kind, and a mixed batch', () => {
    const ws = workspace();
    expect(pushChangesRequestSchema.safeParse({ changes: [] }).success).toBe(false);
    expect(
      pushChangesRequestSchema.safeParse({
        changes: [change({ entityKind: 'record', payload: ws })],
      }).success,
    ).toBe(false);
    expect(
      pushChangesRequestSchema.safeParse({
        changes: [change({ payload: ws }), change({ payload: workspace(), installId: uuid() })],
      }).success,
    ).toBe(false);
  });

  it('rejects a payload whose id or updatedAt disagrees with the Change', () => {
    const ws = workspace();
    expect(
      pushChangesRequestSchema.safeParse({ changes: [change({ entityId: uuid(), payload: ws })] })
        .success,
    ).toBe(false);
    expect(
      pushChangesRequestSchema.safeParse({ changes: [change({ updatedAt: T2, payload: ws })] })
        .success,
    ).toBe(false);
  });

  it('drops pushedAt, which is the Install’s own bookkeeping', () => {
    const ws = workspace();
    const parsed = pushChangesRequestSchema.parse({
      changes: [{ ...change({ payload: ws }), pushedAt: T2 }],
    });
    expect(parsed.changes[0]).not.toHaveProperty('pushedAt');
  });
});
