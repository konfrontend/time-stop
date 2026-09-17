import ButtonFastForward1 from '~icons/streamline-ultimate-color/button-fast-forward-1';
import ButtonPlay1 from '~icons/streamline-ultimate-color/button-play-1';
import ControlsPause from '~icons/streamline-ultimate-color/controls-pause';
import { cn } from '@/lib/utils';

interface TimerDialProps {
  // The running Timer's elapsed time; `00:00:00` on standby.
  elapsed: string;
  elapsedMs: number;
  running: boolean;
  // What a click does with no Timer running: start something new, or go on with what is remembered.
  standby: 'start' | 'continue';
  // What is started, continued or paused; it names the button.
  name: string;
  pending: boolean;
  onToggle: () => void;
}

export const DIAL_PX = 280;
const RING_WIDTH = 3;
/** Clear of the Name above and the action label below, which the dial places against it. */
const FACE_PX = 47;

/** The Timer face and its Start/Continue/Pause control as one circle; the whole disc is the button. */
export function TimerDial({
  elapsed,
  elapsedMs,
  running,
  standby,
  name,
  pending,
  onToggle,
}: TimerDialProps) {
  const label = running ? 'Pause' : standby === 'continue' ? 'Continue' : 'Start';
  return (
    <button
      type="button"
      data-slot="timer-dial"
      data-running={running || undefined}
      data-standby={running ? undefined : standby}
      aria-label={name ? `${label} ${name}` : label}
      disabled={pending}
      onClick={onToggle}
      style={{ width: DIAL_PX, height: DIAL_PX }}
      className={cn(
        'group relative flex flex-col items-center justify-center rounded-full outline-none transition-[background-color,box-shadow,transform] duration-300 focus-visible:ring-4 focus-visible:ring-ring/40 active:scale-[0.985] disabled:opacity-60',
        running
          ? 'bg-primary text-primary-foreground shadow-primary/15'
          : 'border-2 border-border text-foreground hover:bg-accent',
        // Dashed is empty; solid has something to go on with.
        !running &&
          (standby === 'continue'
            ? 'border-solid border-foreground/30'
            : 'border-dashed hover:border-solid'),
      )}
    >
      {running && <SecondsRing elapsedMs={elapsedMs} />}
      <span
        data-slot="timer-face"
        style={{ fontSize: FACE_PX }}
        className={cn(
          'leading-none font-semibold tracking-tight tabular-nums',
          !running && 'text-muted-foreground/50 group-hover:text-foreground',
        )}
      >
        {elapsed}
      </span>
      <span
        className={cn(
          // Out of flow, so the time alone sits at the dial's vertical center.
          'absolute top-[calc(50%+37px)] inline-flex items-center gap-1.5 text-[12px] font-medium',
          running ? 'text-primary-foreground/80' : 'text-muted-foreground',
        )}
      >
        {running ? (
          // The glyph has no disc of its own, unlike play and fast-forward.
          <span className="flex size-6 items-center justify-center rounded-full bg-primary-foreground">
            <ControlsPause className="size-3.5" />
          </span>
        ) : standby === 'continue' ? (
          <ButtonFastForward1 className="size-6" />
        ) : (
          <ButtonPlay1 className="size-6" />
        )}
        {label}
      </span>
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
