// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Project } from '@time-stop/domain';
import { dayLabel } from '@/lib/format';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RecentRecords } from './RecentRecords';

const today = new Date(2026, 8, 15).toISOString();
const now = Date.parse(new Date(2026, 8, 15, 12).toISOString());
const at = (day: number, hour: number) => new Date(2026, 8, day, hour).toISOString();

const project: Project = {
  id: 'p1',
  workspaceId: 'w1',
  clientId: null,
  name: 'Website redesign',
  rate: 110,
  limitMin: null,
  limitMax: null,
  limitPeriod: null,
  startDate: null,
  endDate: null,
  color: '#4f6bd9',
  archived: false,
  updatedAt: at(1, 8),
};

const archived: Project = { ...project, id: 'p2', name: 'Old site', archived: true };

function row(
  id: string,
  { name = 'Build header', on = project, start = at(15, 9), hours = 1 } = {},
): DashboardRow {
  return {
    record: {
      id,
      workspaceId: 'w1',
      projectId: on.id,
      actorId: 'a1',
      name,
      start,
      stop: new Date(Date.parse(start) + hours * 3_600_000).toISOString(),
      updatedAt: start,
    },
    project: on,
    client: null,
    currency: 'USD',
    limits: null,
  };
}

const handlers = { onContinue: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() };
const queryClient = new QueryClient();

const list = (rows: DashboardRow[]) =>
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RecentRecords
          rows={rows}
          loaded
          now={now}
          today={today}
          workspaceId="w1"
          projects={[project, archived]}
          onContinue={handlers.onContinue}
          onRename={handlers.onRename}
          onDelete={handlers.onDelete}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  Object.assign(window, {
    timeStop: { record: { recentNames: vi.fn(async () => []), update: vi.fn(async () => ({})) } },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RecentRecords', () => {
  it('gathers an activity into one row with today’s total, and expands it to its Records', () => {
    list([row('r2', { start: at(15, 10) }), row('r1', { start: at(14, 8), hours: 3 })]);
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
    list([row('r1')]);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(handlers.onContinue).toHaveBeenCalledWith(
      expect.objectContaining({ record: expect.objectContaining({ id: 'r1' }) }),
    );

    fireEvent.contextMenu(document.querySelector('[data-slot=record-row]') ?? document.body);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Continue' }));
    expect(handlers.onContinue).toHaveBeenCalledTimes(2);
  });

  it('refuses to continue a Record of an Archived Project', async () => {
    list([row('r1', { on: archived })]);
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    expect(screen.getByText('Archived')).toBeTruthy();

    fireEvent.contextMenu(document.querySelector('[data-slot=record-row]') ?? document.body);
    const item = await screen.findByRole('menuitem', { name: 'Continue' });
    expect(item.getAttribute('data-disabled')).not.toBeNull();
  });

  it('renames a single Record in place', () => {
    list([row('r1')]);
    const input = screen.getByDisplayValue('Build header');
    fireEvent.change(input, { target: { value: 'Build footer' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(handlers.onRename).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r1' }),
      'Build footer',
    );
  });

  it('marks a Billable activity and says when nothing ran today', () => {
    list([row('r1', { start: at(13, 9) }), row('r2', { start: at(12, 9) })]);
    expect(screen.getAllByRole('img', { name: 'Billable' })).toHaveLength(1);
    expect(screen.getByText(/^last /).textContent).toBe(`last ${dayLabel(at(13, 0), today)}`);
  });

  it('says when nothing was tracked at all', () => {
    list([]);
    expect(screen.getByText('Nothing tracked yet')).toBeTruthy();
  });
});
