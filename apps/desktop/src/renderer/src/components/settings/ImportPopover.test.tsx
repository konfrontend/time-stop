// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workspace } from '@time-stop/domain';
import { harness, renderWith } from '@/test/harness';
import { nameWorkspace } from '@/test/fixtures';
import { pickOption } from '@/test/pickOption';
import { slot } from '@/test/slot';
import { ImportPopover } from './ImportPopover';

const result = { filename: 'toggl.csv', projects: 5, clients: 0, records: 307, skipped: 0 };

let workspaces: [Workspace, Workspace];
let importToggl: ReturnType<typeof vi.spyOn>;

function renderPopover(shown = workspaces) {
  return renderWith(<ImportPopover workspaces={shown} defaultWorkspaceId={workspaces[0].id} />);
}

async function open() {
  renderPopover();
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  await slot('import-popover');
}

const importButton = () => screen.getByRole('button', { name: /Choose CSV/ });

beforeEach(async () => {
  const h = harness();
  const work = await nameWorkspace(h, { name: 'Work' });
  const side = await h.api.workspace.create({ name: 'Side', currency: 'USD', color: '#ffe066' });
  workspaces = [work, side];
  importToggl = vi.spyOn(window.desktop.imports, 'importToggl').mockResolvedValue(result);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ImportPopover', () => {
  it("imports into the Context's Workspace and the zone of this machine", async () => {
    await open();
    fireEvent.click(importButton());

    await waitFor(() =>
      expect(importToggl).toHaveBeenCalledWith({
        workspaceId: workspaces[0].id,
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    );
  });

  it('imports into the Workspace picked', async () => {
    await open();
    await pickOption('Workspace', 'Side');
    fireEvent.click(importButton());

    await waitFor(() =>
      expect(importToggl).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: workspaces[1].id }),
      ),
    );
  });

  it('falls back to the default when the Workspace picked is deleted', async () => {
    const { rerender } = renderPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await slot('import-popover');
    await pickOption('Workspace', 'Side');

    rerender(<ImportPopover workspaces={[workspaces[0]]} defaultWorkspaceId={workspaces[0].id} />);
    fireEvent.click(importButton());

    await waitFor(() =>
      expect(importToggl).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: workspaces[0].id }),
      ),
    );
  });

  it('reads the export in the zone picked', async () => {
    await open();
    await pickOption('Time zone of the export', 'Europe/Berlin');
    fireEvent.click(importButton());

    await waitFor(() =>
      expect(importToggl).toHaveBeenCalledWith(expect.objectContaining({ zone: 'Europe/Berlin' })),
    );
  });

  it('shows what went wrong when the export cannot be read', async () => {
    importToggl.mockRejectedValueOnce(new Error('The export is missing Start date'));
    await open();
    fireEvent.click(importButton());

    const popover = await slot('import-popover');
    expect(await popover.findByText(/The export is missing Start date/)).toBeTruthy();
  });
});
