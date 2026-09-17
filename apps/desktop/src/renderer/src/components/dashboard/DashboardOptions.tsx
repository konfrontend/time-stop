import GoldBars from '~icons/streamline-ultimate-color/gold-bars';
import type { Rounding } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { RoundingPicker } from './RoundingPicker';

interface DashboardOptionsProps {
  billable: boolean;
  rounding: Rounding;
  onBillable: (billable: boolean) => void;
  onRounding: (rounding: Rounding) => void;
}

/** Billable only and Rounding, beside the RangeNav. */
export function DashboardOptions({
  billable,
  rounding,
  onBillable,
  onRounding,
}: DashboardOptionsProps) {
  return (
    <div className="flex items-center gap-1" data-slot="dashboard-options">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost-icon"
            size="icon-sm"
            aria-label="Billable only"
            aria-pressed={billable}
            className={cn(
              'text-muted-foreground',
              billable && 'bg-accent text-accent-foreground dark:bg-accent',
            )}
            onClick={() => onBillable(!billable)}
          >
            <GoldBars className="size-5.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Billable only</TooltipContent>
      </Tooltip>
      <RoundingPicker value={rounding} onChange={onRounding} />
    </div>
  );
}
