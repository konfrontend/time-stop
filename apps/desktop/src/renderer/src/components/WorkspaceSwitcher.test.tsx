// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { harness, renderWith } from '@/test/harness';
import { nameWorkspace } from '@/test/fixtures';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

async function showSwitcher(...others: Array<{ name: string; color: string }>) {
  const h = harness();
  await nameWorkspace(h, { name: 'Work', currency: null, color: '#101820' });
  for (const other of others) await h.api.workspace.create({ ...other, currency: null });
  renderWith(<WorkspaceSwitcher />);
  return h;
}

afterEach(cleanup);

describe('WorkspaceSwitcher', () => {
  it('fills the avatar with the Workspace color and reads the initials over it', async () => {
    await showSwitcher();

    const fallback = await screen.findByText('WO');
    expect(fallback.style.backgroundColor).toBe('rgb(16, 24, 32)');
    expect(fallback.style.color).toBe('rgb(255, 255, 255)');
  });

  it('marks every Workspace in the menu with its color', async () => {
    await showSwitcher({ name: 'Side', color: '#ffe066' });

    await screen.findByText('WO');
    const trigger = screen.getByRole('button', { name: 'Switch Workspace' });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });

    const side = await waitFor(() => screen.getByRole('menuitemradio', { name: 'Side' }));
    const dot = side.querySelector<HTMLElement>('[data-slot="workspace-dot"]');
    expect(dot?.style.backgroundColor).toBe('rgb(255, 224, 102)');
  });
});
