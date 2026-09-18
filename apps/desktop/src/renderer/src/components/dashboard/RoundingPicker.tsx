import Stopwatch from '~icons/streamline-ultimate-color/stopwatch';
import type { Rounding } from '@time-stop/domain';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/ui/IconButton';

const options: ReadonlyArray<{ value: Rounding; label: string }> = [
  { value: 'none', label: 'None' },
  { value: '15m', label: '15 min' },
  { value: '30m', label: '30 min' },
];

interface RoundingPickerProps {
  value: Rounding;
  onChange: (rounding: Rounding) => void;
}

/** The clock icon opens the step menu; the icon stays highlighted while a step is active. */
export function RoundingPicker({ value, onChange }: RoundingPickerProps) {
  const active = value !== 'none';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          label="Rounding"
          tooltip={
            active
              ? `Rounded to ${options.find((o) => o.value === value)?.label}`
              : 'Round Durations'
          }
          aria-pressed={active}
          data-slot="rounding-picker"
        >
          <Stopwatch />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Round to</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as Rounding)}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
