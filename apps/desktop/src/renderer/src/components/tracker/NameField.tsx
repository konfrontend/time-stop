import { useEffect, useId } from 'react';
import type { Record } from '@time-stop/domain';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { Field, FieldLabel } from '@/components/ui/field';
import { useAutoApply } from '@/hooks/useAutoApply';
import { useRecentNames } from '@/hooks/useDashboard';
import { useUpdateRecordName } from '@/hooks/useTimer';
import { nameSuggestions } from '@/lib/nameSuggestions';
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
 * A running Timer's Name is an auto-apply field that also saves while typing, after a pause, so
 * it has no Escape: there is no draft to give up. It lies over the dial face, which is a button
 * and cannot hold an input. Remount per Timer.
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
  const update = useUpdateRecordName();
  const field = useAutoApply({
    saved: timer?.name ?? '',
    validate: () => [],
    save: (name: string) =>
      timer ? update.mutateAsync({ id: timer.id, name }) : Promise.resolve(),
  });
  const name = timer ? field.draft : draft;
  const recent = useRecentNames(projectId);

  const suggestions = nameSuggestions(recent.data ?? [], name);

  const running = timer !== null;
  const { commit } = field;
  useEffect(() => {
    if (!running) return;
    const timeout = setTimeout(() => void commit(), NAME_SAVE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [running, field.draft, commit]);

  function pick(value: string) {
    if (timer) {
      void field.commit(value);
      return;
    }
    onDraftChange(value);
    onSubmit(value);
  }

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
        inline
        placeholder={placeholder}
        value={name}
        options={suggestions}
        align="center"
        className={cn(
          'text-center text-[15px] font-medium text-ellipsis',
          timer
            ? 'text-primary-foreground placeholder:text-primary-foreground/50 hover:bg-primary-foreground/10 focus-visible:bg-primary-foreground/15'
            : 'placeholder:text-muted-foreground/60 hover:bg-muted focus-visible:bg-accent',
        )}
        listClassName="w-72"
        onValueChange={timer ? field.setDraft : onDraftChange}
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
          if (timer) void field.commit();
        }}
      />
    </Field>
  );
}
