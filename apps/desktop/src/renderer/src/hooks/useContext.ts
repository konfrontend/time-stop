import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Context } from '@time-stop/domain';

export const contextKey = ['context'] as const;

export function useContextQuery() {
  return useQuery({ queryKey: contextKey, queryFn: () => window.timeStop.getContext() });
}

export function useSetContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Context) => window.timeStop.setContext(input),
    onSuccess: (context) => queryClient.setQueryData<Context>(contextKey, context),
  });
}
