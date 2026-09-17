import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { RowSelectionState, Updater } from '@tanstack/react-table';
import { dayStart, totalsOf } from '@time-stop/domain';
import type { Context, Record } from '@time-stop/domain';
import { DashboardFooter } from '@/components/dashboard/DashboardFooter';
import { DashboardTable } from '@/components/dashboard/DashboardTable';
import { DashboardToolbar } from '@/components/dashboard/DashboardToolbar';
import { useContextQuery } from '@/hooks/useContext';
import {
  useCreateRecord,
  useDashboard,
  useDeleteRecord,
  useExportReport,
  useUpdateRecord,
} from '@/hooks/useDashboard';
import { useProjects } from '@/hooks/useProjects';
import { useNow, useTimer, useUpdateRecordName } from '@/hooks/useTimer';
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
  const rename = useUpdateRecordName();
  const create = useCreateRecord();
  const update = useUpdateRecord();
  const remove = useDeleteRecord();
  const exportReport = useExportReport();
  const [editing, setEditing] = useState<string | null>(null);
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
  const onRename = useCallback(
    (record: Record, name: string) => rename.mutate({ id: record.id, name }),
    [rename],
  );
  const onEditing = useCallback((recordId: string | null) => setEditing(recordId), []);
  const removeAsync = remove.mutateAsync;
  const onDelete = useCallback(
    (record: Record) => {
      setFailure(null);
      removeAsync({ id: record.id }).catch((error: unknown) => setFailure(messageOf(error)));
    },
    [removeAsync],
  );

  async function run(task: () => Promise<unknown>) {
    setFailure(null);
    try {
      await task();
    } catch (error) {
      setFailure(messageOf(error));
    }
  }
  const busy = update.isPending || remove.isPending || exportReport.isPending;

  // An empty Record on that day at the current clock, whose Name opens for typing.
  async function addOn(day: string) {
    const clock = new Date(now);
    const start = new Date(day);
    start.setHours(clock.getHours(), clock.getMinutes(), 0, 0);
    const record = await create.mutateAsync({
      workspaceId: selection.workspace,
      projectId: context.projectId,
      name: '',
      start: start.toISOString(),
      stop: start.toISOString(),
    });
    setEditing(record.id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-slot="dashboard">
      <div className="shrink-0">
        <DashboardToolbar
          selection={selection}
          projects={projects.data ?? []}
          busy={busy}
          onProject={(project) => patch({ project: project ?? undefined })}
          onPeriod={(period) => patch({ period })}
          onAnchor={(anchor) => patch({ anchor })}
          onExport={() => void run(() => exportReport.mutateAsync(toExportInput(selection)))}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" data-slot="dashboard-scroll">
        <DashboardTable
          rows={sorted}
          loaded={dashboard.data !== undefined}
          today={today}
          now={now}
          billable={selection.billable}
          rounding={selection.rounding}
          onBillable={(billable) => patch({ billable: billable || undefined })}
          onRounding={(rounding) => patch({ rounding: rounding === 'none' ? undefined : rounding })}
          workspaceId={selection.workspace}
          projects={projects.data ?? []}
          editing={editing}
          onEditing={onEditing}
          onAdd={(day) => void run(() => addOn(day))}
          rowSelection={visibleSelection}
          onRowSelectionChange={onRowSelectionChange}
          onRename={onRename}
          onDelete={onDelete}
        />
      </div>
      {failure && (
        <p role="alert" className="shrink-0 border-t px-3 py-1.5 text-xs text-destructive">
          {failure}
        </p>
      )}
      <div className="shrink-0">
        <DashboardFooter
          totals={totals}
          count={rows.length}
          now={now}
          rounding={selection.rounding}
          selected={selected}
          projects={projects.data ?? []}
          busy={busy}
          onMove={(projectId) =>
            void run(async () => {
              for (const { record } of selected) {
                await update.mutateAsync({
                  id: record.id,
                  projectId,
                  name: record.name,
                  start: record.start,
                  stop: record.stop,
                });
              }
              setRowSelection({});
            })
          }
          onDelete={() =>
            void run(async () => {
              for (const { record } of selected) await remove.mutateAsync({ id: record.id });
              setRowSelection({});
            })
          }
        />
      </div>
    </div>
  );
}
