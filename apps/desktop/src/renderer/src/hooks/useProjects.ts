import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  IdInput,
  ListProjectsInput,
  ProjectInput,
  UpdateProjectInput,
} from '@time-stop/domain';
import { contextKey } from './useContext';
import { recordsKey, timerKey } from './useTimer';

export const projectsKey = ['projects'] as const;

export function useProjects(input: ListProjectsInput) {
  return useQuery({
    queryKey: [...projectsKey, input.workspaceId, input.archived],
    queryFn: () => window.timeStop.listProjects(input),
  });
}

function useProjectMutation<Input>(run: (input: Input) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: projectsKey }),
        queryClient.invalidateQueries({ queryKey: contextKey }),
      ]),
  });
}

export function useCreateProject() {
  return useProjectMutation((input: ProjectInput) => window.timeStop.createProject(input));
}

export function useUpdateProject() {
  return useProjectMutation((input: UpdateProjectInput) => window.timeStop.updateProject(input));
}

export function useArchiveProject() {
  return useProjectMutation((input: IdInput) => window.timeStop.archiveProject(input));
}

export function useUnarchiveProject() {
  return useProjectMutation((input: IdInput) => window.timeStop.unarchiveProject(input));
}

/** Records of the Project lose their reference, so the Timer and Record lists are refetched. */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IdInput) => window.timeStop.deleteProject(input),
    onSuccess: () =>
      Promise.all(
        [projectsKey, contextKey, timerKey, recordsKey].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
