// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Project } from '@time-stop/domain';
import { RecordRow } from './RecordRow';

const HOUR = 3_600_000;
const now = 10 * HOUR;

const project: Project = {
  id: 'p1',
  workspaceId: 'w1',
  clientId: null,
  name: 'Acme API',
  rate: 110,
  limitMin: null,
  limitMax: null,
  limitPeriod: null,
  startDate: null,
  endDate: null,
  color: '#4f6bd9',
  archived: false,
  updatedAt: 0,
};

function row(
  overrides: Partial<Omit<DashboardRow, 'record'>> & { record?: Partial<DashboardRow['record']> },
): DashboardRow {
  return {
    project,
    client: null,
    currency: 'USD',
    overlap: false,
    limits: null,
    ...overrides,
    record: {
      id: 'r1',
      workspaceId: 'w1',
      projectId: 'p1',
      actorId: 'a1',
      name: 'Redesign',
      start: HOUR,
      stop: 2 * HOUR,
      rate: 110,
      billable: true,
      updatedAt: 0,
      ...overrides.record,
    },
  };
}

afterEach(cleanup);

describe('RecordRow', () => {
  it('shows the Overlap flag only on an overlapping Record', () => {
    const { rerender } = render(
      <RecordRow row={row({ overlap: true })} now={now} onBillable={vi.fn()} onOpen={vi.fn()} />,
    );
    expect(screen.getByText('Overlap')).toBeTruthy();
    rerender(
      <RecordRow row={row({ overlap: false })} now={now} onBillable={vi.fn()} onOpen={vi.fn()} />,
    );
    expect(screen.queryByText('Overlap')).toBeNull();
  });

  it('dims the Billable toggle on a Record without a Rate but keeps it clickable', () => {
    const onBillable = vi.fn();
    render(
      <RecordRow
        row={row({ record: { rate: null, billable: false } })}
        now={now}
        onBillable={onBillable}
        onOpen={vi.fn()}
      />,
    );
    const toggle = screen.getByRole('button', { name: /billable/i });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.dataset['dimmed']).toBe('true');
    fireEvent.click(toggle);
    expect(onBillable).toHaveBeenCalledWith(true);
  });

  it('flips a Billable Record with a Rate off, undimmed', () => {
    const onBillable = vi.fn();
    render(<RecordRow row={row({})} now={now} onBillable={onBillable} onOpen={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /billable/i });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.dataset['dimmed']).toBeUndefined();
    fireEvent.click(toggle);
    expect(onBillable).toHaveBeenCalledWith(false);
    expect(screen.getByText('110.00 USD')).toBeTruthy();
  });

  it('colors Limits usage outside Min and Max', () => {
    render(
      <RecordRow
        row={row({ limits: { period: 'week', usedMs: 5 * HOUR, min: 2, max: 4 } })}
        now={now}
        onBillable={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    const usage = screen.getByText('5.0 of 2–4 h');
    expect(usage.dataset['outside']).toBe('true');
  });

  it('opens on click without the Billable toggle opening it too', () => {
    const onOpen = vi.fn();
    const onBillable = vi.fn();
    render(<RecordRow row={row({})} now={now} onBillable={onBillable} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Redesign'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /billable/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onBillable).toHaveBeenCalledWith(false);
  });
});
