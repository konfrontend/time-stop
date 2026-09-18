import { useState } from 'react';
import type { Record, UpdateRecordInput } from '@time-stop/domain';
import { TimePicker } from '@/components/ui/TimePicker';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { issuesOf, useAutoApply } from '@/hooks/useAutoApply';
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
  // The whole Record as it should become, once a clock is committed.
  onChange: (fields: Omit<UpdateRecordInput, 'id'>) => void;
}

/** A Record's start–stop, both edited in place; a running Timer's stop reads "now" and is fixed. */
export function RecordSpan({ record, now, prefix, align = 'end', onChange }: RecordSpanProps) {
  return (
    <span
      className={cn(
        'flex items-center text-xs text-muted-foreground tabular-nums',
        align === 'end' ? '-mr-1' : !prefix && '-ml-1',
      )}
    >
      {prefix && <span className="pr-0.5">{prefix}</span>}
      <RecordClock record={record} which="start" now={now} onChange={onChange} />–
      {record.stop === null ? (
        <span className="px-1">now</span>
      ) : (
        <RecordClock record={record} which="stop" now={now} onChange={onChange} />
      )}
    </span>
  );
}

interface RecordClockProps {
  record: Record;
  which: 'start' | 'stop';
  now: number;
  onChange: RecordSpanProps['onChange'];
}

interface ClockEditorProps extends RecordClockProps {
  timestamp: string;
  onClose: () => void;
}

/** One clock of a Record's span: the clock at rest, replaced by its editor while it is open. */
function RecordClock({ record, which, now, onChange }: RecordClockProps) {
  const [open, setOpen] = useState(false);
  const timestamp = which === 'start' ? record.start : record.stop!;
  if (open) {
    return (
      <ClockEditor
        record={record}
        which={which}
        now={now}
        timestamp={timestamp}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    );
  }
  return (
    <button
      type="button"
      aria-label={`Edit ${which}`}
      className={cn(clockBox, 'outline-none hover:bg-muted focus-visible:bg-muted')}
      onClick={() => setOpen(true)}
    >
      {clock(timestamp)}
    </button>
  );
}

/**
 * The open clock, an auto-apply field whose draft validates as in `RecordPopover`, against the
 * rest of the Record. Enter on an invalid draft keeps it open with its message; leaving drops it.
 * The input sits over an invisible copy of the clock, so editing never moves the row or the column.
 */
function ClockEditor({ record, which, now, timestamp, onChange, onClose }: ClockEditorProps) {
  const saved = recordFormValues({ record });
  const schema = recordFormSchema(record, () => now);
  const withClock = (clockText: string) => ({ ...saved, [which]: clockText });
  const issuesFor = (clockText: string) => issuesOf(schema, withClock(clockText));
  const field = useAutoApply<string>({
    saved: saved[which],
    validate: issuesFor,
    save: async (clockText) => onChange(toRecordFields(withClock(clockText), record)),
  });
  const error = issuesFor(field.draft)[0]?.message;

  return (
    <Tooltip open={error !== undefined}>
      <TooltipTrigger asChild>
        <span
          className="inline-grid"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              field.revert();
              onClose();
            }
          }}
        >
          <span aria-hidden className={cn(clockBox, 'invisible')}>
            {clock(timestamp)}
          </span>
          <TimePicker
            autoFocus
            inline
            aria-label={which === 'start' ? 'Start' : 'Stop'}
            aria-invalid={error !== undefined || undefined}
            value={field.draft}
            className={cn(
              clockBox,
              'bg-accent py-0 text-xs text-foreground transition-none hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground aria-invalid:shadow-none dark:hover:bg-accent dark:focus-visible:bg-accent',
              error !== undefined &&
                'text-destructive hover:text-destructive focus-visible:text-destructive',
            )}
            onFocus={(event) => event.currentTarget.select()}
            onChange={field.setDraft}
            onCommit={(clockText) => {
              void field.commit(clockText);
              if (issuesFor(clockText).length === 0) onClose();
            }}
            onBlur={onClose}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{error}</TooltipContent>
    </Tooltip>
  );
}
