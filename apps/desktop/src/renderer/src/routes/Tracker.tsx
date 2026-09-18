import { useMemo, useState } from 'react';
import {
  acceptsRecords,
  dayStart,
  formatDuration,
  isBillable,
  recordDurationMs,
} from '@time-stop/domain';
import type { DashboardRow } from '@time-stop/domain';
import { RecordActions, RecordFailure } from '@/components/record/RecordActions';
import { RecentRecords } from '@/components/tracker/RecentRecords';
import { TrackerDial } from '@/components/tracker/TrackerDial';
import { TrackerFooter } from '@/components/tracker/TrackerFooter';
import { useContextQuery, useSetContext } from '@/hooks/useContext';
import { useRecentRows } from '@/hooks/useDashboard';
import { useRecentRecordsOpen, useSetRecentRecordsOpen } from '@/hooks/usePreferences';
import { useProjects } from '@/hooks/useProjects';
import { useSyncStatus } from '@/hooks/useSync';
import {
  useNow,
  useStartTimer,
  useStopTimer,
  useTimer,
  useTodayRecords,
  useUpdateRecordName,
} from '@/hooks/useTimer';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { dayBounds } from '@/lib/format';
import { standbyOf } from '@/lib/standby';
import { cn } from '@/lib/utils';

const RECENT_LIMIT = 50;

export function Tracker() {
  const timerQuery = useTimer();
  const timer = timerQuery.data ?? null;
  const now = useNow(timer?.start);
  const { from, to } = useMemo(() => dayBounds(now), [now]);
  const today = useTodayRecords(from, to);
  const todayStart = dayStart(new Date(now).toISOString());
  const start = useStartTimer();
  const stop = useStopTimer();
  const rename = useUpdateRecordName();
  const setContext = useSetContext();
  // The Name typed on the dial; null while it is untouched, so the remembered Record shows through.
  const [typed, setTyped] = useState<string | null>(null);
  // The Project whose remembered Record Clear let go, until the next Timer starts.
  const [cleared, setCleared] = useState<{ projectId: string | null } | null>(null);
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
  // An Archived Project takes no new Records, so only the one already picked stays on offer.
  const pickable = useMemo(
    () => projects.data?.filter((option) => acceptsRecords(option) || option.id === projectId),
    [projects.data, projectId],
  );

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

  const standby = standbyOf({
    rows,
    projectId,
    typed,
    cleared: cleared !== null && cleared.projectId === projectId,
    today: todayStart,
    now,
  });
  const showList = listOpen.data ?? true;
  const name = timer ? timer.name : standby.name;
  const elapsedMs = timer ? recordDurationMs(timer, now) : 0;
  const currentBillable = isBillable({ project, currency: workspace?.currency ?? null });

  const latestStop = today.data?.find((record) => record.stop !== null)?.stop ?? null;
  const todayMs = (today.data ?? []).reduce(
    (sum, record) => sum + recordDurationMs(record, now),
    0,
  );
  const billableTodayMs = (today.data ?? []).reduce((sum, record) => {
    const on = projects.data?.find(({ id }) => id === record.projectId) ?? null;
    const billable = isBillable({ project: on, currency: workspace?.currency ?? null });
    return billable ? sum + recordDurationMs(record, now) : sum;
  }, 0);

  async function startWith(name: string) {
    setTyped(null);
    setCleared(null);
    const started = await start.mutateAsync();
    if (name) await rename.mutateAsync({ id: started.id, name });
  }

  async function continueRow(row: DashboardRow) {
    if (timer) await stop.mutateAsync();
    await setContext.mutateAsync({
      workspaceId: row.record.workspaceId,
      projectId: row.record.projectId,
    });
    await startWith(row.record.name);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4" data-slot="tracker">
      <div className={cn('flex shrink-0 justify-center', !showList && 'my-auto')}>
        <TrackerDial
          workspace={workspace}
          projects={pickable}
          project={project}
          projectId={projectId}
          timer={timer}
          elapsed={formatDuration(elapsedMs)}
          elapsedMs={elapsedMs}
          standby={standby.target ? 'continue' : 'start'}
          name={name}
          activityTodayMs={standby.todayMs}
          pending={start.isPending || stop.isPending || timerQuery.isPending}
          onDraftChange={setTyped}
          onSubmit={(submitted) => {
            // The remembered activity and the Context's Project are already what a Start repeats.
            if (!timer) void startWith(submitted.trim());
          }}
          onClear={() => {
            setTyped(null);
            setCleared({ projectId });
          }}
          onPickProject={(picked) =>
            workspace && setContext.mutate({ workspaceId: workspace.id, projectId: picked })
          }
          onToggle={() => {
            if (timer) {
              setTyped(null);
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
          todayMs={todayMs}
          billableTodayMs={billableTodayMs}
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
