import { amountOf, outsideLimits, recordDurationMs } from '@time-stop/domain';
import type { DashboardRow } from '@time-stop/domain';
import { clock, hoursMinutes, limitsText, money } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RecordRowProps {
  row: DashboardRow;
  now: number;
  onBillable: (billable: boolean) => void;
  onOpen: () => void;
}

export function RecordRow({ row, now, onBillable, onOpen }: RecordRowProps) {
  const { record, project, client, currency } = row;
  const running = record.stop === null;
  const amount = amountOf(record, currency, now);
  const rated = record.rate !== null;

  return (
    <div
      data-slot="record-row"
      data-running={running || undefined}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'flex cursor-pointer flex-col gap-0.5 border-t px-3 py-2 text-sm outline-none hover:bg-accent/50 focus-visible:bg-accent/50',
        running && 'bg-emerald-500/5',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            !record.name && 'text-muted-foreground/60 italic',
          )}
        >
          {record.name || 'No Name yet'}
        </span>
        {row.overlap && (
          <span
            data-slot="overlap-flag"
            className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400"
          >
            Overlap
          </span>
        )}
        <span className="min-w-12 text-right font-semibold tabular-nums">
          {hoursMinutes(recordDurationMs(record, now))}
        </span>
        <span className="min-w-20 text-right text-muted-foreground tabular-nums">
          {amount !== null && currency !== null ? money(currency, amount) : ''}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
          {project ? (
            <>
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: project.color }}
                aria-hidden
              />
              <span className="truncate">
                {project.name}
                {client ? ` · ${client.name}` : ''}
              </span>
            </>
          ) : (
            <span className="italic">No Project</span>
          )}
        </span>
        {row.limits && (
          <span
            data-slot="limits-usage"
            data-outside={outsideLimits(row.limits) || undefined}
            className={cn(
              'whitespace-nowrap tabular-nums',
              outsideLimits(row.limits) && 'text-destructive font-medium',
            )}
          >
            {limitsText(row.limits)}
          </span>
        )}
        <span className="whitespace-nowrap tabular-nums">
          {clock(record.start)}–{record.stop === null ? 'now' : clock(record.stop)}
        </span>
        <button
          type="button"
          aria-label="Billable"
          aria-pressed={record.billable}
          title={rated ? 'Billable' : 'Billable — this Project has no Rate'}
          data-slot="billable-toggle"
          data-dimmed={!rated || undefined}
          onClick={(event) => {
            event.stopPropagation();
            onBillable(!record.billable);
          }}
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-md border text-[11px] font-bold transition-colors',
            record.billable
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-input text-muted-foreground',
            !rated && 'opacity-40',
          )}
        >
          $
        </button>
      </div>
    </div>
  );
}
