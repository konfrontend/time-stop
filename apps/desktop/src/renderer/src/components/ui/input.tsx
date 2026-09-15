import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-md bg-transparent px-3 py-1 text-base transition-[color,background-color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground dark:hover:bg-accent/50 dark:focus-visible:bg-accent/50 dark:data-[state=open]:bg-accent/50',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:shadow-[inset_0_-2px_0_var(--destructive)] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
