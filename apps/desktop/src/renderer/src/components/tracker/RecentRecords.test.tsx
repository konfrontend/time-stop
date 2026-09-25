// @vitest-environment jsdom
import { cleanup, fireEvent, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Project } from '@app/domain';
import { RecordActions } from '@/components/record/RecordActions';
import { harness, renderWith, type Harness } from '@/test/harness';
import { recentRows, seedProject, seedRecord } from '@/test/fixtures';
import { slots } from '@/test/slot';
import { RecentRecords } from './RecentRecords';

const today = new Date(2026, 8, 15).toISOString();
const now = Date.parse(new Date(2026, 8, 15, 12).toISOString());
const at = (day: number, hour: number) => new Date(2026, 8, day, hour).toISOString();

const onContinue = vi.fn(async () => {});

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

const list = (rows: DashboardRow[]) =>
  renderWith(
    <RecordActions
      workspaceId={h.workspace.id}
      projects={[project]}
      today={today}
      onContinue={onContinue}
    >
      <RecentRecords rows={rows} loaded now={now} today={today} />
    </RecordActions>,
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

  it('continues an activity from its row', async () => {
    const rows = await tracked({});
    list(rows);
    fireEvent.click(within(slots('record-row')[0]!).getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith(rows[0]);
  });

  it('offers no Continue on the row of an Archived Project', async () => {
    // Tracked first, archived after: an Archived Project accepts no new Records.
    await tracked({});
    await h.api.project.archive({ id: project.id });
    list(await recentRows(h));
    expect(within(slots('record-row')[0]!).queryByRole('button', { name: 'Continue' })).toBeNull();
  });
});
