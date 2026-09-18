import { Input } from '@/components/ui/input';
import { textInputProps, trimmedEquals, useAutoApply } from '@/hooks/useAutoApply';
import { cn } from '@/lib/utils';

interface InlineInputProps {
  value: string;
  onCommit: (value: string) => void;
  // Names the input, which carries no visible label.
  label: string;
  // Stands in for an empty value.
  placeholder?: string | undefined;
  slot: string;
  /**
   * `ghost` rests transparent, for a value that reads as text until it is hovered. `subtle` keeps a
   * resting fill, so an input standing on its own is not left hanging in empty space.
   */
  variant?: 'ghost' | 'subtle';
  // Takes focus on mount, for a row that was just added; the caller clears it through `onClose`.
  open?: boolean;
  onClose?: (() => void) | undefined;
  // Sizing and weight.
  className?: string | undefined;
}

/**
 * The app's inline input: a shadcn `Input` with no field chrome, edited where the value is read.
 * An auto-apply text field whose Enter and Escape also leave it, since leaving is the natural end
 * of an edit made in place. `onCommit` takes the trimmed value.
 */
export function InlineInput({
  value,
  onCommit,
  label,
  placeholder,
  slot,
  variant = 'ghost',
  open = false,
  onClose,
  className,
}: InlineInputProps) {
  const field = useAutoApply({
    saved: value,
    validate: () => [],
    save: async (draft: string) => onCommit(draft.trim()),
    equals: trimmedEquals,
  });
  const { errors: _errors, ...input } = textInputProps(field);

  return (
    <Input
      autoFocus={open}
      aria-label={label}
      data-slot={slot}
      placeholder={placeholder}
      variant={variant}
      inline
      className={cn('text-sm text-ellipsis', className)}
      {...input}
      onBlur={(event) => {
        input.onBlur();
        // At rest the input shows the saved value: a committed draft comes back as the new one.
        field.revert();
        // A long value rests on its head, cut with an ellipsis.
        event.currentTarget.scrollLeft = 0;
        onClose?.();
      }}
      onKeyDown={(event) => {
        input.onKeyDown(event);
        if (event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
