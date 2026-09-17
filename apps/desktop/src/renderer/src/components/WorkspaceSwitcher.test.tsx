// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Workspace } from '@time-stop/domain';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

const stamp = '2026-09-01T08:00:00.000Z';

const workspace = (id: string, name: string, color: string): Workspace => ({
  id,
  name,
  currency: null,
  color,
  createdAt: stamp,
  updatedAt: stamp,
});

function renderSwitcher(workspaces: Workspace[]) {
  Object.assign(window, {
    timeStop: {
      workspace: { list: async () => workspaces },
      context: {
        get: async () => ({ workspaceId: workspaces[0]!.id, projectId: null }),
        set: vi.fn(),
        onContextChanged: () => () => {},
      },
    },
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceSwitcher />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe('WorkspaceSwitcher', () => {
  it('fills the avatar with the Workspace color and reads the initials over it', async () => {
    renderSwitcher([workspace('w1', 'Work', '#101820')]);

    const fallback = await screen.findByText('WO');
    expect(fallback.style.backgroundColor).toBe('rgb(16, 24, 32)');
    expect(fallback.style.color).toBe('rgb(255, 255, 255)');
  });

  it('marks every Workspace in the menu with its color', async () => {
    renderSwitcher([workspace('w1', 'Work', '#101820'), workspace('w2', 'Side', '#ffe066')]);

    await screen.findByText('WO');
    const trigger = screen.getByRole('button', { name: 'Switch Workspace' });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });

    const side = await waitFor(() => screen.getByRole('menuitemradio', { name: 'Side' }));
    const dot = side.querySelector<HTMLElement>('[data-slot="workspace-dot"]');
    expect(dot?.style.backgroundColor).toBe('rgb(255, 224, 102)');
  });
});
