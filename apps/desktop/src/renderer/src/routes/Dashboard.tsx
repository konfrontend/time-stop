import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  dayStart,
  formatIsoDate,
  parseIsoDate,
  recordDurationMs,
  shiftPeriod,
  totalsOf,
} from '@time-stop/domain';
import type { Context, DashboardRow, Record } from '@time-stop/domain';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { RangeNav } from '@/components/dashboard/RangeNav';
import { RecordDialog } from '@/components/dashboard/RecordDialog';
import { RecordRow } from '@/components/dashboard/RecordRow';
import { TotalsBar } from '@/components/dashboard/TotalsBar';
import { useContextQuery } from '@/hooks/useContext';
import { useDashboard, useSetRecordBillable } from '@/hooks/useDashboard';
import { useNow, useTimer } from '@/hooks/useTimer';
import { Button } from '@/components/ui/button';
import { filtersToSearch, resolveSelection, toDashboardInput } from '@/lib/dashboardSearch';
import type { DashboardSearch } from '@/lib/dashboardSearch';
import { dayLabel, hoursText } from '@/lib/format';
import { dashboardRoute } from '../routes';

export function Dashboard() {
  const context = useContextQuery();
  return context.data ? (
    <DashboardPage search={dashboardRoute.useSearch()} context={context.data} />
  ) : null;
}

function DashboardPage({ search, context }: { search: DashboardSearch; context: Context }) {
  const navigate = useNavigate({ from: '/dashboard' });
  const timer = useTimer();
  const now = useNow(timer.data?.start);
  const today = useMemo(() => dayStart(now), [now]);
  const selection = useMemo(
    () => resolveSelection(search, context, today),
    [search, context, today],
  );
  const dashboard = useDashboard(useMemo(() => toDashboardInput(selection), [selection]));
  const setBillable = useSetRecordBillable();
  const [dialog, setDialog] = useState<Record | 'new' | null>(null);

  const update = (patch: Partial<DashboardSearch>, replace = false) =>
    navigate({ to: '/dashboard', search: (prev) => ({ ...prev, ...patch }), replace });

  // An implicit view becomes explicit so the URL alone restores it.
  useEffect(() => {
    if (search.workspace === undefined) {
      void update(
        { workspace: selection.workspace, project: selection.project ?? undefined },
        true,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.workspace]);

  // The Context's Workspace changing underneath resets the filters to it.
  const contextWorkspace = useRef(context.workspaceId);
  useEffect(() => {
    if (contextWorkspace.current === context.workspaceId) return;
    contextWorkspace.current = context.workspaceId;
    void update({ workspace: context.workspaceId, project: undefined, client: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.workspaceId]);

  const rows = useMemo(() => dashboard.data?.rows ?? [], [dashboard.data]);
  const totals = useMemo(() => totalsOf(rows, now), [rows, now]);
  const days = useMemo(() => groupByDay(rows), [rows]);

  return (
    <div className="-m-4 flex flex-col" data-slot="dashboard">
      <div className="flex flex-col gap-2 border-b px-3 py-2.5">
        <RangeNav
          period={selection.period}
          from={selection.from}
          to={selection.to}
          onStep={(steps) =>
            update({
              anchor: formatIsoDate(
                shiftPeriod(selection.period, parseIsoDate(selection.anchor), steps),
              ),
            })
          }
          onPeriod={(period) => update({ period })}
        />
        <div className="flex items-start gap-2">
          <FilterBar filters={selection} onChange={(filters) => update(filtersToSearch(filters))} />
          <Button
            size="sm"
            variant="outline"
            className="ml-auto shrink-0"
            onClick={() => setDialog('new')}
          >
            + Add Record
          </Button>
        </div>
      </div>
      {dialog !== null && (
        <RecordDialog
          record={dialog === 'new' ? undefined : dialog}
          context={context}
          today={today}
          onClose={() => setDialog(null)}
        />
      )}
      <div className="flex-1">
        {dashboard.data && rows.length === 0 && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No Records in this Range.
          </p>
        )}
        {days.map((day) => (
          <section key={day.start} className="border-b" data-slot="day-group">
            <header className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 text-sm">
              <span className="font-semibold">{dayLabel(day.start, today)}</span>
              <span className="ml-auto text-muted-foreground tabular-nums">
                {hoursText(
                  day.rows.reduce((sum, row) => sum + recordDurationMs(row.record, now), 0),
                )}
              </span>
            </header>
            {day.rows.map((row) => (
              <RecordRow
                key={row.record.id}
                row={row}
                now={now}
                onBillable={(billable) => setBillable.mutate({ id: row.record.id, billable })}
                onOpen={() => setDialog(row.record)}
              />
            ))}
          </section>
        ))}
      </div>
      <div className="sticky bottom-0 bg-background">
        <TotalsBar totals={totals} count={rows.length} />
      </div>
    </div>
  );
}

function groupByDay(rows: DashboardRow[]): Array<{ start: number; rows: DashboardRow[] }> {
  const days = new Map<number, DashboardRow[]>();
  for (const row of rows) {
    const start = dayStart(row.record.start);
    const day = days.get(start);
    if (day) day.push(row);
    else days.set(start, [row]);
  }
  return [...days].map(([start, rows]) => ({ start, rows }));
}
