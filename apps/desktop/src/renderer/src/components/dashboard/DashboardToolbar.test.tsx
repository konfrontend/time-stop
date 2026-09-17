// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@time-stop/domain';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { DashboardSelection } from '@/lib/dashboardSearch';
import { DashboardToolbar } from './DashboardToolbar';

const project: Project = {
  id: 'p1',
  workspaceId: 'w1',
  clientId: null,
  name: 'Acme API',
  rate: 100,
  limitMin: null,
  limitMax: null,
  limitPeriod: null,
  startDate: null,
  endDate: null,
  color: '#4f6bd9',
  archived: false,
  updatedAt: '2026-09-01T08:00:00.000Z',
};

const selection: DashboardSelection = {
  period: 'month',
  anchor: '2026-09-01',
  from: '2026-09-01T00:00:00.000Z',
  to: '2026-09-30T23:59:59.999Z',
  workspace: 'w1',
  project: null,
  billable: false,
  rounding: 'none',
};

const handlers = {
  onProject: vi.fn(),
  onPeriod: vi.fn(),
  onAnchor: vi.fn(),
  onExport: vi.fn(),
};

function open(overrides: Partial<DashboardSelection> = {}, busy = false) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <DashboardToolbar
          selection={{ ...selection, ...overrides }}
          projects={[project]}
          busy={busy}
          {...handlers}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('DashboardToolbar', () => {
  it('names the picked Project, or every one of them', () => {
    open();
    expect(screen.getByRole('combobox', { name: 'Project' }).textContent).toContain('All Projects');
    cleanup();
    open({ project: 'p1' });
    expect(screen.getByRole('combobox', { name: 'Project' }).textContent).toContain('Acme API');
  });

  it('clears the Project filter from the list', async () => {
    open({ project: 'p1' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Project' }));
    fireEvent.click(await screen.findByRole('option', { name: 'All Projects' }));
    expect(handlers.onProject).toHaveBeenCalledWith(null);
  });

  it('offers no Project to create from the filter', async () => {
    open();
    fireEvent.click(screen.getByRole('combobox', { name: 'Project' }));
    const list = await screen.findByRole('dialog');
    fireEvent.change(within(list).getByPlaceholderText('Find a Project…'), {
      target: { value: 'Nothing' },
    });
    expect(within(list).queryByRole('button', { name: /Create/ })).toBe(null);
    expect(within(list).getByText('No Project matches.')).toBeTruthy();
  });

  it('exports the view, and not while a mutation is in flight', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(handlers.onExport).toHaveBeenCalledTimes(1);
    cleanup();
    open({}, true);
    expect(screen.getByRole('button', { name: 'Export' }).hasAttribute('disabled')).toBe(true);
  });

  it('switches the Period from inside the Range popover', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /September/ }));
    const popover = await screen.findByRole('dialog');
    const period = within(popover).getByRole('radiogroup', { name: 'Period' });
    fireEvent.click(within(period).getByRole('radio', { name: 'Week' }));
    expect(handlers.onPeriod).toHaveBeenCalledWith('week');
  });
});
