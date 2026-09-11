import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServerInput, SyncStatus } from '@time-stop/domain';

export const serverKey = ['server'] as const;
export const syncStatusKey = ['syncStatus'] as const;

export function useServer() {
  return useQuery({ queryKey: serverKey, queryFn: () => window.timeStop.sync.getServer() });
}

/** The main process pushes every move of the sync state, so nothing here polls. */
export function useSyncStatus() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: syncStatusKey,
    queryFn: () => window.timeStop.sync.getStatus(),
  });

  useEffect(
    () =>
      window.timeStop.sync.onSyncChanged((status) => {
        queryClient.setQueryData<SyncStatus>(syncStatusKey, status);
      }),
    [queryClient],
  );

  return query;
}

export function useSetServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ServerInput) => window.timeStop.sync.setServer(input),
    onSuccess: (server) => {
      queryClient.setQueryData(serverKey, server);
      void queryClient.invalidateQueries({ queryKey: syncStatusKey });
    },
  });
}
