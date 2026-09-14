import { useId, useState } from 'react';
import { CalendarRange, Gauge, Gem } from 'lucide-react';
import type { Client, Project, Workspace } from '@time-stop/domain';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useArchiveProject,
  useCreateProject,
  useDeleteProject,
  useUnarchiveProject,
  useUpdateProject,
} from '@/hooks/useProjects';
import { fieldErrors } from '@/lib/fieldErrors';
import { recordsWarning } from '@/lib/format';
import { messageOf } from '@/lib/messageOf';
import { projectFormSchema, projectFormValues, toProjectFields } from '@/lib/projectForm';
import type { ProjectFormValues } from '@/lib/projectForm';
import { NONE, fromSelectValue, toSelectValue } from '@/lib/selectValue';
import { Aspect } from './Aspect';
import { FormFooter } from './FormFooter';
import { TextField } from './TextField';

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

/** Name, Workspace and Client up front; Rate, Limits and Dates folded behind Aspects. */
export function ProjectForm({
  workspace,
  workspaces,
  clients,
  initial,
  onClose,
}: ProjectFormProps) {
  const id = useId();
  const [values, setValues] = useState<ProjectFormValues>(() => projectFormValues(initial));
  const [workspaceId, setWorkspaceId] = useState(workspace.id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const create = useCreateProject();
  const update = useUpdateProject();
  const archive = useArchiveProject();
  const unarchive = useUnarchiveProject();
  const remove = useDeleteProject();
  const moved = workspaceId !== workspace.id;
  const target = workspaces.find((w) => w.id === workspaceId);

  const set = <Key extends keyof ProjectFormValues>(key: Key, value: ProjectFormValues[Key]) =>
    setValues((current) => ({ ...current, [key]: value }));

  // Typing a bound without a Period picks the week, so the Limits are usable as entered.
  const setBound = (key: 'limitMin' | 'limitMax', value: string) =>
    setValues((current) => ({
      ...current,
      [key]: value,
      limitPeriod: current.limitPeriod || (value.trim() ? 'week' : current.limitPeriod),
    }));

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const parsed = projectFormSchema.safeParse(values);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    const fields = toProjectFields(values);
    // A move drops the Client: it stays in the old Workspace.
    const input = { ...fields, workspaceId, clientId: moved ? null : fields.clientId };
    try {
      if (initial) await update.mutateAsync({ id: initial.id, ...input });
      else await create.mutateAsync(input);
      onClose();
    } catch (error) {
      setFailure(messageOf(error));
    }
  }

  const errorsOf = (fields: readonly string[]) =>
    fields.map((field) => errors[field]).filter((message) => message !== undefined);
  const hiddenErrors = errorsOf([...RATE_FIELDS, ...LIMITS_FIELDS, ...DATES_FIELDS]);

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
      <FieldGroup className="gap-3">
        <TextField
          label="Name"
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          error={errors['name']}
          autoFocus
          trailing={
            <input
              type="color"
              value={values.color}
              onChange={(event) => set('color', event.target.value)}
              aria-label="Color"
              className="size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
            />
          }
        />
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
        <Field>
          <FieldLabel htmlFor={`${id}-client`}>Client</FieldLabel>
          <Select
            value={moved ? NONE : toSelectValue(values.clientId)}
            onValueChange={(value) => set('clientId', fromSelectValue(value))}
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
          invalid={errorsOf(RATE_FIELDS).length > 0}
        >
          <TextField
            label="Rate per hour"
            value={values.rate}
            onChange={(event) => set('rate', event.target.value)}
            error={errors['rate']}
            inputMode="decimal"
            placeholder="Unpaid"
            className="w-32"
            autoFocus
          />
        </Aspect>
        <Aspect
          icon={<Gauge />}
          label="Limits"
          summary={limitsSummary(values)}
          invalid={errorsOf(LIMITS_FIELDS).length > 0}
        >
          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="Min hours"
              value={values.limitMin}
              onChange={(event) => setBound('limitMin', event.target.value)}
              error={errors['limitMin']}
              inputMode="decimal"
              autoFocus
            />
            <TextField
              label="Max hours"
              value={values.limitMax}
              onChange={(event) => setBound('limitMax', event.target.value)}
              error={errors['limitMax']}
              inputMode="decimal"
            />
          </div>
          <Field data-invalid={errors['limitPeriod'] !== undefined || undefined}>
            <FieldLabel htmlFor={`${id}-period`}>Per</FieldLabel>
            <Select
              value={toSelectValue(values.limitPeriod)}
              onValueChange={(value) =>
                set('limitPeriod', fromSelectValue(value) as ProjectFormValues['limitPeriod'])
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
          </Field>
        </Aspect>
        <Aspect
          icon={<CalendarRange />}
          label="Dates"
          summary={datesSummary(values)}
          invalid={errorsOf(DATES_FIELDS).length > 0}
        >
          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="Start"
              type="date"
              value={values.startDate}
              onChange={(event) => set('startDate', event.target.value)}
              error={errors['startDate']}
              autoFocus
            />
            <TextField
              label="End"
              type="date"
              value={values.endDate}
              onChange={(event) => set('endDate', event.target.value)}
              error={errors['endDate']}
            />
          </div>
        </Aspect>
      </div>
      {hiddenErrors.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {hiddenErrors.join(' · ')}
        </p>
      )}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      <FormFooter
        submitting={create.isPending || update.isPending}
        onCancel={onClose}
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
              `${recordsWarning(await window.timeStop.record.count({ projectId: initial.id }), 'This Project')} They keep their Workspace and lose the Project.`,
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
