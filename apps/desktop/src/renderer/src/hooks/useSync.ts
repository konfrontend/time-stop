import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ServerInput } from '@time-stop/domain';
import { keys } from './cacheSync';

export function useServer() {
  return useQuery({ queryKey: keys.server, queryFn: () => window.timeStop.sync.getServer() });
}

/** Seeded once; the main process reports every move of the sync state through `useCacheSync`. */
export function useSyncStatus() {
  return useQuery({ queryKey: keys.syncStatus, queryFn: () => window.timeStop.sync.getStatus() });
}

export function useSetServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ServerInput) => window.timeStop.sync.setServer(input),
    onSuccess: (server) => {
      queryClient.setQueryData(keys.server, server);
      void queryClient.invalidateQueries({ queryKey: keys.syncStatus });
    },
  });
}
