import { useMutation, useQuery } from '@tanstack/react-query';
import type { IdInput, UpdateWorkspaceInput, WorkspaceInput } from '@app/domain';
import { keys, useInvalidate } from './cacheSync';

export function useWorkspaces() {
  return useQuery({ queryKey: keys.workspaces, queryFn: () => window.api.workspace.list() });
}

function useWorkspaceMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: run, onSuccess: () => invalidate('workspace') });
}

export function useCreateWorkspace() {
  return useWorkspaceMutation((input: WorkspaceInput) => window.api.workspace.create(input));
}

export function useUpdateWorkspace() {
  return useWorkspaceMutation((input: UpdateWorkspaceInput) => window.api.workspace.update(input));
}

export function useDeleteWorkspace() {
  return useWorkspaceMutation((input: IdInput) => window.api.workspace.delete(input));
}
