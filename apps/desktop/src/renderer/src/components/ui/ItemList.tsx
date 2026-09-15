import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { cn } from '@/lib/utils';

/** Renders the form of a Popover; `close` dismisses it once the form is done. */
export type PopoverForm = (close: () => void) => React.ReactNode;

const formPopoverClass = 'max-h-(--radix-popover-content-available-height) w-80 overflow-y-auto';

interface ItemListProps {
  title: string;
  newLabel: string;
  newForm: PopoverForm;
  // Sits between the title and the + button.
  aside?: React.ReactNode;
  empty?: string | undefined;
  slot: string;
  children: React.ReactNode;
}

/** A heading with a + that opens the empty form, over a bordered list of rows. */
export function ItemList({
  title,
  newLabel,
  newForm,
  aside,
  empty,
  slot,
  children,
}: ItemListProps) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="flex flex-col gap-1.5" data-slot={slot}>
      <div className="flex h-8 items-center gap-1 px-1">
        <SectionTitle>{title}</SectionTitle>
        <span className="ml-auto" />
        {aside}
        <Popover open={adding} onOpenChange={setAdding}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={newLabel}
                  className="text-muted-foreground"
                >
                  <Plus />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>{newLabel}</TooltipContent>
          </Tooltip>
          <PopoverContent align="end" collisionPadding={8} className={formPopoverClass}>
            {newForm(() => setAdding(false))}
          </PopoverContent>
        </Popover>
      </div>
      {empty ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div role="list" className="divide-y overflow-hidden rounded-lg border">
          {children}
        </div>
      )}
    </section>
  );
}

interface ItemRowProps {
  form: PopoverForm;
  // Shown at the row's end on hover and focus only.
  aside?: React.ReactNode;
  className?: string | undefined;
  children: React.ReactNode;
}

/** One row of an ItemList; clicking it opens its form in a Popover below. */
export function ItemRow({ form, aside, className, children }: ItemRowProps) {
  const [open, setOpen] = useState(false);
  return (
    <div role="listitem" className={cn('group/row relative flex items-center', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex min-h-9 flex-1 items-center gap-2 px-3 py-1.5 text-left text-sm outline-none hover:bg-accent/50 focus-visible:bg-accent/50 data-[state=open]:bg-accent',
              aside && 'pr-10',
            )}
          >
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          collisionPadding={8}
          className={formPopoverClass}
        >
          {form(() => setOpen(false))}
        </PopoverContent>
      </Popover>
      {aside && (
        <div className="absolute right-1 flex opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 has-[[data-state=open]]:opacity-100">
          {aside}
        </div>
      )}
    </div>
  );
}
