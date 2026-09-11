import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  IdInput,
  ListProjectsInput,
  ProjectInput,
  UpdateProjectInput,
} from '@time-stop/domain';
import { recordsKey, timerKey } from './useTimer';

export const projectsKey = ['projects'] as const;

export function useProjects(input: ListProjectsInput) {
  return useQuery({
    queryKey: [...projectsKey, input.workspaceId, input.archived],
    queryFn: () => window.timeStop.project.list(input),
  });
}

function useProjectMutation<Input>(run: (input: Input) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  });
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

/** Records of the Project lose their reference, so the Timer and Record lists are refetched. */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IdInput) => window.timeStop.project.delete(input),
    onSuccess: () =>
      Promise.all(
        [projectsKey, timerKey, recordsKey].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
