import { Button } from '@/components/ui/button';
import { PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Confirm {
  label: string;
  variant?: 'default' | 'destructive';
  disabled?: boolean | undefined;
  onConfirm: () => void;
}

interface ConfirmPopoverProps extends React.ComponentProps<typeof PopoverContent> {
  // What confirming does, or what to double-check first.
  note?: React.ReactNode;
  failures?: string[] | undefined;
  // Absent when the Popover only reports failures.
  confirm?: Confirm | undefined;
  onCancel?: (() => void) | undefined;
}

/**
 * The content of a Popover that asks before acting and reports what went wrong, so warnings and
 * failures never push a form's layout around. `children` render above the note.
 */
export function ConfirmPopover({
  note,
  failures = [],
  confirm,
  onCancel,
  className,
  children,
  ...props
}: ConfirmPopoverProps) {
  return (
    <PopoverContent
      align="end"
      collisionPadding={8}
      className={cn('flex w-64 flex-col gap-3 text-sm', className)}
      {...props}
    >
      {children}
      {note && <p className="font-medium">{note}</p>}
      {failures.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 text-destructive">
          {failures.map((failure) => (
            <li key={failure}>{failure}</li>
          ))}
        </ul>
      )}
      {confirm && (
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant={confirm.variant ?? 'default'}
            size="sm"
            disabled={confirm.disabled}
            onClick={confirm.onConfirm}
          >
            {confirm.label}
          </Button>
        </div>
      )}
    </PopoverContent>
  );
}
