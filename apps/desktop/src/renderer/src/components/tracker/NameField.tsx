import { useEffect, useId, useRef, useState } from 'react';
import type { Record } from '@time-stop/domain';
import { Field, FieldLabel } from '@/components/ui/field';
import { useUpdateRecordName } from '@/hooks/useTimer';

const NAME_SAVE_DELAY_MS = 400;

// Always a question that teases a Name out, never an instruction.
const placeholderFor = (record: Record | null) =>
  record === null
    ? 'What are you working on?'
    : record.stop === null
      ? 'What are you working on now?'
      : 'What did you just finish?';

/** Names the Timer, or the last Record stopped today once the Timer is gone. Remount per Record. */
export function NameField({ record }: { record: Record | null }) {
  const id = useId();
  const [name, setName] = useState(record?.name ?? '');
  const update = useUpdateRecordName();
  const saved = useRef(record?.name ?? '');
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  function save(value: string) {
    clearTimeout(timeout.current);
    if (!record || value === saved.current) return;
    saved.current = value;
    update.mutate({ id: record.id, name: value });
  }

  useEffect(() => () => clearTimeout(timeout.current), []);

  return (
    <Field>
      <FieldLabel htmlFor={id} className="sr-only">
        Name
      </FieldLabel>
      <input
        id={id}
        data-slot="name-field"
        placeholder={placeholderFor(record)}
        value={name}
        disabled={!record}
        className="w-full border-b border-transparent bg-transparent py-1 text-center text-[15px] outline-none placeholder:text-muted-foreground/60 focus:border-border disabled:opacity-50"
        onChange={(event) => {
          const value = event.target.value;
          setName(value);
          clearTimeout(timeout.current);
          timeout.current = setTimeout(() => save(value), NAME_SAVE_DELAY_MS);
        }}
        onBlur={() => save(name)}
      />
    </Field>
  );
}
