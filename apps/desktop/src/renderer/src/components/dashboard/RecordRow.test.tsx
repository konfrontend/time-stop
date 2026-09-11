// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow, Project } from '@time-stop/domain';
import { RecordRow } from './RecordRow';

const HOUR = 3_600_000;
const now = Date.parse('2026-09-15T10:00:00.000Z');

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
  updatedAt: '2026-09-01T08:00:00.000Z',
};

function row(
  overrides: Partial<Omit<DashboardRow, 'record'>> & { record?: Partial<DashboardRow['record']> },
): DashboardRow {
  return {
    project,
    client: null,
    currency: 'USD',
    limits: null,
    ...overrides,
    record: {
      id: 'r1',
      workspaceId: 'w1',
      projectId: 'p1',
      actorId: 'a1',
      name: 'Redesign',
      start: '2026-09-15T01:00:00.000Z',
      stop: '2026-09-15T02:00:00.000Z',
      updatedAt: '2026-09-15T02:00:00.000Z',
      ...overrides.record,
    },
  };
}

afterEach(cleanup);

describe('RecordRow', () => {
  it('shows the Amount of a Record in a rated Project with a Currency', () => {
    render(<RecordRow row={row({})} now={now} onOpen={vi.fn()} />);
    expect(screen.getByText('110.00 USD')).toBeTruthy();
  });

  it('shows no Amount without a Rate or without a Currency', () => {
    render(
      <RecordRow row={row({ project: { ...project, rate: null } })} now={now} onOpen={vi.fn()} />,
    );
    render(<RecordRow row={row({ currency: null })} now={now} onOpen={vi.fn()} />);
    expect(screen.queryByText(/USD/)).toBeNull();
  });

  it('prices the running Timer up to now', () => {
    render(
      <RecordRow
        row={row({ record: { start: '2026-09-15T08:00:00.000Z', stop: null } })}
        now={now}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText('220.00 USD')).toBeTruthy();
  });

  it('colors Limits usage outside Min and Max', () => {
    render(
      <RecordRow
        row={row({ limits: { period: 'week', usedMs: 5 * HOUR, min: 2, max: 4 } })}
        now={now}
        onOpen={vi.fn()}
      />,
    );
    const usage = screen.getByText('5.0 of 2–4 h');
    expect(usage.dataset['outside']).toBe('true');
  });

  it('opens on click', () => {
    const onOpen = vi.fn();
    render(<RecordRow row={row({})} now={now} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Redesign'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
