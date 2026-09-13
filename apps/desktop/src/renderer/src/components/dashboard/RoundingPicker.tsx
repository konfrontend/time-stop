import { Timer } from 'lucide-react';
import type { Rounding } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Rounding"
              aria-pressed={active}
              data-slot="rounding-picker"
              className={cn(
                'text-muted-foreground',
                active && 'bg-accent text-accent-foreground dark:bg-accent/50',
              )}
            >
              <Timer />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {active
            ? `Rounded to ${options.find((o) => o.value === value)?.label}`
            : 'Round Durations'}
        </TooltipContent>
      </Tooltip>
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
