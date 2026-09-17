// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncStatus } from '@time-stop/domain';
import { harness, renderWith, type Harness } from '@/test/harness';
import { ServerSection } from './ServerSection';

const idle: SyncStatus = {
  configured: false,
  pending: 3,
  lastPushedAt: null,
  lastError: null,
  halted: false,
};

let h: Harness;
let setServer: ReturnType<typeof vi.spyOn>;

/** The push state is the main process's to report, so a test states it rather than earning it. */
function reporting(status: SyncStatus) {
  vi.spyOn(window.timeStop.sync, 'getStatus').mockResolvedValue(status);
}

const open = () => renderWith(<ServerSection />);
const tokenField = () => screen.getByLabelText('Token');
const save = () => screen.getByRole('button', { name: 'Save' });

beforeEach(() => {
  h = harness();
  setServer = vi.spyOn(window.timeStop.sync, 'setServer');
  reporting(idle);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ServerSection', () => {
  it('shows the pending count and no error while unconfigured', async () => {
    open();

    expect(await screen.findByText('No Server configured')).toBeTruthy();
    expect(screen.getByText('3 Changes waiting')).toBeTruthy();
    expect(screen.queryByText(/timestop.sqlite3/)).toBeNull();
  });

  it('sends the URL and the Token, then leaves the Token field empty', async () => {
    open();
    fireEvent.change(await screen.findByLabelText('Server URL'), {
      target: { value: 'https://mirror.test' },
    });
    fireEvent.change(tokenField(), { target: { value: 'tst_one' } });
    fireEvent.click(save());

    await waitFor(() =>
      expect(setServer).toHaveBeenCalledWith({ url: 'https://mirror.test', token: 'tst_one' }),
    );
    await waitFor(() => expect((tokenField() as HTMLInputElement).value).toBe(''));
  });

  it('masks the Token and only ever replaces it', async () => {
    await h.api.sync.setServer({ url: 'https://mirror.test', token: 'tst_one' });
    setServer.mockClear();
    open();

    const token = (await screen.findByLabelText('Token')) as HTMLInputElement;
    expect(token.type).toBe('password');
    expect(token.value).toBe('');
    expect(token.placeholder).toMatch(/paste a new one to replace/);

    fireEvent.click(save());
    await waitFor(() =>
      expect(setServer).toHaveBeenCalledWith({ url: 'https://mirror.test', token: null }),
    );
  });

  it('refuses a URL that is not http', async () => {
    open();
    fireEvent.change(await screen.findByLabelText('Server URL'), {
      target: { value: 'mirror.test' },
    });
    fireEvent.click(save());

    expect(await screen.findByText(/starts with http/)).toBeTruthy();
    expect(setServer).not.toHaveBeenCalled();
  });

  it('reports the last push, and a halt with the way out of it', async () => {
    reporting({
      configured: true,
      pending: 1,
      lastPushedAt: '2026-09-08T10:00:00.000Z',
      lastError: { kind: 'auth', message: '401 Token unknown', at: '2026-09-08T10:05:00.000Z' },
      halted: true,
    });
    open();

    expect(await screen.findByText(/1 Change waiting/)).toBeTruthy();
    expect(screen.getByText(/Last push/)).toBeTruthy();
    expect(screen.getByText(/Pushing stopped: 401 Token unknown/)).toBeTruthy();
    expect(screen.getByText(/Replace the Token to resume/)).toBeTruthy();
  });

  it('names a retry a retry rather than a halt', async () => {
    reporting({
      configured: true,
      pending: 2,
      lastPushedAt: null,
      lastError: {
        kind: 'network',
        message: '503 Service Unavailable',
        at: '2026-09-08T10:05:00.000Z',
      },
      halted: false,
    });
    open();

    expect(await screen.findByText(/Retrying: 503 Service Unavailable/)).toBeTruthy();
  });
});
