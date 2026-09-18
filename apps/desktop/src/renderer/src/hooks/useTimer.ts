import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { keys, useInvalidate } from './cacheSync';

/** Seeded once; the main process reports every later change through `useCacheSync`. */
export function useTimer() {
  return useQuery({ queryKey: keys.timer, queryFn: () => window.timeStop.record.getTimer() });
}

export function useStartTimer() {
  return useMutation({ mutationFn: () => window.timeStop.record.startTimer() });
}

export function useStopTimer() {
  return useMutation({ mutationFn: () => window.timeStop.record.stopTimer() });
}

export function useUpdateRecordName() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) => window.timeStop.record.updateName(input),
    onSuccess: () => invalidate('record'),
  });
}

export function useTodayRecords(from: string, to: string) {
  return useQuery({
    queryKey: [...keys.records, 'today', from],
    queryFn: () => window.timeStop.record.list({ from, to }),
  });
}

/**
 * Ticks once a second, with each tick landing on a whole second after `anchor` so an elapsed
 * clock derived from it flips exactly on the boundary instead of at an arbitrary phase.
 */
export function useNow(anchor?: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const phase = anchor === undefined ? 0 : Date.parse(anchor);
    const untilNextTick = 1000 - ((Date.now() - phase) % 1000);
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
