import * as React from 'react';
import { ghostStates } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** `subtle` rests on a fill, so a field reads as one; `ghost` rests transparent, inside a row. */
export type EditableVariant = 'subtle' | 'ghost';

export const subtleRest = 'bg-muted dark:bg-input/30';

function Input({
  className,
  type,
  variant = 'subtle',
  ...props
}: React.ComponentProps<'input'> & { variant?: EditableVariant }) {
  return (
    <input
      type={type}
      data-slot="input"
      data-variant={variant}
      className={cn(
        'h-9 w-full min-w-0 rounded-md bg-transparent px-3 py-1 text-base transition-[color,background-color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        variant === 'subtle' && subtleRest,
        ghostStates,
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
