// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Project, Workspace } from '@time-stop/domain';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WorkspacesTab } from './WorkspacesTab';

const stamp = '2026-09-01T08:00:00.000Z';

const project = {
  id: 'p1',
  workspaceId: 'w1',
  clientId: null,
  name: 'Site',
  color: '#3366ff',
  rate: 80,
  archived: false,
  createdAt: stamp,
  updatedAt: stamp,
} as unknown as Project;

function renderWith(currency: string | null) {
  const workspace = { id: 'w1', name: 'Work', currency, createdAt: stamp, updatedAt: stamp };
  Object.assign(window, {
    timeStop: {
      context: {
        get: async () => ({ workspaceId: 'w1', projectId: null }),
        onContextChanged: () => () => {},
      },
      workspace: { list: async () => [workspace as unknown as Workspace] },
      client: { list: async () => [] },
      project: { list: async () => [project] },
    },
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <WorkspacesTab />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('WorkspacesTab Projects', () => {
  it('marks a Project with a Rate Billable when its Workspace has a Currency', async () => {
    renderWith('USD');

    expect(await screen.findByText('80/h')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Billable' })).toBeTruthy();
    expect(screen.queryByText(/Set a Currency/)).toBeNull();
  });

  it('keeps a Project with a Rate not Billable when its Workspace has no Currency', async () => {
    renderWith(null);

    expect(await screen.findByText('80/h')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Billable' })).toBeNull();
    expect(screen.getByText('Set a Currency on Work to bill')).toBeTruthy();
  });
});
