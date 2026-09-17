// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Project } from '@time-stop/domain';
import { dayLabel } from '@/lib/format';
import { harness, renderWith, type Harness } from '@/test/harness';
import { nameWorkspace, recentRows, seedProject, seedRecord } from '@/test/fixtures';
import { RecentRecords } from './RecentRecords';

const today = new Date(2026, 8, 15).toISOString();
const now = Date.parse(new Date(2026, 8, 15, 12).toISOString());
const at = (day: number, hour: number) => new Date(2026, 8, day, hour).toISOString();

const handlers = { onContinue: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() };

let h: Harness;
let project: Project;
let archived: Project;

beforeEach(async () => {
  h = harness();
  // A Rate alone does not make a Record Billable; the Workspace has to carry a Currency.
  await nameWorkspace(h, { name: 'Work' });
  project = await seedProject(h, { name: 'Website redesign' });
  archived = await h.api.project.archive({ id: (await seedProject(h, { name: 'Old site' })).id });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Lays down one Record per spec, then lists what the Tracker would show. */
async function tracked(
  ...records: Array<{ name?: string; on?: Project; start?: string; hours?: number }>
): Promise<DashboardRow[]> {
  for (const { name = 'Build header', on = project, start = at(15, 9), hours = 1 } of records) {
    await seedRecord(h, {
      project: on,
      name,
      start,
      stop: new Date(Date.parse(start) + hours * 3_600_000).toISOString(),
    });
  }
  return recentRows(h);
}

const list = (rows: DashboardRow[]) =>
  renderWith(
    <RecentRecords
      rows={rows}
      loaded
      now={now}
      today={today}
      workspaceId={h.workspace.id}
      projects={[project, archived]}
      onContinue={handlers.onContinue}
      onRename={handlers.onRename}
      onDelete={handlers.onDelete}
    />,
  );

describe('RecentRecords', () => {
  it('gathers an activity into one row with today’s total, and expands it to its Records', async () => {
    const rows = await tracked({ start: at(15, 10) }, { start: at(14, 8), hours: 3 });
    list(rows);
    // Grouped, the activity shows its Name as text; only a single Record's Name is an input.
    expect(screen.getAllByText('Build header')).toHaveLength(1);
    expect(screen.queryByDisplayValue('Build header')).toBeNull();
    expect(screen.getByText('1:00')).toBeTruthy();
    expect(screen.getByText('today')).toBeTruthy();
    expect(screen.queryAllByTestId('record-row')).toHaveLength(0);

    fireEvent.click(screen.getByText('Build header'));
    expect(screen.getAllByRole('button', { name: 'Edit start' })).toHaveLength(2);
    expect(screen.getByText('3:00')).toBeTruthy();
  });

  it('continues an activity from its row and from the menu', async () => {
    const rows = await tracked({});
    list(rows);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(handlers.onContinue).toHaveBeenCalledWith(
      expect.objectContaining({ record: expect.objectContaining({ id: rows[0]?.record.id }) }),
    );

    fireEvent.contextMenu(document.querySelector('[data-slot=record-row]') ?? document.body);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Continue' }));
    expect(handlers.onContinue).toHaveBeenCalledTimes(2);
  });

  it('refuses to continue a Record of an Archived Project', async () => {
    // Tracked first, archived after: an Archived Project accepts no new Records.
    const retired = await seedProject(h, { name: 'Retired site' });
    await tracked({ on: retired });
    archived = await h.api.project.archive({ id: retired.id });
    list(await recentRows(h));
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.getByText('Archived')).toBeTruthy();

    fireEvent.contextMenu(document.querySelector('[data-slot=record-row]') ?? document.body);
    const item = await screen.findByRole('menuitem', { name: 'Continue' });
    expect(item.getAttribute('data-disabled')).not.toBeNull();
  });

  it('renames a single Record in place', async () => {
    const rows = await tracked({});
    list(rows);
    const input = screen.getByDisplayValue('Build header');
    fireEvent.change(input, { target: { value: 'Build footer' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(handlers.onRename).toHaveBeenCalledWith(
      expect.objectContaining({ id: rows[0]?.record.id }),
      'Build footer',
    );
  });

  it('marks a Billable activity and says when nothing ran today', async () => {
    const rows = await tracked({ start: at(13, 9) }, { start: at(12, 9) });
    list(rows);
    expect(screen.getAllByRole('img', { name: 'Billable' })).toHaveLength(1);
    expect(screen.getByText(/^last /).textContent).toBe(`last ${dayLabel(at(13, 0), today)}`);
  });

  it('says when nothing was tracked at all', () => {
    list([]);
    expect(screen.getByText('Nothing tracked yet')).toBeTruthy();
  });
});
