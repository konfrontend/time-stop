import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientInput, IdInput, UpdateClientInput } from '@time-stop/domain';
import { projectsKey } from './useProjects';

export const clientsKey = ['clients'] as const;

/** `null` lists the Clients of every Workspace. */
export function useClients(workspaceId: string | null) {
  return useQuery({
    queryKey: [...clientsKey, workspaceId],
    queryFn: () => window.timeStop.listClients(workspaceId ? { workspaceId } : {}),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) => window.timeStop.createClient(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientsKey }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateClientInput) => window.timeStop.updateClient(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientsKey }),
  });
}

/** Projects of the Client lose their reference, so they are refetched too. */
export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IdInput) => window.timeStop.deleteClient(input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: clientsKey }),
        queryClient.invalidateQueries({ queryKey: projectsKey }),
      ]),
  });
}
