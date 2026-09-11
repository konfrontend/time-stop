// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerSettings, SyncStatus } from '@time-stop/domain';
import { ServerSection } from './ServerSection';

const unconfigured: ServerSettings = {
  url: null,
  tokenSet: false,
  databasePath: '/home/owner/timestop.sqlite3',
};

const idle: SyncStatus = {
  configured: false,
  pending: 3,
  lastPushedAt: null,
  lastError: null,
  halted: false,
};

let server: ServerSettings;
let status: SyncStatus;
const setServer = vi.fn(async (input: { url: string; token: string | null }) => {
  server = { ...server, url: input.url || null, tokenSet: input.token !== null || server.tokenSet };
  return server;
});

function open() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ServerSection />
    </QueryClientProvider>,
  );
}

const tokenField = () => screen.getByLabelText('Token');
const save = () => screen.getByRole('button', { name: 'Save' });

beforeEach(() => {
  vi.clearAllMocks();
  server = unconfigured;
  status = idle;
  Object.assign(window, {
    timeStop: {
      sync: {
        getServer: async () => server,
        setServer,
        getStatus: async () => status,
        onSyncChanged: () => () => {},
      },
    },
  });
});
afterEach(cleanup);

describe('ServerSection', () => {
  it('shows the database path, the pending count and no error while unconfigured', async () => {
    open();

    expect(await screen.findByText(/\/home\/owner\/timestop.sqlite3/)).toBeTruthy();
    expect(screen.getByText(/No Server configured · 3 Changes waiting/)).toBeTruthy();
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
    server = { ...unconfigured, url: 'https://mirror.test', tokenSet: true };
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
    status = {
      configured: true,
      pending: 1,
      lastPushedAt: '2026-09-08T10:00:00.000Z',
      lastError: { kind: 'auth', message: '401 Token unknown', at: '2026-09-08T10:05:00.000Z' },
      halted: true,
    };
    open();

    expect(await screen.findByText(/1 Change waiting/)).toBeTruthy();
    expect(screen.getByText(/Last push/)).toBeTruthy();
    expect(screen.getByText(/Pushing stopped: 401 Token unknown/)).toBeTruthy();
    expect(screen.getByText(/Replace the Token to resume/)).toBeTruthy();
  });

  it('names a retry a retry rather than a halt', async () => {
    status = {
      configured: true,
      pending: 2,
      lastPushedAt: null,
      lastError: {
        kind: 'network',
        message: '503 Service Unavailable',
        at: '2026-09-08T10:05:00.000Z',
      },
      halted: false,
    };
    open();

    expect(await screen.findByText(/Retrying: 503 Service Unavailable/)).toBeTruthy();
  });
});
