import { CircleHelp, Cloud, CloudOff, CloudUpload, Pin } from 'lucide-react';
import type { SyncStatus } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAlwaysOnTop } from '@/hooks/useShell';
import { hoursText } from '@/lib/format';
import { cn } from '@/lib/utils';

const mac = navigator.platform.startsWith('Mac');
/** The global hotkey the main process registers, in the keys of this platform. */
const TOGGLE_KEYS = mac ? ['⌘', '⌥', 'S'] : ['Ctrl', 'Alt', 'S'];

/** Nothing is lost while pushing is halted, so the Tracker states it once and stays quiet. */
const haltText = (reason: string) =>
  `The Server refused the push: ${reason}. Records keep queueing; fix it in Settings.`;

interface TrackerFooterProps {
  todayMs: number;
  sync: SyncStatus | undefined;
  // The Recent Records trigger, beside the Today total.
  records: React.ReactNode;
}

export function TrackerFooter({ todayMs, sync, records }: TrackerFooterProps) {
  const { alwaysOnTop, toggle } = useAlwaysOnTop();
  return (
    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <span>
        Today <b className="tabular-nums">{hoursText(todayMs)}</b>
      </span>
      {records}
      <span className="ml-auto" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Keyboard shortcut">
            <CircleHelp className="size-3.5 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          Start / Stop anywhere
          <KbdGroup>
            {TOGGLE_KEYS.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
        </TooltipContent>
      </Tooltip>
      {sync?.configured && <SyncIcon sync={sync} />}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Always on top"
        aria-pressed={alwaysOnTop}
        className={cn(alwaysOnTop && 'bg-accent text-accent-foreground')}
        onClick={toggle}
      >
        <Pin className={cn('size-3.5', alwaysOnTop || 'text-muted-foreground')} />
      </Button>
    </div>
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
        className="inline-flex size-6 items-center justify-center text-destructive"
      >
        <CloudOff className="size-3.5" />
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
      className="inline-flex size-6 items-center justify-center"
    >
      {waiting ? <CloudUpload className="size-3.5" /> : <Cloud className="size-3.5" />}
    </span>
  );
}
