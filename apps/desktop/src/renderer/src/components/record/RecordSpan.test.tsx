// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Record } from '@time-stop/domain';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RecordSpan } from './RecordSpan';

const local = (day: number, h: number, m = 0, s = 0, ms = 0) =>
  new Date(2026, 8, day, h, m, s, ms).toISOString();

const record: Record = {
  id: 'r1',
  workspaceId: 'w1',
  projectId: 'p1',
  actorId: 'a1',
  name: 'Redesign',
  start: local(15, 9, 14, 37, 412),
  stop: local(15, 10, 2, 5, 9),
  updatedAt: local(15, 10, 2),
};

const update = vi.fn(async (input: object) => ({ ...record, ...input }));

function show(shown: Record) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <RecordSpan record={shown} now={Date.parse(local(16, 12))} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

function type(which: 'start' | 'stop', value: string) {
  fireEvent.click(screen.getByRole('button', { name: `Edit ${which}` }));
  const input = screen.getByRole('combobox', { name: which === 'start' ? 'Start' : 'Stop' });
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
  // Mutations reach the IPC bridge a tick later.
  return act(() => new Promise((resolve) => setTimeout(resolve)));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(window, { timeStop: { record: { update } } });
});
afterEach(cleanup);

describe('RecordSpan', () => {
  it('keeps the seconds of the clock it did not edit', async () => {
    show(record);
    await type('stop', '10:30');
    expect(update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ start: record.start, stop: local(15, 10, 30) }),
    );
  });

  it('edits the start of a Record that crosses midnight', async () => {
    const overnight = { ...record, start: local(15, 23, 30), stop: local(16, 0, 30) };
    show(overnight);
    await type('start', '23:00');
    expect(update).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ start: local(15, 23), stop: overnight.stop }),
    );
  });
});
