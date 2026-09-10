import { amountOf, hoursOf, outsideLimits, recordDurationMs } from '@time-stop/domain';
import type { DashboardRow } from '@time-stop/domain';
import { clock, hoursMinutes, limitsText, money } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RecordRowProps {
  row: DashboardRow;
  now: number;
  onOpen: () => void;
}

export function RecordRow({ row, now, onOpen }: RecordRowProps) {
  const { record, project, client, currency } = row;
  const running = record.stop === null;
  const amount = amountOf(row, hoursOf(record, now));

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
      </div>
    </div>
  );
}
