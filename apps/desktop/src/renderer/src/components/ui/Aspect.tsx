import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AspectProps {
  icon: React.ReactNode;
  label: string;
  // Replaces the label once the aspect is set.
  summary: string | null;
  invalid?: boolean | undefined;
  children: React.ReactNode;
}

/**
 * An optional aspect of a form, folded behind a ghost button like the Dashboard's Rounding:
 * muted while unset, filled with its summary once set; the fields live in a nested Popover.
 */
export function Aspect({ icon, label, summary, invalid, children }: AspectProps) {
  const active = summary !== null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={active}
          aria-invalid={invalid || undefined}
          className={cn(
            'text-muted-foreground',
            active && 'bg-accent text-accent-foreground dark:bg-accent/50',
            invalid && 'text-destructive',
          )}
        >
          {icon}
          {summary ?? label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={8} className="flex w-72 flex-col gap-3">
        {children}
      </PopoverContent>
    </Popover>
  );
}
