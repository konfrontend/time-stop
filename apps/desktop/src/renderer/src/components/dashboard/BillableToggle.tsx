import GoldBars from '~icons/streamline-ultimate-color/gold-bars';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BillableToggleProps {
  value: boolean;
  onChange: (billable: boolean) => void;
}

/** The gold icon narrows the view to Billable Records; it stays highlighted while it does. */
export function BillableToggle({ value, onChange }: BillableToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost-icon"
          size="icon-sm"
          aria-label="Billable only"
          aria-pressed={value}
          data-slot="billable-toggle"
          className={cn(
            'text-muted-foreground',
            value && 'bg-accent text-accent-foreground dark:bg-accent',
          )}
          onClick={() => onChange(!value)}
        >
          <GoldBars className="size-5.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Billable only</TooltipContent>
    </Tooltip>
  );
}
