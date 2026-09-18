import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { RowSelectionState, Updater } from '@tanstack/react-table';
import { dayStart, totalsOf } from '@time-stop/domain';
import type { Context, DashboardRow, Project, Rounding, Totals } from '@time-stop/domain';
import { DashboardFooter } from '@/components/dashboard/DashboardFooter';
import { DashboardTable } from '@/components/dashboard/DashboardTable';
import { DashboardToolbar } from '@/components/dashboard/DashboardToolbar';
import { RecordActions, RecordFailure, useRecordActions } from '@/components/record/RecordActions';
import { useContextQuery } from '@/hooks/useContext';
import { useDashboard, useExportReport } from '@/hooks/useDashboard';
import { useProjects } from '@/hooks/useProjects';
import { useNow, useTimer } from '@/hooks/useTimer';
import { resolveSelection, toDashboardInput, toExportInput } from '@/lib/dashboardSearch';
import type { DashboardSearch } from '@/lib/dashboardSearch';
import { sortByStart } from '@/lib/dashboardSort';
import { messageOf } from '@/lib/messageOf';
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
  const today = useMemo(() => dayStart(new Date(now).toISOString()), [now]);
  const selection = useMemo(
    () => resolveSelection(search, context, today),
    [search, context, today],
  );
  const dashboard = useDashboard(useMemo(() => toDashboardInput(selection), [selection]));
  const projects = useProjects({ workspaceId: selection.workspace });
  const exportReport = useExportReport();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [failure, setFailure] = useState<string | null>(null);

  const patch = (next: Partial<DashboardSearch>, replace = false) =>
    navigate({ to: '/dashboard', search: (prev) => ({ ...prev, ...next }), replace });

  // An implicit view becomes explicit so the URL alone restores it.
  useEffect(() => {
    if (search.workspace === undefined) {
      void patch({ workspace: selection.workspace }, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.workspace]);

  // The Context's Workspace changing underneath moves the view to it.
  const contextWorkspace = useRef(context.workspaceId);
  useEffect(() => {
    if (contextWorkspace.current === context.workspaceId) return;
    contextWorkspace.current = context.workspaceId;
    void patch({ workspace: context.workspaceId, project: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.workspaceId]);

  const rows = useMemo(() => dashboard.data?.rows ?? [], [dashboard.data]);
  const sorted = useMemo(() => sortByStart(rows), [rows]);
  const totals = useMemo(
    () => totalsOf(rows, now, selection.rounding),
    [rows, now, selection.rounding],
  );
  // Ids that left the view (deleted, or out of the Range) stay in state but count for nothing.
  const visibleSelection = useMemo(
    (): RowSelectionState =>
      Object.fromEntries(
        rows
          .filter((row) => rowSelection[row.record.id])
          .map((row) => [row.record.id, true as const]),
      ),
    [rows, rowSelection],
  );
  const selected = useMemo(
    () => sorted.filter((row) => visibleSelection[row.record.id]),
    [sorted, visibleSelection],
  );

  const onRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) =>
      setRowSelection((current) => (typeof updater === 'function' ? updater(current) : updater)),
    [],
  );
  async function exportView() {
    setFailure(null);
    try {
      await exportReport.mutateAsync(toExportInput(selection));
    } catch (error) {
      setFailure(messageOf(error));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-slot="dashboard">
      <div className="shrink-0">
        <DashboardToolbar
          selection={selection}
          projects={projects.data ?? []}
          busy={exportReport.isPending}
          onProject={(project) => patch({ project: project ?? undefined })}
          onPeriod={(period) => patch({ period })}
          onAnchor={(anchor) => patch({ anchor })}
          onExport={() => void exportView()}
        />
      </div>
      <RecordActions workspaceId={selection.workspace} projects={projects.data ?? []} today={today}>
        <div className="min-h-0 flex-1 overflow-y-auto" data-slot="dashboard-scroll">
          <DashboardTable
            rows={sorted}
            loaded={dashboard.data !== undefined}
            today={today}
            now={now}
            billable={selection.billable}
            rounding={selection.rounding}
            onBillable={(billable) => patch({ billable: billable || undefined })}
            onRounding={(rounding) =>
              patch({ rounding: rounding === 'none' ? undefined : rounding })
            }
            rowSelection={visibleSelection}
            onRowSelectionChange={onRowSelectionChange}
          />
        </div>
        {failure && (
          <p role="alert" className="shrink-0 border-t px-3 py-1.5 text-xs text-destructive">
            {failure}
          </p>
        )}
        <RecordFailure />
        <div className="shrink-0">
          <SelectionFooter
            totals={totals}
            count={rows.length}
            now={now}
            rounding={selection.rounding}
            selected={selected}
            projects={projects.data ?? []}
            busy={exportReport.isPending}
            onWritten={(ids) =>
              setRowSelection((current) => {
                const next = { ...current };
                for (const id of ids) delete next[id];
                return next;
              })
            }
          />
        </div>
      </RecordActions>
    </div>
  );
}

interface SelectionFooterProps {
  totals: Totals;
  count: number;
  now: number;
  rounding: Rounding;
  selected: DashboardRow[];
  projects: Project[];
  busy: boolean;
  // Ids a bulk write reached; what failed or was never reached stays selected.
  onWritten: (ids: string[]) => void;
}

/** The footer, with Move and Delete of the selection run through the Record actions. */
function SelectionFooter({ selected, busy, onWritten, ...footer }: SelectionFooterProps) {
  const actions = useRecordActions();
  const records = selected.map(({ record }) => record);
  return (
    <DashboardFooter
      {...footer}
      selected={selected}
      busy={busy || actions.busy}
      onMove={(projectId) => void actions.moveAll(records, projectId).then(onWritten)}
      onDelete={() => void actions.deleteAll(records).then(onWritten)}
    />
  );
}
