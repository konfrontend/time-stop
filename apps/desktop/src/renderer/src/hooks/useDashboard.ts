import { useMutation, useQuery } from '@tanstack/react-query';
import type { DashboardInput, ExportReportInput, RecentRowsInput } from '@time-stop/domain';
import { keys } from './cacheSync';

export function useDashboard(input: DashboardInput) {
  return useQuery({
    queryKey: [...keys.records, 'dashboard', input],
    queryFn: () => window.timeStop.dashboard.get(input),
    placeholderData: (previous) => previous,
  });
}

export function useRecentRows(input: RecentRowsInput, enabled = true) {
  return useQuery({
    queryKey: [...keys.records, 'recent', input],
    queryFn: () => window.timeStop.dashboard.recent(input),
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

export function useRecentNames(projectId: string | null) {
  return useQuery({
    queryKey: [...keys.records, 'names', projectId],
    queryFn: () => window.timeStop.record.recentNames({ projectId }),
  });
}
