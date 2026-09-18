import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  IdInput,
  ListProjectsInput,
  ProjectInput,
  UpdateProjectInput,
} from '@time-stop/domain';
import { keys, useInvalidate } from './cacheSync';

export function useProjects(input: ListProjectsInput) {
  return useQuery({
    queryKey: [...keys.projects, input.workspaceId, input.archived],
    queryFn: () => window.timeStop.project.list(input),
  });
}

function useProjectMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: run, onSuccess: () => invalidate('project') });
}

export function useCreateProject() {
  return useProjectMutation((input: ProjectInput) => window.timeStop.project.create(input));
}

export function useUpdateProject() {
  return useProjectMutation((input: UpdateProjectInput) => window.timeStop.project.update(input));
}

export function useArchiveProject() {
  return useProjectMutation((input: IdInput) => window.timeStop.project.archive(input));
}

export function useUnarchiveProject() {
  return useProjectMutation((input: IdInput) => window.timeStop.project.unarchive(input));
}

export function useDeleteProject() {
  return useProjectMutation((input: IdInput) => window.timeStop.project.delete(input));
}
