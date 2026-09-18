import { useMutation, useQuery } from '@tanstack/react-query';
import type { IdInput, UpdateWorkspaceInput, WorkspaceInput } from '@time-stop/domain';
import { keys, useInvalidate } from './cacheSync';

export function useWorkspaces() {
  return useQuery({ queryKey: keys.workspaces, queryFn: () => window.timeStop.workspace.list() });
}

function useWorkspaceMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: run, onSuccess: () => invalidate('workspace') });
}

export function useCreateWorkspace() {
  return useWorkspaceMutation((input: WorkspaceInput) => window.timeStop.workspace.create(input));
}

export function useUpdateWorkspace() {
  return useWorkspaceMutation((input: UpdateWorkspaceInput) =>
    window.timeStop.workspace.update(input),
  );
}

export function useDeleteWorkspace() {
  return useWorkspaceMutation((input: IdInput) => window.timeStop.workspace.delete(input));
}
