import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Record } from '@time-stop/domain';

export const timerKey = ['timer'] as const;
export const recordsKey = ['records'] as const;

export function useTimer() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: timerKey, queryFn: () => window.timeStop.record.getTimer() });

  useEffect(
    () =>
      window.timeStop.record.onTimerChanged((timer) => {
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
    mutationFn: () => window.timeStop.record.startTimer(),
    onSuccess: (timer) => queryClient.setQueryData<Record | null>(timerKey, timer),
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => window.timeStop.record.stopTimer(),
    onSuccess: () => queryClient.setQueryData<Record | null>(timerKey, null),
  });
}

export function useUpdateRecordName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) => window.timeStop.record.updateName(input),
    onSuccess: (record) => {
      if (record.stop === null) queryClient.setQueryData<Record | null>(timerKey, record);
      void queryClient.invalidateQueries({ queryKey: recordsKey });
    },
  });
}

export function useTodayRecords(from: number, to: number) {
  return useQuery({
    queryKey: [...recordsKey, 'today', from],
    queryFn: () => window.timeStop.record.list({ from, to }),
  });
}

/**
 * Ticks once a second, with each tick landing on a whole second after `anchor` so an elapsed
 * clock derived from it flips exactly on the boundary instead of at an arbitrary phase.
 */
export function useNow(anchor = 0): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const untilNextTick = 1000 - ((Date.now() - anchor) % 1000);
    const timeout = setTimeout(() => {
      setNow(Date.now());
      interval = setInterval(() => setNow(Date.now()), 1000);
    }, untilNextTick);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [anchor]);
  return now;
}
