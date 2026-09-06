import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { Period } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { rangeLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RangeNavProps {
  range: Period;
  from: number;
  to: number;
  onStep: (steps: number) => void;
  onRange: (range: Period) => void;
}

const periods: Period[] = ['week', 'month'];

export function RangeNav({ range, from, to, onStep, onRange }: RangeNavProps) {
  return (
    <div className="flex items-center gap-2" data-slot="range-nav">
      <Button variant="ghost" size="icon" aria-label="Previous" onClick={() => onStep(-1)}>
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-32 flex-1 text-center text-sm font-semibold" data-slot="range-label">
        {rangeLabel(range, from, to)}
      </span>
      <Button variant="ghost" size="icon" aria-label="Next" onClick={() => onStep(1)}>
        <ChevronRightIcon />
      </Button>
      <div className="flex rounded-md bg-muted p-0.5" role="group" aria-label="Range">
        {periods.map((period) => (
          <button
            key={period}
            type="button"
            aria-pressed={range === period}
            onClick={() => onRange(period)}
            className={cn(
              'rounded-sm px-2.5 py-1 text-xs font-medium capitalize',
              range === period ? 'bg-background shadow-xs' : 'text-muted-foreground',
            )}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  );
}
