import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { keepOpenOnDirtyEscape } from '@/hooks/useAutoApply';
import { cn } from '@/lib/utils';

interface AspectProps {
  icon: React.ReactNode;
  label: string;
  // Replaces the label once the aspect is set.
  summary: string | null;
  invalid?: boolean | undefined;
  disabled?: boolean | undefined;
  // Where an auto-apply editor commits the aspect's fields as a unit.
  onClose?: (() => void) | undefined;
  children: React.ReactNode;
}

/**
 * An optional aspect of a form, folded behind a ghost button like the Dashboard's Rounding:
 * muted while unset, filled with its summary once set; the fields live in a nested Popover.
 */
export function Aspect({
  icon,
  label,
  summary,
  invalid,
  disabled,
  onClose,
  children,
}: AspectProps) {
  const active = summary !== null;
  return (
    <Popover onOpenChange={(open) => !open && onClose?.()}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-slot="aspect"
          aria-pressed={active}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            'text-muted-foreground',
            invalid && 'text-destructive aria-pressed:text-destructive',
          )}
        >
          {icon}
          {summary ?? label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex w-72 flex-col gap-3"
        onEscapeKeyDown={keepOpenOnDirtyEscape}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
