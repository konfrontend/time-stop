// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Project } from '@time-stop/domain';
import { harness, renderWith, type Harness } from '@/test/harness';
import { recentRows, seedProject, seedRecord } from '@/test/fixtures';
import { slots } from '@/test/slot';
import { RecentRecords } from './RecentRecords';

const today = new Date(2026, 8, 15).toISOString();
const now = Date.parse(new Date(2026, 8, 15, 12).toISOString());
const at = (day: number, hour: number) => new Date(2026, 8, day, hour).toISOString();

const handlers = { onContinue: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() };

let h: Harness;
let project: Project;

beforeEach(async () => {
  h = harness();
  project = await seedProject(h, { name: 'Website redesign' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Lays down one Record per spec, then lists what the Tracker would show. */
async function tracked(
  ...records: Array<{ on?: Project; start?: string; hours?: number }>
): Promise<DashboardRow[]> {
  for (const { on = project, start = at(15, 9), hours = 1 } of records) {
    await seedRecord(h, {
      project: on,
      name: 'Build header',
      start,
      stop: new Date(Date.parse(start) + hours * 3_600_000).toISOString(),
    });
  }
  return recentRows(h);
}

const list = (rows: DashboardRow[], projects = [project]) =>
  renderWith(
    <RecentRecords
      rows={rows}
      loaded
      now={now}
      today={today}
      workspaceId={h.workspace.id}
      projects={projects}
      onContinue={handlers.onContinue}
      onRename={handlers.onRename}
      onDelete={handlers.onDelete}
    />,
  );

describe('RecentRecords', () => {
  it('gathers an activity into one row with today’s total, and expands it to its Records', async () => {
    list(await tracked({ start: at(15, 10) }, { start: at(14, 8), hours: 3 }));
    const [activity] = slots('activity');
    expect(slots('activity')).toHaveLength(1);
    expect(within(activity!).getByText('1:00')).toBeTruthy();
    expect(slots('record-row')).toHaveLength(0);

    fireEvent.click(within(activity!).getByText('Build header'));
    expect(slots('record-row')).toHaveLength(2);
  });

  it('continues an activity from its row and from the menu', async () => {
    const rows = await tracked({});
    list(rows);
    const [row] = slots('record-row');
    fireEvent.click(within(row!).getByRole('button', { name: 'Continue' }));
    expect(handlers.onContinue).toHaveBeenCalledWith(
      expect.objectContaining({ record: expect.objectContaining({ id: rows[0]?.record.id }) }),
    );

    fireEvent.contextMenu(row!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Continue' }));
    expect(handlers.onContinue).toHaveBeenCalledTimes(2);
  });

  it('refuses to continue a Record of an Archived Project', async () => {
    // Tracked first, archived after: an Archived Project accepts no new Records.
    await tracked({});
    const archived = await h.api.project.archive({ id: project.id });
    list(await recentRows(h), [archived]);
    const [row] = slots('record-row');
    expect(within(row!).queryByRole('button', { name: 'Continue' })).toBeNull();

    fireEvent.contextMenu(row!);
    const item = await screen.findByRole('menuitem', { name: 'Continue' });
    expect(item.getAttribute('aria-disabled')).toBe('true');
  });

  it('renames a single Record in place', async () => {
    const rows = await tracked({});
    list(rows);
    const input = within(slots('record-row')[0]!).getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Build footer' } });
    fireEvent.blur(input);
    expect(handlers.onRename).toHaveBeenCalledWith(
      expect.objectContaining({ id: rows[0]?.record.id }),
      'Build footer',
    );
  });
});
