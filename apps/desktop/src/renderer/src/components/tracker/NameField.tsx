import { useEffect, useId, useRef, useState } from 'react';
import type { Record } from '@time-stop/domain';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { Field, FieldLabel } from '@/components/ui/field';
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
  // Enter on standby, or a picked suggestion: the Timer starts or continues under this Name.
  onSubmit: (name: string) => void;
  placeholder: string;
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * Names the current Record only: the Timer while one runs, otherwise the one the next Start
 * creates. Recent Names of the Project are offered on focus so repeated work keeps one Name.
 * It lies over the dial face, which is a button and cannot hold an input. Remount per Timer.
 */
export function NameField({
  timer,
  projectId,
  draft,
  onDraftChange,
  onSubmit,
  placeholder,
  ref,
}: NameFieldProps) {
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
      return;
    }
    onDraftChange(value);
    onSubmit(value);
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
        ref={ref}
        id={id}
        data-slot="name-field"
        variant="ghost"
        placeholder={placeholder}
        value={name}
        options={suggestions}
        align="center"
        className={cn(
          'h-auto rounded-md border-0 bg-transparent px-2 py-1 text-center text-[15px] font-medium text-ellipsis shadow-none focus-visible:ring-0 md:text-[15px] dark:bg-transparent',
          timer
            ? 'text-primary-foreground placeholder:text-primary-foreground/50 hover:bg-primary-foreground/10 focus-visible:bg-primary-foreground/15'
            : 'placeholder:text-muted-foreground/60 hover:bg-muted focus-visible:bg-accent',
        )}
        listClassName="w-72"
        onValueChange={change}
        onPick={pick}
        onKeyDown={(event) => {
          // An arrowed-to suggestion is the Autocomplete's Enter; it comes back through pick.
          if (event.key !== 'Enter' || event.currentTarget.getAttribute('aria-activedescendant'))
            return;
          event.currentTarget.blur();
          if (!timer) onSubmit(name);
        }}
        onBlur={(event) => {
          // A long Name rests on its head, cut with an ellipsis.
          event.currentTarget.scrollLeft = 0;
          if (timer) save(local);
        }}
      />
    </Field>
  );
}
