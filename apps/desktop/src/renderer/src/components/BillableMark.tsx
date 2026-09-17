import GoldBars from '~icons/streamline-ultimate-color/gold-bars';
import { cn } from '@/lib/utils';

/** The gold bars: what marks Billable time wherever it is shown. */
export function BillableMark({ className }: { className?: string }) {
  return (
    <GoldBars
      className={cn('size-4.5 shrink-0', className)}
      role="img"
      aria-label="Billable"
      title="Billable"
      data-slot="billable"
    />
  );
}
