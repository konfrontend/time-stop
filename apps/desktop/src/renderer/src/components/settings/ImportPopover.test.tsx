// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workspace } from '@time-stop/domain';
import { TooltipProvider } from '@/components/ui/tooltip';
import { pickOption } from '@/test/pickOption';
import { ImportPopover } from './ImportPopover';

const stamp = '2026-09-01T08:00:00.000Z';

function workspace(id: string, name: string): Workspace {
  return { id, name, currency: 'USD', createdAt: stamp, updatedAt: stamp } as unknown as Workspace;
}

const workspaces = [workspace('w1', 'Work'), workspace('w2', 'Side')];

const result = { filename: 'toggl.csv', projects: 5, clients: 0, records: 307, skipped: 0 };
const desktop = { imports: { importToggl: vi.fn(async () => result) } };

function renderPopover(props: Partial<React.ComponentProps<typeof ImportPopover>> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <ImportPopover workspaces={workspaces} defaultWorkspaceId="w1" {...props} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

async function open() {
  renderPopover();
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  await screen.findByText('Import from Toggl Track');
}

const importButton = () => screen.getByRole('button', { name: /Choose CSV/ });

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(window, { desktop });
});
afterEach(cleanup);

describe('ImportPopover', () => {
  it("imports into the Context's Workspace and the zone of this machine", async () => {
    await open();
    fireEvent.click(importButton());

    await waitFor(() =>
      expect(desktop.imports.importToggl).toHaveBeenCalledWith({
        workspaceId: 'w1',
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    );
    expect(await screen.findByText(/Imported 307 Records, 5 Projects/)).toBeTruthy();
  });

  it('imports into the Workspace picked', async () => {
    await open();
    await pickOption('Workspace', 'Side');
    fireEvent.click(importButton());

    await waitFor(() =>
      expect(desktop.imports.importToggl).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'w2' }),
      ),
    );
  });

  it('falls back to the default when the Workspace picked is deleted', async () => {
    const { rerender } = renderPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    await screen.findByText('Import from Toggl Track');
    await pickOption('Workspace', 'Side');

    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <ImportPopover workspaces={[workspaces[0]!]} defaultWorkspaceId="w1" />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(importButton());

    await waitFor(() =>
      expect(desktop.imports.importToggl).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'w1' }),
      ),
    );
  });

  it('reads the export in the zone picked', async () => {
    await open();
    await pickOption('Time zone of the export', 'Europe/Berlin');
    fireEvent.click(importButton());

    await waitFor(() =>
      expect(desktop.imports.importToggl).toHaveBeenCalledWith(
        expect.objectContaining({ zone: 'Europe/Berlin' }),
      ),
    );
  });

  it('says how many entries were already here', async () => {
    desktop.imports.importToggl.mockResolvedValueOnce({ ...result, records: 0, skipped: 307 });
    await open();
    fireEvent.click(importButton());

    expect(await screen.findByText(/307 entries were already here/)).toBeTruthy();
  });

  it('stays quiet when the Owner cancels the file dialog', async () => {
    desktop.imports.importToggl.mockResolvedValueOnce(null as unknown as typeof result);
    await open();
    fireEvent.click(importButton());

    await waitFor(() => expect(importButton().hasAttribute('disabled')).toBe(false));
    expect(screen.queryByText(/Imported/)).toBeNull();
  });

  it('shows what went wrong when the export cannot be read', async () => {
    desktop.imports.importToggl.mockRejectedValueOnce(
      new Error('The export is missing Start date'),
    );
    await open();
    fireEvent.click(importButton());

    expect(await screen.findByText(/The export is missing Start date/)).toBeTruthy();
  });
});
