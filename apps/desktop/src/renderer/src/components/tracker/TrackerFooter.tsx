import { useState } from 'react';
import AddCircleBold from '~icons/streamline-ultimate-color/add-circle-bold';
import CloudDataTransfer from '~icons/streamline-ultimate-color/cloud-data-transfer';
import CloudLoading from '~icons/streamline-ultimate-color/cloud-loading';
import CloudWarning from '~icons/streamline-ultimate-color/cloud-warning';
import MoveExpandVertical from '~icons/streamline-ultimate-color/move-expand-vertical';
import QuestionHelpMessage from '~icons/streamline-ultimate-color/question-help-message';
import { formatClock } from '@app/domain';
import type { SyncStatus } from '@app/domain';
import { BillableMark } from '@/components/BillableMark';
import { NewRecordPopover } from '@/components/record/RecordActions';
import { IconButton } from '@/components/ui/IconButton';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { hoursText } from '@/lib/format';

const mac = navigator.platform.startsWith('Mac');
/** The global hotkey the main process registers, in the keys of this platform. */
const TOGGLE_KEYS = mac ? ['⌘', '⌥', 'S'] : ['Ctrl', 'Alt', 'S'];

const DEFAULT_SPAN_MS = 30 * 60_000;

/** Nothing is lost while pushing is halted, so the Tracker states it once and stays quiet. */
const haltText = (reason: string) =>
  `The Server refused the push: ${reason}. Records keep queueing; fix it in Settings.`;

interface TrackerFooterProps {
  todayMs: number;
  // Billable hours tracked today, the running Timer included.
  billableTodayMs: number;
  // Whether the Record the dial starts, or the running Timer, is Billable.
  currentBillable: boolean;
  // Without a Workspace Currency nothing is Billable, so the hours are not shown at all.
  currency: string | null;
  sync: SyncStatus | undefined;
  listOpen: boolean;
  onListOpenChange: (open: boolean) => void;
  // What a new Record is filled in with: the Context's Project, and a span up to now.
  projectId: string | null;
  now: number;
  // Stop of the latest Record stopped today, to butt a new one against.
  latestStop: string | null;
}

/** Help and tools under the dial: what was tracked today, the list toggle, and the shell's state. */
export function TrackerFooter({
  todayMs,
  billableTodayMs,
  currentBillable,
  currency,
  sync,
  listOpen,
  onListOpenChange,
  ...adding
}: TrackerFooterProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
      <span>
        Today <b className="tabular-nums">{hoursText(todayMs)}</b>
      </span>
      {currency && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              data-slot="billable-today"
              data-current={currentBillable || undefined}
              className="ml-2 flex items-center gap-1 data-current:text-foreground"
            >
              <BillableMark />
              <b className="tabular-nums">{hoursText(billableTodayMs)}</b>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Billable today{currentBillable ? '' : ' · the current Project is not Billable'}
          </TooltipContent>
        </Tooltip>
      )}
      <span className="ml-auto" />
      <IconButton
        size="icon-xs"
        label="Recent Records"
        tooltip={listOpen ? 'Hide Recent Records' : 'Show Recent Records'}
        aria-pressed={listOpen}
        data-slot="list-toggle"
        onClick={() => onListOpenChange(!listOpen)}
      >
        <MoveExpandVertical />
      </IconButton>
      <AddRecord {...adding} />
      <IconButton
        size="icon-xs"
        label="Keyboard shortcut"
        tooltip={
          <span className="flex items-center gap-2">
            Start / Pause anywhere
            <KbdGroup>
              {TOGGLE_KEYS.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </KbdGroup>
          </span>
        }
      >
        <QuestionHelpMessage />
      </IconButton>
      {sync?.configured && <SyncIcon sync={sync} />}
    </div>
  );
}

type AddRecordProps = Pick<TrackerFooterProps, 'projectId' | 'now' | 'latestStop'>;

function AddRecord({ projectId, now, latestStop }: AddRecordProps) {
  const [open, setOpen] = useState(false);
  const defaults = {
    projectId,
    start: formatClock(latestStop ?? new Date(now - DEFAULT_SPAN_MS).toISOString()),
    stop: formatClock(new Date(now).toISOString()),
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton size="icon-xs" label="Add Record">
          <AddCircleBold />
        </IconButton>
      </PopoverTrigger>
      {open && <NewRecordPopover defaults={defaults} onClose={() => setOpen(false)} />}
    </Popover>
  );
}

function SyncIcon({ sync }: { sync: SyncStatus }) {
  const stopped = sync.halted || sync.lastError !== null;
  if (stopped) {
    return (
      <span
        data-slot="sync-halted"
        role="img"
        aria-label="Sync stopped"
        title={haltText(sync.lastError?.message ?? 'no reason given')}
        className="inline-flex size-6 items-center justify-center rounded-md dark:bg-accent/50"
      >
        <CloudWarning className="size-4.5" />
      </span>
    );
  }
  const waiting = sync.pending > 0;
  return (
    <span
      role="img"
      aria-label={waiting ? 'Pushing' : 'Synced'}
      title={
        waiting
          ? `${sync.pending} ${sync.pending === 1 ? 'Change' : 'Changes'} waiting for the Server`
          : 'Everything is on the Server'
      }
      className="inline-flex size-6 items-center justify-center rounded-md dark:bg-accent/50"
    >
      {waiting ? <CloudDataTransfer className="size-4.5" /> : <CloudLoading className="size-4.5" />}
    </span>
  );
}
