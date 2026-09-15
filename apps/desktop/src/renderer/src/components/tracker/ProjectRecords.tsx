import { useMemo, useState } from 'react';
import AddCircleBold from '~icons/streamline-ultimate-color/add-circle-bold';
import Undo from '~icons/streamline-ultimate-color/undo';
import { formatClock, recordDurationMs } from '@time-stop/domain';
import type { DashboardRow, Project, Record } from '@time-stop/domain';
import { ProjectLabel } from '@/components/ProjectLabel';
import { RecordPopover } from '@/components/RecordPopover';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDashboard } from '@/hooks/useDashboard';
import { clock, dayBounds, hoursMinutes } from '@/lib/format';
import { cn } from '@/lib/utils';

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

const DEFAULT_SPAN_MS = 30 * 60_000;

/** A run of consecutive rows on the same Project; a run of one is shown as a plain row. */
interface Run {
  key: string;
  projectId: string | null;
  rows: DashboardRow[];
}

/** Today's Records of the Context, behind a button in the status line, so the day stays in view. */
export function ProjectRecords({
  workspaceId,
  projectId,
  projects,
  now,
  today,
  latestStop,
}: ProjectRecordsProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  // A new day moves the range; a new second does not.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const range = useMemo(() => dayBounds(now), [today]);
  const dashboard = useDashboard({
    ...range,
    workspaceId,
    ...(projectId ? { projectIds: [projectId] } : {}),
  });
  const rows = useMemo(() => dashboard.data?.rows ?? [], [dashboard.data]);
  // Runs only make sense across Projects; filtered to one, every row would join the same run.
  const runs = useMemo(() => (projectId ? rows.map(soloRun) : groupRuns(rows)), [rows, projectId]);
  const project = projects.find(({ id }) => id === projectId);

  const defaults = {
    projectId,
    start: formatClock(latestStop ?? new Date(now - DEFAULT_SPAN_MS).toISOString()),
    stop: formatClock(new Date(now).toISOString()),
  };
  const editor = (record: Record | undefined) => (
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
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setEditing(null);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Recent Records"
              data-slot="project-records-trigger"
              className="text-muted-foreground"
            >
              <Undo className="size-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Recent Records</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        side="top"
        className="flex max-h-96 w-88 flex-col p-0"
        data-slot="project-records"
      >
        <div className="min-h-0 flex-1 divide-y overflow-y-auto">
          {dashboard.data && rows.length === 0 && (
            <Empty className="py-6">
              <EmptyHeader>
                <EmptyTitle className="text-sm">No Records today</EmptyTitle>
                <EmptyDescription>
                  {project ? `Nothing tracked on ${project.name} yet.` : 'Nothing tracked yet.'}
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
                open={editing === run.rows[0]!.record.id}
                onOpenChange={(next) => setEditing(next ? run.rows[0]!.record.id : null)}
              >
                {editing === run.rows[0]!.record.id && editor(run.rows[0]!.record)}
              </RecordRow>
            ) : (
              <RunGroup key={run.key} run={run} now={now}>
                {run.rows.map((row) => (
                  <RecordRow
                    key={row.record.id}
                    row={row}
                    now={now}
                    nested
                    open={editing === row.record.id}
                    onOpenChange={(next) => setEditing(next ? row.record.id : null)}
                  >
                    {editing === row.record.id && editor(row.record)}
                  </RecordRow>
                ))}
              </RunGroup>
            ),
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t bg-popover p-1.5">
          <Popover
            open={editing === 'new'}
            onOpenChange={(next) => setEditing(next ? 'new' : null)}
          >
            <PopoverTrigger asChild>
              <Button variant="ghost" size="xs">
                <AddCircleBold />
                Add
              </Button>
            </PopoverTrigger>
            {editing === 'new' && editor(undefined)}
          </Popover>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RunGroup({ run, now, children }: { run: Run; now: number; children: React.ReactNode }) {
  const project = run.rows[0]!.project;
  const total = run.rows.reduce((sum, row) => sum + recordDurationMs(row.record, now), 0);
  return (
    <Collapsible data-slot="record-run">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none hover:bg-accent/50 focus-visible:bg-accent/50">
        <ProjectChip project={project} className="min-w-0 flex-1 text-sm" />
        <span className="text-xs text-muted-foreground tabular-nums">×{run.rows.length}</span>
        <span className="min-w-12 text-right font-semibold tabular-nums">
          {hoursMinutes(total)}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="divide-y border-t bg-muted/40">{children}</CollapsibleContent>
    </Collapsible>
  );
}

interface RecordRowProps {
  row: DashboardRow;
  now: number;
  nested?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function RecordRow({ row, now, nested, open, onOpenChange, children }: RecordRowProps) {
  const { record, project } = row;
  const running = record.stop === null;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        data-slot="record-row"
        data-running={running || undefined}
        className={cn(
          'flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm outline-none hover:bg-accent/50 focus-visible:bg-accent/50 data-[state=open]:bg-accent/50',
          nested && 'pl-8',
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
            {clock(record.start)}–{record.stop === null ? 'now' : clock(record.stop)}
          </span>
        </div>
      </PopoverTrigger>
      {children}
    </Popover>
  );
}

function ProjectChip({ project, className }: { project: Project | null; className?: string }) {
  return project ? (
    <ProjectLabel project={project} className={className} />
  ) : (
    <span className={cn('truncate italic', className)}>No Project</span>
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
