import { useMutation, useQuery } from '@tanstack/react-query';
import type { DashboardInput, ExportReportInput, RecentRowsInput } from '@app/domain';
import { keys } from './cacheSync';

export function useDashboard(input: DashboardInput, enabled = true) {
  return useQuery({
    queryKey: [...keys.records, 'dashboard', input],
    queryFn: () => window.api.dashboard.get(input),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useRecentRows(input: RecentRowsInput, enabled = true) {
  return useQuery({
    queryKey: [...keys.records, 'recent', input],
    queryFn: () => window.api.dashboard.recent(input),
    placeholderData: (previous) => previous,
    enabled,
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: async (input: ExportReportInput) => {
      const report = await window.api.report.export(input);
      return window.desktop.files.saveText({ filename: report.filename, text: report.csv });
    },
  });
}

export function useRecentNames(projectId: string | null) {
  return useQuery({
    queryKey: [...keys.records, 'names', projectId],
    queryFn: () => window.api.record.recentNames({ projectId }),
  });
}
