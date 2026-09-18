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
  // Fires once per settled edit, after `onChange`, with the normalised value: Enter, blur, a pick.
  onCommit?: (value: string) => void;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  autoFocus?: boolean;
  placeholder?: string | undefined;
  'aria-label'?: string | undefined;
  'aria-invalid'?: boolean | undefined;
  // Drops the field's chrome, for a clock edited in place.
  inline?: boolean;
  className?: string | undefined;
  twelveHours?: boolean;
}

/**
 * A wall clock as text: whatever is typed is normalised on blur or Enter, an exact `HH:mm`
 * lands at once, Escape puts the typed text back. A list in quarter-hour steps narrows as you
 * type; ↑/↓ nudge by five minutes. The field and the list show the locale's 12- or 24-hour
 * clock; the value is always `HH:mm`.
 */
export function TimePicker({
  id,
  value,
  onChange,
  onBlur,
  onCommit,
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

  function settle(next: string | null) {
    const clockText = next ?? value;
    setText(label(clockText));
    if (clockText !== value) onChange(clockText);
    onCommit?.(clockText);
  }

  function commit() {
    settle(text.trim() === '' ? '' : normaliseClock(text));
  }

  function nudge(step: string) {
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
      onPick={settle}
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
          nudge(
            nudgeClock(
              normaliseClock(text) ?? value ?? '00:00',
              event.key === 'ArrowUp' ? NUDGE_MINUTES : -NUDGE_MINUTES,
            ),
          );
        } else if (event.key === 'Enter') {
          // Enter normalises first; a second Enter reaches the form.
          if (text !== label(value)) event.preventDefault();
          commit();
        } else if (event.key === 'Escape') {
          setText(label(value));
        }
      }}
      {...rest}
    />
  );
}
