import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Context } from '@time-stop/domain';

export const contextKey = ['context'] as const;

/** Seeded once, then fed by the main process on every Context move; nothing here refetches. */
export function useContextQuery() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: contextKey, queryFn: () => window.timeStop.context.get() });

  useEffect(
    () =>
      window.timeStop.context.onContextChanged((context) => {
        queryClient.setQueryData<Context>(contextKey, context);
      }),
    [queryClient],
  );

  return query;
}

export function useSetContext() {
  return useMutation({ mutationFn: (input: Context) => window.timeStop.context.set(input) });
}
