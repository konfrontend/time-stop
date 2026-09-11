// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rounding } from '@time-stop/domain';
import { ExportDialog } from './ExportDialog';
import type { DashboardSelection } from '@/lib/dashboardSearch';

const selection: DashboardSelection = {
  period: 'month',
  anchor: '2026-07-15',
  from: new Date(2026, 6, 1).toISOString(),
  to: new Date(2026, 7, 1).toISOString(),
  workspace: 'w1',
  project: 'p1',
  client: null,
  billable: 'all',
  rounding: 'none',
};

const report = { filename: 'acme-site_2026-07-01_2026-07-31.csv', csv: 'Project,Acme site\n' };
const timeStop = { report: { export: vi.fn(async () => report) } };
const desktop = { files: { saveText: vi.fn(async () => true) } };

function open(rounding: Rounding = 'none') {
  const props = { onRounding: vi.fn(), onClose: vi.fn() };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ExportDialog selection={{ ...selection, rounding }} {...props} />
    </QueryClientProvider>,
  );
  return props;
}

const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(window, { timeStop, desktop });
});
afterEach(cleanup);

describe('ExportDialog', () => {
  it('saves the Report of the current view under the built filename', async () => {
    const { onClose } = open();
    await act(async () => click(/export/i));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(timeStop.report.export).toHaveBeenCalledWith({
      from: selection.from,
      to: selection.to,
      workspaceId: 'w1',
      projectId: 'p1',
      rounding: 'none',
    });
    expect(desktop.files.saveText).toHaveBeenCalledWith({
      filename: report.filename,
      text: report.csv,
    });
  });

  it('reports the chosen Rounding upwards and exports with it', async () => {
    const { onRounding } = open();
    click(/nearest 15 min/i);
    expect(onRounding).toHaveBeenCalledWith('15m');

    cleanup();
    open('15m');
    await act(async () => click(/export/i));
    expect(timeStop.report.export).toHaveBeenCalledWith(
      expect.objectContaining({ rounding: '15m' }),
    );
  });

  it('keeps the dialog open and shows why the save failed', async () => {
    timeStop.report.export.mockRejectedValueOnce(new Error('Disk full'));
    const { onClose } = open();
    await act(async () => click(/export/i));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Disk full');
    expect(onClose).not.toHaveBeenCalled();
  });
});
