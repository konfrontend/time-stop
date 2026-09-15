import { useState } from 'react';
import AddCircleBold from '~icons/streamline-ultimate-color/add-circle-bold';
import ArrowButtonUp from '~icons/streamline-ultimate-color/arrow-button-up';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemGroup } from '@/components/ui/item';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { keepOpenOnDirtyEscape } from '@/hooks/useAutoApply';
import { cn } from '@/lib/utils';

/** Renders the form of a Popover; `close` dismisses it once the form is done. */
export type PopoverForm = (close: () => void) => React.ReactNode;

/** Props of the `PopoverContent` of an auto-apply editor. */
export const editorPopoverProps = {
  collisionPadding: 8,
  className: 'max-h-(--radix-popover-content-available-height) w-80 overflow-y-auto',
  overlay: true,
  onEscapeKeyDown: keepOpenOnDirtyEscape,
} as const;

interface ItemListProps {
  title: string;
  newLabel: string;
  newForm: PopoverForm;
  // Sits between the title and the + button.
  aside?: React.ReactNode;
  // Shown instead of the rows and the +, with a CTA that opens the same form as the +.
  empty?: { title: string; cta: string } | undefined;
  slot: string;
  children: React.ReactNode;
}

/**
 * A collapsible heading over gapped rows. The + is a hover-reveal action of the whole section; an
 * empty section shows its empty state instead.
 */
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
    <Popover open={adding} onOpenChange={setAdding}>
      <Collapsible defaultOpen asChild>
        <section className="group/section flex flex-col gap-1.5" data-slot={slot}>
          <div className="flex h-8 items-center gap-1">
            <CollapsibleTrigger className="group/trigger flex items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:bg-muted focus-visible:bg-muted">
              <SectionTitle>{title}</SectionTitle>
              <ArrowButtonUp className="size-3 group-data-[state=open]/trigger:rotate-180" />
            </CollapsibleTrigger>
            <span className="ml-auto" />
            {aside}
            {!empty && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost-icon"
                      size="icon-sm"
                      aria-label={newLabel}
                      className="opacity-0 group-focus-within/section:opacity-100 group-hover/section:opacity-100 aria-expanded:opacity-100"
                    >
                      <AddCircleBold />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>{newLabel}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <CollapsibleContent>
            {empty ? (
              <Empty className="gap-3 p-4 md:p-4">
                <EmptyHeader>
                  <EmptyTitle className="text-sm font-normal text-muted-foreground">
                    {empty.title}
                  </EmptyTitle>
                </EmptyHeader>
                <EmptyContent>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      {empty.cta}
                    </Button>
                  </PopoverTrigger>
                </EmptyContent>
              </Empty>
            ) : (
              <ItemGroup className="gap-1">{children}</ItemGroup>
            )}
          </CollapsibleContent>
        </section>
      </Collapsible>
      <PopoverContent align="end" {...editorPopoverProps}>
        {newForm(() => setAdding(false))}
      </PopoverContent>
    </Popover>
  );
}

interface ItemRowProps {
  form: PopoverForm;
  // Shown at the row's end on hover and focus only.
  aside?: React.ReactNode;
  className?: string | undefined;
  children: React.ReactNode;
}

/** One row of an ItemList; clicking it opens its editor in a Popover below. */
export function ItemRow({ form, aside, className, children }: ItemRowProps) {
  const [open, setOpen] = useState(false);
  return (
    <Item
      variant="muted"
      role="listitem"
      className={cn('group/row relative flex-nowrap gap-0 p-0', className)}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent data-[state=open]:bg-accent',
              aside && 'pr-10',
            )}
          >
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom" {...editorPopoverProps}>
          {form(() => setOpen(false))}
        </PopoverContent>
      </Popover>
      {aside && (
        <div className="absolute right-1 flex opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          {aside}
        </div>
      )}
    </Item>
  );
}
