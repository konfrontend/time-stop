// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Record } from '@app/domain';
import { TooltipProvider } from '@/components/ui/tooltip';
import { aDashboardRow } from '@/test/fixtures';
import { RecordSpan } from './RecordSpan';

const local = (hour: number, minute = 0) => new Date(2026, 8, 15, hour, minute).toISOString();

afterEach(cleanup);

function span(record: Partial<Record> = {}) {
  const onChange = vi.fn();
  const shown = aDashboardRow('r1', {
    project: null,
    record: { name: 'Redesign', start: local(9), stop: local(11), ...record },
  }).record;
  render(
    <TooltipProvider>
      <RecordSpan record={shown} now={Date.parse(local(20))} onChange={onChange} />
    </TooltipProvider>,
  );
  return onChange;
}

function edit(which: 'Start' | 'Stop') {
  fireEvent.click(screen.getByRole('button', { name: `Edit ${which.toLowerCase()}` }));
  return screen.getByRole('combobox', { name: which });
}

describe('RecordSpan', () => {
  it('commits a start picked from the list, keeping the rest of the Record', async () => {
    const onChange = span();
    edit('Start');
    fireEvent.click(await screen.findByRole('option', { name: /^08:30( AM)?$/ }));
    expect(onChange).toHaveBeenCalledWith({
      projectId: null,
      name: 'Redesign',
      start: local(8, 30),
      stop: local(11),
    });
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('commits a typed stop on Enter', () => {
    const onChange = span();
    const input = edit('Stop');
    fireEvent.change(input, { target: { value: '11:45' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ stop: local(11, 45) }));
  });

  it('commits nothing for an unchanged time, nor one given up with Escape', () => {
    const onChange = span();
    fireEvent.keyDown(edit('Start'), { key: 'Enter' });

    const input = edit('Stop');
    fireEvent.change(input, { target: { value: '11:45' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('marks a draft the form rules refuse, keeps it open on Enter, drops it on blur', () => {
    const onChange = span();
    const input = edit('Stop');
    fireEvent.change(input, { target: { value: '08:00' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('combobox', { name: 'Stop' })).toBe(input);

    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('commits a pick over an exact clock typed before it, once', async () => {
    const onChange = span();
    const input = edit('Start');
    fireEvent.change(input, { target: { value: '08:00' } });
    fireEvent.click(await screen.findByRole('option', { name: /^08:30( AM)?$/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ start: local(8, 30) }),
    );
  });

  it('commits a typed stop on blur, once', () => {
    const onChange = span();
    const input = edit('Stop');
    fireEvent.change(input, { target: { value: '1145' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ stop: local(11, 45) }),
    );
  });

  it("edits a running Timer's start, and offers no stop", () => {
    span({ start: local(19), stop: null });
    expect(screen.queryByRole('button', { name: 'Edit stop' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit start' })).toBeTruthy();
  });
});
