import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IdInput, UpdateWorkspaceInput, WorkspaceInput } from '@time-stop/domain';

export const workspacesKey = ['workspaces'] as const;

export function useWorkspaces() {
  return useQuery({ queryKey: workspacesKey, queryFn: () => window.timeStop.workspace.list() });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkspaceInput) => window.timeStop.workspace.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorkspaceInput) => window.timeStop.workspace.update(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  });
}

/** A Workspace takes its Clients, Projects, Records and possibly the Timer with it. */
export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IdInput) => window.timeStop.workspace.delete(input),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
