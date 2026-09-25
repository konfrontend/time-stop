import { useState } from 'react';
import ArrowButtonUp from '~icons/streamline-ultimate-color/arrow-button-up';
import type { Period } from '@app/domain';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/IconButton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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

/** `‹ label ›`; the label opens the Period toggle over a picker for another week or month. */
export function RangeNav({ period, anchor, from, to, onStep, onPeriod, onAnchor }: RangeNavProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1" data-slot="range-nav">
      <IconButton label="Previous" onClick={() => onStep(-1)}>
        <ArrowButtonUp className="-rotate-90" />
      </IconButton>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-34 truncate px-2 font-semibold"
            data-slot="range-label"
          >
            {rangeLabel(period, from, to)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <div className="p-2 pb-0">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={period}
              aria-label="Period"
              data-slot="period-toggle"
              className="w-full [&>*]:flex-1"
              onValueChange={(value) => value && onPeriod(value as Period)}
            >
              <ToggleGroupItem value="week">Week</ToggleGroupItem>
              <ToggleGroupItem value="month">Month</ToggleGroupItem>
            </ToggleGroup>
          </div>
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
      <IconButton label="Next" onClick={() => onStep(1)}>
        <ArrowButtonUp className="rotate-90" />
      </IconButton>
    </div>
  );
}
