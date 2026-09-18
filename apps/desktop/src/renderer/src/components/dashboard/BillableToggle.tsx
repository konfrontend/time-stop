import GoldBars from '~icons/streamline-ultimate-color/gold-bars';
import { IconButton } from '@/components/ui/IconButton';

interface BillableToggleProps {
  value: boolean;
  onChange: (billable: boolean) => void;
}

/** The gold icon narrows the view to Billable Records; it stays highlighted while it does. */
export function BillableToggle({ value, onChange }: BillableToggleProps) {
  return (
    <IconButton
      label="Billable only"
      aria-pressed={value}
      data-slot="billable-toggle"
      onClick={() => onChange(!value)}
    >
      <GoldBars className="size-5.5" />
    </IconButton>
  );
}
