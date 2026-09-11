import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { Period } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { rangeLabel } from '@/lib/format';
import { Segmented } from './Segmented';

interface RangeNavProps {
  period: Period;
  from: string;
  to: string;
  onStep: (steps: number) => void;
  onPeriod: (period: Period) => void;
}

const periods = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
] as const;

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
      <Segmented label="Period" value={period} options={periods} onChange={onPeriod} />
    </div>
  );
}
