import { useMemo, useReducer } from 'react';
import {
  dashboardViewOf,
  dayBounds,
  formatDuration,
  isBillable,
  recordDurationMs,
} from '@app/domain';
import type { DashboardRow } from '@app/domain';
import { RecordActions, RecordFailure } from '@/components/record/RecordActions';
import { RecentRecords } from '@/components/tracker/RecentRecords';
import { TrackerDial } from '@/components/tracker/TrackerDial';
import { TrackerFooter } from '@/components/tracker/TrackerFooter';
import { useContextQuery, useSetContext } from '@/hooks/useContext';
import { useDashboard, useRecentRows } from '@/hooks/useDashboard';
import { useRecentRecordsOpen, useSetRecentRecordsOpen } from '@/hooks/usePreferences';
import { useProjects } from '@/hooks/useProjects';
import { useSyncStatus } from '@/hooks/useSync';
import { useNow, useStartTimer, useStopTimer, useTimer } from '@/hooks/useTimer';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { initialStandby, standbyOf, standbyReducer } from '@/lib/standby';
import { cn } from '@/lib/utils';

const RECENT_LIMIT = 50;

export function Tracker() {
  const timerQuery = useTimer();
  const timer = timerQuery.data ?? null;
  const now = useNow(timer?.start);
  const { from: todayStart, to: tomorrowStart } = useMemo(
    () => dayBounds(new Date(now).toISOString()),
    [now],
  );
  const start = useStartTimer();
  const stop = useStopTimer();
  const setContext = useSetContext();
  const [standbyState, dispatch] = useReducer(standbyReducer, initialStandby);
  const sync = useSyncStatus();
  const context = useContextQuery();
  const workspaces = useWorkspaces();
  const listOpen = useRecentRecordsOpen();
  const setListOpen = useSetRecentRecordsOpen();
  // A running Timer shows its own Project; on standby the Context's is what the next one gets.
  const workspaceId = timer?.workspaceId ?? context.data?.workspaceId;
  const projectId = timer ? timer.projectId : (context.data?.projectId ?? null);
  const projects = useProjects({ workspaceId });
  const workspace = workspaces.data?.find(({ id }) => id === workspaceId) ?? null;
  const project = projects.data?.find(({ id }) => id === projectId) ?? null;

  // The list is the whole Workspace: several activities across Projects run in one day, and
  // Continue has to reach them all. The running Timer takes one of the places it asks for.
  const recent = useRecentRows(
    { workspaceId: workspaceId ?? '', projectId: null, limit: RECENT_LIMIT + 1 },
    workspaceId !== undefined,
  );
  const rows = useMemo(
    () => (recent.data ?? []).filter((row) => row.record.stop !== null).slice(0, RECENT_LIMIT),
    [recent.data],
  );

  const standby = standbyOf({ rows, projectId, state: standbyState, today: todayStart, now });
  const showList = listOpen.data ?? true;
  const name = timer ? timer.name : standby.name;
  const elapsedMs = timer ? recordDurationMs(timer, now) : 0;
  const currentBillable = isBillable({ project, currency: workspace?.currency ?? null });

  // Today is the Workspace's, like the list and the Dashboard; the running Timer counts.
  const today = useDashboard(
    { from: todayStart, to: tomorrowStart, workspaceId: workspaceId ?? '' },
    workspaceId !== undefined,
  );
  const todayTotals = useMemo(
    () => dashboardViewOf(today.data ?? [], now).totals,
    [today.data, now],
  );
  const latestStop = today.data?.find((row) => row.record.stop !== null)?.record.stop ?? null;

  async function startWith(name: string) {
    dispatch({ type: 'started' });
    await start.mutateAsync({ name });
  }

  async function continueRow(row: DashboardRow) {
    dispatch({ type: 'started' });
    await start.mutateAsync({ name: row.record.name, projectId: row.record.projectId });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4" data-slot="tracker">
      <div className={cn('flex shrink-0 justify-center', !showList && 'my-auto')}>
        <TrackerDial
          workspace={workspace}
          projects={projects.data}
          project={project}
          projectId={projectId}
          timer={timer}
          elapsed={formatDuration(elapsedMs)}
          elapsedMs={elapsedMs}
          standby={standby.target ? 'continue' : 'start'}
          name={name}
          activityTodayMs={standby.todayMs}
          pending={start.isPending || stop.isPending || timerQuery.isPending}
          onDraftChange={(draft) => dispatch({ type: 'typed', draft })}
          onSubmit={(submitted) => {
            // The remembered activity and the Context's Project are already what a Start repeats.
            if (!timer) void startWith(submitted.trim());
          }}
          onClear={() => dispatch({ type: 'cleared', projectId })}
          onPickProject={(picked) =>
            workspace && setContext.mutate({ workspaceId: workspace.id, projectId: picked })
          }
          onToggle={() => {
            if (timer) {
              dispatch({ type: 'stopped' });
              stop.mutate();
            } else void startWith(standby.name.trim());
          }}
        />
      </div>
      <RecordActions
        workspaceId={workspaceId}
        projects={projects.data}
        today={todayStart}
        onContinue={continueRow}
      >
        {showList && (
          // Full bleed: the list runs edge to edge and slides under a shadow cast by the dial area.
          <div className="relative -mx-4 mt-2 flex min-h-0 flex-1 flex-col border-y">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-linear-to-b from-foreground/12 to-transparent"
            />
            {workspaceId && (
              <RecentRecords
                rows={rows}
                loaded={recent.data !== undefined}
                now={now}
                today={todayStart}
              />
            )}
          </div>
        )}
        <RecordFailure />
        <TrackerFooter
          todayMs={todayTotals.ms}
          billableTodayMs={todayTotals.billableMs}
          currentBillable={currentBillable}
          currency={workspace?.currency ?? null}
          sync={sync.data}
          listOpen={showList}
          onListOpenChange={(open) => setListOpen.mutate(open)}
          projectId={projectId}
          now={now}
          latestStop={latestStop}
        />
      </RecordActions>
    </div>
  );
}
