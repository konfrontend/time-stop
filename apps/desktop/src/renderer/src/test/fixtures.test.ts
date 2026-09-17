// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { harness } from './harness';
import { seedProject, seedRecord, recentRows } from './fixtures';

describe('fixtures', () => {
  it('seeds a Project in the bootstrapped Workspace', async () => {
    const h = harness();
    const project = await seedProject(h, { name: 'Website redesign' });
    expect(project.workspaceId).toBe(h.workspace.id);
    expect(project.name).toBe('Website redesign');
    expect(await h.api.project.list({ workspaceId: h.workspace.id })).toHaveLength(1);
  });

  it('seeds a Record against a Project it creates on demand', async () => {
    const h = harness();
    const record = await seedRecord(h, { name: 'Build header' });
    expect(record.projectId).not.toBeNull();
    expect(await h.db.allRecords()).toHaveLength(1);
  });

  it('builds Dashboard rows newest first, with the Project resolved', async () => {
    const h = harness();
    const project = await seedProject(h);
    await seedRecord(h, { project, name: 'Older', start: '2026-09-15T09:00:00.000Z' });
    await seedRecord(h, { project, name: 'Newer', start: '2026-09-15T11:00:00.000Z' });

    const rows = await recentRows(h);
    expect(rows.map((row) => row.record.name)).toEqual(['Newer', 'Older']);
    expect(rows[0]?.project?.id).toBe(project.id);
  });

  it('refuses a span the rules reject', async () => {
    const h = harness();
    await expect(
      seedRecord(h, { start: '2026-09-15T10:00:00.000Z', stop: '2026-09-15T09:00:00.000Z' }),
    ).rejects.toThrow();
  });
});
