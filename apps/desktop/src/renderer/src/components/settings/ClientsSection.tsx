import { useId, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { updateClientInputSchema } from '@time-stop/domain';
import type { Client } from '@time-stop/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useClients, useCreateClient, useDeleteClient, useUpdateClient } from '@/hooks/useClients';
import { DeleteButton } from './DeleteButton';

const nameSchema = updateClientInputSchema.pick({ name: true });

export function ClientsSection({ workspaceId }: { workspaceId: string }) {
  const clients = useClients(workspaceId);
  const [editing, setEditing] = useState<string | null>(null);
  const create = useCreateClient();
  const update = useUpdateClient();
  const remove = useDeleteClient();

  return (
    <Card data-slot="clients-section">
      <CardHeader>
        <CardTitle>Clients</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {clients.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No Clients in this Workspace yet.</p>
        )}
        <ul className="flex flex-col gap-1">
          {clients.data?.map((client) =>
            editing === client.id ? (
              <li key={client.id}>
                <ClientForm
                  initial={client}
                  submitLabel="Save"
                  onSubmit={async (name) => {
                    await update.mutateAsync({ id: client.id, name });
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={client.id} className="flex items-center gap-2">
                <span className="flex-1 truncate">{client.name}</span>
                <Button variant="ghost" size="sm" onClick={() => setEditing(client.id)}>
                  Edit
                </Button>
                <DeleteButton
                  title={`Delete ${client.name}?`}
                  describe={async () => 'Its Projects stay and lose the Client.'}
                  onConfirm={() => remove.mutate({ id: client.id })}
                />
              </li>
            ),
          )}
        </ul>
        <ClientForm
          key={workspaceId}
          submitLabel="Add Client"
          onSubmit={async (name) => {
            await create.mutateAsync({ workspaceId, name });
          }}
        />
      </CardContent>
    </Card>
  );
}

interface ClientFormProps {
  initial?: Client;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel?: () => void;
}

function ClientForm({ initial, submitLabel, onSubmit, onCancel }: ClientFormProps) {
  const id = useId();
  const form = useForm({
    defaultValues: { name: initial?.name ?? '' },
    validators: { onSubmit: nameSchema },
    onSubmit: async ({ value, formApi }) => {
      await onSubmit(nameSchema.parse(value).name);
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
