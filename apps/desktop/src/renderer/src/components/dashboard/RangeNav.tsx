import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { Period } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { rangeLabel } from '@/lib/format';

interface RangeNavProps {
  period: Period;
  from: string;
  to: string;
  onStep: (steps: number) => void;
  onPeriod: (period: Period) => void;
}

export function RangeNav({ period, from, to, onStep, onPeriod }: RangeNavProps) {
  return (
    <div className="flex items-center gap-2" data-slot="range-nav">
      <Button variant="ghost" size="icon" aria-label="Previous" onClick={() => onStep(-1)}>
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-32 flex-1 text-center text-sm font-semibold" data-slot="range-label">
        {rangeLabel(period, from, to)}
      </span>
      <Button variant="ghost" size="icon" aria-label="Next" onClick={() => onStep(1)}>
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
    </div>
  );
}
