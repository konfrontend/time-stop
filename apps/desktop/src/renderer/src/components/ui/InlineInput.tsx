import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
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
 * Enter or blur commits the trimmed value, Escape gives up on it.
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
  const [draft, setDraft] = useState<string | null>(null);
  // Escape blurs the input, whose blur must then not commit.
  const cancelled = useRef(false);

  function settle(input: HTMLInputElement) {
    if (!cancelled.current && draft !== null && draft.trim() !== value) onCommit(draft.trim());
    cancelled.current = false;
    setDraft(null);
    // A long value rests on its head, cut with an ellipsis.
    input.scrollLeft = 0;
    onClose?.();
  }

  return (
    <Input
      autoFocus={open}
      aria-label={label}
      data-slot={slot}
      data-variant={variant}
      value={draft ?? value}
      placeholder={placeholder}
      className={cn(
        'h-auto rounded-md px-2 py-1 text-sm text-ellipsis shadow-none focus-visible:ring-0 md:text-sm',
        variant === 'subtle' && 'bg-muted',
        className,
      )}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => settle(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          cancelled.current = true;
          event.currentTarget.blur();
        }
      }}
    />
  );
}
