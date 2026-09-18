// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Record } from '@time-stop/domain';
import { harness, renderWith, type Harness } from '@/test/harness';
import { recentRows, seedRecord } from '@/test/fixtures';
import { RecordSpan } from './RecordSpan';

const local = (hour: number, minute = 0) => new Date(2026, 8, 15, hour, minute).toISOString();

let h: Harness;

beforeEach(() => {
  h = harness();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function stopped(): Promise<Record> {
  const record = await seedRecord(h, { name: 'Redesign', start: local(9), stop: local(11) });
  renderWith(<RecordSpan record={record} now={Date.parse(local(20))} />);
  return record;
}

function edit(which: 'Start' | 'Stop') {
  fireEvent.click(screen.getByRole('button', { name: `Edit ${which.toLowerCase()}` }));
  return screen.getByRole('combobox', { name: which });
}

// Mutations reach the seam a tick later.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve)));

const saved = async () => (await recentRows(h))[0]!.record;

describe('RecordSpan', () => {
  it('saves a start picked from the list, keeping the rest of the Record', async () => {
    await stopped();
    edit('Start');
    fireEvent.click(await screen.findByRole('option', { name: /^08:30( AM)?$/ }));
    await settle();
    expect(await saved()).toMatchObject({ name: 'Redesign', start: local(8, 30), stop: local(11) });
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('saves a typed stop on Enter', async () => {
    await stopped();
    const input = edit('Stop');
    fireEvent.change(input, { target: { value: '11:45' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await settle();
    expect((await saved()).stop).toBe(local(11, 45));
  });

  it('saves nothing for an unchanged time, nor one given up with Escape', async () => {
    await stopped();
    const update = vi.spyOn(window.timeStop.record, 'update');
    fireEvent.keyDown(edit('Start'), { key: 'Enter' });

    const input = edit('Stop');
    fireEvent.change(input, { target: { value: '11:45' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    await settle();
    expect(update).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('marks a draft the form rules refuse, and closes on it without saving', async () => {
    await stopped();
    const update = vi.spyOn(window.timeStop.record, 'update');
    const input = edit('Stop');
    fireEvent.change(input, { target: { value: '08:00' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');

    fireEvent.keyDown(input, { key: 'Enter' });
    await settle();
    expect(update).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it("edits a running Timer's start, and offers no stop", async () => {
    await h.api.record.startTimer();
    const timer = (await h.api.record.getTimer())!;
    renderWith(<RecordSpan record={timer} now={Date.parse(timer.start) + 3_600_000} />);
    expect(screen.queryByRole('button', { name: 'Edit stop' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit start' })).toBeTruthy();
  });
});
