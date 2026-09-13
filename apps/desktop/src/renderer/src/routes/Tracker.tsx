import { useMemo } from 'react';
import { dayStart, formatDuration, recordDurationMs } from '@time-stop/domain';
import type { Record } from '@time-stop/domain';
import { NameField } from '@/components/tracker/NameField';
import { ProjectPicker } from '@/components/tracker/ProjectPicker';
import { ProjectRecords } from '@/components/tracker/ProjectRecords';
import { TimerDial } from '@/components/tracker/TimerDial';
import { TrackerFooter } from '@/components/tracker/TrackerFooter';
import { useClients } from '@/hooks/useClients';
import { useContextQuery } from '@/hooks/useContext';
import { useProjects } from '@/hooks/useProjects';
import { useSyncStatus } from '@/hooks/useSync';
import { useNow, useStartTimer, useStopTimer, useTimer, useTodayRecords } from '@/hooks/useTimer';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { dayBounds } from '@/lib/format';

export function Tracker() {
  const timerQuery = useTimer();
  const timer = timerQuery.data ?? null;
  const now = useNow(timer?.start);
  const { from, to } = useMemo(() => dayBounds(now), [now]);
  const today = useTodayRecords(from, to);
  const start = useStartTimer();
  const stop = useStopTimer();
  const sync = useSyncStatus();
  const context = useContextQuery();
  const workspaces = useWorkspaces();
  // A running Timer shows its own Project; on standby the Context's is what the next one gets.
  const workspaceId = timer?.workspaceId ?? context.data?.workspaceId;
  const projectId = timer ? timer.projectId : (context.data?.projectId ?? null);
  const projects = useProjects({ workspaceId, archived: false });
  const clients = useClients(workspaceId ?? null);
  const workspace = workspaces.data?.find(({ id }) => id === workspaceId) ?? null;
  const project = projects.data?.find(({ id }) => id === projectId) ?? null;
  const client = clients.data?.find(({ id }) => id === project?.clientId) ?? null;

  // The Name field edits the Timer, or the last Record stopped today once the Timer is gone.
  const target: Record | null = timer ?? today.data?.[0] ?? null;
  const latestStop = today.data?.find((record) => record.stop !== null)?.stop ?? null;
  const todayMs = (today.data ?? []).reduce(
    (sum, record) => sum + recordDurationMs(record, now),
    0,
  );
  const elapsedMs = timer ? recordDurationMs(timer, now) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" data-slot="tracker">
      <div className="flex shrink-0 flex-col items-center gap-4">
        {workspace && projects.data ? (
          <ProjectPicker
            workspace={workspace}
            projects={projects.data}
            project={project}
            client={client}
          />
        ) : (
          <div className="h-8" />
        )}
        <TimerDial
          elapsed={formatDuration(elapsedMs)}
          elapsedMs={elapsedMs}
          running={timer !== null}
          pending={start.isPending || stop.isPending || timerQuery.isPending}
          onToggle={() => (timer ? stop.mutate() : start.mutate())}
        />
        <div className="w-full">
          <NameField key={target?.id ?? 'none'} record={target} />
        </div>
      </div>
      {workspaceId && projects.data && (
        <ProjectRecords
          workspaceId={workspaceId}
          projectId={projectId}
          projects={projects.data}
          now={now}
          today={dayStart(new Date(now).toISOString())}
          latestStop={latestStop}
        />
      )}
      <div className="mt-auto shrink-0 pt-2">
        <TrackerFooter todayMs={todayMs} sync={sync.data} />
      </div>
    </div>
  );
}
