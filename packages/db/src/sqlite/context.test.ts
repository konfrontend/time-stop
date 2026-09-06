import { beforeEach, describe, expect, it } from 'vitest';
import { createSqliteApi } from './api.js';
import { projectInput, testApi, type TestApi } from './testApi.js';
import { changes, projects } from './schema.js';
import { eq } from 'drizzle-orm';

let t: TestApi;
let workspaceId: string;
beforeEach(async () => {
  t = testApi();
  workspaceId = (await t.api.listWorkspaces())[0]!.id;
});

describe('getContext', () => {
  it('defaults to the default Workspace and no Project', async () => {
    expect(await t.api.getContext()).toEqual({ workspaceId, projectId: null });
  });
});

describe('setContext', () => {
  it('keeps a Project of the Workspace and survives reopening the api', async () => {
    const project = await t.api.createProject({ ...projectInput, workspaceId });

    expect(await t.api.setContext({ workspaceId, projectId: project.id })).toEqual({
      workspaceId,
      projectId: project.id,
    });
    const reopened = createSqliteApi({ db: t.db, ...t.identity, now: () => t.clock.now });
    expect(await reopened.getContext()).toEqual({ workspaceId, projectId: project.id });
  });

  it('clears a Project that does not belong to the Workspace', async () => {
    const other = await t.api.createWorkspace({ name: 'Personal', currency: 'EUR' });
    const project = await t.api.createProject({ ...projectInput, workspaceId });
    await t.api.setContext({ workspaceId, projectId: project.id });

    expect(await t.api.setContext({ workspaceId: other.id, projectId: project.id })).toEqual({
      workspaceId: other.id,
      projectId: null,
    });
    expect(await t.api.getContext()).toEqual({ workspaceId: other.id, projectId: null });
  });

  it('rejects an unknown Workspace or Project', async () => {
    const unknown = '00000000-0000-7000-8000-000000000000';
    await expect(t.api.setContext({ workspaceId: unknown, projectId: null })).rejects.toThrow(
      /Workspace .* not found/,
    );
    await expect(t.api.setContext({ workspaceId, projectId: unknown })).rejects.toThrow(
      /Project .* not found/,
    );
  });

  it('appends no Change: the Context is not an entity', async () => {
    const before = t.db.select().from(changes).all().length;
    await t.api.setContext({ workspaceId, projectId: null });
    expect(t.db.select().from(changes).all()).toHaveLength(before);
  });
});

describe('startTimer in a Context', () => {
  it('lands in the Context’s Workspace and Project with the Rate frozen and Billable on', async () => {
    const project = await t.api.createProject({ ...projectInput, workspaceId, rate: 110 });
    await t.api.setContext({ workspaceId, projectId: project.id });

    const timer = await t.api.startTimer();

    expect(timer).toMatchObject({ workspaceId, projectId: project.id, rate: 110, billable: true });
  });

  it('leaves Billable off for a Project without a Rate', async () => {
    const project = await t.api.createProject({ ...projectInput, workspaceId, rate: null });
    await t.api.setContext({ workspaceId, projectId: project.id });

    expect(await t.api.startTimer()).toMatchObject({
      projectId: project.id,
      rate: null,
      billable: false,
    });
  });

  it('refuses a Record on a Project archived behind the Context’s back', async () => {
    const project = await t.api.createProject({ ...projectInput, workspaceId });
    await t.api.setContext({ workspaceId, projectId: project.id });
    t.db.update(projects).set({ archived: true }).where(eq(projects.id, project.id)).run();

    await expect(t.api.startTimer()).rejects.toThrow(/Archived/);
    expect(await t.api.getTimer()).toBeNull();
  });

  it('lands in a non-default Workspace without a Project', async () => {
    const other = await t.api.createWorkspace({ name: 'Personal', currency: 'EUR' });
    await t.api.setContext({ workspaceId: other.id, projectId: null });

    expect(await t.api.startTimer()).toMatchObject({ workspaceId: other.id, projectId: null });
  });
});
