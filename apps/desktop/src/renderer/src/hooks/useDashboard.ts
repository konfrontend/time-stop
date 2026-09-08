import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRecordInput,
  DashboardInput,
  ExportReportInput,
  IdInput,
  Record,
  SetRecordBillableInput,
  UpdateRecordInput,
} from '@time-stop/domain';
import { recordsKey, timerKey } from './useTimer';

/** Refetched on every mount: Project and Workspace edits made in Settings show up on return. */
export function useDashboard(input: DashboardInput) {
  return useQuery({
    queryKey: [...recordsKey, 'dashboard', input],
    queryFn: () => window.timeStop.getDashboard(input),
    staleTime: 0,
    placeholderData: (previous) => previous,
  });
}

export function useSetRecordBillable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SetRecordBillableInput) => window.timeStop.setRecordBillable(input),
    onSuccess: (record) => {
      if (record.stop === null) queryClient.setQueryData<Record | null>(timerKey, record);
      void queryClient.invalidateQueries({ queryKey: recordsKey });
    },
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: async (input: ExportReportInput) => {
      const report = await window.timeStop.exportReport(input);
      return window.files.saveText({ filename: report.filename, text: report.csv });
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
  return useRecordMutation((input: CreateRecordInput) => window.timeStop.createRecord(input));
}

export function useUpdateRecord() {
  return useRecordMutation((input: UpdateRecordInput) => window.timeStop.updateRecord(input));
}

export function useDeleteRecord() {
  return useRecordMutation((input: IdInput) => window.timeStop.deleteRecord(input));
}

export function useRecentNames(projectId: string | null) {
  return useQuery({
    queryKey: [...recordsKey, 'names', projectId],
    queryFn: () => window.timeStop.listRecentNames({ projectId }),
  });
}
