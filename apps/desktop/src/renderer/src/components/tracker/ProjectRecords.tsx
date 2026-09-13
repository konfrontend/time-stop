import { useMemo, useState } from 'react';
import { ChevronsUpDown, Plus } from 'lucide-react';
import { dayStart, formatClock, recordDurationMs } from '@time-stop/domain';
import type { DashboardRow, Project, Record } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { useDashboard } from '@/hooks/useDashboard';
import { clock, dayLabel, hoursMinutes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RecordPopover } from './RecordPopover';

interface ProjectRecordsProps {
  workspaceId: string;
  projectId: string | null;
  projects: Project[];
  now: number;
  // Start of today, ISO; the day new Records land on.
  today: string;
  // Stop of the latest Record stopped today, to butt a new one against.
  latestStop: string | null;
}

const DAYS_BACK = 7;
const MAX_ROWS = 20;
const OPEN_KEY = 'tracker.records.open';
const DEFAULT_SPAN_MS = 30 * 60_000;

/** A run of consecutive rows on the same Project; a run of one is shown as a plain row. */
interface Run {
  key: string;
  projectId: string | null;
  rows: DashboardRow[];
}

const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
};

/** The Context's latest Records, so what was tracked stays in view while the next Timer runs. */
export function ProjectRecords({
  workspaceId,
  projectId,
  projects,
  now,
  today,
  latestStop,
}: ProjectRecordsProps) {
  const [open, setOpen] = useState(readOpen);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const range = useMemo(() => {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (DAYS_BACK - 1));
    const to = new Date(now);
    to.setHours(24, 0, 0, 0);
    return { from: from.toISOString(), to: to.toISOString() };
    // A new day moves the range; a new second does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);
  const dashboard = useDashboard({ ...range, workspaceId, ...(projectId ? { projectId } : {}) });
  const rows = useMemo(() => (dashboard.data?.rows ?? []).slice(0, MAX_ROWS), [dashboard.data]);
  // Runs only make sense across Projects; filtered to one, every row would join the same run.
  const runs = useMemo(() => (projectId ? rows.map(soloRun) : groupRuns(rows)), [rows, projectId]);
  const project = projects.find(({ id }) => id === projectId);

  function toggle(next: boolean) {
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, String(next));
    } catch {
      // A browser that refuses storage still gets the toggle for this session.
    }
  }

  const defaults = {
    projectId,
    start: formatClock(latestStop ?? new Date(now - DEFAULT_SPAN_MS).toISOString()),
    stop: formatClock(new Date(now).toISOString()),
  };
  const popover = (record: Record | undefined) => (
    <RecordPopover
      record={record}
      workspaceId={workspaceId}
      projects={projects}
      today={today}
      defaults={defaults}
      onClose={() => setEditing(null)}
    />
  );

  return (
    <Collapsible
      open={open}
      onOpenChange={toggle}
      className="group/records -mx-4 flex min-h-0 flex-1 flex-col"
      data-slot="project-records"
    >
      <div className="flex shrink-0 items-center gap-1 px-3 py-1.5">
        <CollapsibleTrigger className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground">
          Recent Records
          <ChevronsUpDown className="size-3.5" />
        </CollapsibleTrigger>
        <Popover open={editing === 'new'} onOpenChange={(next) => setEditing(next ? 'new' : null)}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto opacity-0 transition-opacity group-hover/records:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            >
              <Plus />
              Add
            </Button>
          </PopoverTrigger>
          {editing === 'new' && popover(undefined)}
        </Popover>
      </div>
      <CollapsibleContent className="min-h-0 flex-1 overflow-y-auto">
        {dashboard.data && rows.length === 0 && (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyTitle className="text-sm">No Records yet</EmptyTitle>
              <EmptyDescription>
                {project
                  ? `Nothing tracked on ${project.name} this week.`
                  : 'Nothing tracked this week.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {runs.map((run) =>
          run.rows.length === 1 ? (
            <RecordRow
              key={run.key}
              row={run.rows[0]!}
              now={now}
              today={today}
              open={editing === run.rows[0]!.record.id}
              onOpenChange={(next) => setEditing(next ? run.rows[0]!.record.id : null)}
            >
              {editing === run.rows[0]!.record.id && popover(run.rows[0]!.record)}
            </RecordRow>
          ) : (
            <RunGroup key={run.key} run={run} now={now}>
              {run.rows.map((row) => (
                <RecordRow
                  key={row.record.id}
                  row={row}
                  now={now}
                  today={today}
                  nested
                  open={editing === row.record.id}
                  onOpenChange={(next) => setEditing(next ? row.record.id : null)}
                >
                  {editing === row.record.id && popover(row.record)}
                </RecordRow>
              ))}
            </RunGroup>
          ),
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function RunGroup({ run, now, children }: { run: Run; now: number; children: React.ReactNode }) {
  const project = run.rows[0]!.project;
  const total = run.rows.reduce((sum, row) => sum + recordDurationMs(row.record, now), 0);
  return (
    <Collapsible data-slot="record-run">
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 border-t px-3 py-2 text-left text-sm outline-none hover:bg-accent/50 focus-visible:bg-accent/50">
        <ProjectChip project={project} className="min-w-0 flex-1 text-sm" />
        <span className="text-xs text-muted-foreground tabular-nums">×{run.rows.length}</span>
        <span className="min-w-12 text-right font-semibold tabular-nums">
          {hoursMinutes(total)}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

interface RecordRowProps {
  row: DashboardRow;
  now: number;
  today: string;
  nested?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function RecordRow({ row, now, today, nested, open, onOpenChange, children }: RecordRowProps) {
  const { record, project } = row;
  const running = record.stop === null;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        data-slot="record-row"
        data-running={running || undefined}
        className={cn(
          'flex w-full cursor-pointer flex-col gap-0.5 border-t px-3 py-2 text-left text-sm outline-none hover:bg-accent/50 focus-visible:bg-accent/50 data-[state=open]:bg-accent/50',
          nested && 'bg-muted/30 pl-8',
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
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {nested || <ProjectChip project={project} className="min-w-0 flex-1" />}
          <span className={cn('whitespace-nowrap tabular-nums', nested && 'ml-auto')}>
            {dayLabel(dayStart(record.start), today)} · {clock(record.start)}–
            {record.stop === null ? 'now' : clock(record.stop)}
          </span>
        </div>
      </PopoverTrigger>
      {children}
    </Popover>
  );
}

function ProjectChip({ project, className }: { project: Project | null; className?: string }) {
  return (
    <span className={cn('flex items-center gap-1.5 truncate', className)}>
      {project ? (
        <>
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
            aria-hidden
          />
          <span className="truncate">{project.name}</span>
        </>
      ) : (
        <span className="italic">No Project</span>
      )}
    </span>
  );
}

const soloRun = (row: DashboardRow): Run => ({
  key: row.record.id,
  projectId: row.record.projectId,
  rows: [row],
});

function groupRuns(rows: DashboardRow[]): Run[] {
  const runs: Run[] = [];
  for (const row of rows) {
    const last = runs[runs.length - 1];
    const projectId = row.record.projectId;
    if (last && last.projectId === projectId) last.rows.push(row);
    else runs.push({ key: row.record.id, projectId, rows: [row] });
  }
  return runs;
}
