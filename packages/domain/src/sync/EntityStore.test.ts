import { describe, expect, it } from 'vitest';
import { v7 as uuid } from 'uuid';
import type { EntityKind } from '../change/Change.js';
import type { Workspace } from '../workspace/Workspace.js';
import { materializeChange, type EntityStore } from './EntityStore.js';
import type { PushedChange } from './PushedChange.js';

const installId = uuid();
const actorId = uuid();

function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: uuid(),
    name: 'Work',
    currency: 'USD',
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function change(
  overrides: Partial<PushedChange> & { payload: PushedChange['payload'] },
): PushedChange {
  const entity = overrides.payload as { id?: string; updatedAt?: number };
  return {
    id: uuid(),
    entityKind: 'workspace',
    entityId: entity.id ?? uuid(),
    op: 'create',
    updatedAt: entity.updatedAt ?? 1000,
    actorId,
    installId,
    ...overrides,
  };
}

function memoryStore() {
  const rows = new Map<string, { updatedAt: number }>();
  const key = (kind: EntityKind, id: string) => `${kind}:${id}`;
  const store: EntityStore = {
    async latestUpdatedAt(kind, id) {
      return rows.get(key(kind, id))?.updatedAt ?? null;
    },
    async upsert(kind, entity) {
      rows.set(key(kind, entity.id), entity);
    },
    async remove(kind, id) {
      rows.delete(key(kind, id));
    },
  };
  return { store, rows };
}

describe('materializeChange', () => {
  it('creates, updates and deletes the entity row in sequence', async () => {
    const { store, rows } = memoryStore();
    const ws = workspace();
    await materializeChange(store, change({ payload: ws }));
    expect(rows.get(`workspace:${ws.id}`)).toEqual(ws);

    const renamed = { ...ws, name: 'Play', updatedAt: 2000 };
    await materializeChange(store, change({ op: 'update', entityId: ws.id, payload: renamed }));
    expect(rows.get(`workspace:${ws.id}`)).toEqual(renamed);

    await materializeChange(
      store,
      change({ op: 'delete', entityId: ws.id, updatedAt: 3000, payload: {} }),
    );
    expect(rows.has(`workspace:${ws.id}`)).toBe(false);
  });

  it('never lets an older updatedAt overwrite a newer row', async () => {
    const { store, rows } = memoryStore();
    const ws = workspace({ updatedAt: 2000 });
    await materializeChange(store, change({ payload: ws }));
    const stale = { ...ws, name: 'Old', updatedAt: 1000 };
    const result = await materializeChange(
      store,
      change({ op: 'update', entityId: ws.id, payload: stale }),
    );
    expect(result).toBe('stale');
    expect(rows.get(`workspace:${ws.id}`)).toEqual(ws);
  });

  it('keeps a deleted entity deleted when an older update arrives later', async () => {
    const { store, rows } = memoryStore();
    const ws = workspace();
    const log = new Map<string, number>();
    const tombstoning: EntityStore = {
      ...store,
      async latestUpdatedAt(kind, id) {
        return log.get(`${kind}:${id}`) ?? null;
      },
    };
    for (const c of [
      change({ payload: ws }),
      change({ op: 'delete', entityId: ws.id, updatedAt: 3000, payload: {} }),
    ]) {
      log.set(
        `${c.entityKind}:${c.entityId}`,
        Math.max(log.get(`${c.entityKind}:${c.entityId}`) ?? 0, c.updatedAt),
      );
      await materializeChange(tombstoning, c);
    }
    const late = change({ op: 'update', entityId: ws.id, payload: { ...ws, updatedAt: 2000 } });
    expect(await materializeChange(tombstoning, late)).toBe('stale');
    expect(rows.has(`workspace:${ws.id}`)).toBe(false);
  });
});
