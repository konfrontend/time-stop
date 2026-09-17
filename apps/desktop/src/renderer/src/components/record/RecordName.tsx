import { useRef, useState } from 'react';
import { UNTITLED_RECORD } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RecordNameProps {
  name: string;
  onRename: (name: string) => void;
  // Opens the input without a click, for a Record that was just added; cleared through `onClose`.
  open?: boolean;
  onClose?: (() => void) | undefined;
  className?: string;
}

/** A Record's Name, edited in place: Enter or blur saves the trimmed Name, Escape gives up. */
export function RecordName({ name, onRename, open = false, onClose, className }: RecordNameProps) {
  const [draft, setDraft] = useState<string | null>(null);
  // Escape unmounts the input, whose blur must then not save.
  const cancelled = useRef(false);

  function close() {
    cancelled.current = false;
    setDraft(null);
    onClose?.();
  }

  function save() {
    if (!cancelled.current && draft !== null && draft.trim() !== name) onRename(draft.trim());
    close();
  }

  if (draft === null && !open) {
    return (
      <button
        type="button"
        aria-label="Edit Name"
        data-slot="record-name"
        className={cn(
          '-mx-1 h-5 max-w-full min-w-0 truncate rounded-sm px-1 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted',
          !name && 'text-muted-foreground/60',
          className,
        )}
        onClick={() => setDraft(name)}
      >
        {name || UNTITLED_RECORD}
      </button>
    );
  }
  return (
    <input
      autoFocus
      aria-label="Name"
      value={draft ?? name}
      placeholder={UNTITLED_RECORD}
      className="-mx-1 h-5 w-[calc(100%+0.5rem)] rounded-sm border-0 bg-accent px-1 text-sm outline-none placeholder:text-muted-foreground/60"
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
