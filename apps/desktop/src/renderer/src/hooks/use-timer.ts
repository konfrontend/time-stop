import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Record } from '@time-stop/domain';
import { api } from '@/api';

export const timerKey = ['timer'] as const;
export const recordsKey = ['records'] as const;

/** The running Timer, kept current by the main process's Timer events. */
export function useTimer() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: timerKey, queryFn: () => api().getTimer() });

  useEffect(
    () =>
      api().subscribeTimer((timer) => {
        queryClient.setQueryData<Record | null>(timerKey, timer);
        void queryClient.invalidateQueries({ queryKey: recordsKey });
      }),
    [queryClient],
  );

  return query;
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api().startTimer(),
    onSuccess: (timer) => queryClient.setQueryData<Record | null>(timerKey, timer),
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api().stopTimer(),
    onSuccess: () => queryClient.setQueryData<Record | null>(timerKey, null),
  });
}

export function useUpdateRecordName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) => api().updateRecordName(input),
    onSuccess: (record) => {
      if (record.stop === null) queryClient.setQueryData<Record | null>(timerKey, record);
      void queryClient.invalidateQueries({ queryKey: recordsKey });
    },
  });
}

/** Records started today, refetched whenever the Timer changes. */
export function useTodayRecords(from: number, to: number) {
  return useQuery({
    queryKey: [...recordsKey, 'today', from],
    queryFn: () => api().listRecords({ from, to }),
  });
}

/** Wall clock ticking once a second, so the elapsed clock and today's hours stay live. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
