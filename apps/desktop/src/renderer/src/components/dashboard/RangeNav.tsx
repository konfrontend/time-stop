import { useState } from 'react';
import ArrowRight from '~icons/streamline-ultimate-color/arrow-right';
import NavigationLeft from '~icons/streamline-ultimate-color/navigation-left';
import type { Period } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { rangeLabel } from '@/lib/format';
import { PeriodPicker } from './PeriodPicker';

interface RangeNavProps {
  period: Period;
  // The first day of the Range, `YYYY-MM-DD`.
  anchor: string;
  from: string;
  to: string;
  onStep: (steps: number) => void;
  onPeriod: (period: Period) => void;
  onAnchor: (anchor: string) => void;
}

/** `‹ label › [Period]`; the label opens a picker for another week or month. */
export function RangeNav({ period, anchor, from, to, onStep, onPeriod, onAnchor }: RangeNavProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1" data-slot="range-nav">
      <Button variant="ghost-icon" size="icon-sm" aria-label="Previous" onClick={() => onStep(-1)}>
        <NavigationLeft />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="min-w-0 truncate font-semibold"
            data-slot="range-label"
          >
            {rangeLabel(period, from, to)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <PeriodPicker
            period={period}
            anchor={anchor}
            onAnchor={(next) => {
              onAnchor(next);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      <Button variant="ghost-icon" size="icon-sm" aria-label="Next" onClick={() => onStep(1)}>
        <ArrowRight />
      </Button>
      <Select value={period} onValueChange={(value) => onPeriod(value as Period)}>
        <SelectTrigger size="sm" aria-label="Period" className="ml-1 h-7 px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="week">Week</SelectItem>
          <SelectItem value="month">Month</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
