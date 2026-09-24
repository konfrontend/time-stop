import { useMutation, useQuery } from '@tanstack/react-query';
import type { IdInput, ListProjectsInput, ProjectInput, UpdateProjectInput } from '@app/domain';
import { keys, useInvalidate } from './cacheSync';

export function useProjects(input: ListProjectsInput) {
  return useQuery({
    queryKey: [...keys.projects, input.workspaceId, input.archived],
    queryFn: () => window.api.project.list(input),
  });
}

function useProjectMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: run, onSuccess: () => invalidate('project') });
}

export function useCreateProject() {
  return useProjectMutation((input: ProjectInput) => window.api.project.create(input));
}

export function useUpdateProject() {
  return useProjectMutation((input: UpdateProjectInput) => window.api.project.update(input));
}

export function useArchiveProject() {
  return useProjectMutation((input: IdInput) => window.api.project.archive(input));
}

export function useUnarchiveProject() {
  return useProjectMutation((input: IdInput) => window.api.project.unarchive(input));
}

export function useDeleteProject() {
  return useProjectMutation((input: IdInput) => window.api.project.delete(input));
}
