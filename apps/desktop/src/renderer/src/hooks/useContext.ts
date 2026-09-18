import { useMutation, useQuery } from '@tanstack/react-query';
import type { Context } from '@time-stop/domain';
import { keys } from './cacheSync';

/** Seeded once; the main process reports every Context move through `useCacheSync`. */
export function useContextQuery() {
  return useQuery({ queryKey: keys.context, queryFn: () => window.timeStop.context.get() });
}

export function useSetContext() {
  return useMutation({ mutationFn: (input: Context) => window.timeStop.context.set(input) });
}
