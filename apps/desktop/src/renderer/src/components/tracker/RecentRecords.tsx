import { useMemo } from 'react';
import ButtonPlay1 from '~icons/streamline-ultimate-color/button-play-1';
import MoveExpandVertical from '~icons/streamline-ultimate-color/move-expand-vertical';
import { acceptsRecords, dayStart, isBillable, recordDurationMs } from '@time-stop/domain';
import type { DashboardRow } from '@time-stop/domain';
import { BillableMark } from '@/components/BillableMark';
import { ProjectLabel } from '@/components/ProjectLabel';
import { RecordMenu, useRecordActions } from '@/components/record/RecordActions';
import { RecordName } from '@/components/record/RecordName';
import { RecordSpan } from '@/components/record/RecordSpan';
import { IconButton } from '@/components/ui/IconButton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { groupActivities, totalDurationMs, type Activity } from '@/lib/activities';
import { dayLabel, hoursMinutes, UNTITLED_RECORD } from '@/lib/format';

interface RecentRecordsProps {
  // Stopped Records of the Workspace, newest first; the running Timer has no row.
  rows: DashboardRow[];
  loaded: boolean;
  now: number;
  // Start of today, ISO.
  today: string;
}

/** One row per activity, newest use first, with the Dashboard's row behaviour. */
export function RecentRecords(props: RecentRecordsProps) {
  const activities = useMemo(() => groupActivities(props.rows), [props.rows]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pt-2" data-slot="recent">
      {props.loaded && props.rows.length === 0 && (
        <Empty className="py-6">
          <EmptyHeader>
            <EmptyTitle className="text-sm">Nothing tracked yet</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
      <div className="divide-y">
        {activities.map((activity) => (
          <ActivityRow key={activity.key} activity={activity} list={props} />
        ))}
      </div>
    </div>
  );
}

/**
 * An activity of several Records: one row with today's total, or the whole window's when nothing
 * ran today, expanding to its Records on a rail. Play continues the activity.
 */
function ActivityRow({ activity, list }: { activity: Activity; list: RecentRecordsProps }) {
  const head = activity.rows[0]!;
  if (activity.rows.length === 1) return <RecordRow row={head} list={list} />;
  const todays = activity.rows.filter((row) => dayStart(row.record.start) === list.today);
  return (
    <Collapsible data-slot="activity">
      <div className="group/row flex items-center gap-1 pr-3 hover:bg-accent/50">
        <CollapsibleTrigger className="group/trigger flex min-w-0 flex-1 items-center gap-1 py-1.5 pl-4 text-left outline-none focus-visible:bg-accent/50">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="truncate">{head.record.name || UNTITLED_RECORD}</span>
              <span className="flex shrink-0 items-center gap-1 rounded-sm bg-muted px-1 text-xs text-muted-foreground tabular-nums group-hover/trigger:bg-accent group-hover/trigger:text-foreground group-data-[state=open]/trigger:text-foreground">
                <MoveExpandVertical className="size-3.5" />
                {activity.rows.length}
              </span>
            </span>
            <ProjectLine row={head} />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <b className="text-sm tabular-nums">
              {hoursMinutes(totalDurationMs(todays.length > 0 ? todays : activity.rows, list.now))}
            </b>
            <span className="text-xs text-muted-foreground tabular-nums">
              {todays.length > 0
                ? 'today'
                : `last ${dayLabel(dayStart(head.record.start), list.today)}`}
            </span>
          </div>
        </CollapsibleTrigger>
        <PlaySlot row={head} />
      </div>
      <CollapsibleContent className="mb-1.5 ml-5 border-l">
        {activity.rows.map((row) => (
          <NestedRecordRow key={row.record.id} row={row} list={list} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** A Record that is an activity of its own: Name and Duration, then Project and span. */
function RecordRow({ row, list }: { row: DashboardRow; list: RecentRecordsProps }) {
  const { rename, update } = useRecordActions();
  const { record } = row;
  return (
    <RecordMenu row={row}>
      <div
        data-slot="record-row"
        className="group/row flex items-center gap-1 py-1.5 pr-3 pl-4 hover:bg-accent/50 data-[state=open]:bg-accent/50"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0">
            <RecordName name={record.name} onRename={(name) => rename(record, name)} />
          </div>
          <ProjectLine row={row} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <b className="text-sm tabular-nums">{hoursMinutes(recordDurationMs(record, list.now))}</b>
          <RecordSpan
            record={record}
            now={list.now}
            prefix={dayLabel(dayStart(record.start), list.today)}
            onChange={(fields) => update(record, fields)}
          />
        </div>
        <PlaySlot row={row} />
      </div>
    </RecordMenu>
  );
}

/** One Record inside an expanded activity: only what differs from its siblings, the span. */
function NestedRecordRow({ row, list }: { row: DashboardRow; list: RecentRecordsProps }) {
  const { update } = useRecordActions();
  const { record } = row;
  return (
    <RecordMenu row={row}>
      <div
        data-slot="record-row"
        className="flex h-7 items-center gap-1 pr-10 pl-3 hover:bg-accent/50 data-[state=open]:bg-accent/50"
      >
        <RecordSpan
          record={record}
          now={list.now}
          prefix={dayLabel(dayStart(record.start), list.today)}
          align="start"
          onChange={(fields) => update(record, fields)}
        />
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {hoursMinutes(recordDurationMs(record, list.now))}
        </span>
      </div>
    </RecordMenu>
  );
}

/** Holds the row's right edge whether or not the activity can be continued. */
function PlaySlot({ row }: { row: DashboardRow }) {
  const { onContinue } = useRecordActions();
  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      {onContinue && acceptsRecords(row.project) && (
        <IconButton
          size="icon-xs"
          label="Continue"
          data-slot="continue"
          className="reveal shrink-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onContinue(row);
          }}
        >
          <ButtonPlay1 />
        </IconButton>
      )}
    </span>
  );
}

function ProjectLine({ row }: { row: DashboardRow }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      {row.project ? (
        <ProjectLabel
          project={row.project}
          suffix={row.project.archived ? 'Archived' : null}
          className="min-w-0"
        />
      ) : (
        <span className="truncate italic">No Project</span>
      )}
      {isBillable(row) && <BillableMark />}
    </span>
  );
}
