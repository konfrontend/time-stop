import { useId, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { dayStart } from '@time-stop/domain';
import type { Project, Record } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PopoverContent } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateRecord, useDeleteRecord, useUpdateRecord } from '@/hooks/useDashboard';
import { recordFormSchema, recordFormValues, toRecordFields } from '@/lib/recordForm';
import type { RecordFormValues } from '@/lib/recordForm';
import { NONE, fromSelectValue, toSelectValue } from '@/lib/selectValue';

interface RecordPopoverProps {
  // An existing Record to edit or delete; absent when entering a new one.
  record: Record | undefined;
  workspaceId: string;
  projects: Project[];
  today: string;
  // Prefilled span of a new Record, as clock text.
  defaults: { projectId: string | null; start: string; stop: string };
  onClose: () => void;
}

const PREVIOUS_DAY = 'This Record is from a previous day.';
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Manual entry beside the list: a new Record from the Context, or a fix to one already there. */
export function RecordPopover({
  record,
  workspaceId,
  projects,
  today,
  defaults,
  onClose,
}: RecordPopoverProps) {
  const id = useId();
  const running = record?.stop === null;
  const previousDay = record !== undefined && dayStart(record.start) !== today;
  const [warned, setWarned] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const create = useCreateRecord();
  const update = useUpdateRecord();
  const remove = useDeleteRecord();

  const form = useForm({
    defaultValues: record
      ? recordFormValues({ record })
      : { ...recordFormValues({ day: today, projectId: defaults.projectId }), ...spanOf(defaults) },
    validators: { onSubmit: recordFormSchema(running) },
    onSubmit: async ({ value }) => {
      if (previousDay && !warned) {
        setWarned(true);
        return;
      }
      const fields = toRecordFields(value);
      try {
        if (record) await update.mutateAsync({ id: record.id, ...fields });
        else if (fields.stop === null) throw new Error('Enter a stop time');
        else await create.mutateAsync({ ...fields, stop: fields.stop, workspaceId });
        onClose();
      } catch (error) {
        setFailure(messageOf(error));
      }
    },
  });

  // Warns once about a previous day, like saving; a second click proceeds.
  function removeRecord() {
    if (!record) return;
    if (previousDay && !warned) {
      setWarned(true);
      return;
    }
    void remove.mutateAsync({ id: record.id }).then(onClose, (error: unknown) => {
      setFailure(messageOf(error));
    });
  }

  // Archived Projects are hidden, except the one the Record already sits in.
  const pickable = projects.filter((p) => !p.archived || p.id === record?.projectId);

  function textField(
    name: Exclude<keyof RecordFormValues, 'projectId'>,
    label: string,
    props: React.ComponentProps<'input'> = {},
  ) {
    return (
      <form.Field name={name}>
        {(field) => (
          <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
            <FieldLabel htmlFor={`${id}-${name}`}>{label}</FieldLabel>
            <Input
              id={`${id}-${name}`}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-invalid={field.state.meta.errors.length > 0 || undefined}
              {...props}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>
    );
  }

  return (
    <PopoverContent
      data-slot="record-popover"
      align="end"
      className="w-80"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        document.getElementById(`${id}-name`)?.focus();
      }}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <FieldGroup className="gap-3">
          {textField('date', 'Date', { type: 'date' })}
          <div className="grid grid-cols-2 gap-2">
            {textField('start', 'Start', { type: 'time' })}
            {textField('stop', 'Stop', { type: 'time', placeholder: running ? 'Running' : '' })}
          </div>
          <form.Field name="projectId">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={`${id}-projectId`}>Project</FieldLabel>
                <Select
                  value={toSelectValue(field.state.value)}
                  onValueChange={(value) => field.handleChange(fromSelectValue(value))}
                >
                  <SelectTrigger id={`${id}-projectId`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No Project</SelectItem>
                    {pickable.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                        {p.archived ? ' (Archived)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>
          {textField('name', 'Name', { placeholder: 'Optional', autoComplete: 'off' })}
        </FieldGroup>
        {warned && (
          <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">
            {PREVIOUS_DAY}
          </p>
        )}
        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div>
            {record && (
              <Button type="button" variant="ghost" size="sm" onClick={removeRecord}>
                {warned ? 'Delete anyway' : 'Delete'}
              </Button>
            )}
          </div>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {record ? (warned ? 'Save anyway' : 'Save') : 'Add Record'}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </PopoverContent>
  );
}

const spanOf = ({ start, stop }: { start: string; stop: string }) => ({ start, stop });
