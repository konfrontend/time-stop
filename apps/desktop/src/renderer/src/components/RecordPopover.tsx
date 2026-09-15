import { useId, useRef, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { dayStart } from '@time-stop/domain';
import type { Project, Record } from '@time-stop/domain';
import { ProjectCombobox } from '@/components/ProjectCombobox';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { FormFooter } from '@/components/ui/FormFooter';
import type { SaveAlert } from '@/components/ui/FormFooter';
import { PopoverContent } from '@/components/ui/popover';
import { TimePicker } from '@/components/ui/TimePicker';
import {
  useCreateRecord,
  useDeleteRecord,
  useRecentNames,
  useUpdateRecord,
} from '@/hooks/useDashboard';
import { recordFormSchema, recordFormValues, toRecordFields } from '@/lib/recordForm';
import { messageOf } from '@/lib/messageOf';

interface RecordPopoverProps {
  // An existing Record to edit or delete; absent when entering a new one.
  record: Record | undefined;
  // Where a new Record lands; an existing one stays in its own.
  workspaceId: string;
  projects: Project[];
  today: string;
  // Prefill of a new Record: its Project and span as clock text.
  defaults?: { projectId: string | null; start: string; stop: string } | undefined;
  align?: 'start' | 'center' | 'end';
  onClose: () => void;
}

const PREVIOUS_DAY = 'This Record is from a previous day.';

/** The Record form, as the content of a Popover: adds a Record, or edits or deletes one. */
export function RecordPopover({
  record,
  workspaceId,
  projects,
  today,
  defaults,
  align = 'end',
  onClose,
}: RecordPopoverProps) {
  const id = useId();
  const running = record?.stop === null;
  const previousDay = record !== undefined && dayStart(record.start) !== today;
  // Set once the previous-day warning is confirmed, for the submit it re-runs.
  const confirmed = useRef(false);
  const [alert, setAlert] = useState<SaveAlert | null>(null);
  const create = useCreateRecord();
  const update = useUpdateRecord();
  const remove = useDeleteRecord();

  const form = useForm({
    defaultValues: record
      ? recordFormValues({ record })
      : {
          ...recordFormValues({ day: today, projectId: defaults?.projectId ?? null }),
          start: defaults?.start ?? '',
          stop: defaults?.stop ?? '',
        },
    validators: { onSubmit: recordFormSchema(running) },
    onSubmit: async ({ value }) => {
      if (previousDay && !confirmed.current) {
        setAlert({ note: PREVIOUS_DAY, onConfirm: saveAnyway });
        return;
      }
      const fields = toRecordFields(value);
      try {
        if (record) await update.mutateAsync({ id: record.id, ...fields });
        else if (fields.stop === null) throw new Error('Enter a stop time');
        else await create.mutateAsync({ ...fields, stop: fields.stop, workspaceId });
        onClose();
      } catch (error) {
        setAlert({ failures: [messageOf(error)] });
      }
    },
  });

  function saveAnyway(): void {
    confirmed.current = true;
    setAlert(null);
    void form.handleSubmit();
  }

  const projectId = useStore(form.store, (state) => state.values.projectId);
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const names = useRecentNames(projectId || null);

  // Archived Projects are hidden, except the one the Record already sits in.
  const pickable = projects.filter((p) => !p.archived || p.id === record?.projectId);

  const invalid = (errors: unknown[]) => errors.length > 0 || undefined;

  return (
    <PopoverContent
      data-slot="record-popover"
      align={align}
      collisionPadding={8}
      className="max-h-(--radix-popover-content-available-height) w-80 overflow-y-auto"
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
          <form.Field name="projectId">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={`${id}-projectId`}>Project</FieldLabel>
                <ProjectCombobox
                  id={`${id}-projectId`}
                  workspaceId={record?.workspaceId ?? workspaceId}
                  projects={pickable}
                  value={field.state.value || null}
                  onChange={(next) => field.handleChange(next ?? '')}
                  variant="outline"
                  align="start"
                  className="w-full"
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="name">
            {(field) => {
              const query = field.state.value.trim().toLowerCase();
              return (
                <Field data-invalid={invalid(field.state.meta.errors)}>
                  <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
                  <Autocomplete
                    id={`${id}-name`}
                    value={field.state.value}
                    options={(names.data ?? []).filter(
                      (name) => name.toLowerCase().includes(query) && name !== field.state.value,
                    )}
                    onValueChange={field.handleChange}
                    onPick={field.handleChange}
                    onBlur={field.handleBlur}
                    aria-invalid={invalid(field.state.meta.errors)}
                    placeholder="Optional — can be filled in later"
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              );
            }}
          </form.Field>
          <form.Field name="date">
            {(field) => (
              <Field data-invalid={invalid(field.state.meta.errors)}>
                <FieldLabel htmlFor={`${id}-date`}>Date</FieldLabel>
                <DatePicker
                  id={`${id}-date`}
                  value={field.state.value}
                  onChange={field.handleChange}
                  aria-invalid={invalid(field.state.meta.errors)}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
          <div className="grid grid-cols-2 gap-2">
            {(['start', 'stop'] as const).map((name) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <Field data-invalid={invalid(field.state.meta.errors)}>
                    <FieldLabel htmlFor={`${id}-${name}`}>
                      {name === 'start' ? 'Start' : 'Stop'}
                    </FieldLabel>
                    <TimePicker
                      id={`${id}-${name}`}
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      aria-invalid={invalid(field.state.meta.errors)}
                      placeholder={name === 'stop' && running ? 'Running' : undefined}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>
            ))}
          </div>
        </FieldGroup>
        <FormFooter
          submitting={submitting}
          onCancel={onClose}
          alert={alert}
          onAlertClose={() => setAlert(null)}
          danger={
            record && {
              describe: async () => (previousDay ? PREVIOUS_DAY : 'Delete this Record?'),
              onDelete: async () => {
                await remove.mutateAsync({ id: record.id });
                onClose();
              },
            }
          }
        />
      </form>
    </PopoverContent>
  );
}
