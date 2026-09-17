import { useRef, useState } from 'react';
import type { Record } from '@time-stop/domain';
import { TimePicker } from '@/components/ui/TimePicker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUpdateRecord } from '@/hooks/useDashboard';
import { clock } from '@/lib/format';
import { recordFormSchema, recordFormValues, toRecordFields } from '@/lib/recordForm';
import { cn } from '@/lib/utils';

const clockBox = 'col-start-1 row-start-1 h-4 rounded-sm px-1 leading-4';

interface RecordSpanProps {
  record: Record;
  now: number;
  // Leads the span, e.g. the day the Record sits on.
  prefix?: string | undefined;
  align?: 'start' | 'end';
}

/** A Record's start–stop, both edited in place; a running Timer's stop reads "now" and is fixed. */
export function RecordSpan({ record, now, prefix, align = 'end' }: RecordSpanProps) {
  return (
    <span
      className={cn(
        'flex items-center text-xs text-muted-foreground tabular-nums',
        align === 'end' ? '-mr-1' : !prefix && '-ml-1',
      )}
    >
      {prefix && <span className="pr-0.5">{prefix}</span>}
      <RecordClock record={record} which="start" now={now} />–
      {record.stop === null ? (
        <span className="px-1">now</span>
      ) : (
        <RecordClock record={record} which="stop" now={now} />
      )}
    </span>
  );
}

/**
 * One clock of a Record's span, edited in place. The draft resolves against the Record's start day
 * and validates as in `RecordPopover`; saving an invalid one reverts it. The input sits over an
 * invisible copy of the clock, so editing never moves the row or the column.
 */
function RecordClock({
  record,
  which,
  now,
}: {
  record: Record;
  which: 'start' | 'stop';
  now: number;
}) {
  const update = useUpdateRecord();
  const saved = recordFormValues({ record });
  const [draft, setDraft] = useState<string | null>(null);
  // Leads `draft` within one event: the picker's own Enter and blur change it before we save.
  const latest = useRef('');
  // Set once closed, so the blur of the unmounting input does not save.
  const closed = useRef(false);

  const issueOf = (clockText: string) =>
    recordFormSchema(record, () => now).safeParse({ ...saved, [which]: clockText }).error?.issues[0]
      ?.message;
  const error = draft === null ? undefined : issueOf(draft);

  function change(next: string) {
    latest.current = next;
    setDraft(next);
  }

  function close() {
    closed.current = true;
    setDraft(null);
  }

  function save(clockText: string) {
    if (closed.current) return;
    close();
    if (clockText === saved[which] || issueOf(clockText) !== undefined) return;
    update.mutate({ id: record.id, ...toRecordFields({ ...saved, [which]: clockText }, record) });
  }

  const timestamp = which === 'start' ? record.start : record.stop!;
  if (draft === null) {
    return (
      <button
        type="button"
        aria-label={`Edit ${which}`}
        className={cn(clockBox, 'outline-none hover:bg-muted focus-visible:bg-muted')}
        onClick={() => {
          closed.current = false;
          change(saved[which]);
        }}
      >
        {clock(timestamp)}
      </button>
    );
  }
  return (
    <Tooltip open={error !== undefined}>
      <TooltipTrigger asChild>
        <span
          className="inline-grid"
          onKeyDown={(event) => {
            if (event.key === 'Enter') save(latest.current);
            else if (event.key === 'Escape') close();
          }}
        >
          <span aria-hidden className={cn(clockBox, 'invisible')}>
            {clock(timestamp)}
          </span>
          <TimePicker
            autoFocus
            aria-label={which === 'start' ? 'Start' : 'Stop'}
            aria-invalid={error !== undefined || undefined}
            value={draft}
            className={cn(
              clockBox,
              'w-full border-0 bg-accent py-0 text-xs text-foreground shadow-none transition-none hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground focus-visible:ring-0 aria-invalid:shadow-none md:text-xs dark:hover:bg-accent dark:focus-visible:bg-accent',
              error !== undefined &&
                'text-destructive hover:text-destructive focus-visible:text-destructive',
            )}
            onFocus={(event) => event.currentTarget.select()}
            onChange={change}
            onPick={save}
            onBlur={() => save(latest.current)}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{error}</TooltipContent>
    </Tooltip>
  );
}
