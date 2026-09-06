import { useId, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import type { Client, Project, ProjectInput } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useClients } from '@/hooks/useClients';
import {
  useArchiveProject,
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUnarchiveProject,
  useUpdateProject,
} from '@/hooks/useProjects';
import { projectFormSchema, projectFormValues, toProjectFields } from '@/lib/projectForm';
import type { ProjectFormValues } from '@/lib/projectForm';
import { cn } from '@/lib/utils';
import { recordsWarning } from '@/lib/format';
import { DeleteButton } from './DeleteButton';

type ProjectFields = Omit<ProjectInput, 'workspaceId'>;

export function ProjectsSection({ workspaceId }: { workspaceId: string }) {
  const projects = useProjects({ workspaceId });
  const clients = useClients(workspaceId);
  const [editing, setEditing] = useState<string | null>(null);
  const create = useCreateProject();
  const update = useUpdateProject();
  const archive = useArchiveProject();
  const unarchive = useUnarchiveProject();
  const remove = useDeleteProject();
  const clientName = (id: string | null) => clients.data?.find((c) => c.id === id)?.name;

  return (
    <Card data-slot="projects-section">
      <CardHeader>
        <CardTitle>Projects</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {projects.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No Projects in this Workspace yet.</p>
        )}
        <ul className="flex flex-col gap-1">
          {projects.data?.map((project) =>
            editing === project.id ? (
              <li key={project.id}>
                <ProjectForm
                  initial={project}
                  clients={clients.data ?? []}
                  submitLabel="Save"
                  onSubmit={async (fields) => {
                    await update.mutateAsync({ id: project.id, ...fields });
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li
                key={project.id}
                className={cn('flex items-center gap-1', project.archived && 'opacity-60')}
                data-archived={project.archived || undefined}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: project.color }}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{project.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[
                      clientName(project.clientId),
                      project.rate !== null ? `${project.rate}/h` : 'Unpaid',
                      project.archived ? 'Archived' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  onClick={() => setEditing(project.id)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  onClick={() =>
                    project.archived
                      ? unarchive.mutate({ id: project.id })
                      : archive.mutate({ id: project.id })
                  }
                >
                  {project.archived ? 'Unarchive' : 'Archive'}
                </Button>
                <DeleteButton
                  title={`Delete ${project.name}?`}
                  describe={async () =>
                    `${recordsWarning(await window.timeStop.countRecords({ projectId: project.id }), 'This Project')} They keep their Workspace and lose the Project.`
                  }
                  onConfirm={() => remove.mutate({ id: project.id })}
                />
              </li>
            ),
          )}
        </ul>
        <ProjectForm
          key={workspaceId}
          clients={clients.data ?? []}
          submitLabel="Add Project"
          onSubmit={async (fields) => {
            await create.mutateAsync({ workspaceId, ...fields });
          }}
        />
      </CardContent>
    </Card>
  );
}

interface ProjectFormProps {
  initial?: Project;
  clients: Client[];
  submitLabel: string;
  onSubmit: (fields: ProjectFields) => Promise<void>;
  onCancel?: () => void;
}

function ProjectForm({ initial, clients, submitLabel, onSubmit, onCancel }: ProjectFormProps) {
  const id = useId();
  const form = useForm({
    defaultValues: projectFormValues(initial),
    validators: { onSubmit: projectFormSchema },
    onSubmit: async ({ value, formApi }) => {
      await onSubmit(toProjectFields(value));
      formApi.reset();
    },
  });

  function textField(
    name: Exclude<keyof ProjectFormValues, 'limitPeriod'>,
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
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-2">
        {textField('name', 'Name')}
        <form.Field name="clientId">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={`${id}-clientId`}>Client</FieldLabel>
              <NativeSelect
                id={`${id}-clientId`}
                className="w-full"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              >
                <NativeSelectOption value="">No Client</NativeSelectOption>
                {clients.map((client) => (
                  <NativeSelectOption key={client.id} value={client.id}>
                    {client.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
        </form.Field>
        {textField('rate', 'Rate per hour', { inputMode: 'decimal', placeholder: 'Unpaid' })}
        <div className="grid grid-cols-3 gap-2">
          {textField('limitMin', 'Min hours', { inputMode: 'decimal' })}
          {textField('limitMax', 'Max hours', { inputMode: 'decimal' })}
          <form.Field name="limitPeriod">
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
                <FieldLabel htmlFor={`${id}-limitPeriod`}>Period</FieldLabel>
                <NativeSelect
                  id={`${id}-limitPeriod`}
                  className="w-full"
                  value={field.state.value}
                  onChange={(event) =>
                    field.handleChange(event.target.value as ProjectFormValues['limitPeriod'])
                  }
                  aria-invalid={field.state.meta.errors.length > 0 || undefined}
                >
                  <NativeSelectOption value="">None</NativeSelectOption>
                  <NativeSelectOption value="week">Week</NativeSelectOption>
                  <NativeSelectOption value="month">Month</NativeSelectOption>
                </NativeSelect>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {textField('startDate', 'Start', { type: 'date' })}
          {textField('endDate', 'End', { type: 'date' })}
        </div>
        {textField('color', 'Color', { type: 'color', className: 'p-1' })}
      </FieldGroup>
      <div className="flex gap-2">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {submitLabel}
            </Button>
          )}
        </form.Subscribe>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
