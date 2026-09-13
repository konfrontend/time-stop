import { useEffect, useId, useRef, useState } from 'react';
import type { Record } from '@time-stop/domain';
import { Field, FieldLabel } from '@/components/ui/field';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { useRecentNames } from '@/hooks/useDashboard';
import { useUpdateRecordName } from '@/hooks/useTimer';
import { cn } from '@/lib/utils';

const NAME_SAVE_DELAY_MS = 400;

interface NameFieldProps {
  // The running Timer; absent on standby, when the field holds the Name of the Timer to come.
  timer: Record | null;
  projectId: string | null;
  draft: string;
  onDraftChange: (draft: string) => void;
}

/**
 * Names the current Record only: the Timer while one runs, otherwise the one the next Start
 * creates. Recent Names of the Project are offered on focus so repeated work keeps one Name.
 * Remount per Timer.
 */
export function NameField({ timer, projectId, draft, onDraftChange }: NameFieldProps) {
  const id = useId();
  const [local, setLocal] = useState(timer?.name ?? '');
  const name = timer ? local : draft;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const update = useUpdateRecordName();
  const recent = useRecentNames(projectId);
  const saved = useRef(timer?.name ?? '');
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const query = name.trim().toLowerCase();
  const suggestions = (recent.data ?? []).filter(
    (option) => option.toLowerCase().includes(query) && option !== name,
  );
  const showing = open && suggestions.length > 0;

  function save(value: string) {
    clearTimeout(timeout.current);
    if (!timer || value === saved.current) return;
    saved.current = value;
    update.mutate({ id: timer.id, name: value });
  }

  function change(value: string) {
    setHighlight(0);
    if (!timer) {
      onDraftChange(value);
      return;
    }
    setLocal(value);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => save(value), NAME_SAVE_DELAY_MS);
  }

  function pick(value: string) {
    setOpen(false);
    if (timer) {
      setLocal(value);
      save(value);
    } else {
      onDraftChange(value);
    }
  }

  useEffect(() => () => clearTimeout(timeout.current), []);

  // A Name that arrives from outside (the Start carrying the draft, the tray) replaces the field.
  const outside = timer?.name;
  useEffect(() => {
    if (outside !== undefined && outside !== saved.current) {
      saved.current = outside;
      setLocal(outside);
    }
  }, [outside]);

  return (
    <Popover open={showing} onOpenChange={setOpen}>
      <Field>
        <FieldLabel htmlFor={id} className="sr-only">
          Name
        </FieldLabel>
        <PopoverAnchor asChild>
          <input
            id={id}
            data-slot="name-field"
            role="combobox"
            aria-expanded={showing}
            aria-controls={`${id}-names`}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={timer ? 'What are you working on now?' : 'What will you work on?'}
            value={name}
            className="w-full border-b border-transparent bg-transparent py-1 text-center text-[15px] outline-none placeholder:text-muted-foreground/60 focus:border-border"
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setOpen(false);
              if (timer) save(local);
            }}
            onChange={(event) => {
              setOpen(true);
              change(event.target.value);
            }}
            onKeyDown={(event) => {
              if (!showing) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setHighlight((index) => (index + 1) % suggestions.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setHighlight((index) => (index + suggestions.length - 1) % suggestions.length);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                pick(suggestions[highlight] ?? suggestions[0]!);
              } else if (event.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
        </PopoverAnchor>
      </Field>
      <PopoverContent
        id={`${id}-names`}
        role="listbox"
        align="center"
        sideOffset={4}
        className="max-h-56 w-72 overflow-y-auto p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (event.target instanceof Node && document.getElementById(id)?.contains(event.target))
            event.preventDefault();
        }}
      >
        {suggestions.map((option, index) => (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={index === highlight}
            className={cn(
              'block w-full truncate rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent',
              index === highlight && 'bg-accent text-accent-foreground',
            )}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setHighlight(index)}
            onClick={() => pick(option)}
          >
            {option}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
