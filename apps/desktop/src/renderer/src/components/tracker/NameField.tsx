import { useEffect, useId, useRef, useState } from 'react';
import type { Record } from '@time-stop/domain';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { Field, FieldLabel } from '@/components/ui/field';
import { useRecentNames } from '@/hooks/useDashboard';
import { useUpdateRecordName } from '@/hooks/useTimer';

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
  const update = useUpdateRecordName();
  const recent = useRecentNames(projectId);
  const saved = useRef(timer?.name ?? '');
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const query = name.trim().toLowerCase();
  const suggestions = (recent.data ?? []).filter(
    (option) => option.toLowerCase().includes(query) && option !== name,
  );

  function save(value: string) {
    clearTimeout(timeout.current);
    if (!timer || value === saved.current) return;
    saved.current = value;
    update.mutate({ id: timer.id, name: value });
  }

  function change(value: string) {
    if (!timer) {
      onDraftChange(value);
      return;
    }
    setLocal(value);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => save(value), NAME_SAVE_DELAY_MS);
  }

  function pick(value: string) {
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
    <Field>
      <FieldLabel htmlFor={id} className="sr-only">
        Name
      </FieldLabel>
      <Autocomplete
        id={id}
        data-slot="name-field"
        placeholder={timer ? 'What are you working on now?' : 'What are you going to work on?'}
        value={name}
        options={suggestions}
        autoHighlight
        align="center"
        className="h-auto rounded-md px-2 py-1 text-center text-[15px] placeholder:text-muted-foreground/60 hover:bg-muted focus-visible:bg-accent focus-visible:ring-0 md:text-[15px] dark:hover:bg-muted dark:focus-visible:bg-accent"
        listClassName="w-72"
        onValueChange={change}
        onPick={pick}
        onBlur={() => {
          if (timer) save(local);
        }}
      />
    </Field>
  );
}
