import { useState } from 'react';
import { isClock } from '@time-stop/domain';
import { Autocomplete } from '@/components/ui/Autocomplete';
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
const localeTwelveHours = usesTwelveHours();

interface TimePickerProps {
  id?: string;
  // `HH:mm`, or empty for none.
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  // Fires, after `onChange`, only for a click in the list; typing and nudges never fire it.
  onPick?: (value: string) => void;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  autoFocus?: boolean;
  placeholder?: string | undefined;
  'aria-label'?: string | undefined;
  'aria-invalid'?: boolean | undefined;
  className?: string | undefined;
  twelveHours?: boolean;
}

/**
 * A wall clock as text: whatever is typed is normalised on blur or Enter, an exact `HH:mm`
 * lands at once. A list in quarter-hour steps narrows as you type; ↑/↓ nudge by five minutes.
 * The field and the list show the locale's 12- or 24-hour clock; the value is always `HH:mm`.
 */
export function TimePicker({
  id,
  value,
  onChange,
  onBlur,
  onPick,
  placeholder,
  className,
  twelveHours = localeTwelveHours,
  ...rest
}: TimePickerProps) {
  const label = (step: string) => (twelveHours && step !== '' ? clockLabel(step) : step);
  const [text, setText] = useState(label(value));

  // A value that arrives from outside replaces what was typed.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(label(value));
  }

  const query = text.replace(/\s/g, '').toLowerCase();
  const options =
    query === '' || text === label(value)
      ? steps
      : steps.filter(
          (step) =>
            step.startsWith(query) ||
            step.replace(/^0/, '').startsWith(query) ||
            label(step).replace(/\s/g, '').toLowerCase().startsWith(query),
        );

  function commit() {
    const normalised = text.trim() === '' ? '' : normaliseClock(text);
    if (normalised === null) {
      setText(label(value));
      return;
    }
    setText(label(normalised));
    if (normalised !== value) onChange(normalised);
  }

  function pick(step: string) {
    setText(label(step));
    onChange(step);
  }

  return (
    <Autocomplete
      id={id}
      data-slot="time-picker"
      variant="ghost"
      inputMode="numeric"
      placeholder={placeholder}
      value={text}
      options={options}
      selected={value}
      label={label}
      onPick={(step) => {
        pick(step);
        onPick?.(step);
      }}
      className={cn('tabular-nums', className)}
      listClassName="min-w-28"
      onValueChange={(next) => {
        setText(next);
        if (isClock(next)) onChange(next);
      }}
      onBlur={() => {
        commit();
        onBlur?.();
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          pick(
            nudgeClock(
              normaliseClock(text) ?? value ?? '00:00',
              event.key === 'ArrowUp' ? NUDGE_MINUTES : -NUDGE_MINUTES,
            ),
          );
        } else if (event.key === 'Enter') {
          // Enter normalises first; a second Enter reaches the form.
          if (text !== label(value)) event.preventDefault();
          commit();
        }
      }}
      {...rest}
    />
  );
}
