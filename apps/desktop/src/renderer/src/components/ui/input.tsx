import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { ghostStates } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const subtleRest = 'bg-muted dark:bg-input/30';

const inputVariants = cva(
  [
    'w-full min-w-0 rounded-md bg-transparent transition-[color,background-color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
    ghostStates,
  ],
  {
    variants: {
      // `subtle` rests on a fill, so a field reads as one; `ghost` rests transparent, inside a row.
      variant: { subtle: subtleRest, ghost: '' },
      // Sits in a row at the text size it inherits.
      inline: {
        false:
          'h-9 px-3 py-1 text-base focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:ring-destructive/40',
        true: 'h-auto px-2 py-1',
      },
    },
    defaultVariants: { variant: 'subtle', inline: false },
  },
);

export type EditableVariant = NonNullable<VariantProps<typeof inputVariants>['variant']>;

type InputProps = React.ComponentProps<'input'> & VariantProps<typeof inputVariants>;

function Input({ className, type, variant, inline, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      data-variant={variant ?? 'subtle'}
      className={cn(inputVariants({ variant, inline }), className)}
      {...props}
    />
  );
}

export { Input, type InputProps };
