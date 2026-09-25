// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { seedRecord } from '@/test/fixtures';
import { harness, type Harness } from '@/test/harness';
import { keys, useCacheSync, useInvalidate } from './cacheSync';

let h: Harness;

beforeEach(() => {
  h = harness();
});

function mount<Result>(hook: () => Result) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(hook, { wrapper });
}

const read = () => vi.fn(async () => []);

describe('useInvalidate', () => {
  it('refetches every read a Project change dirties, and no other', async () => {
    const projects = read();
    const records = read();
    const clients = read();
    const { result } = mount(() => {
      useQuery({ queryKey: [...keys.projects, 'w1', false], queryFn: projects });
      useQuery({ queryKey: [...keys.records, 'recent'], queryFn: records });
      useQuery({ queryKey: keys.clients, queryFn: clients });
      return useInvalidate();
    });
    await waitFor(() => expect(clients).toHaveBeenCalledOnce());

    await act(() => result.current('project'));

    expect(projects).toHaveBeenCalledTimes(2);
    expect(records).toHaveBeenCalledTimes(2);
    expect(clients).toHaveBeenCalledOnce();
  });
});

describe('useCacheSync', () => {
  it('takes the Timer the main process reports and refetches the Records', async () => {
    const records = read();
    const { result } = mount(() => {
      useCacheSync();
      useQuery({ queryKey: [...keys.records, 'today'], queryFn: records });
      return useQuery({ queryKey: keys.timer, queryFn: () => window.api.record.getTimer() });
    });
    await waitFor(() => expect(result.current.data).toBeNull());

    const elsewhere = await seedRecord(h, { name: 'Elsewhere' });
    act(() => h.emit.timerChanged({ ...elsewhere, stop: null }));

    await waitFor(() =>
      expect(result.current.data).toMatchObject({ id: elsewhere.id, name: 'Elsewhere' }),
    );
    await waitFor(() => expect(records).toHaveBeenCalledTimes(2));
  });

  it('takes the Context the main process reports', async () => {
    const { result } = mount(() => {
      useCacheSync();
      return useQuery({ queryKey: keys.context, queryFn: () => window.api.context.get() });
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const moved = { workspaceId: h.workspace.id, projectId: 'p-elsewhere' };
    act(() => h.emit.contextChanged(moved));

    await waitFor(() => expect(result.current.data).toEqual(moved));
  });

  it('takes the sync status the main process reports', async () => {
    const { result } = mount(() => {
      useCacheSync();
      return useQuery({
        queryKey: keys.syncStatus,
        queryFn: () => window.api.sync.getStatus(),
      });
    });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const pushed = {
      configured: true,
      pending: 3,
      lastPushedAt: null,
      lastError: null,
      halted: false,
    };
    act(() => h.emit.syncChanged(pushed));

    await waitFor(() => expect(result.current.data).toEqual(pushed));
  });

  it('stops listening once unmounted', async () => {
    const { result, unmount } = mount(() => {
      useCacheSync();
      return useQuery({ queryKey: keys.timer, queryFn: () => window.api.record.getTimer() });
    });
    await waitFor(() => expect(result.current.data).toBeNull());
    unmount();

    const started = await h.api.record.startTimer();
    act(() => h.emit.timerChanged(started));

    expect(result.current.data).toBeNull();
  });
});
