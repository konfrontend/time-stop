// @vitest-environment jsdom
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, Workspace } from '@time-stop/domain';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TrackerDial } from './TrackerDial';

const workspace: Workspace = {
  id: 'w1',
  name: 'Work',
  currency: 'USD',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
};

const project: Project = {
  id: 'p1',
  workspaceId: 'w1',
  clientId: null,
  name: 'Website redesign',
  rate: null,
  limitMin: null,
  limitMax: null,
  limitPeriod: null,
  startDate: null,
  endDate: null,
  color: '#4f6bd9',
  archived: false,
  updatedAt: '2026-09-01T08:00:00.000Z',
};

const handlers = { onSubmit: vi.fn(), onClear: vi.fn(), onToggle: vi.fn(), onPick: vi.fn() };
const queryClient = new QueryClient();

function Harness({
  standby = 'start' as 'start' | 'continue',
  name = '',
}: {
  standby?: 'start' | 'continue';
  name?: string;
}) {
  const [draft, setDraft] = useState(name);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TrackerDial
          workspace={workspace}
          projects={[project]}
          project={project}
          projectId="p1"
          timer={null}
          elapsed="00:00:00"
          elapsedMs={0}
          standby={standby}
          name={draft}
          activityTodayMs={3 * 3_600_000 + 45 * 60_000}
          pending={false}
          onDraftChange={setDraft}
          onSubmit={handlers.onSubmit}
          onClear={() => {
            handlers.onClear();
            setDraft('');
          }}
          onPickProject={handlers.onPick}
          onToggle={handlers.onToggle}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  Object.assign(window, { timeStop: { record: { recentNames: vi.fn(async () => []) } } });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TrackerDial', () => {
  it('starts what was typed on Enter, without the mouse', () => {
    render(<Harness />);
    const name = screen.getByLabelText('Name');
    fireEvent.change(name, { target: { value: 'Build header' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(handlers.onSubmit).toHaveBeenCalledExactlyOnceWith('Build header');
  });

  it('prints the Project abbreviation and its colour outside the ring', () => {
    render(<Harness />);
    expect(screen.getByText('WR')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Project: Website redesign' })).toBeTruthy();
  });

  it("prints the activity's total today beside Clear, and clears back to an empty Name", () => {
    render(<Harness standby="continue" name="Build header" />);
    expect(screen.getByText('3:45 today')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(handlers.onClear).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Name')).toHaveProperty('value', '');
    expect(document.activeElement).toBe(screen.getByLabelText('Name'));
  });

  it('offers Clear only once there is something to let go of', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'B' } });
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
  });
});
