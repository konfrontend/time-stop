// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { timeStop } from '@time-stop/domain';
import { desktop as desktopContract } from '../../../shared/desktop';
import { harness, renderWith } from './harness';

afterEach(() => {
  vi.restoreAllMocks();
});

const membersOf = (contract: Record<string, Record<string, unknown>>) =>
  Object.entries(contract).flatMap(([group, members]) =>
    Object.keys(members).map((member) => [group, member] as const),
  );

describe('harness', () => {
  it('installs every member of both contracts', () => {
    harness();
    for (const [group, member] of membersOf(timeStop)) {
      expect(typeof (window.timeStop as never)[group][member], `timeStop.${group}.${member}`).toBe(
        'function',
      );
    }
    for (const [group, member] of membersOf(desktopContract)) {
      expect(typeof (window.desktop as never)[group][member], `desktop.${group}.${member}`).toBe(
        'function',
      );
    }
  });

  it('enforces the real rules behind the seam', async () => {
    const h = harness();
    await expect(
      h.api.record.create({
        workspaceId: h.workspace.id,
        projectId: null,
        name: 'Backwards',
        start: '2026-09-15T10:00:00.000Z',
        stop: '2026-09-15T09:00:00.000Z',
      }),
    ).rejects.toThrow();
  });

  it('fires onTimerChanged from a real write', async () => {
    harness();
    const seen = vi.fn();
    window.timeStop.record.onTimerChanged(seen);
    await window.timeStop.record.startTimer();
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ stop: null }));
  });

  it('emits a sync status no write would produce', () => {
    const h = harness();
    const seen = vi.fn();
    window.timeStop.sync.onSyncChanged(seen);
    h.emit.syncChanged({
      configured: true,
      pending: 3,
      lastPushedAt: null,
      lastError: null,
      halted: true,
    });
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ pending: 3, halted: true }));
  });

  it('emits a theme change over the desktop seam', () => {
    const h = harness();
    const seen = vi.fn();
    window.desktop.theme.onChanged(seen);
    h.emit.themeChanged(true);
    expect(seen).toHaveBeenCalledWith(true);
  });

  it('stops notifying a listener that unsubscribed', () => {
    const h = harness();
    const seen = vi.fn();
    window.desktop.theme.onChanged(seen)();
    h.emit.themeChanged(true);
    expect(seen).not.toHaveBeenCalled();
  });

  it('renders with a QueryClient and a TooltipProvider in place', () => {
    harness();
    renderWith(<span>ready</span>);
    expect(screen.getByText('ready')).toBeTruthy();
  });
});
