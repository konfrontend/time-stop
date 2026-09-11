import { useId, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { workspaceInputSchema } from '@time-stop/domain';
import type { Workspace, WorkspaceInput } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useCreateWorkspace, useDeleteWorkspace, useUpdateWorkspace } from '@/hooks/useWorkspaces';
import { recordsWarning } from '@/lib/format';
import { DeleteButton } from './DeleteButton';

// Same rules as the API on the text the field holds; the API turns an empty Currency into null.
const workspaceFormSchema = workspaceInputSchema.extend({ currency: z.string().max(20) });

export function WorkspacesSection({ workspaces }: { workspaces: Workspace[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const create = useCreateWorkspace();
  const update = useUpdateWorkspace();
  const remove = useDeleteWorkspace();
  const defaultId = workspaces[0]?.id;

  return (
    <Card data-slot="workspaces-section">
      <CardHeader>
        <CardTitle>Workspaces</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-1">
          {workspaces.map((workspace) =>
            editing === workspace.id ? (
              <li key={workspace.id}>
                <WorkspaceForm
                  initial={workspace}
                  submitLabel="Save"
                  onSubmit={async (input) => {
                    await update.mutateAsync({ id: workspace.id, ...input });
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={workspace.id} className="flex items-center gap-2">
                <span className="flex-1 truncate">
                  {workspace.name}
                  {workspace.currency && (
                    <span className="text-muted-foreground"> {workspace.currency}</span>
                  )}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setEditing(workspace.id)}>
                  Edit
                </Button>
                <DeleteButton
                  title={`Delete ${workspace.name}?`}
                  disabled={workspace.id === defaultId}
                  describe={async () =>
                    `${recordsWarning(await window.timeStop.record.count({ workspaceId: workspace.id }), 'This Workspace')} Its Clients, Projects and Records go with it.`
                  }
                  onConfirm={() => remove.mutate({ id: workspace.id })}
                />
              </li>
            ),
          )}
        </ul>
        <WorkspaceForm
          submitLabel="Add Workspace"
          onSubmit={async (input) => {
            await create.mutateAsync(input);
          }}
        />
      </CardContent>
    </Card>
  );
}

interface WorkspaceFormProps {
  initial?: Workspace;
  submitLabel: string;
  onSubmit: (input: WorkspaceInput) => Promise<void>;
  onCancel?: () => void;
}

function WorkspaceForm({ initial, submitLabel, onSubmit, onCancel }: WorkspaceFormProps) {
  const id = useId();
  const form = useForm({
    defaultValues: { name: initial?.name ?? '', currency: initial?.currency ?? '' },
    validators: { onSubmit: workspaceFormSchema },
    onSubmit: async ({ value, formApi }) => {
      await onSubmit(workspaceInputSchema.parse(value));
      formApi.reset();
    },
  });

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-2">
        <form.Field name="name">
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
              <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
              <Input
                id={`${id}-name`}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={field.state.meta.errors.length > 0 || undefined}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        <form.Field name="currency">
          {(field) => (
            <Field data-invalid={field.state.meta.errors.length > 0 || undefined}>
              <FieldLabel htmlFor={`${id}-currency`}>Currency</FieldLabel>
              <Input
                id={`${id}-currency`}
                className="w-32"
                placeholder="Optional"
                maxLength={20}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={field.state.meta.errors.length > 0 || undefined}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
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
