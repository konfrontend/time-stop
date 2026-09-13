import { Play, Square } from 'lucide-react';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

interface TimerDialProps {
  elapsed: string;
  elapsedMs: number;
  running: boolean;
  pending: boolean;
  onToggle: () => void;
}

const SIZE_PX = 248;
const RING_WIDTH = 3;

const mac = navigator.platform.startsWith('Mac');
/** The global hotkey the main process registers, in the keys of this platform. */
const TOGGLE_KEYS = mac ? ['⌘', '⌥', 'S'] : ['Ctrl', 'Alt', 'S'];

/** The Timer face and its Start/Stop control as one circle; the whole disc is the button. */
export function TimerDial({ elapsed, elapsedMs, running, pending, onToggle }: TimerDialProps) {
  return (
    <button
      type="button"
      data-slot="timer-dial"
      data-running={running || undefined}
      aria-label={running ? 'Stop' : 'Start'}
      disabled={pending}
      onClick={onToggle}
      style={{ width: SIZE_PX, height: SIZE_PX }}
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-full outline-none transition-[background-color,box-shadow,transform] duration-300 focus-visible:ring-4 focus-visible:ring-ring/40 active:scale-[0.985] disabled:opacity-60',
        running
          ? 'bg-primary text-primary-foreground shadow-primary/15'
          : 'border-2 border-dashed border-border text-foreground hover:border-solid hover:bg-accent',
      )}
    >
      {running && <SecondsRing elapsedMs={elapsedMs} />}
      <span
        data-slot="timer-face"
        className={cn(
          'text-[42px] leading-none font-semibold tracking-tight tabular-nums',
          !running && 'text-muted-foreground/50 group-hover:text-foreground',
        )}
      >
        {elapsed}
      </span>
      <span
        className={cn(
          'mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium',
          running ? 'text-primary-foreground/80' : 'text-muted-foreground',
        )}
      >
        {running ? (
          <Square className="size-3 fill-current" />
        ) : (
          <Play className="size-3 fill-current" />
        )}
        {running ? 'Stop' : 'Start'}
      </span>
      <KbdGroup
        aria-hidden
        className={cn(
          'absolute bottom-9 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100',
          running && '[&_kbd]:bg-primary-foreground/15 [&_kbd]:text-primary-foreground/80',
        )}
      >
        {TOGGLE_KEYS.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </KbdGroup>
      {running && (
        <span className="absolute top-6 size-1.5 animate-pulse rounded-full bg-primary-foreground" />
      )}
    </button>
  );
}

/** A thin arc outside the disc that sweeps once per minute while the Timer runs. */
function SecondsRing({ elapsedMs }: { elapsedMs: number }) {
  const r = 50 - RING_WIDTH / 2;
  const c = 2 * Math.PI * r;
  const second = Math.floor(elapsedMs / 1000) % 60;
  // Jumping from 59 back to 0 must not animate the arc backwards.
  const transition = second === 0 ? 'none' : 'stroke-dashoffset 1s linear';
  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 scale-[1.09] -rotate-90"
      aria-hidden
    >
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        strokeWidth={RING_WIDTH}
        className="stroke-primary-foreground/15"
      />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        strokeWidth={RING_WIDTH}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - (second + 1) / 60)}
        style={{ transition }}
        className="stroke-primary-foreground/80"
      />
    </svg>
  );
}
