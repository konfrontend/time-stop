// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, Record } from '@time-stop/domain';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import { harness, renderWith, type Harness } from '@/test/harness';
import { seedProject, seedRecord } from '@/test/fixtures';
import { RecordPopover } from './RecordPopover';

const at = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m).toISOString();
const today = at(15, 0);

let h: Harness;
let acme: Project;
let record: Record;
let spies: {
  create: ReturnType<typeof vi.spyOn>;
  update: ReturnType<typeof vi.spyOn>;
  delete: ReturnType<typeof vi.spyOn>;
  recentNames: ReturnType<typeof vi.spyOn>;
};

interface OpenProps {
  record?: Record;
  projects?: Project[];
  defaults?: { projectId: string | null; start: string; stop: string };
}

function open({ record: shown, projects = [acme], defaults }: OpenProps = {}) {
  const onClose = vi.fn();
  renderWith(
    <Popover open>
      <PopoverAnchor />
      <RecordPopover
        record={shown}
        workspaceId={h.workspace.id}
        projects={projects}
        today={today}
        defaults={defaults}
        onClose={onClose}
      />
    </Popover>,
  );
  return onClose;
}

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));
const popoverOf = (slot: string) =>
  screen.findAllByRole('dialog').then((all) => all.find((d) => d.dataset.slot === slot)!);

beforeEach(async () => {
  h = harness();
  acme = await seedProject(h, { name: 'Acme API' });
  record = await seedRecord(h, {
    project: acme,
    name: 'Redesign',
    start: at(15, 9),
    stop: at(15, 10),
  });
  spies = {
    create: vi.spyOn(window.timeStop.record, 'create'),
    update: vi.spyOn(window.timeStop.record, 'update'),
    delete: vi.spyOn(window.timeStop.record, 'delete'),
    recentNames: vi
      .spyOn(window.timeStop.record, 'recentNames')
      .mockResolvedValue(['Review', 'Redesign']),
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const yesterdayRecord = () =>
  seedRecord(h, { project: acme, name: 'Redesign', start: at(14, 9), stop: at(14, 10) });

describe('RecordPopover', () => {
  it('adds a stopped Record on the day with the prefilled Project and span', async () => {
    const onClose = open({ defaults: { projectId: acme.id, start: '09:00', stop: '10:30' } });
    type(/name/i, 'Review');
    await act(async () => save());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(spies.create).toHaveBeenCalledWith({
      workspaceId: h.workspace.id,
      projectId: acme.id,
      name: 'Review',
      start: at(15, 9),
      stop: at(15, 10, 30),
    });
  });

  it('rejects a stop before start on the stop field', async () => {
    const onClose = open();
    type(/start/i, '10:00');
    type(/stop/i, '09:00');
    await act(async () => save());

    expect(await screen.findByText('Stop must not precede start')).toBeTruthy();
    expect(screen.getByLabelText(/stop/i).getAttribute('aria-invalid')).toBe('true');
    expect(spies.create).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('asks in a Popover before saving a Record from a previous day, then proceeds', async () => {
    const yesterday = await yesterdayRecord();
    const onClose = open({ record: yesterday });
    type(/name/i, 'Fixed');
    await act(async () => save());

    const alert = await popoverOf('save-alert');
    expect(alert.textContent).toContain('previous day');
    expect(spies.update).not.toHaveBeenCalled();

    await act(async () =>
      fireEvent.click(within(alert).getByRole('button', { name: 'Save anyway' })),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(spies.update).toHaveBeenCalledWith({
      id: yesterday.id,
      projectId: acme.id,
      name: 'Fixed',
      start: at(14, 9),
      stop: at(14, 10),
    });
  });

  it('saves a Record from today without asking', async () => {
    const onClose = open({ record });
    type(/name/i, 'Same day');
    await act(async () => save());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByText(/previous day/)).toBeNull();
  });

  it('keeps the seconds of a span it did not edit', async () => {
    const precise = await seedRecord(h, {
      project: acme,
      name: 'Redesign',
      start: new Date(2026, 8, 15, 9, 14, 37, 412).toISOString(),
      stop: new Date(2026, 8, 15, 10, 2, 5, 9).toISOString(),
    });
    const onClose = open({ record: precise });
    type(/name/i, 'Renamed');
    await act(async () => save());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(spies.update).toHaveBeenCalledWith({
      id: precise.id,
      projectId: acme.id,
      name: 'Renamed',
      start: precise.start,
      stop: precise.stop,
    });
  });

  it('renames a Record that crosses midnight', async () => {
    const overnight = await seedRecord(h, {
      project: acme,
      name: 'Redesign',
      start: at(15, 23, 30),
      stop: at(16, 0, 30),
    });
    const onClose = open({ record: overnight });
    type(/name/i, 'Late');
    await act(async () => save());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(spies.update).toHaveBeenCalledWith({
      id: overnight.id,
      projectId: acme.id,
      name: 'Late',
      start: overnight.start,
      stop: overnight.stop,
    });
  });

  it('reports a failed save in a Popover over Save and stays open', async () => {
    spies.update.mockRejectedValueOnce(new Error('Record not found'));
    const onClose = open({ record });
    await act(async () => save());

    const alert = await popoverOf('save-alert');
    expect(within(alert).getByRole('alert').textContent).toBe('Record not found');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('suggests recent Names of the chosen Project', async () => {
    open({ defaults: { projectId: acme.id, start: '', stop: '' } });
    await waitFor(() => expect(spies.recentNames).toHaveBeenCalledWith({ projectId: acme.id }));
    fireEvent.focus(screen.getByLabelText(/name/i));
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['Review', 'Redesign']);

    fireEvent.click(screen.getByLabelText(/project/i));
    fireEvent.click(await screen.findByRole('option', { name: 'No Project' }));
    await waitFor(() => expect(spies.recentNames).toHaveBeenCalledWith({ projectId: null }));
  });

  it('deletes a Record after confirming', async () => {
    const onClose = open({ record });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await popoverOf('danger-popover');
    await waitFor(() => expect(confirm.textContent).toContain('Delete this Record?'));
    await act(async () => fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' })));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(spies.delete).toHaveBeenCalledWith({ id: record.id });
  });

  it('names a previous day in the delete confirm', async () => {
    open({ record: await yesterdayRecord() });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await popoverOf('danger-popover');
    await waitFor(() => expect(confirm.textContent).toContain('previous day'));
  });

  it('keeps an Archived Project the Record already has in the picker', async () => {
    open({ record, projects: [{ ...acme, archived: true }] });
    const picker = screen.getByLabelText(/project/i);
    expect(picker.textContent).toBe('Acme APIArchived');
    fireEvent.click(picker);
    expect(await screen.findByRole('option', { name: /Acme API\s*Archived/ })).toBeTruthy();
  });
});
