import { useMutation, useQuery } from '@tanstack/react-query';
import type { ClientInput, IdInput, UpdateClientInput } from '@app/domain';
import { keys, useInvalidate } from './cacheSync';

/** `null` lists the Clients of every Workspace. */
export function useClients(workspaceId: string | null) {
  return useQuery({
    queryKey: [...keys.clients, workspaceId],
    queryFn: () => window.api.client.list(workspaceId ? { workspaceId } : {}),
  });
}

function useClientMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: run, onSuccess: () => invalidate('client') });
}

export function useCreateClient() {
  return useClientMutation((input: ClientInput) => window.api.client.create(input));
}

export function useUpdateClient() {
  return useClientMutation((input: UpdateClientInput) => window.api.client.update(input));
}

export function useDeleteClient() {
  return useClientMutation((input: IdInput) => window.api.client.delete(input));
}
