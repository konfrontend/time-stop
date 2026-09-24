import { useId, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import type { Project, Record, UpdateRecordInput } from '@app/domain';
import { ProjectCombobox } from '@/components/ProjectCombobox';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { FormFooter } from '@/components/ui/FormFooter';
import type { SaveAlert } from '@/components/ui/FormFooter';
import { PopoverContent } from '@/components/ui/popover';
import { TimePicker } from '@/components/ui/TimePicker';
import { useRecentNames } from '@/hooks/useDashboard';
import { UNTITLED_RECORD } from '@/lib/format';
import { recordFormSchema, recordFormValues, toRecordFields } from '@/lib/recordForm';
import { messageOf } from '@/lib/messageOf';
import { nameSuggestions } from '@/lib/nameSuggestions';

interface RecordPopoverProps {
  // An existing Record to edit or delete; absent when entering a new one.
  record: Record | undefined;
  // Where a Project created from the picker lands, unless the Record sits in a Workspace of its own.
  workspaceId: string;
  projects: Project[];
  today: string;
  // Prefill of a new Record: its Project and span as clock text.
  defaults?: { projectId: string | null; start: string; stop: string } | undefined;
  align?: 'start' | 'center' | 'end';
  // A rejection stays open and shows over Save.
  onSave: (fields: Omit<UpdateRecordInput, 'id'>) => Promise<void>;
  // Absent where the Record cannot be deleted, as for the Timer.
  onDelete?: (() => Promise<void>) | undefined;
  onClose: () => void;
}

/** The Record form, as the content of a Popover: adds a Record, or edits or deletes one. */
export function RecordPopover({
  record,
  workspaceId,
  projects,
  today,
  defaults,
  align = 'end',
  onSave,
  onDelete,
  onClose,
}: RecordPopoverProps) {
  const id = useId();
  const running = record?.stop === null;
  const [alert, setAlert] = useState<SaveAlert | null>(null);

  const form = useForm({
    defaultValues: record
      ? recordFormValues({ record })
      : {
          ...recordFormValues({ day: today, projectId: defaults?.projectId ?? null }),
          start: defaults?.start ?? '',
          stop: defaults?.stop ?? '',
        },
    validators: { onSubmit: recordFormSchema(record) },
    onSubmit: async ({ value }) => {
      try {
        await onSave(toRecordFields(value, record));
        onClose();
      } catch (error) {
        setAlert({ failures: [messageOf(error)] });
      }
    },
  });

  const projectId = useStore(form.store, (state) => state.values.projectId);
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const names = useRecentNames(projectId || null);

  const invalid = (errors: unknown[]) => errors.length > 0 || undefined;

  return (
    <PopoverContent
      data-slot="record-popover"
      editor
      align={align}
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
                  projects={projects}
                  value={field.state.value || null}
                  onChange={(next) => field.handleChange(next ?? '')}
                  align="start"
                  className="h-9 w-full justify-between font-normal"
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="name">
            {(field) => (
              <Field data-invalid={invalid(field.state.meta.errors)}>
                <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
                <Autocomplete
                  id={`${id}-name`}
                  value={field.state.value}
                  options={nameSuggestions(names.data ?? [], field.state.value)}
                  onValueChange={field.handleChange}
                  onPick={field.handleChange}
                  onBlur={field.handleBlur}
                  aria-invalid={invalid(field.state.meta.errors)}
                  placeholder={UNTITLED_RECORD}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
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
            onDelete && {
              describe: async () => 'Delete this Record?',
              onDelete: async () => {
                await onDelete();
                onClose();
              },
            }
          }
        />
      </form>
    </PopoverContent>
  );
}
