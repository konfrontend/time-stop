import { useId, useState } from 'react';
import { useForm, useStore } from '@tanstack/react-form';
import { CalendarRange, Gauge, Gem } from 'lucide-react';
import type { Client, Project, Workspace } from '@time-stop/domain';
import { Aspect } from '@/components/ui/Aspect';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { FormFooter } from '@/components/ui/FormFooter';
import type { SaveAlert } from '@/components/ui/FormFooter';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextField } from '@/components/ui/TextField';
import {
  useArchiveProject,
  useCreateProject,
  useDeleteProject,
  useUnarchiveProject,
  useUpdateProject,
} from '@/hooks/useProjects';
import { recordsWarning } from '@/lib/format';
import { messageOf } from '@/lib/messageOf';
import { projectFormSchema, projectFormValues, toProjectFields } from '@/lib/projectForm';
import type { ProjectFormValues } from '@/lib/projectForm';
import { NONE, fromSelectValue, toSelectValue } from '@/lib/selectValue';

interface ProjectFormProps {
  workspace: Workspace;
  workspaces: Workspace[];
  clients: Client[];
  initial?: Project | undefined;
  onClose: () => void;
}

const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function limitsSummary({ limitMin, limitMax, limitPeriod }: ProjectFormValues): string | null {
  const min = limitMin.trim();
  const max = limitMax.trim();
  if (!min && !max) return null;
  const bounds = min && max ? `${min}–${max}` : min ? `≥ ${min}` : `≤ ${max}`;
  return `${bounds} h${limitPeriod ? ` / ${limitPeriod}` : ''}`;
}

function datesSummary({ startDate, endDate }: ProjectFormValues): string | null {
  if (!startDate && !endDate) return null;
  return `${startDate ? shortDate(startDate) : '…'} – ${endDate ? shortDate(endDate) : '…'}`;
}

const RATE_FIELDS = ['rate'] as const;
const LIMITS_FIELDS = ['limitMin', 'limitMax', 'limitPeriod'] as const;
const DATES_FIELDS = ['startDate', 'endDate'] as const;
const FOLDED_FIELDS = [...RATE_FIELDS, ...LIMITS_FIELDS, ...DATES_FIELDS];

type FieldMeta = Partial<Record<keyof ProjectFormValues, { errors: unknown[] } | undefined>>;

const messagesOf = (meta: FieldMeta, fields: readonly (keyof ProjectFormValues)[]): string[] =>
  fields.flatMap((field) =>
    (meta[field]?.errors ?? []).map((error) => (error as { message?: string }).message ?? ''),
  );

/** Name, Workspace and Client up front; Rate, Limits and Dates folded behind Aspects. */
export function ProjectForm({
  workspace,
  workspaces,
  clients,
  initial,
  onClose,
}: ProjectFormProps) {
  const id = useId();
  const [workspaceId, setWorkspaceId] = useState(workspace.id);
  const [alert, setAlert] = useState<SaveAlert | null>(null);
  const create = useCreateProject();
  const update = useUpdateProject();
  const archive = useArchiveProject();
  const unarchive = useUnarchiveProject();
  const remove = useDeleteProject();
  const moved = workspaceId !== workspace.id;
  const target = workspaces.find((w) => w.id === workspaceId);

  const form = useForm({
    defaultValues: projectFormValues(initial),
    validators: { onSubmit: projectFormSchema },
    // Errors of folded fields are out of sight, so Save lists them.
    onSubmitInvalid: ({ formApi }) => {
      const failures = messagesOf(formApi.state.fieldMeta, FOLDED_FIELDS);
      if (failures.length > 0) setAlert({ failures });
    },
    onSubmit: async ({ value }) => {
      const fields = toProjectFields(value);
      // A move drops the Client: it stays in the old Workspace.
      const input = { ...fields, workspaceId, clientId: moved ? null : fields.clientId };
      try {
        if (initial) await update.mutateAsync({ id: initial.id, ...input });
        else await create.mutateAsync(input);
        onClose();
      } catch (error) {
        setAlert({ failures: [messageOf(error)] });
      }
    },
  });
  const values = useStore(form.store, (state) => state.values);
  const meta = useStore(form.store, (state) => state.fieldMeta);
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const invalid = (fields: readonly (keyof ProjectFormValues)[]) =>
    messagesOf(meta, fields).length > 0;

  // Typing a bound without a Period picks the week, so the Limits are usable as entered.
  const setBound = (value: string) => {
    if (value.trim() && !form.getFieldValue('limitPeriod')) {
      form.setFieldValue('limitPeriod', 'week');
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-3">
        <form.Field name="name">
          {(field) => (
            <TextField
              label="Name"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              errors={field.state.meta.errors}
              autoFocus
              trailing={
                <form.Field name="color">
                  {(color) => (
                    <input
                      type="color"
                      value={color.state.value}
                      onChange={(event) => color.handleChange(event.target.value)}
                      aria-label="Color"
                      className="size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                    />
                  )}
                </form.Field>
              }
            />
          )}
        </form.Field>
        <Field>
          <FieldLabel htmlFor={`${id}-workspace`}>Workspace</FieldLabel>
          <Select value={workspaceId} onValueChange={setWorkspaceId}>
            <SelectTrigger id={`${id}-workspace`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <form.Field name="clientId">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={`${id}-client`}>Client</FieldLabel>
              <Select
                value={moved ? NONE : toSelectValue(field.state.value)}
                onValueChange={(value) => field.handleChange(fromSelectValue(value))}
                disabled={moved}
              >
                <SelectTrigger id={`${id}-client`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No Client</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>
        {moved && (
          <p className="text-xs text-muted-foreground" data-slot="move-note">
            Its Records move to {target?.name}; the Client stays behind.
          </p>
        )}
      </FieldGroup>
      <div className="flex flex-wrap gap-1">
        <Aspect
          icon={<Gem />}
          label="Rate"
          summary={values.rate.trim() ? `${values.rate.trim()}/h` : null}
          invalid={invalid(RATE_FIELDS)}
        >
          <form.Field name="rate">
            {(field) => (
              <TextField
                label="Rate per hour"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                errors={field.state.meta.errors}
                inputMode="decimal"
                placeholder="Unpaid"
                className="w-32"
                autoFocus
              />
            )}
          </form.Field>
        </Aspect>
        <Aspect
          icon={<Gauge />}
          label="Limits"
          summary={limitsSummary(values)}
          invalid={invalid(LIMITS_FIELDS)}
        >
          <div className="grid grid-cols-2 gap-2">
            {(['limitMin', 'limitMax'] as const).map((name) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <TextField
                    label={name === 'limitMin' ? 'Min hours' : 'Max hours'}
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      setBound(event.target.value);
                    }}
                    onBlur={field.handleBlur}
                    errors={field.state.meta.errors}
                    inputMode="decimal"
                    autoFocus={name === 'limitMin'}
                  />
                )}
              </form.Field>
            ))}
          </div>
          <form.Field name="limitPeriod">
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                <FieldLabel htmlFor={`${id}-period`}>Per</FieldLabel>
                <Select
                  value={toSelectValue(field.state.value)}
                  onValueChange={(value) =>
                    field.handleChange(fromSelectValue(value) as ProjectFormValues['limitPeriod'])
                  }
                >
                  <SelectTrigger id={`${id}-period`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </Aspect>
        <Aspect
          icon={<CalendarRange />}
          label="Dates"
          summary={datesSummary(values)}
          invalid={invalid(DATES_FIELDS)}
        >
          <div className="grid grid-cols-2 gap-2">
            {(['startDate', 'endDate'] as const).map((name) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <TextField
                    label={name === 'startDate' ? 'Start' : 'End'}
                    type="date"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    errors={field.state.meta.errors}
                    autoFocus={name === 'startDate'}
                  />
                )}
              </form.Field>
            ))}
          </div>
        </Aspect>
      </div>
      <FormFooter
        submitting={submitting}
        onCancel={onClose}
        alert={alert}
        onAlertClose={() => setAlert(null)}
        danger={
          initial && {
            archive: initial.archived
              ? {
                  label: 'Unarchive',
                  note: 'Back in the pickers.',
                  run: async () => {
                    await unarchive.mutateAsync({ id: initial.id });
                    onClose();
                  },
                }
              : {
                  label: 'Archive',
                  note: 'Hidden from pickers; its Records stay.',
                  run: async () => {
                    await archive.mutateAsync({ id: initial.id });
                    onClose();
                  },
                },
            describe: async () =>
              recordsWarning(
                await window.timeStop.record.count({ projectId: initial.id }),
                'This Project',
                'They keep their Workspace and lose the Project.',
              ),
            onDelete: async () => {
              await remove.mutateAsync({ id: initial.id });
              onClose();
            },
          }
        }
      />
    </form>
  );
}
