import { ChevronLeftIcon, ChevronRightIcon, Plus } from 'lucide-react';
import type { Period } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { rangeLabel } from '@/lib/format';

interface RangeNavProps {
  period: Period;
  from: string;
  to: string;
  onStep: (steps: number) => void;
  onPeriod: (period: Period) => void;
  onAdd: () => void;
}

export function RangeNav({ period, from, to, onStep, onPeriod, onAdd }: RangeNavProps) {
  return (
    <div className="flex items-center gap-1" data-slot="range-nav">
      <Button variant="ghost" size="icon-sm" aria-label="Previous" onClick={() => onStep(-1)}>
        <ChevronLeftIcon />
      </Button>
      <span
        className="min-w-0 flex-1 truncate text-center text-sm font-semibold"
        data-slot="range-label"
      >
        {rangeLabel(period, from, to)}
      </span>
      <Button variant="ghost" size="icon-sm" aria-label="Next" onClick={() => onStep(1)}>
        <ChevronRightIcon />
      </Button>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Period"
        value={period}
        onValueChange={(value) => value && onPeriod(value as Period)}
      >
        <ToggleGroupItem value="week">Week</ToggleGroupItem>
        <ToggleGroupItem value="month">Month</ToggleGroupItem>
      </ToggleGroup>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Add Record" onClick={onAdd}>
            <Plus />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Add Record</TooltipContent>
      </Tooltip>
    </div>
  );
}
