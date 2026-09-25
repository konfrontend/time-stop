import { useCallback, useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Context, Record, SyncStatus } from '@app/domain';

/** Every query key of the renderer; an entity hook spreads its own and imports no other's. */
export const keys = {
  workspaces: ['workspaces'],
  clients: ['clients'],
  projects: ['projects'],
  records: ['records'],
  timer: ['timer'],
  context: ['context'],
  server: ['server'],
  syncStatus: ['syncStatus'],
  themeMode: ['themeMode'],
  recentRecordsOpen: ['recentRecordsOpen'],
  version: ['version'],
  update: ['update'],
} as const satisfies { [name: string]: readonly [string] };

/** The entity a Change touched, in the glossary's sense. */
export type Changed = 'record' | 'project' | 'client' | 'workspace';

/**
 * Which cached reads a Change leaves stale. A read embeds what it joins (a Dashboard row carries
 * its Project, Client and Currency), so a write to a container dirties the reads of everything it
 * contains, and a Workspace takes the whole cache with it. The Timer is absent on purpose: the
 * main process reports every change to it through `onTimerChanged`, whatever wrote it.
 */
export const dirtiedBy: { [entity in Changed]: readonly (readonly string[])[] } = {
  record: [keys.records],
  project: [keys.projects, keys.records],
  client: [keys.clients, keys.projects, keys.records],
  workspace: Object.values(keys),
};

const invalidate = (queryClient: QueryClient, changed: Changed): Promise<void> =>
  Promise.all(
    dirtiedBy[changed].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ).then(() => undefined);

/** Resolves once every dirtied read that is on screen has refetched. */
export function useInvalidate(): (changed: Changed) => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback((changed: Changed) => invalidate(queryClient, changed), [queryClient]);
}

/**
 * Mounted once for the app's lifetime, above every route: what the main process pushes lands in
 * the cache here, so a Timer toggled from the tray reaches a window that shows no Timer.
 */
export function useCacheSync(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const subscriptions = [
      window.api.record.onTimerChanged((timer) => {
        queryClient.setQueryData<Record | null>(keys.timer, timer);
        void invalidate(queryClient, 'record');
      }),
      window.api.context.onContextChanged((context) => {
        queryClient.setQueryData<Context>(keys.context, context);
      }),
      window.api.sync.onSyncChanged((status) => {
        queryClient.setQueryData<SyncStatus>(keys.syncStatus, status);
      }),
    ];
    return () => {
      for (const unsubscribe of subscriptions) unsubscribe();
    };
  }, [queryClient]);
}
