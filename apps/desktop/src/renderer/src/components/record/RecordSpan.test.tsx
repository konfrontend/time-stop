// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Record } from '@time-stop/domain';
import { harness, renderWith, type Harness } from '@/test/harness';
import { seedRecord } from '@/test/fixtures';
import { RecordSpan } from './RecordSpan';

const local = (day: number, h: number, m = 0, s = 0, ms = 0) =>
  new Date(2026, 8, day, h, m, s, ms).toISOString();

let h: Harness;
let update: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  h = harness();
  update = vi.spyOn(window.timeStop.record, 'update');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function show(record: Record) {
  renderWith(<RecordSpan record={record} now={Date.parse(local(16, 12))} />);
}

function type(which: 'start' | 'stop', value: string) {
  fireEvent.click(screen.getByRole('button', { name: `Edit ${which}` }));
  const input = screen.getByRole('combobox', { name: which === 'start' ? 'Start' : 'Stop' });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
  // Mutations reach the seam a tick later.
  return act(() => new Promise((resolve) => setTimeout(resolve)));
}

describe('RecordSpan', () => {
  it('keeps the seconds of the clock it did not edit', async () => {
    const record = await seedRecord(h, {
      name: 'Redesign',
      start: local(15, 9, 14, 37, 412),
      stop: local(15, 10, 2, 5, 9),
    });
    show(record);
    await type('stop', '10:30');
    expect(update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ start: record.start, stop: local(15, 10, 30) }),
    );
  });

  it('edits the start of a Record that crosses midnight', async () => {
    const overnight = await seedRecord(h, {
      name: 'Redesign',
      start: local(15, 23, 30),
      stop: local(16, 0, 30),
    });
    show(overnight);
    await type('start', '23:00');
    expect(update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ start: local(15, 23), stop: overnight.stop }),
    );
  });
});
