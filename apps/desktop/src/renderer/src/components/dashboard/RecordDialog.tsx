import { useId, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { dayStart } from '@time-stop/domain';
import type { Context, Record } from '@time-stop/domain';
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
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  useCreateRecord,
  useDeleteRecord,
  useRecentNames,
  useUpdateRecord,
} from '@/hooks/useDashboard';
import { useProjects } from '@/hooks/useProjects';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { recordFormSchema, recordFormValues, toRecordFields } from '@/lib/recordForm';
import type { RecordFormValues } from '@/lib/recordForm';

interface RecordDialogProps {
  // An existing Record to edit or delete; absent when entering a new one.
  record: Record | undefined;
  context: Context;
  today: number;
  onClose: () => void;
}

const PREVIOUS_DAY = 'This Record is from a previous day.';
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Manual entry lives here: the Dashboard adds, edits and deletes; the Tracker only tracks. */
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
  const projects = useProjects({});

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
  const project = pickable.find((p) => p.id === projectId);
  const workspaceId = project?.workspaceId ?? record?.workspaceId ?? context.workspaceId;
  const workspaceName = workspaces.data?.find((w) => w.id === workspaceId)?.name ?? '';
  const workspaceIds = [...new Set(pickable.map((p) => p.workspaceId))];
  const multiWorkspace = workspaceIds.length > 1;
  const projectOptions = (ofWorkspace: string) =>
    pickable
      .filter((p) => p.workspaceId === ofWorkspace)
      .map((p) => (
        <NativeSelectOption key={p.id} value={p.id}>
          {p.name}
          {p.archived ? ' (Archived)' : ''}
        </NativeSelectOption>
      ));

  function textField(
    name: Exclude<keyof RecordFormValues, 'billable' | 'projectId'>,
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
            {textField('date', 'Date', { type: 'date' })}
            <div className="grid grid-cols-2 gap-2">
              {textField('start', 'Start', { type: 'time' })}
              {textField('stop', 'Stop', { type: 'time', placeholder: running ? 'Running' : '' })}
            </div>
            <form.Field name="projectId">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={`${id}-projectId`}>Project</FieldLabel>
                  <NativeSelect
                    id={`${id}-projectId`}
                    className="w-full"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                  >
                    <NativeSelectOption value="">No Project</NativeSelectOption>
                    {multiWorkspace
                      ? workspaceIds.map((wid) => (
                          <NativeSelectOptGroup
                            key={wid}
                            label={workspaces.data?.find((w) => w.id === wid)?.name}
                          >
                            {projectOptions(wid)}
                          </NativeSelectOptGroup>
                        ))
                      : workspaceIds.map((wid) => projectOptions(wid))}
                  </NativeSelect>
                </Field>
              )}
            </form.Field>
            {textField('name', 'Name', {
              placeholder: 'Optional — can be filled in later',
              list: `${id}-names`,
              autoComplete: 'off',
            })}
            <datalist id={`${id}-names`}>
              {names.data?.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            {record && (
              <form.Field name="billable">
                {(field) => (
                  <Field orientation="horizontal">
                    <input
                      id={`${id}-billable`}
                      type="checkbox"
                      checked={field.state.value}
                      onChange={(event) => field.handleChange(event.target.checked)}
                    />
                    <FieldLabel htmlFor={`${id}-billable`}>Billable</FieldLabel>
                  </Field>
                )}
              </form.Field>
            )}
          </FieldGroup>
          <p className="text-xs text-muted-foreground" data-slot="record-dialog-note">
            {record
              ? `Workspace ${workspaceName}; the Rate follows the Project.`
              : `Inherits Workspace ${workspaceName} from the Context. Billable follows the Project’s Rate.`}
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
