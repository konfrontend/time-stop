import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRecordInput,
  DashboardInput,
  ExportReportInput,
  IdInput,
  UpdateRecordInput,
} from '@time-stop/domain';
import { recordsKey, timerKey } from './useTimer';

/** Refetched on every mount: Project and Workspace edits made in Settings show up on return. */
export function useDashboard(input: DashboardInput, enabled = true) {
  return useQuery({
    queryKey: [...recordsKey, 'dashboard', input],
    queryFn: () => window.timeStop.dashboard.get(input),
    staleTime: 0,
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: async (input: ExportReportInput) => {
      const report = await window.timeStop.report.export(input);
      return window.desktop.files.saveText({ filename: report.filename, text: report.csv });
    },
  });
}

function useRecordMutation<Input, Output>(run: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: recordsKey }),
        queryClient.invalidateQueries({ queryKey: timerKey }),
      ]),
  });
}

export function useCreateRecord() {
  return useRecordMutation((input: CreateRecordInput) => window.timeStop.record.create(input));
}

export function useUpdateRecord() {
  return useRecordMutation((input: UpdateRecordInput) => window.timeStop.record.update(input));
}

export function useDeleteRecord() {
  return useRecordMutation((input: IdInput) => window.timeStop.record.delete(input));
}

export function useRecentNames(projectId: string | null) {
  return useQuery({
    queryKey: [...recordsKey, 'names', projectId],
    queryFn: () => window.timeStop.record.recentNames({ projectId }),
  });
}
