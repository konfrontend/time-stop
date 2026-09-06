import { useEffect, useMemo, useRef, useState } from 'react';
import { recordDurationMs } from '@time-stop/domain';
import type { Record } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useNow,
  useStartTimer,
  useStopTimer,
  useTimer,
  useTodayRecords,
  useUpdateRecordName,
} from '@/hooks/useTimer';
import { dayBounds, hms, hoursText } from '@/lib/format';
import { cn } from '@/lib/utils';

const NAME_SAVE_DELAY_MS = 400;

export function Tracker() {
  const timer = useTimer();
  const running = timer.data ?? null;
  const now = useNow();
  const { from, to } = useMemo(() => dayBounds(now), [now]);
  const today = useTodayRecords(from, to);
  const start = useStartTimer();
  const stop = useStopTimer();

  // The Name field edits the Timer, or the last Record stopped today once the Timer is gone.
  const target: Record | null = running ?? today.data?.[0] ?? null;
  const todayMs = (today.data ?? []).reduce(
    (sum, record) => sum + recordDurationMs(record, now),
    0,
  );

  return (
    <div className="flex flex-col gap-3.5" data-slot="tracker">
      <div className="py-1.5 text-center">
        <div
          data-slot="timer-face"
          className={cn(
            'text-[38px] font-semibold tracking-tight tabular-nums',
            running ? '' : 'text-muted-foreground/40',
          )}
        >
          {running ? hms(recordDurationMs(running, now)) : '00:00:00'}
        </div>
        <div data-slot="timer-status" className="min-h-4 text-[11.5px] text-muted-foreground">
          {running ? 'Timer running' : 'Ready'}
        </div>
      </div>

      <NameField key={target?.id ?? 'none'} record={target} />

      {running ? (
        <Button
          variant="destructive"
          className="h-11 w-full"
          onClick={() => stop.mutate()}
          disabled={stop.isPending}
        >
          Stop
        </Button>
      ) : (
        <Button
          className="h-11 w-full"
          onClick={() => start.mutate()}
          disabled={start.isPending || timer.isPending}
        >
          Start
        </Button>
      )}

      <div className="mt-1 border-t pt-3 text-[11px] text-muted-foreground">
        Today: <b className="tabular-nums">{hoursText(todayMs)}</b>
      </div>
    </div>
  );
}

function NameField({ record }: { record: Record | null }) {
  const [name, setName] = useState(record?.name ?? '');
  const update = useUpdateRecordName();
  const saved = useRef(record?.name ?? '');
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  function save(value: string) {
    clearTimeout(timeout.current);
    if (!record || value === saved.current) return;
    saved.current = value;
    update.mutate({ id: record.id, name: value });
  }

  useEffect(() => () => clearTimeout(timeout.current), []);

  return (
    <Input
      aria-label="Name"
      placeholder={record?.stop === null ? 'Name this Record…' : 'Name (optional)'}
      value={name}
      disabled={!record}
      onChange={(event) => {
        const value = event.target.value;
        setName(value);
        clearTimeout(timeout.current);
        timeout.current = setTimeout(() => save(value), NAME_SAVE_DELAY_MS);
      }}
      onBlur={() => save(name)}
    />
  );
}
