import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IdInput, UpdateWorkspaceInput, WorkspaceInput } from '@time-stop/domain';

export const workspacesKey = ['workspaces'] as const;

export function useWorkspaces() {
  return useQuery({ queryKey: workspacesKey, queryFn: () => window.timeStop.listWorkspaces() });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkspaceInput) => window.timeStop.createWorkspace(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorkspaceInput) => window.timeStop.updateWorkspace(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  });
}

/** A Workspace takes its Clients, Projects, Records and possibly the Timer with it. */
export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IdInput) => window.timeStop.deleteWorkspace(input),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
