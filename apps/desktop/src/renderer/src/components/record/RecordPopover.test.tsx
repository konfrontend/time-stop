// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, Record } from '@time-stop/domain';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import { harness, renderWith, type Harness } from '@/test/harness';
import { seedProject, seedRecord } from '@/test/fixtures';
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
  onSave?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

function open({
  record: shown,
  projects = [acme],
  defaults,
  onSave = async () => {},
  onDelete,
}: OpenProps = {}) {
  const callbacks = {
    onSave: vi.fn(onSave),
    onDelete: onDelete && vi.fn(onDelete),
    onClose: vi.fn(),
  };
  renderWith(
    <Popover open>
      <PopoverAnchor />
      <RecordPopover
        record={shown}
        workspaceId={h.workspace.id}
        projects={projects}
        today={today}
        defaults={defaults}
        {...callbacks}
      />
    </Popover>,
  );
  return callbacks;
}

const form = () => slot('record-popover');

async function rename(name: string) {
  fireEvent.change((await form()).getByLabelText(/name/i), { target: { value: name } });
}

async function save() {
  const popover = await form();
  await act(async () => fireEvent.click(popover.getByRole('button', { name: 'Save' })));
}

beforeEach(async () => {
  h = harness();
  acme = await seedProject(h, { name: 'Acme API' });
  record = await seedRecord(h, {
    project: acme,
    name: 'Redesign',
    start: at(14, 9),
    stop: at(14, 10),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RecordPopover', () => {
  it('saves a new Record on today with the prefilled Project and span, then closes', async () => {
    const { onSave, onClose } = open({
      defaults: { projectId: acme.id, start: '09:00', stop: '10:30' },
    });
    await rename('Review');
    await save();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({
      projectId: acme.id,
      name: 'Review',
      start: at(15, 9),
      stop: at(15, 10, 30),
    });
  });

  it('saves an edited Record of any day without asking', async () => {
    const { onSave, onClose } = open({ record });
    await rename('Fixed');
    await save();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fixed', start: at(14, 9) }),
    );
  });

  it('reports a rejected save over Save and stays open', async () => {
    const { onClose } = open({
      record,
      onSave: () => Promise.reject(new Error('Record not found')),
    });
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

  it('deletes once confirmed, then closes', async () => {
    const { onDelete, onClose } = open({ record, onDelete: async () => {} });
    fireEvent.click((await form()).getByRole('button', { name: 'Delete' }));
    const confirm = await slot('danger-popover');
    const button = await waitFor(() => {
      const found = confirm.getByRole('button', { name: 'Delete' }) as HTMLButtonElement;
      expect(found.disabled).toBe(false);
      return found;
    });
    await act(async () => fireEvent.click(button));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('offers no Delete without onDelete', async () => {
    open({ record });
    expect((await form()).queryByRole('button', { name: 'Delete' })).toBeNull();
  });
});
