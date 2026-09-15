import { beforeEach, describe, expect, it } from 'vitest';
import { entityKindSchema } from '@time-stop/domain';
import { createSqliteApi } from '../api.js';
import { seedContextProject } from './rows.js';
import { projectInput, testApi, type TestApi } from '../testApi.js';
import { projects } from '../schema.js';
import { eq } from 'drizzle-orm';

let t: TestApi;
let workspaceId: string;
beforeEach(async () => {
  t = testApi();
  workspaceId = (await t.api.workspace.list())[0]!.id;
});

describe('context.get', () => {
  it('defaults to the default Workspace and no Project', async () => {
    expect(await t.api.context.get()).toEqual({ workspaceId, projectId: null });
  });
});

describe('context.set', () => {
  it('keeps a Project of the Workspace and survives reopening the api', async () => {
    const project = await t.api.project.create({ ...projectInput, workspaceId });

    expect(await t.api.context.set({ workspaceId, projectId: project.id })).toEqual({
      workspaceId,
      projectId: project.id,
    });
    const reopened = createSqliteApi({ db: t.db, ...t.identity, now: () => t.clock.now });
    expect(await reopened.context.get()).toEqual({ workspaceId, projectId: project.id });
  });

  it('clears a Project that does not belong to the Workspace', async () => {
    const other = await t.api.workspace.create({ name: 'Personal', currency: 'EUR' });
    const project = await t.api.project.create({ ...projectInput, workspaceId });
    await t.api.context.set({ workspaceId, projectId: project.id });

    expect(await t.api.context.set({ workspaceId: other.id, projectId: project.id })).toEqual({
      workspaceId: other.id,
      projectId: null,
    });
    expect(await t.api.context.get()).toEqual({ workspaceId: other.id, projectId: null });
  });

  it('rejects an unknown Workspace or Project', async () => {
    const unknown = '00000000-0000-7000-8000-000000000000';
    await expect(t.api.context.set({ workspaceId: unknown, projectId: null })).rejects.toThrow(
      /Workspace .* not found/,
    );
    await expect(t.api.context.set({ workspaceId, projectId: unknown })).rejects.toThrow(
      /Project .* not found/,
    );
  });

  it('appends no Change: the Context is not an entity', async () => {
    const changeCount = () => entityKindSchema.options.flatMap((kind) => t.changesOf(kind)).length;
    const before = changeCount();
    await t.api.context.set({ workspaceId, projectId: null });
    expect(changeCount()).toBe(before);
  });
});

describe('seedContextProject', () => {
  const entry = (projectId: string | null, start: string) => ({
    workspaceId,
    projectId,
    name: '',
    start,
    stop: start.replace('T09', 'T10'),
  });

  it('picks the Project of the most recent Record in the Workspace, skipping Archived', async () => {
    const older = await t.api.project.create({ ...projectInput, workspaceId, name: 'Older' });
    const archived = await t.api.project.create({ ...projectInput, workspaceId, name: 'Gone' });
    const other = await t.api.workspace.create({ name: 'Personal', currency: null });
    const elsewhere = await t.api.project.create({ ...projectInput, workspaceId: other.id });
    await t.api.record.create(entry(older.id, '2026-09-14T09:00:00.000Z'));
    await t.api.record.create(entry(archived.id, '2026-09-15T09:00:00.000Z'));
    await t.api.record.create(entry(null, '2026-09-16T09:00:00.000Z'));
    await t.api.record.create({
      ...entry(elsewhere.id, '2026-09-17T09:00:00.000Z'),
      workspaceId: other.id,
    });
    await t.api.project.archive({ id: archived.id });

    expect(seedContextProject(t.db, t.identity.actorId)).toEqual({
      workspaceId,
      projectId: older.id,
    });
    expect(await t.api.context.get()).toEqual({ workspaceId, projectId: older.id });
  });

  it('keeps a Project already in the Context', async () => {
    const chosen = await t.api.project.create({ ...projectInput, workspaceId, name: 'Chosen' });
    const recent = await t.api.project.create({ ...projectInput, workspaceId, name: 'Recent' });
    await t.api.record.create(entry(recent.id, '2026-09-15T09:00:00.000Z'));
    await t.api.context.set({ workspaceId, projectId: chosen.id });

    expect(seedContextProject(t.db, t.identity.actorId)).toEqual({
      workspaceId,
      projectId: chosen.id,
    });
  });

  it('leaves no Project when the Workspace has no Record on a live Project', async () => {
    await t.api.record.create(entry(null, '2026-09-15T09:00:00.000Z'));

    expect(seedContextProject(t.db, t.identity.actorId)).toEqual({ workspaceId, projectId: null });
  });
});

describe('record.startTimer in a Context', () => {
  it('lands in the Context’s Workspace and Project', async () => {
    const project = await t.api.project.create({ ...projectInput, workspaceId });
    await t.api.context.set({ workspaceId, projectId: project.id });

    const timer = await t.api.record.startTimer();

    expect(timer).toMatchObject({ workspaceId, projectId: project.id });
  });

  it('refuses a Record on a Project archived behind the Context’s back', async () => {
    const project = await t.api.project.create({ ...projectInput, workspaceId });
    await t.api.context.set({ workspaceId, projectId: project.id });
    t.db.update(projects).set({ archived: true }).where(eq(projects.id, project.id)).run();

    await expect(t.api.record.startTimer()).rejects.toThrow(/Archived/);
    expect(await t.api.record.getTimer()).toBeNull();
  });

  it('lands in a non-default Workspace without a Project', async () => {
    const other = await t.api.workspace.create({ name: 'Personal', currency: 'EUR' });
    await t.api.context.set({ workspaceId: other.id, projectId: null });

    expect(await t.api.record.startTimer()).toMatchObject({
      workspaceId: other.id,
      projectId: null,
    });
  });
});
