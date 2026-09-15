// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Workspace } from '@time-stop/domain';
import { TooltipProvider } from '@/components/ui/tooltip';
import { pickOption } from '@/test/pickOption';
import { ImportPopover } from './ImportPopover';

const workspace = {
  id: 'w1',
  name: 'Work',
  currency: 'USD',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
} as unknown as Workspace;

const result = { filename: 'toggl.csv', projects: 5, clients: 0, records: 307, skipped: 0 };
const desktop = { imports: { importToggl: vi.fn(async () => result) } };

async function open() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <ImportPopover workspace={workspace} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Import into Work' }));
  await screen.findByText('Import into Work');
}

const importButton = () => screen.getByRole('button', { name: /Choose CSV/ });

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(window, { desktop });
});
afterEach(cleanup);

describe('ImportPopover', () => {
  it('imports into the Workspace of its row and the zone of this machine', async () => {
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
