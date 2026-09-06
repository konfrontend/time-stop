import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DashboardInput, Record, SetRecordBillableInput } from '@time-stop/domain';
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
