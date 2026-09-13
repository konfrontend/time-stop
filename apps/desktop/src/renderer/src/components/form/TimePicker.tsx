import { useEffect, useId, useRef, useState } from 'react';
import { isClock } from '@time-stop/domain';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  clockLabel,
  clockSteps,
  normaliseClock,
  nudgeClock,
  usesTwelveHours,
} from '@/lib/clockText';
import { cn } from '@/lib/utils';

const STEP_MINUTES = 15;
const NUDGE_MINUTES = 5;
const steps = clockSteps(STEP_MINUTES);
const twelveHours = usesTwelveHours();

interface TimePickerProps {
  id?: string;
  // `HH:mm`, or empty for none.
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string | undefined;
  'aria-invalid'?: boolean | undefined;
  className?: string | undefined;
}

/**
 * A wall clock as text: whatever is typed is normalised to `HH:mm` on blur or Enter, an exact
 * `HH:mm` lands at once. A list in quarter-hour steps narrows as you type; ↑/↓ nudge by five
 * minutes. Labels follow the locale's 12- or 24-hour clock; the value is always 24-hour.
 */
export function TimePicker({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  ...rest
}: TimePickerProps) {
  const listId = useId();
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const chosen = useRef<HTMLButtonElement>(null);

  // A value that arrives from outside replaces what was typed.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value);
  }

  useEffect(() => {
    if (open) chosen.current?.scrollIntoView({ block: 'center' });
  }, [open, value]);

  const query = text.replace(/\s/g, '').toLowerCase();
  const options =
    query === '' || text === value
      ? steps
      : steps.filter(
          (step) =>
            step.startsWith(query) ||
            step.replace(/^0/, '').startsWith(query) ||
            label(step).replace(/\s/g, '').toLowerCase().startsWith(query),
        );

  function commit(): boolean {
    const normalised = text.trim() === '' ? '' : normaliseClock(text);
    if (normalised === null) {
      setText(value);
      return false;
    }
    setText(normalised);
    if (normalised !== value) onChange(normalised);
    return true;
  }

  function pick(step: string) {
    setOpen(false);
    setText(step);
    onChange(step);
  }

  return (
    <Popover open={open && options.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          id={id}
          data-slot="time-picker"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          inputMode="numeric"
          placeholder={placeholder}
          value={text}
          className={cn('tabular-nums', className)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            commit();
            onBlur?.();
          }}
          onChange={(event) => {
            const next = event.target.value;
            setOpen(true);
            setText(next);
            if (isClock(next)) onChange(next);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault();
              pick(
                nudgeClock(
                  value || '00:00',
                  event.key === 'ArrowUp' ? NUDGE_MINUTES : -NUDGE_MINUTES,
                ),
              );
            } else if (event.key === 'Enter') {
              // Enter normalises first; a second Enter reaches the form.
              if (text !== value) event.preventDefault();
              setOpen(false);
              commit();
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
          {...rest}
        />
      </PopoverAnchor>
      <PopoverContent
        id={listId}
        role="listbox"
        align="start"
        sideOffset={4}
        className="max-h-56 w-(--radix-popover-trigger-width) min-w-28 overflow-y-auto p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (
            id &&
            event.target instanceof Node &&
            document.getElementById(id)?.contains(event.target)
          )
            event.preventDefault();
        }}
      >
        {options.map((step) => (
          <button
            key={step}
            ref={step === value ? chosen : undefined}
            type="button"
            role="option"
            aria-selected={step === value}
            className={cn(
              'block w-full rounded-sm px-2 py-1 text-left text-sm outline-none hover:bg-accent tabular-nums',
              step === value && 'bg-accent text-accent-foreground',
            )}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => pick(step)}
          >
            {label(step)}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const label = (step: string) => (twelveHours ? clockLabel(step) : step);
