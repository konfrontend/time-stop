import { useId, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { dayStart } from '@time-stop/domain';
import type { Context, Record } from '@time-stop/domain';
import { DatePicker } from '@/components/form/DatePicker';
import { ProjectCombobox } from '@/components/form/ProjectCombobox';
import { TimePicker } from '@/components/form/TimePicker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  useCreateRecord,
  useDeleteRecord,
  useRecentNames,
  useUpdateRecord,
} from '@/hooks/useDashboard';
import { useProjects } from '@/hooks/useProjects';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { recordFormSchema, recordFormValues, toRecordFields } from '@/lib/recordForm';

interface RecordDialogProps {
  // An existing Record to edit or delete; absent when entering a new one.
  record: Record | undefined;
  context: Context;
  today: string;
  onClose: () => void;
}

const PREVIOUS_DAY = 'This Record is from a previous day.';
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The full Record form: the Dashboard adds, edits and deletes here; the row edits the Name. */
export function RecordDialog({ record, context, today, onClose }: RecordDialogProps) {
  const id = useId();
  const running = record?.stop === null;
  const previousDay = record !== undefined && dayStart(record.start) !== today;
  const [warned, setWarned] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const create = useCreateRecord();
  const update = useUpdateRecord();
  const remove = useDeleteRecord();
  const workspaces = useWorkspaces();
  // A Record stays in its Workspace; a new one lands in the Context's.
  const workspaceId = record?.workspaceId ?? context.workspaceId;
  const projects = useProjects({ workspaceId });
  const workspaceName = workspaces.data?.find((w) => w.id === workspaceId)?.name ?? '';

  const form = useForm({
    defaultValues: record
      ? recordFormValues({ record })
      : recordFormValues({ day: today, projectId: context.projectId }),
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
  const projectId = useStore(form.store, (state) => state.values.projectId);
  const names = useRecentNames(projectId || null);

  // Archived Projects are hidden, except the one the Record already sits in.
  const pickable = projects.data?.filter((p) => !p.archived || p.id === record?.projectId) ?? [];

  const invalid = (errors: unknown[]) => errors.length > 0 || undefined;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-slot="record-dialog">
        <DialogHeader>
          <DialogTitle>{record ? 'Edit Record' : 'Add Record'}</DialogTitle>
          <DialogDescription>
            {record ? 'Fix the Record’s span, Project or Name.' : 'Enter a Record by hand.'}
          </DialogDescription>
        </DialogHeader>
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
                    workspaceId={workspaceId}
                    projects={pickable}
                    value={field.state.value || null}
                    onChange={(projectId) => field.handleChange(projectId ?? '')}
                    variant="outline"
                    align="start"
                    className="w-full"
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="name">
              {(field) => (
                <Field data-invalid={invalid(field.state.meta.errors)}>
                  <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
                  <Input
                    id={`${id}-name`}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={invalid(field.state.meta.errors)}
                    placeholder="Optional — can be filled in later"
                    list={`${id}-names`}
                    autoComplete="off"
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <datalist id={`${id}-names`}>
              {names.data?.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
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
          <p className="text-xs text-muted-foreground" data-slot="record-dialog-note">
            Workspace {workspaceName}; Rate and Billable follow the Project.
          </p>
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
          <DialogFooter className="flex-row justify-between">
            <div>
              {record && (
                <Button type="button" variant="ghost" onClick={removeRecord}>
                  {warned ? 'Delete anyway' : 'Delete'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button type="submit" disabled={isSubmitting}>
                    {record ? (warned ? 'Save anyway' : 'Save') : 'Add Record'}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
