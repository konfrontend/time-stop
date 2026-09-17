import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface InlineInputProps {
  value: string;
  onCommit: (value: string) => void;
  /** Names the resting button as "Edit {label}" and the input as "{label}". */
  label: string;
  // Stands in for an empty value, at rest and while editing.
  placeholder?: string | undefined;
  slot: string;
  // Opens the input without a click, for a row that was just added; cleared through `onClose`.
  open?: boolean;
  onClose?: (() => void) | undefined;
  // Sizing and weight, which both states share.
  className?: string | undefined;
}

/**
 * The app's inline input: one text value edited where it is read, with no field chrome around it.
 * Enter or blur commits the trimmed value, Escape gives up.
 */
export function InlineInput({
  value,
  onCommit,
  label,
  placeholder,
  slot,
  open = false,
  onClose,
  className,
}: InlineInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape unmounts the input, whose blur must then not commit.
  const cancelled = useRef(false);

  function close() {
    cancelled.current = false;
    setDraft(null);
    onClose?.();
  }

  function save() {
    if (!cancelled.current && draft !== null && draft.trim() !== value) onCommit(draft.trim());
    close();
  }

  if (draft === null && !open) {
    return (
      <button
        type="button"
        aria-label={`Edit ${label}`}
        data-slot={slot}
        className={cn(
          '-mx-1 max-w-full min-w-0 truncate rounded-sm px-1 text-left outline-none hover:bg-muted focus-visible:bg-muted',
          !value && 'text-muted-foreground/60',
          className,
        )}
        onClick={() => setDraft(value)}
      >
        {value || placeholder}
      </button>
    );
  }
  return (
    <input
      autoFocus
      aria-label={label}
      value={draft ?? value}
      placeholder={placeholder}
      className={cn(
        '-mx-1 w-[calc(100%+0.5rem)] rounded-sm border-0 bg-accent px-1 outline-none placeholder:text-muted-foreground/60',
        className,
      )}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          save();
        } else if (event.key === 'Escape') {
          cancelled.current = true;
          close();
        }
      }}
    />
  );
}
