import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type IconButtonProps = Omit<React.ComponentProps<typeof Button>, 'aria-label'> & {
  // The accessible name, and the Tooltip unless `tooltip` says more.
  label: string;
  tooltip?: React.ReactNode;
  side?: React.ComponentProps<typeof TooltipContent>['side'];
};

/**
 * An icon-only `Button` named by its label, with the Tooltip every icon-only button carries. Props
 * a wrapping `asChild` trigger merges in reach the button.
 */
export function IconButton({
  label,
  tooltip = label,
  side = 'top',
  variant = 'ghost-icon',
  size = 'icon-sm',
  ...props
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} size={size} aria-label={label} {...props} />
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
