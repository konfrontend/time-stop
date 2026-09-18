// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, Record } from '@time-stop/domain';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import { harness, renderWith, type Harness } from '@/test/harness';
import { recentRows, seedProject, seedRecord } from '@/test/fixtures';
import { slot } from '@/test/slot';
import { RecordPopover } from './RecordPopover';

const at = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m).toISOString();
const today = at(15, 0);

let h: Harness;
let acme: Project;
let record: Record;

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

const form = () => slot('record-popover');

async function rename(name: string) {
  fireEvent.change((await form()).getByLabelText(/name/i), { target: { value: name } });
}

async function save() {
  const popover = await form();
  await act(async () => fireEvent.click(popover.getByRole('button', { name: 'Save' })));
}

const saved = async (id: string) =>
  (await recentRows(h)).find((row) => row.record.id === id)?.record;

beforeEach(async () => {
  h = harness();
  acme = await seedProject(h, { name: 'Acme API' });
  record = await seedRecord(h, {
    project: acme,
    name: 'Redesign',
    start: at(15, 9),
    stop: at(15, 10),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RecordPopover', () => {
  it('adds a stopped Record on the day with the prefilled Project and span', async () => {
    const onClose = open({ defaults: { projectId: acme.id, start: '09:00', stop: '10:30' } });
    await rename('Review');
    await save();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const added = (await recentRows(h)).find((row) => row.record.name === 'Review')?.record;
    expect(added).toMatchObject({ projectId: acme.id, start: at(15, 9), stop: at(15, 10, 30) });
  });

  it('saves a Record from today without asking', async () => {
    const onClose = open({ record });
    await rename('Same day');
    await save();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await saved(record.id))?.name).toBe('Same day');
  });

  it('asks before saving a Record from a previous day, then saves once confirmed', async () => {
    const yesterday = await seedRecord(h, {
      project: acme,
      name: 'Redesign',
      start: at(14, 9),
      stop: at(14, 10),
    });
    const onClose = open({ record: yesterday });
    await rename('Fixed');
    await save();

    const alert = await slot('save-alert');
    expect((await saved(yesterday.id))?.name).toBe('Redesign');

    await act(async () => fireEvent.click(alert.getByRole('button', { name: 'Save anyway' })));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await saved(yesterday.id))?.name).toBe('Fixed');
  });

  it('reports a failed save over Save and stays open', async () => {
    vi.spyOn(window.timeStop.record, 'update').mockRejectedValueOnce(new Error('Record not found'));
    const onClose = open({ record });
    await save();

    expect((await slot('save-alert')).getByRole('alert').textContent).toBe('Record not found');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('suggests the recent Names of the Project picked', async () => {
    await seedRecord(h, { project: null, name: 'Chores', start: at(15, 11), stop: at(15, 12) });
    open({ defaults: { projectId: acme.id, start: '', stop: '' } });
    const popover = await form();

    fireEvent.focus(popover.getByLabelText(/name/i));
    const names = async () =>
      (await screen.findAllByRole('option')).map((option) => option.textContent);
    await waitFor(async () => expect(await names()).toEqual(['Redesign']));

    fireEvent.click(popover.getByLabelText(/project/i));
    fireEvent.click(await screen.findByRole('option', { name: 'No Project' }));
    fireEvent.focus(popover.getByLabelText(/name/i));
    await waitFor(async () => expect(await names()).toContain('Chores'));
  });

  it('deletes a Record once confirmed', async () => {
    const onClose = open({ record });
    fireEvent.click((await form()).getByRole('button', { name: 'Delete' }));
    const confirm = await slot('danger-popover');
    const button = await waitFor(() => {
      const found = confirm.getByRole('button', { name: 'Delete' }) as HTMLButtonElement;
      expect(found.disabled).toBe(false);
      return found;
    });
    await act(async () => fireEvent.click(button));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await saved(record.id)).toBeUndefined();
  });

  it('keeps the Archived Project the Record already has pickable', async () => {
    const archived = await seedProject(h, { name: 'Old site' });
    open({
      record,
      projects: [
        { ...acme, archived: true },
        { ...archived, archived: true },
      ],
    });

    fireEvent.click((await form()).getByLabelText(/project/i));
    expect(await screen.findByRole('option', { name: /Acme API/ })).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Old site/ })).toBeNull();
  });
});
