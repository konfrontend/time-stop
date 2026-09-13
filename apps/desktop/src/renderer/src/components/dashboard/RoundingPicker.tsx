import { useId, useState } from 'react';
import { ChevronDown, Timer } from 'lucide-react';
import type { Rounding } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type Step = Exclude<Rounding, 'none'>;

const steps: ReadonlyArray<{ value: Step; label: string }> = [
  { value: '15m', label: '15 min' },
  { value: '30m', label: '30 min' },
];

interface RoundingPickerProps {
  value: Rounding;
  onChange: (rounding: Rounding) => void;
}

/** Rounding on or off as a Toggle; the step behind a chevron, remembered while off. */
export function RoundingPicker({ value, onChange }: RoundingPickerProps) {
  const id = useId();
  // The step last used, so switching Rounding back on restores it.
  const [remembered, setRemembered] = useState<Step>(value === 'none' ? '15m' : value);
  const on = value !== 'none';
  const step = on ? value : remembered;

  return (
    <div className="flex items-center" data-slot="rounding-picker">
      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle
            size="sm"
            aria-label="Rounding"
            pressed={on}
            onPressedChange={(pressed) => {
              if (!pressed) setRemembered(step);
              onChange(pressed ? step : 'none');
            }}
          >
            <Timer />
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>
          {on ? `Rounded to ${steps.find((s) => s.value === step)?.label}` : 'Round Durations'}
        </TooltipContent>
      </Tooltip>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Rounding step" className="-ml-1">
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 p-3">
          <Field>
            <FieldLabel htmlFor={`${id}-step`}>Round to</FieldLabel>
            <Select
              value={step}
              onValueChange={(next) => {
                setRemembered(next as Step);
                if (on) onChange(next as Step);
              }}
            >
              <SelectTrigger id={`${id}-step`} size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {steps.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </PopoverContent>
      </Popover>
    </div>
  );
}
